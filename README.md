# kylezontheair

> Personal digital avatar website — scroll-driven frame animation background with an AI chatbot interface at the bottom.

> 个人数字分身网站——滚动驱动序列帧动画背景，底部集成 AI 对话界面。

## Tech Stack / 技术栈

| Layer | Tech |
|-------|------|
| Framework | [Next.js 16](https://github.com/vercel/next.js) (App Router, Turbopack) |
| Language | [TypeScript](https://github.com/microsoft/TypeScript) |
| Styling | [Tailwind CSS v4](https://github.com/tailwindlabs/tailwindcss) |
| Animation | [GSAP ScrollTrigger](https://github.com/greensock/GSAP) + [Framer Motion](https://github.com/motiondivision/motion) |
| UI Base | [shadcn/ui](https://github.com/shadcn-ui/ui) |
| AI Chat | [DeepSeek API](https://github.com/deepseek-ai) (reasoner + chat) |
| RAG | [@xenova/transformers](https://github.com/xenova/transformers.js) ([all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)) + hybrid semantic/keyword search |
| Deploy | [Vercel](https://github.com/vercel) |

## Architecture / 架构

```
app/
├── page.tsx              # Main page (scroll background + chat overlay)
├── api/chat/route.ts     # Streaming chat API with RAG retrieval
├── api/follow-ups/       # Follow-up question generation
├── components/           # UI components
├── hooks/                # useScrollProgress, useOrientationLock
├── data/                 # Bilingual content & question bank
└── context/              # Language context (zh/en)
lib/chat/
├── knowledge.ts          # RAG search: semantic + keyword hybrid (Intl.Segmenter)
scripts/
├── build-rag.ts          # Build RAG index with embedding vectors
└── prepare-frames.ts     # Convert PNG frames to AVIF
public/
├── frames/               # AVIF sequence frames (generated)
├── models/               # ONNX embedding model (downloaded at build)
└── rag-index.json        # Compiled RAG index (generated, gitignored)
```

## RAG Pipeline / RAG 管道

The chatbot uses a hybrid retrieval system:

1. **Build time**: `scripts/build-rag.ts` reads markdown from `knowledge/`, splits by headings, embeds each chunk with `Xenova/all-MiniLM-L6-v2` (384d vectors)
2. **Runtime**: `lib/chat/knowledge.ts` embeds the user query, computes cosine similarity, then boosts scores with keyword hits via `Intl.Segmenter` Chinese word segmentation (`score = semantic × 1.5^keyword_hits`)
3. **Warmup**: Frontend sends a warmup request at 50% scroll progress so the model is loaded before the user starts chatting

构建时将知识库 Markdown 分块嵌入 384 维向量；运行时混合语义＋关键词检索；滚动 50% 时预热模型。

## Getting Started / 开始

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your DEEPSEEK_API_KEY

# (Optional) Build RAG index from your knowledge base
KB_DIR=/path/to/knowledge npm run build-rag

# Dev server
npm run dev
```

## Environment Variables / 环境变量

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API key |
| `DEEPSEEK_BASE_URL` | ❌ | Custom API base URL |
| `KB_DIR` | ❌ | Path to knowledge base markdown files (default: `./knowledge`) |
| `FRAMES_DIR` | ❌ | Path to source PNG frames for AVIF conversion |

## Deploy / 部署

```bash
npx vercel --prod
```

## Contributors / 作者

| Avatar | Name | Role |
|--------|------|------|
| ![KAI777THEBEGINNER](https://github.com/KAI777THEBEGINNER.png?size=40) | [KAI777THEBEGINNER](https://github.com/KAI777THEBEGINNER) | Creator & owner / 项目创建者 |
| ![claude](https://github.com/claude.png?size=40) | [claude](https://github.com/claude) | AI collaborator / AI 协作者 |

## Attributions / 开源声明

See [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) for third-party software and model licenses.

第三方软件与模型许可证见 [ATTRIBUTIONS.md](./ATTRIBUTIONS.md)。

## License

Personal project. All rights reserved.
