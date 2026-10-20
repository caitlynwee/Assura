import { SECTIONS } from "./sections";

type Sections = typeof SECTIONS;
export type Messages = { [K in keyof Sections]: Sections[K]["en"] };

export const en = Object.fromEntries(
  Object.entries(SECTIONS).map(([k, v]) => [k, v.en])
) as Messages;
