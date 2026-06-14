# Kai's Digital Chatbot Website

## 项目定位
Kai 的个人网站，以滚动驱动序列帧动画为背景，底部集成 AI 数字分身对话界面。

## 技术栈
- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- GSAP (ScrollTrigger 驱动滚动动画)
- Framer Motion (UI 过渡)
- shadcn/ui (组件底座)
- Vercel AI SDK (对接 DeepSeek API)
- LangChain (RAG 管道)
- Vector DB: 文件系统/内存 (阶段一) → Pinecone/Supabase pgvector (阶段二)
- Vercel 部署 (主) + 国内 CDN 镜像

## 目录结构
```
├── app/
│   ├── page.tsx                 # 主页面（滚动背景 + 文本 + Chatbot）
│   ├── api/
│   │   └── chat/
│   │       └── route.ts         # DeepSeek 流式接口 + RAG 检索
│   ├── components/
│   │   ├── ScrollFrameBackground.tsx   # 序列帧滚动背景核心组件
│   │   ├── TextContainers.tsx          # 3 个圆角矩形容器
│   │   ├── ChatbotOverlay.tsx          # 底部唤出 AI 聊天界面
│   │   ├── ChatMessage.tsx             # 单条消息气泡
│   │   └── MarkdownRenderer.tsx        # 知识库/回复的 Markdown 渲染
│   └── hooks/
│       └── useScrollProgress.ts        # 滚动进度 0-1
├── lib/
│   ├── rag/
│   │   ├── loader.ts            # Markdown 知识库加载
│   │   ├── splitter.ts          # 文本分块
│   │   ├── embedding.ts         # 向量化（DeepSeek Embedding / 本地）
│   │   └── retriever.ts         # 相似度检索
│   └── utils.ts
├── public/
│   └── frames/                  # 序列帧图片 (frame_0001.jpg ...)
├── knowledge/
│   └── base.md                  # 全 Markdown 知识库
└── CLAUDE.md                    # 本文件
```

## 核心交互约定
1. **序列帧背景**
   - 图片预加载前 5 帧 + 按需加载后续帧
   - 滚动进度 `0 -> 1` 映射到帧索引 `0 -> totalFrames-1`
   - 使用 `requestAnimationFrame` + Canvas 或 `<img>` 渲染，避免滚动卡顿

2. **文本容器**
   - 3 个圆角矩形 (`rounded-2xl` / `rounded-3xl`)
   - 每个在特定滚动区间进入视口：淡入 + 上移 `translateY(20px -> 0)` + opacity `0 -> 1`
   - 离开区间后：淡出 + 上移消失
   - GSAP ScrollTrigger: `scrub: true`, `start/end` 由你后续指定

3. **Chatbot 唤起**
   - 滚动到底部（进度 ≥ 0.95）时自动展开聊天界面
   - 展开动画：从底部滑入 + 遮罩层淡入
   - 用户可手动收起/重新展开
   - 输入框固定在聊天面板底部

4. **AI 对话**
   - 流式输出 (SSE)
   - 每次请求先走 RAG 检索 top-k  chunks，拼接进 system prompt
   - 人设 prompt：基于 Kai 的知识库，以第一人称回答

## RAG 数字大脑设计（阶段一：本地/内存）
- 知识库: `knowledge/base.md`（全 markdown，后续可拆多文件）
- 分块: 按标题层级切分，chunk size ~500 tokens, overlap ~50
- 嵌入: DeepSeek `text-embedding` API 或本地轻量模型
- 检索: 余弦相似度，top 5 chunks
- system prompt 模板: 检索结果 + 固定人设指令

## 命名规范
- 组件: PascalCase, 文件同名
- hooks: camelCase, 前缀 `use`
- utils: camelCase
- API routes: kebab-case

## 部署
- 默认 Vercel (vercel --prod)
- 国内可访问：检查 DNS / CDN，必要时配置国内镜像
- 环境变量: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` (可选)
