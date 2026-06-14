import fs from "fs";
import path from "path";

const KB_DIR = process.env.KB_DIR ??
  "./knowledge";

/** Load the full 数字分身规范.md as the base system prompt */
export function loadSystemPrompt(): string {
  try {
    const p = path.join(KB_DIR, "数字分身规范.md");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  } catch {}
  return "你是 Kyle 的数字分身。以第一人称回答。只基于知识库中的事实回答，不编造。绝不提及真名。";
}

export interface RagChunk {
  heading: string;
  content: string;
  embedding?: number[];
}

interface RagIndex {
  version: number;
  model?: string;
  dimensions?: number;
  chunks: RagChunk[];
}

let _indexCache: RagIndex | null = null;

/** Load RAG index from public/ (cached in memory) */
export function loadRagIndex(): RagIndex {
  if (_indexCache) return _indexCache;
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "public", "rag-index.json"),
      "utf-8"
    );
    _indexCache = JSON.parse(raw);
    return _indexCache!;
  } catch {
    return { version: 0, chunks: [] };
  }
}

/** Cosine similarity between two normalized vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Resolve the local model path from bundled files.
 * On Vercel, public/ is deployed with the project and accessible via fs.
 * If bundled files exist, use them (no network download needed).
 * Otherwise fall back to HuggingFace download.
 */
function resolveModelPath(): string | null {
  const localPath = path.join(
    process.cwd(),
    "public",
    "models",
    "Xenova",
    "all-MiniLM-L6-v2"
  );
  if (fs.existsSync(path.join(localPath, "onnx", "model_quantized.onnx"))) {
    return localPath;
  }
  return null;
}

// Cache the pipeline instance across invocations within the same serverless function
let _pipelineInstance: Awaited<
  ReturnType<typeof import("@xenova/transformers").pipeline>
> | null = null;
let _pipelineReady = false;

/** Get or initialize the embedding pipeline (cached across invocations) */
async function getEmbeddingPipeline() {
  if (_pipelineInstance) return _pipelineInstance;

  const { env, pipeline } = await import("@xenova/transformers");

  // Vercel serverless: write model cache to /tmp (only writable dir)
  env.cacheDir = "/tmp/transformers-cache";

  const localPath = resolveModelPath();
  const modelId = localPath ?? "Xenova/all-MiniLM-L6-v2";

  if (localPath) {
    console.log("[RAG] Loading embedding model from bundled files (no download)");
  } else {
    console.log("[RAG] Loading embedding model from HuggingFace (will download ~23MB)");
  }

  _pipelineInstance = await pipeline("feature-extraction", modelId);
  _pipelineReady = true;
  console.log("[RAG] Embedding model ready");
  return _pipelineInstance;
}

/**
 * Warm up the embedding model — call during scroll phase so the model
 * is loaded before the user sends their first chat message.
 * Returns true if warmup succeeded.
 */
export async function warmupEmbedder(): Promise<boolean> {
  try {
    await getEmbeddingPipeline();
    return true;
  } catch (err) {
    console.warn("[RAG] Warmup failed:", err);
    return false;
  }
}

/** Embed a single query text using the local transformers model */
async function embedQuery(text: string): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractor = (await getEmbeddingPipeline()) as any;
  const output = (await extractor(text, {
    pooling: "mean",
    normalize: true,
  })) as import("@xenova/transformers").Tensor;
  return Array.from(output.data) as number[];
}

/**
 * Segment a query string into meaningful keywords.
 * Uses Intl.Segmenter for CJK word segmentation (Node.js 16+),
 * falls back to whitespace/punctuation splitting for non-CJK.
 */
function segmentQuery(query: string): string[] {
  // Try Intl.Segmenter for proper CJK word segmentation
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
    const segments = [...segmenter.segment(query)];
    return segments
      .filter((s) => s.isWordLike)
      .map((s) => s.segment.toLowerCase())
      .filter((k) => k.length > 0);
  }

  // Fallback: split on whitespace and CJK punctuation
  return query
    .toLowerCase()
    .split(/[\s,，。！？、；：""''（）\?　]+/)
    .filter((k: string) => k.length > 0);
}

/**
 * Hybrid RAG search: combine semantic embedding similarity with keyword matching.
 * - Semantic search: embed query, cosine similarity → base scores
 * - Keyword search: word-segmented matching → multiplicative boost
 * - Chunks that match keywords get a significant score boost,
 *   so facts like "电影" always surface when the query mentions 电影/影片.
 * Falls back to pure keyword search if embedding fails or index is v2.
 */
export async function searchRagIndex(
  index: RagIndex,
  query: string,
  topK: number = 8
): Promise<RagChunk[]> {
  if (!index.chunks || index.chunks.length === 0 || !query.trim()) {
    return [];
  }

  const hasEmbeddings = index.chunks[0]?.embedding?.length;

  if (hasEmbeddings) {
    try {
      const queryVec = await embedQuery(query);
      const keywords = segmentQuery(query);

      // --- Combined scoring: semantic base + keyword boost ---
      const scored = index.chunks.map((c) => {
        const semScore = c.embedding ? cosineSimilarity(queryVec, c.embedding) : 0;

        // Count keyword hits (each keyword independently)
        const text = (c.heading + " " + c.content).toLowerCase();
        const hits = keywords.reduce(
          (s: number, k: string) => s + (text.includes(k) ? 1 : 0),
          0
        );

        // Multiplicative boost: each keyword hit multiplies score by 1.5
        const keywordBoost = Math.pow(1.5, hits);
        const score = semScore * keywordBoost;

        return { ...c, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK);
    } catch (err) {
      console.warn("[RAG] Embedding failed, falling back to keyword search:", err);
      // Fall through to keyword search
    }
  }

  // v2 fallback: keyword matching with segmentation
  const keywords = segmentQuery(query);

  const scored = index.chunks.map((c) => {
    const text = (c.heading + " " + c.content).toLowerCase();
    const score = keywords.reduce(
      (s: number, k: string) => s + (text.includes(k) ? 1 : 0),
      0
    );
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
