/**
 * i18n config — shared by server and client (no Node or browser APIs here).
 *
 * The chosen language lives in a cookie so server components, server actions,
 * API routes and client components all agree, and it survives reloads.
 */

export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "assura-locale";

/** Value for <html lang>. Chinese is Simplified (mainland / Singapore usage). */
export const HTML_LANG: Record<Locale, string> = { en: "en", zh: "zh-CN" };

/** Locale for Intl date/number formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-SG", zh: "zh-CN" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Pick a locale from an Accept-Language header (first-visit default). */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("zh") ? "zh" : DEFAULT_LOCALE;
}
