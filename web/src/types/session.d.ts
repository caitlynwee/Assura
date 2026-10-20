/**
 * session.d.ts — Re-export of the app session type.
 *
 * Replaces the old next-auth module augmentation. Consumers read the session
 * through the facade's `auth()` return (`AppSession` from @/lib/auth); no
 * global module augmentation is needed under Supabase Auth.
 */

export type { AppSession } from "@/lib/auth";
