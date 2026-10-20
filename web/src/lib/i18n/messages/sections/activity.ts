import { section } from "../define";

export const activity = section(
  {
    meta: "Activity Log — Assura",
    title: "Activity Log",
    description: "Every action taken by Assura is logged here in a tamper-evident SHA-256 hash chain.",
    empty: "No activity recorded yet.",
    loadFailed: "Failed to load the activity log.",
    columns: ["Time", "Actor", "Action", "Prev hash", "Hash"],
    verify: "Verify chain",
    intact: "Chain intact",
    tampered: "Tampered",
    entriesVerified: (n: number) => `${n} entries verified`,
    brokenAt: (n: number | string) => `chain broken at entry ${n}`,
    verifyFailed: "verification request failed",
  },
  {
    meta: "活动日志 — Assura",
    title: "活动日志",
    description: "Assura 执行的每一项操作都记录在这里，并以防篡改的 SHA-256 哈希链保存。",
    empty: "暂无活动记录。",
    loadFailed: "无法加载活动日志。",
    columns: ["时间", "执行者", "操作", "上一个哈希", "哈希"],
    verify: "验证哈希链",
    intact: "哈希链完整",
    tampered: "已被篡改",
    entriesVerified: (n: number) => `已验证 ${n} 条记录`,
    brokenAt: (n: number | string) => `哈希链在第 ${n} 条记录处断开`,
    verifyFailed: "验证请求失败",
  }
);
