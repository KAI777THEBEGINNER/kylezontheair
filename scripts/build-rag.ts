/**
 * Build RAG index from the digital Kai knowledge base.
 * Excludes 数字分身规范.md (system prompt) and 对话起点库.md (UI questions).
 * However, factual tables from 数字分身规范.md are extracted and indexed,
 * so that queries like "你喜欢的电影" can be semantically matched.
 * Now with semantic embeddings via @xenova/transformers.
 * Run: npx tsx scripts/build-rag.ts
 */

import fs from "fs";
import path from "path";

const KB_DIR = process.env.KB_DIR ?? "./knowledge";

const EXCLUDE = new Set(["数字分身规范.md", "对话起点库.md", "digital-avatar-config.md"]);

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Extract factual data from 数字分身规范.md for RAG indexing.
 * Each table row becomes its own chunk so that embedding vectors
 * are focused on one fact each — avoiding dilution in large tables.
 * Only factual tables are extracted; behavioral rules stay as system prompt.
 */
function extractFactsFromSpec(text: string): Chunk[] {
  const chunks: Chunk[] = [];

  // --- Parse markdown tables: each row → one chunk ---
  const tableRowRegex = /^\|(.+)\|$/;

  // Section 2.2: 身份事实锁 — extract identity table rows
  const identitySection = text.match(
    /### 2\.2 身份事实锁[\s\S]*?(?=\n### |\n## )/
  );
  if (identitySection) {
    // Extract the intro line + table rows
    const lines = identitySection[0].split("\n");
    let headerRow = "";
    for (const line of lines) {
      const m = line.match(tableRowRegex);
      if (!m) continue;
      const cells = m[1].split("|").map((c: string) => c.trim());
      // Skip separator rows like |---|---|
      if (cells.every((c: string) => /^[-:\s]+$/.test(c))) continue;
      if (!headerRow) {
        headerRow = cells.join(" ｜ ");
        continue; // first row is the header
      }
      // Data row: combine with header context
      const dimension = cells[0] || "";
      const fact = cells.slice(1).join(" ｜ ");
      if (dimension && fact) {
        chunks.push({
          heading: `身份事实：${dimension}`,
          content: `${dimension}：${fact}`,
        });
      }
    }
  }

  // Section 2.2A: 时间线锁 — keep as one chunk (already concise)
  const timelineSection = text.match(
    /### 2\.2A · 时间线锁[\s\S]*?(?=\n### |\n## )/
  );
  if (timelineSection) {
    chunks.push({
      heading: "时间线锁",
      content: timelineSection[0].trim(),
    });
  }

  // Section 2.2B: 个人兴趣事实 — extract table rows
  const interestSection = text.match(
    /### 2\.2B · 个人兴趣事实[\s\S]*?(?=\n### |\n## )/
  );
  if (interestSection) {
    const sectionText = interestSection[0];
    const lines = sectionText.split("\n");
    let headerRow = "";
    for (const line of lines) {
      const m = line.match(tableRowRegex);
      if (!m) continue;
      const cells = m[1].split("|").map((c: string) => c.trim());
      if (cells.every((c: string) => /^[-:\s]+$/.test(c))) continue;
      if (!headerRow) {
        headerRow = cells.join(" ｜ ");
        continue;
      }
      const category = cells[0] || "";
      const fact = cells.slice(1).join(" ｜ ");
      if (category && fact) {
        chunks.push({
          heading: `个人兴趣：${category}`,
          content: `${category}：${fact}`,
        });
      }
    }
    // Also capture the "规则" and "电影话题回答示例" text after the table
    const rulesMatch = sectionText.match(/\*\*规则\*\*：[\s\S]*$/);
    if (rulesMatch) {
      chunks.push({
        heading: "个人兴趣回答规则",
        content: rulesMatch[0].trim(),
      });
    }
  }

  // Section 2.6: 案例数量锁 — extract table rows
  const caseLockSection = text.match(
    /### 2\.6 案例数量锁[\s\S]*?(?=\n### |\n## )/
  );
  if (caseLockSection) {
    const lines = caseLockSection[0].split("\n");
    let headerRow = "";
    for (const line of lines) {
      const m = line.match(tableRowRegex);
      if (!m) continue;
      const cells = m[1].split("|").map((c: string) => c.trim());
      if (cells.every((c: string) => /^[-:\s]+$/.test(c))) continue;
      if (!headerRow) {
        headerRow = cells.join(" ｜ ");
        continue;
      }
      const category = cells[0] || "";
      const fact = cells.slice(1).join(" ｜ ");
      if (category && fact) {
        chunks.push({
          heading: `案例数量锁：${category}`,
          content: `${category}：${fact}`,
        });
      }
    }
  }

  return chunks;
}

interface Chunk {
  heading: string;
  content: string;
}

interface EmbeddedChunk extends Chunk {
  embedding: number[];
}

function splitByHeadings(text: string, maxChunkSize = 1000): Chunk[] {
  const lines = text.split("\n");
  const chunks: Chunk[] = [];
  let currentHeading = "";
  let buffer = "";

  const flush = () => {
    const trimmed = buffer.trim();
    if (!trimmed) return;
    chunks.push({ heading: currentHeading, content: trimmed });
    if (buffer.length > 200) {
      buffer = buffer.slice(-200);
    } else {
      buffer = "";
    }
  };

  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flush();
      currentHeading = h[2].trim();
      buffer = line + "\n";
    } else {
      buffer += line + "\n";
      if (buffer.length >= maxChunkSize) {
        flush();
      }
    }
  }
  flush();
  return chunks;
}

/** Embed a batch of texts, returning normalized vectors */
async function embedBatch(texts: string[]): Promise<number[][]> {
  // Use HF mirror for model download (hf-mirror.com is accessible from China)
  const { env } = await import("@xenova/transformers");
  env.remoteHost = "https://hf-mirror.com/";
  env.remotePathTemplate = "{model}/resolve/{revision}/";

  const { pipeline } = await import("@xenova/transformers");
  const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL);

  const embeddings: number[][] = [];
  // Process one at a time — all-MiniLM is small and batching in pipeline
  // doesn't help much; processing sequentially avoids OOM on large batches.
  for (const text of texts) {
    const output = await extractor(text, { pooling: "mean", normalize: true });
    embeddings.push(Array.from(output.data) as number[]);
  }
  return embeddings;
}

async function main() {
  if (!fs.existsSync(KB_DIR)) {
    console.log(
      `⚠️ Knowledge base directory not found: ${KB_DIR} — skipping RAG index rebuild (using existing public/rag-index.json)`
    );
    return;
  }

  const files = fs
    .readdirSync(KB_DIR)
    .filter((f) => f.endsWith(".md") && !EXCLUDE.has(f))
    .sort();

  console.log(`📂 Loading ${files.length} files: ${files.join(", ")}`);

  const allChunks: Chunk[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(KB_DIR, file), "utf-8");
    const chunks = splitByHeadings(raw);
    console.log(`  ${file}: ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }

  // Extract factual tables from 数字分身规范.md for RAG retrieval
  const specPath = path.join(KB_DIR, "数字分身规范.md");
  if (fs.existsSync(specPath)) {
    const specText = fs.readFileSync(specPath, "utf-8");
    const factChunks = extractFactsFromSpec(specText);
    console.log(`  数字分身规范.md (facts only): ${factChunks.length} chunks`);
    allChunks.push(...factChunks);
  }

  console.log(`\n🧠 Embedding ${allChunks.length} chunks with ${EMBEDDING_MODEL}...`);
  console.log("   (first run downloads the model ~23MB, subsequent runs are instant)\n");

  // Build text representations: prepend heading for better semantic context
  const texts = allChunks.map((c) =>
    c.heading ? `${c.heading}\n${c.content}` : c.content
  );

  const startTime = Date.now();
  const embeddings = await embedBatch(texts);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const embeddedChunks: EmbeddedChunk[] = allChunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i],
  }));

  const dimensions = embeddings[0]?.length ?? 0;

  const outPath = path.join(process.cwd(), "data", "rag-index.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        version: 3,
        model: EMBEDDING_MODEL,
        dimensions,
        chunks: embeddedChunks,
      },
      null,
      2
    )
  );

  const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(1);
  console.log(
    `✅ Embedded ${embeddedChunks.length} chunks (${dimensions}d) in ${elapsed}s → public/rag-index.json (${sizeMB}MB)`
  );
}

main();
