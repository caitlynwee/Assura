export const COUNTRY_OF_ORIGIN_OPTIONS = ["Singapore", "China"] as const;

export type CountryOfOrigin = (typeof COUNTRY_OF_ORIGIN_OPTIONS)[number];
