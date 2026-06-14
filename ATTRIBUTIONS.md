# Open Source Attributions / 开源项目声明

This project relies on the following open-source projects.

本项目依赖以下开源项目。

---

## Runtime Dependencies / 运行时依赖

| Project | License | Usage |
|---------|---------|-------|
| [Next.js](https://nextjs.org) | MIT | React framework — App Router, SSR, API routes, Turbopack |
| [React](https://react.dev) | MIT | UI rendering library |
| [React DOM](https://react.dev) | MIT | React DOM renderer (Next.js peer dependency) |
| [@xenova/transformers](https://huggingface.co/docs/transformers.js) | Apache-2.0 | Local ML inference — runs `all-MiniLM-L6-v2` embedding model for RAG semantic search |
| [react-markdown](https://github.com/remarkjs/react-markdown) | MIT | Renders AI chat responses as formatted Markdown |
| [remark-gfm](https://github.com/remarkjs/remark-gfm) | MIT | GitHub Flavored Markdown support (tables, strikethrough, autolinks) |

## Dev / Build Dependencies / 开发与构建依赖

| Project | License | Usage |
|---------|---------|-------|
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com) | MIT | Utility-first CSS framework |
| [@tailwindcss/postcss](https://tailwindcss.com) | MIT | PostCSS plugin for Tailwind CSS v4 |
| [sharp](https://sharp.pixelplumbing.com) | Apache-2.0 | Image processing — converts PNG frames to AVIF for scroll background |
| [ESLint](https://eslint.org) | MIT | Code linting |
| [eslint-config-next](https://nextjs.org) | MIT | Next.js ESLint rules |
| [@playwright/test](https://playwright.dev) | Apache-2.0 | End-to-end browser testing |

## AI / ML Models / AI 模型

| Model | License | Usage |
|-------|---------|-------|
| [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) | Apache-2.0 | 384-dimensional text embedding model for semantic search. Runs locally via @xenova/transformers (ONNX Runtime). |

## Fonts / 字体

All fonts are self-hosted in `public/fonts/` — no external CDN loaded.

| Font | License | Source |
|------|---------|--------|
| JetBrains Mono | OFL-1.1 | [jetbrains.com/mono](https://www.jetbrains.com/lp/mono/) |
| Instrument Serif | OFL-1.1 | [instrument-serif on GitHub](https://github.com/Instrument/instrument-serif) |
| Newsreader | OFL-1.1 | [Newsreader on Google Fonts](https://fonts.google.com/specimen/Newsreader) |
| 方正小标宋 (FZXiaoBiaoSong) | Personal use | Founder Type |
| 钢锋宋体 (GangFeng-SongTi) | Personal use | Independent designer |

---

## Previously Used Then Removed / 曾使用后移除

These packages were installed during development but later replaced with custom implementations:

| Project | Why removed |
|---------|-------------|
| Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`) | Replaced with direct `fetch()` to DeepSeek API for full SSE control and streaming customization |
| Framer Motion | Replaced with CSS transitions and `requestAnimationFrame` — no heavy animation library needed |
| GSAP | Replaced with custom scroll progress hook + CSS — simpler, no license concerns |
| shadcn/ui | Evaluated but not adopted — all components are custom-built |

---

*If you believe any attribution is missing or incorrect, please open an issue.*
