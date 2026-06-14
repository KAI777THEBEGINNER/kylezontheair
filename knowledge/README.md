# Knowledge Base

This directory holds the markdown files that feed into the RAG index.

Run `npm run build-rag` to generate `public/rag-index.json` from the files here.

## Expected files

| File | Purpose |
|------|---------|
| `身份.md` | Identity and background facts |
| `经历.md` | Work and project experience |
| `认知.md` | Methodology, viewpoints, AI opinions |
| `配置.md` | Language style, disclosure levels, technical boundaries |

## System prompt

The system prompt is loaded from an external path (set via `KB_DIR` env var).
It is NOT included in this repo — it contains personal data.

## Build

```bash
KB_DIR=/path/to/your/knowledge npm run build-rag
```
