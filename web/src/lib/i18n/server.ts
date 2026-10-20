/**
 * Server-side i18n: server components, server actions and route handlers.
 * Reads the language cookie (falling back to the browser's Accept-Language).
 */

import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

export async function getLocale(): Promise<Locale> {
  try {
    const jar = await cookies();
    const fromCookie = jar.get(LOCALE_COOKIE)?.value;
    if (isLocale(fromCookie)) return fromCookie;
    const h = await headers();
    return localeFromAcceptLanguage(h.get("accept-language"));
  } catch {
    // Outside a request (e.g. build-time) — fall back to the default.
    return DEFAULT_LOCALE;
  }
}

/** The message dictionary for the current request's language. */
export async function getT(): Promise<Messages> {
  return getMessages(await getLocale());
}
