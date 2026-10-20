import { SECTIONS } from "./sections";
import type { Messages } from "./en";

/** Simplified Chinese (简体中文). */
export const zh = Object.fromEntries(
  Object.entries(SECTIONS).map(([k, v]) => [k, v.zh])
) as Messages;
