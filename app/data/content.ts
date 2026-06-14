// Bilingual content for all 5 sections + UI strings
// Video duration: 29.208s — timeline mapped to scroll progress

export type Lang = "zh" | "en";

export interface HeroContent {
  tags: string[];
  title: string;
  name: string;
  subtitle: string;
}

export interface TextSectionContent {
  label: string;  // e.g. "创业经历" / "Entrepreneurship"
  title: string;
  body: string;
}

export interface BridgeContent {
  body: string;
  cta: string;
}

export interface UIContent {
  siteName: string;
  navEntrepreneurship: string;
  navInternship: string;
  navEducation: string;
  contactMe: string;
  chatPlaceholder: string;
  suggestionHint: string;
  backToTop: string;
  scrollHint: string;
  scrollHintDown: {
    desktop: string;
    mobile: string;
  };
}

export interface SectionContent {
  id: string;
  type: "hero" | "text" | "bridge";
  range: [number, number];
}

const VIDEO_DURATION = 29.208;
export const t = (seconds: number) => seconds / VIDEO_DURATION;

export const SECTIONS: SectionContent[] = [
  { id: "hero", type: "hero", range: [t(0), t(2)] },
  { id: "entrepreneurship", type: "text", range: [0.14, 0.28] },
  { id: "internship", type: "text", range: [0.3451, 0.4980] },
  { id: "education", type: "text", range: [0.6150, 0.7000] },
  { id: "bridge", type: "bridge", range: [0.8192, 0.9263] },
];

type ContentMap = Record<Lang, {
  hero: HeroContent;
  entrepreneurship: TextSectionContent;
  internship: TextSectionContent;
  education: TextSectionContent;
  bridge: BridgeContent;
  ui: UIContent;
}>;

export const content: ContentMap = {
  zh: {
    hero: {
      tags: ["自驱", "迭代", "沟通", "格局"],
      title: "保持学习并应用",
      name: "Kyle Zhao",
      subtitle: "「保持成为AI时代的头号玩家」",
    },
    entrepreneurship: {
      label: "创业经历",
      title: "青年创业者",
      body: `「成都杉树文化传媒工作室，联合创始人」

面向高校竞赛队伍提供高质量的宣传片制作，首季 10+ 客单，8 万营收，2 个国奖。
主导 R&D 项目：泛知识视频商业特化与 ROI 归因分析模型。
涉及数据实验量化自媒体平台流量机制，制定出特化内容策略框架，把创作者变现的模糊需求翻译成可执行方案。`,
    },
    internship: {
      label: "实习经历",
      title: "美团 · 餐饮 SaaS 事业部\n体验及合作伙伴运营组",
      body: `「前线部署 × 产品工程师融合角色（初级）」

3 个月，8 个工具，覆盖小组 83% 实习生日常工作，直接助推实习生迈向数字员工化。
始终学习最新 Agentic Coding 规范与原则，清楚什么时候该怎么指挥 AI。所有代码来自 Agent，我不写代码。我的工作在决策并落地——选方向、做验证、定边界、为结果负责。`,
    },
    education: {
      label: "教育经历",
      title: "学了什么专业不是重点，\n带走了什么能力才是。",
      body: `「四川大学艺术学院，美术学系→影视与戏剧系（广播电视编导专业）」

美术学理论和影视与戏剧训练带给我两件事：观察人的行为，还原行为背后的动机。设计叙事结构，让核心先被看见。这两件事，在 AI 压平技术门槛之后，比会写代码更稀缺。
挑战杯全国金奖 · 互联网+ 省级金奖。
我想带着训练出来的人文素养，走到一个更需要它的地方。`,
    },
    bridge: {
      body: `简历装得下的，是「做了什么」。装不下的是那些「能做但选择不做」的时刻、那些在三个方案里挑对那一个的瞬间、那些学了就用、用了就跑出闭环的路径。`,
      cta: "欢迎找我聊一聊！",
    },
    ui: {
      siteName: "[KYLE ZHAO]",
      navEntrepreneurship: "创业经历",
      navInternship: "实习经历",
      navEducation: "教育经历",
      contactMe: "联系我",
      chatPlaceholder: "问 Kyle 任何问题…",
      suggestionHint: "不知道该问什么？试试这些：",
      backToTop: "↑ 离开聊天",
      scrollHint: "缓慢地划动页面",
      scrollHintDown: {
        desktop: "缓慢地滚动网页",
        mobile: "缓慢地划动页面",
      },
    },
  },

  en: {
    hero: {
      tags: ["Self-driven", "Iterative", "Communicative", "Ground & Visionary"],
      title: "Always learning.\nAlways applying.",
      name: "Kyle Zhao",
      subtitle: "\"Keep being the READY PLAYER ONE in the AI era.\"",
    },
    entrepreneurship: {
      label: "Entrepreneurship",
      title: "Young Entrepreneur",
      body: `「SHANSHU Visual Design & Production (Chengdu) Co., Ltd, Co-founder」

Provided high-quality promotional video production for university competition teams. First season: 10+ clients, ¥80K revenue, 2 national gold medals.
Led a R&D project: a commercial specialization and ROI attribution model for general-knowledge video content. Conducted data experiments to quantify traffic dynamics across content platforms, built a specialized content strategy framework, and translated creators' fuzzy monetization needs into executable plans.`,
    },
    internship: {
      label: "Internship",
      title: "Meituan · Food SaaS\nCustomer Experience & Partner Operations",
      body: `「FDE × PDE Hybrid Role (Junior)」

3 months, 8 tools, covering 83% of the team's intern-level daily work — directly advancing the shift from intern to digital workforce.
Spanning local and online data pipeline automation, browser automation, and SKILLs built with harness-engineering sense. But what's irreplaceable isn't the tool count:
Constantly learning the latest Agentic Coding principles and conventions. Knowing when and how to direct AI. All code comes from Agentic AI — I don't write it. My job is deciding and shipping: picking the direction, verifying the output, defining the boundaries, owning the outcome.`,
    },
    education: {
      label: "Education",
      title: "What I studied matters less\nthan what I took with me.",
      body: `「Sichuan University, School of Art · Fine Art Theory → Film & Theater Studies (Radio and TV Directing)」

The dual training in fine art theory and film & theater gave me two things: observing human behavior and inferring the intent behind it. Structuring a narrative so the core lands first. In a world where AI has flattened the technical barrier, these are more scarce than coding.
National Challenge Cup Gold · Provincial Internet+ Gold.
I want to bring these humanities-trained sensibilities to a place that needs them more.`,
    },
    bridge: {
      body: `What fits on a résumé: what I did. What doesn't — the moments I could have built something but chose not to, the split seconds spent picking the right answer out of three wrong-looking ones, the learn-apply-ship loops that don't fit into bullet points.`,
      cta: "Come say hi!",
    },
    ui: {
      siteName: "[KYLE ZHAO]",
      navEntrepreneurship: "Entrepreneurship",
      navInternship: "Internship",
      navEducation: "Education",
      contactMe: "LET'S TALK",
      chatPlaceholder: "Ask Kyle anything…",
      suggestionHint: "Not sure what to ask? Try these:",
      backToTop: "↑ Leave chat",
      scrollHint: "Scroll slowly",
      scrollHintDown: {
        desktop: "Scroll down slowly",
        mobile: "Scroll slowly",
      },
    },
  },
};

export const NAV_SECTIONS = (lang: Lang) => [
  { id: "entrepreneurship", label: lang === "zh" ? "创业" : "STARTUP", progress: 0.14 },
  { id: "internship", label: lang === "zh" ? "实习" : "INTERN", progress: 0.3451 },
  { id: "education", label: lang === "zh" ? "教育" : "EDU", progress: 0.6150 },
];
