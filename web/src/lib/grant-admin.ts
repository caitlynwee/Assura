/**
 * grant-admin.ts — Controlled CLI for granting the admin tier.
 *
 * This is intentionally not reachable from the web app. It updates both the
 * app row and Supabase app_metadata so middleware sees the role after sign-in.
 */

import { eq } from "drizzle-orm";
import { getDb, getUserByEmail } from "./db";
import * as schema from "./schema";
import { getAdminClient } from "./supabase/admin";

export async function grantAdmin(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await getUserByEmail(normalizedEmail);
  if (!user) throw new Error(`No Assura account found for ${normalizedEmail}.`);

  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase is not configured with a service-role key.");
  if (!user.authUid) {
    throw new Error("The account has no linked Supabase identity; ask the user to sign in first.");
  }

  await getDb()
    .update(schema.users)
    .set({ tier: "admin" })
    .where(eq(schema.users.id, user.id));

  const { error } = await admin.auth.admin.updateUserById(user.authUid, {
    app_metadata: {
      tier: "admin",
      onboarded: user.onboarded,
      appUserId: user.id,
    },
  });
  if (error) throw error;
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run db:grant-admin -- operator@example.com");
  await grantAdmin(email);
  console.log(`[grant-admin] Granted admin tier to ${email}.`);
}

if (process.argv[1]?.endsWith("grant-admin.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("[grant-admin] failed:", error);
      process.exit(1);
    });
}
