// Conversation starter questions — filtered for sincerity
// No gotcha questions, no humblebrag traps — just straightforward stuff the avatar can answer honestly
// Randomly draw 3 per page load, preferring cross-dimension diversity

export interface QuestionItem {
  id: number;
  zh: string;
  en: string;
  dimension?: number; // only used by initial question pool
}

export const ALL_QUESTIONS: QuestionItem[] = [
  // ── 维度一 · 他是谁 ──
  { id: 1, zh: "用一分钟介绍一下你自己", en: "Introduce yourself in one minute.", dimension: 1 },
  { id: 2, zh: "影视与戏剧系出身，怎么走到 AI 产品方向的？", en: "How did you go from film & theater studies to AI product?", dimension: 1 },
  { id: 3, zh: "你说自己「不会写代码」，但又交付了 8 个工具——这个 gap 是怎么补的？", en: "You say you 'can't code', yet you shipped 8 tools — how did you bridge that gap?", dimension: 1 },
  { id: 4, zh: "你觉得自己和同届同学最大的区别是什么？", en: "What sets you apart from your peers?", dimension: 1 },
  { id: 5, zh: "你为什么选择 AI 产品 / Agent 应用方向？", en: "Why did you choose the AI product / Agent application direction?", dimension: 1 },
  { id: 6, zh: "你为什么说自己不是「转了专业」，而是「带着能力走进去」？", en: "Why do you say you didn't 'switch majors' but 'walked in with your skills'?", dimension: 1 },

  // ── 维度二 · 在美团做了什么 ──
  { id: 7, zh: "在美团实习的三个月，你具体做了什么？", en: "What exactly did you do during your 3 months at Meituan?", dimension: 2 },
  { id: 8, zh: "你做的工具里，挑一个最满意的讲讲", en: "Pick your favorite tool and walk me through it.", dimension: 2 },
  { id: 9, zh: "这些工具在技术上有什么新东西吗？", en: "Was there anything technically novel about these tools?", dimension: 2 },
  { id: 10, zh: "你们组的同事真的在用你做的工具吗？", en: "Did your teammates actually use your tools?", dimension: 2 },
  { id: 11, zh: "你在美团做的事情，换个会用 AI 的实习生也能做吗？", en: "Could any AI-literate intern have done what you did at Meituan?", dimension: 2 },
  { id: 12, zh: "如果明天离开美团，你留下的东西还能继续用吗？", en: "If you left Meituan tomorrow, would your tools keep working?", dimension: 2 },

  // ── 维度三 · 创业经历 ──
  { id: 13, zh: "你跟朋友开的杉树文化，具体在做什么？", en: "What exactly did Shanshu Culture do?", dimension: 3 },
  { id: 14, zh: "杉树那段经历，对你在美团的工作有什么直接帮助？", en: "How did your Shanshu experience directly help at Meituan?", dimension: 3 },

  // ── 维度四 · 怎么想问题 ──
  { id: 15, zh: "你做事情有一套方法论吗？怎么把想法变成工具？", en: "Do you have a methodology? How do you turn an idea into a tool?", dimension: 4 },
  { id: 16, zh: "你怎么判断一件事值不值得自动化？", en: "How do you decide if something is worth automating?", dimension: 4 },
  { id: 17, zh: "你怎么判断一个工具做好了还是没做好？", en: "How do you know when a tool is actually good enough?", dimension: 4 },
  { id: 18, zh: "你做工具的时候，最怕出现什么情况？", en: "What's the worst thing that can happen when you're building a tool?", dimension: 4 },
  { id: 19, zh: "你怎么区分「AI 能做」和「AI 该做」？", en: "How do you tell what AI can do from what it should do?", dimension: 4 },
  { id: 20, zh: "你的方法论有没有盲区？", en: "What are the blind spots in your methodology?", dimension: 4 },
  { id: 21, zh: "你怎么判断一个工具该不该停下来？", en: "How do you decide when to stop building a tool?", dimension: 4 },
  { id: 22, zh: "你做决定的时候更相信数据还是直觉？", en: "When deciding, do you trust data or intuition more?", dimension: 4 },

  // ── 维度五 · 怎么看待 AI ──
  { id: 23, zh: "你亲眼看到的 AI 对工作的最大改变是什么？", en: "What's the biggest change AI has made to work that you've seen firsthand?", dimension: 5 },
  { id: 24, zh: "AI 把写代码的门槛压平了——那你的不可替代性到底在哪？", en: "AI flattened the coding barrier — so what makes you irreplaceable?", dimension: 5 },
  { id: 25, zh: "你现在用的 AI 工具一两年后可能全换了——你积累的东西还会值钱吗？", en: "The AI tools you use today might be gone in two years — will what you've built still matter?", dimension: 5 },
  { id: 26, zh: "你说自己的定位是「前线部署工程师 × 产品工程师的初学者」——这到底是什么角色？", en: "You call yourself a 'frontline deployment engineer × beginner product engineer' — what does that actually mean?", dimension: 5 },
  { id: 27, zh: "你对 AI 最大的警惕是什么？", en: "What are you most wary of when it comes to AI?", dimension: 5 },
  { id: 28, zh: "你觉得 AI 现在最被高估的能力是什么？", en: "What capability of AI is currently the most overhyped?", dimension: 5 },
  { id: 29, zh: "你有没有觉得 AI 被吹过头的地方？", en: "Is there anything about AI that you think is overblown?", dimension: 5 },

  // ── 维度六 · AI 工程实践 ──
  { id: 30, zh: "你用 AI 构建产品的时候，有自己的一套流程吗？", en: "Do you have a personal workflow when building products with AI?", dimension: 6 },
  { id: 31, zh: "什么是「降龙七步」？你怎么用它的？", en: "What's the 'Dragon Subduing 7 Steps' and how do you use it?", dimension: 6 },
  { id: 32, zh: "你的「黑暗工厂模式」是什么？跟普通 AI 用法有什么不同？", en: "What's your 'Dark Factory Mode' and how is it different from regular AI usage?", dimension: 6 },
  { id: 33, zh: "你怎么看最近很火的 Loop Engineering？", en: "What do you think about the recent buzz around Loop Engineering?", dimension: 6 },
  { id: 34, zh: "你觉得 AI agent 的核心能力是什么？", en: "What do you think is the core capability of an AI agent?", dimension: 6 },
  { id: 35, zh: "你平时怎么管理 AI agent 的上下文和记忆？", en: "How do you manage AI agent context and memory day-to-day?", dimension: 6 },

  // ── 维度七 · 个人偏好与日常 ──
  { id: 36, zh: "你喜欢什么电影？", en: "What movies do you like?", dimension: 7 },
  { id: 37, zh: "影视编导出身，你的审美偏好是什么？", en: "With a film & TV background, what's your aesthetic preference?", dimension: 7 },
  { id: 38, zh: "你不上班的时候一般在做什么？", en: "What do you usually do when you're not working?", dimension: 7 },
  { id: 39, zh: "你觉得什么样的人你会愿意一起合作？", en: "What kind of person would you want to collaborate with?", dimension: 7 },
  { id: 40, zh: "你对现在的生活状态满意吗？", en: "Are you satisfied with your current life?", dimension: 7 },
];

/**
 * Randomly draw N questions, preferring cross-dimension diversity.
 * Used for initial suggestions only (before any assistant reply exists).
 */
export function drawQuestions(n: number = 3): QuestionItem[] {
  if (n >= ALL_QUESTIONS.length) return [...ALL_QUESTIONS];

  const shuffle = (arr: QuestionItem[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let best = shuffle(ALL_QUESTIONS).slice(0, n);
  let bestUnique = new Set(best.map((q) => q.dimension)).size;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = shuffle(ALL_QUESTIONS).slice(0, n);
    const unique = new Set(candidate.map((q) => q.dimension)).size;
    if (unique > bestUnique) {
      best = candidate;
      bestUnique = unique;
    }
    if (bestUnique === n) break;
  }

  return best;
}
