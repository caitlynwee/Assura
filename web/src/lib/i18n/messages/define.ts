/**
 * Pair the English and Chinese text for one area of the app. `zh` must have
 * exactly the same shape as `en` (same keys, same function signatures), so a
 * missing or extra translation is a TypeScript error, not a runtime surprise.
 */
export function section<T>(en: T, zh: NoInfer<T>): { en: T; zh: T } {
  return { en, zh };
}
