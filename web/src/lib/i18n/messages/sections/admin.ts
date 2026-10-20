import { section } from "../define";

export const admin = section(
  {
    meta: "Admin dashboard — Assura",
    eyebrow: "Operations",
    title: "Admin dashboard",
    description: (email: string) => `Signed in as ${email}. Manage data refreshes and monitor scraper health.`,
    safeguardsTitle: "Admin safeguards",
    safeguardsBody:
      "Manual refreshes are audit-logged, protected by the internal scraper key, and restricted to accounts with the admin tier. Scraped data is only published when the scraper validation succeeds.",
    refreshTitle: "Insurance data refresh",
    refreshDesc: "Run the scraper against all configured insurer websites. This may take several minutes.",
    rescraping: "Rescraping…",
    rescrape: "Rescrape all insurers",
    schedule: (when: string) => `Automatic schedule: ${when}`,
    unavailable: "Scraper unavailable",
    loadFailed: "Unable to load scraper status.",
    startFailed: "Unable to start rescrape.",
    lastRun: (when: string) => `Last run: ${when}`,
    runSummary: (trigger: string, checked: number, changed: number) =>
      `${trigger} · checked ${checked} · changed ${changed}`,
    triggers: { cron: "Scheduled", manual: "Manual" } as Record<string, string>,
    source: "source",
    unknownError: "Unknown error",
    noRuns: "No scraper runs recorded yet.",
  },
  {
    meta: "管理后台 — Assura",
    eyebrow: "运营",
    title: "管理后台",
    description: (email: string) => `当前登录：${email}。管理数据刷新并监控抓取程序状态。`,
    safeguardsTitle: "管理员安全措施",
    safeguardsBody:
      "手动刷新会记录在审计日志中，受内部抓取密钥保护，并且仅限管理员账户使用。只有在抓取数据通过验证后才会发布。",
    refreshTitle: "保险数据刷新",
    refreshDesc: "对所有已配置的保险公司网站运行抓取程序，可能需要几分钟。",
    rescraping: "重新抓取中…",
    rescrape: "重新抓取所有保险公司",
    schedule: (when: string) => `自动排程：${when}`,
    unavailable: "抓取程序不可用",
    loadFailed: "无法加载抓取程序状态。",
    startFailed: "无法开始重新抓取。",
    lastRun: (when: string) => `上次运行：${when}`,
    runSummary: (trigger: string, checked: number, changed: number) =>
      `${trigger} · 检查 ${checked} 个 · 更新 ${changed} 个`,
    triggers: { cron: "定时", manual: "手动" },
    source: "来源",
    unknownError: "未知错误",
    noRuns: "暂无抓取记录。",
  }
);
