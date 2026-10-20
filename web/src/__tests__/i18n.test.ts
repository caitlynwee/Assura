import { en } from "@/lib/i18n/messages/en";
import { zh } from "@/lib/i18n/messages/zh";
import { getMessages } from "@/lib/i18n/messages";
import { isLocale, localeFromAcceptLanguage } from "@/lib/i18n/config";

type Node = unknown;

/** Every leaf path in a dictionary, with its value. */
function leaves(node: Node, path = ""): Array<[string, Node]> {
  if (node && typeof node === "object" && !Array.isArray(node)) {
    return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  if (Array.isArray(node)) {
    return node.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  }
  return [[path, node]];
}

// Brand names, codes and identifiers that are correctly the same in both.
const SAME_IN_BOTH = new Set([
  "common.appName",
  "auth.emailPlaceholder",
  "account.deleteDialog.confirmWord",
  "outreach.piiTypes.NRIC",
]);

const HAS_CJK = /[一-鿿]/;

describe("i18n dictionaries", () => {
  const enLeaves = new Map(leaves(en));
  const zhLeaves = new Map(leaves(zh));

  it("Chinese has exactly the same keys as English", () => {
    expect([...zhLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
  });

  it("no translation is empty", () => {
    for (const [path, value] of zhLeaves) {
      if (typeof value === "string") expect({ path, empty: value.trim() === "" }).toEqual({ path, empty: false });
    }
  });

  it("functions take the same arguments in both languages", () => {
    for (const [path, value] of enLeaves) {
      if (typeof value === "function") {
        const other = zhLeaves.get(path);
        expect({ path, type: typeof other }).toEqual({ path, type: "function" });
        expect({ path, arity: (other as (...a: unknown[]) => unknown).length }).toEqual({
          path,
          arity: value.length,
        });
      }
    }
  });

  it("Chinese text is actually Chinese (not leftover English)", () => {
    const untranslated: string[] = [];
    for (const [path, value] of zhLeaves) {
      if (SAME_IN_BOTH.has(path)) continue;
      let text: unknown = value;
      if (typeof value === "function") {
        const args = Array.from({ length: value.length }, () => 1);
        text = (value as (...a: unknown[]) => unknown)(...args);
        if (Array.isArray(text)) text = text.join(" ");
      }
      // The language-switch label is deliberately written in the *other* language.
      if (path === "common.switchTo" || path === "common.switchToLabel") continue;
      if (typeof text === "string" && /[A-Za-z]{3,}/.test(text) && !HAS_CJK.test(text)) {
        untranslated.push(`${path}: ${text}`);
      }
    }
    expect(untranslated).toEqual([]);
  });

  it("the switch button offers the other language", () => {
    expect(en.common.switchTo).toBe("中文");
    expect(zh.common.switchTo).toBe("English");
  });

  it("interpolates numbers and names", () => {
    expect(en.compare.table.showingMatching(3, 14)).toBe("Showing 3 of 14 plans that match your profile.");
    expect(zh.compare.table.showingMatching(3, 14)).toBe("显示 14 个计划中符合您资料的 3 个。");
    expect(zh.chat.bin.daysLeft(5)).toBe("剩余 5 天");
  });
});

describe("i18n config", () => {
  it("validates locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("defaults Chinese browsers to Chinese, everyone else to English", () => {
    expect(localeFromAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(localeFromAcceptLanguage("zh-SG")).toBe("zh");
    expect(localeFromAcceptLanguage("en-SG,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });

  it("getMessages returns the right dictionary", () => {
    expect(getMessages("zh").layout.nav.compare).toBe("比较计划");
    expect(getMessages("en").layout.nav.compare).toBe("Compare Plans");
  });
});
