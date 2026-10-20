import { section } from "../define";

export const home = section(
  {
    badge: "Critical illness insurance · Singapore",
    heroLine1: "Stop chasing insurance quotes.",
    heroLine2: "Let AI do it for you.",
    heroBody:
      "Assura compares critical illness plans from Singapore's top insurers, then emails them on your behalf to collect personalised quotes — while keeping your data private.",
    ctaPrimary: "Get started free",
    ctaSecondary: "See how it works",
    howTitle: "How it works",
    howSubtitle: "Three steps, with you in control of every message.",
    step: (n: number) => `Step ${n}`,
    steps: [
      {
        title: "Compare plans",
        desc: 'Browse and filter critical illness plans from Singapore insurers. Every figure links back to its public brochure and "data as of" date.',
      },
      {
        title: "AI emails insurers",
        desc: "Pick up to 5 insurers and a question. Assura drafts each email — you review and approve before anything is sent.",
      },
      {
        title: "Track replies in your CRM",
        desc: "Responses land in one place. Quote details are extracted, and pushy or suspicious replies are flagged.",
      },
    ],
    safeguards: [
      { title: "Masked inbox", desc: "Insurers never see your real email or phone." },
      { title: "Personal-data guard", desc: "NRIC, health and income details are blocked from outgoing email." },
      { title: "Tamper-evident log", desc: "Every AI action is recorded in a verifiable hash chain." },
    ],
    pricingTitle: "Free vs Premium",
    demoBadge: "Demo",
    plans: {
      free: {
        tier: "Free",
        price: "Free forever",
        features: ["Full plan comparison table", "Filter & sort every plan", "Plan Q&A chat with cited answers"],
        cta: "Get started",
      },
      premium: {
        tier: "Premium",
        price: "Included in the demo",
        features: [
          "Everything in Free",
          "AI outreach to up to 5 insurers",
          "Masked inbox — real email stays private",
          "CRM with quote extraction",
          "Activity log + audit chain",
        ],
        cta: "Try the demo",
      },
    },
  },
  {
    badge: "危疾保险 · 新加坡",
    heroLine1: "不必再四处索取保险报价。",
    heroLine2: "让 AI 替您完成。",
    heroBody:
      "Assura 比较新加坡主要保险公司的危疾保险计划，并代您发送邮件索取个性化报价——同时保护您的个人资料。",
    ctaPrimary: "免费开始",
    ctaSecondary: "了解使用方式",
    howTitle: "使用方式",
    howSubtitle: "三个步骤，每一封信息都由您掌控。",
    step: (n: number) => `第 ${n} 步`,
    steps: [
      {
        title: "比较计划",
        desc: "浏览并筛选新加坡保险公司的危疾保险计划。每个数字都附有公开产品手册的链接和“数据截至”日期。",
      },
      {
        title: "AI 发邮件给保险公司",
        desc: "选择最多 5 家保险公司和一个问题。Assura 为每家起草邮件——发送前由您审阅并批准。",
      },
      {
        title: "在回复管理中跟进",
        desc: "所有回复集中在一处。系统会提取报价细节，并标记强行推销或可疑的回复。",
      },
    ],
    safeguards: [
      { title: "匿名中转邮箱", desc: "保险公司永远看不到您的真实邮箱或电话。" },
      { title: "个人资料防护", desc: "身份证号码、健康和收入信息不会出现在外发邮件中。" },
      { title: "防篡改日志", desc: "每一项 AI 操作都记录在可验证的哈希链中。" },
    ],
    pricingTitle: "免费版与高级版",
    demoBadge: "演示",
    plans: {
      free: {
        tier: "免费版",
        price: "永久免费",
        features: ["完整的计划比较表", "筛选和排序所有计划", "附带出处的计划问答"],
        cta: "开始使用",
      },
      premium: {
        tier: "高级版",
        price: "演示中已包含",
        features: [
          "免费版的全部功能",
          "AI 联系最多 5 家保险公司",
          "匿名中转邮箱——真实邮箱保持私密",
          "可提取报价的回复管理",
          "活动日志与审计链",
        ],
        cta: "试用演示",
      },
    },
  }
);
