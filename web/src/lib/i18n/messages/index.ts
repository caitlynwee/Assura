import type { Locale } from "../config";
import { en, type Messages } from "./en";
import { zh } from "./zh";

export type { Messages };

const MESSAGES: Record<Locale, Messages> = { en, zh };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}
