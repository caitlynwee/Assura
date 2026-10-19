/**
 * Module augmentation so `session.user.tier` etc. are typed everywhere
 * (no more `(session.user as any).tier`).
 */
import type { DefaultSession } from "next-auth";
import type { UserTier } from "@/lib/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tier: UserTier;
      maskedInbox: string;
      onboarded: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    tier?: UserTier;
    maskedInbox?: string;
    onboarded?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    tier?: UserTier;
    maskedInbox?: string;
    onboarded?: boolean;
  }
}
