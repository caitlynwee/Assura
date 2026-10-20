/**
 * ensure-demo-user.ts — Idempotent demo Supabase identity + metadata sync.
 *
 * SERVER-ONLY. Uses the service-role admin client. Invoked from the CLI
 * (seed-auth.ts / db:seed-auth) and from server actions (syncAuthMetadata).
 * Never imported from request/middleware code that must stay keyless-safe
 * beyond the no-throw guarantees below.
 *
 * All exported functions are safe to call when Supabase keys are absent: they
 * log a warning and return early (never throw), so keyless builds, `docker
 * compose up`, and seed/reset.sh still succeed.
 */

import { getAdminClient } from "./admin";
import { linkAuthUid, getUserById } from "../db";
import { DEMO_EMAIL, DEMO_PASSWORD, LEGACY_DEMO_EMAIL } from "../demo";

const DEMO_APP_USER_ID = "user_demo";

/** Find a Supabase auth user by email (paged listUsers), or null. */
async function findAuthUserByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  email: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const target = email.toLowerCase();
  let page = 1;
  const perPage = 1000;
  // Page until a short page is returned (end of list).
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => (u.email ?? "").toLowerCase() === target
    );
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
}

/**
 * Ensure the Assura-branded demo Supabase identity exists with the demo
 * password + premium app_metadata, and back-fill user_demo.auth_uid.
 *
 * Idempotent: creates the identity if absent, else re-syncs password/metadata.
 * No-op (warning) when Supabase keys are absent.
 */
export async function ensureDemoAuthUser(): Promise<void> {
  const admin = getAdminClient();
  if (!admin) {
    console.warn(
      "[seed-auth] Supabase not configured (missing URL or service-role key) — skipping demo auth user."
    );
    return;
  }

  const appMetadata = {
    tier: "premium",
    onboarded: true,
    appUserId: DEMO_APP_USER_ID,
  };

  const existing =
    (await findAuthUserByEmail(admin, DEMO_EMAIL)) ??
    (await findAuthUserByEmail(admin, LEGACY_DEMO_EMAIL));

  let authUid: string;
  if (!existing) {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) throw error;
    authUid = data.user.id;
    console.warn(`[seed-auth] Created demo Supabase identity (${authUid}).`);
  } else {
    authUid = existing.id;
    const { error } = await admin.auth.admin.updateUserById(authUid, {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (error) throw error;
    console.warn(`[seed-auth] Re-synced demo Supabase identity (${authUid}).`);
  }

  await linkAuthUid(DEMO_APP_USER_ID, authUid);
  console.warn(`[seed-auth] Linked ${DEMO_APP_USER_ID}.auth_uid → ${authUid}.`);
}

/** Team demo accounts (app rows seeded in seed-data.ts). Shared password. */
const TEAM_PASSWORD = "demo1234";
const TEAM_MEMBERS = ["jeff", "caitlyn", "marcus", "dominic"] as const;

/**
 * Ensure each groupmate's Supabase identity exists (premium, confirmed) and is
 * linked to their seeded app row (user_<slug> ↔ <slug>@assura.local).
 * Idempotent and no-op-safe when Supabase keys are absent, mirroring the demo
 * seeding above.
 */
export async function ensureTeamAuthUsers(): Promise<void> {
  const admin = getAdminClient();
  if (!admin) {
    console.warn(
      "[seed-auth] Supabase not configured — skipping team auth users."
    );
    return;
  }

  for (const slug of TEAM_MEMBERS) {
    const appUserId = `user_${slug}`;
    const email = `${slug}@assura.local`;
    const appMetadata = { tier: "premium", onboarded: true, appUserId };

    const existing = await findAuthUserByEmail(admin, email);
    let authUid: string;
    if (!existing) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: TEAM_PASSWORD,
        email_confirm: true,
        app_metadata: appMetadata,
      });
      if (error) throw error;
      authUid = data.user.id;
      console.warn(`[seed-auth] Created ${email} Supabase identity (${authUid}).`);
    } else {
      authUid = existing.id;
      const { error } = await admin.auth.admin.updateUserById(authUid, {
        password: TEAM_PASSWORD,
        email_confirm: true,
        app_metadata: appMetadata,
      });
      if (error) throw error;
      console.warn(`[seed-auth] Re-synced ${email} Supabase identity (${authUid}).`);
    }

    await linkAuthUid(appUserId, authUid);
    console.warn(`[seed-auth] Linked ${appUserId}.auth_uid → ${authUid}.`);
  }
}

/**
 * Sync an app user's tier/onboarded into their Supabase app_metadata so the
 * edge (which reads the JWT, not the DB) sees the new values after a refresh.
 * No-op (warning) when keys are absent or the user is not linked.
 */
export async function syncAuthMetadata(appUserId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) {
    console.warn(
      "[auth] Supabase not configured — skipping app_metadata sync."
    );
    return;
  }

  const user = await getUserById(appUserId);
  if (!user) {
    console.warn(`[auth] syncAuthMetadata: no app user ${appUserId}.`);
    return;
  }
  if (!user.authUid) {
    console.warn(
      `[auth] syncAuthMetadata: app user ${appUserId} has no linked auth_uid; skipping.`
    );
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(user.authUid, {
    app_metadata: {
      tier: user.tier,
      onboarded: user.onboarded,
      appUserId: user.id,
    },
  });
  if (error) throw error;
}
