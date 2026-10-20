"use client";

/**
 * Client-side i18n. The server passes the initial locale (from the cookie) to
 * <I18nProvider>, so the first render already matches the server HTML.
 * Switching language updates the cookie, re-renders client components
 * instantly and refreshes server components.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { INTL_LOCALE, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

interface I18nContextValue {
  locale: Locale;
  t: Messages;
  /** Intl locale for dates/numbers, e.g. "zh-CN". */
  intlLocale: string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const ONE_YEAR = 60 * 60 * 24 * 365;

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
      document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
      setLocaleState(next);
      router.refresh(); // re-render server components in the new language
    },
    [router]
  );

  const value = useMemo(
    () => ({ locale, t: getMessages(locale), intlLocale: INTL_LOCALE[locale], setLocale }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT/useLocale must be used inside <I18nProvider>");
  return ctx;
}

/** The message dictionary for the current language. */
export function useT(): Messages {
  return useI18n().t;
}

/** Like useT, but falls back to English outside <I18nProvider> (for shared UI primitives). */
export function useMaybeT(): Messages {
  return useContext(I18nContext)?.t ?? getMessages("en");
}

export function useLocale() {
  const { locale, setLocale, intlLocale } = useI18n();
  return { locale, setLocale, intlLocale };
}
