/**
 * users.ts — User record helpers (Node.js runtime only; uses db.ts / Drizzle).
 *
 * Never import from middleware / edge code.
 */

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  getDb,
  getUserById,
  getUserByEmail,
  getUserByAuthUid,
  linkAuthUid,
} from "./db";
import * as schema from "./schema";
import { generateId } from "./utils";
import { generateMaskedAddress } from "./mail";
import type { ConsentFlags, PublicUser, User, UserTier } from "./types";

export const DEFAULT_CONSENT: ConsentFlags = {
  shareAge: false,
  shareGender: false,
  shareSmokerStatus: false,
  shareCoverageNeeds: false,
  shareBudgetRange: false,
  shareOccupation: false,
  shareHealthHistory: false, // Tier 3 — never shareable by the AI
  shareIncome: false,        // Tier 3 — never shareable by the AI
};

export { getUserById as findUserById, getUserByEmail as findUserByEmail, linkAuthUid };

export async function resolveOrCreateAuthUser(identity: {
  id: string;
  email: string | null;
  user_metadata?: Record<string, unknown>;
} | null | undefined): Promise<User | null> {
  if (!identity?.id) return null;

  const byAuthUid = await getUserByAuthUid(identity.id);
  if (byAuthUid) return byAuthUid;
  if (!identity.email) return null;

  const email = identity.email.trim().toLowerCase();
  const byEmail = await getUserByEmail(email);
  if (byEmail) {
    if (byEmail.authUid && byEmail.authUid !== identity.id) return null;
    if (byEmail.authUid !== identity.id) await linkAuthUid(byEmail.id, identity.id);
    return { ...byEmail, authUid: identity.id };
  }

  const metadataName = identity.user_metadata?.full_name ?? identity.user_metadata?.name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim().slice(0, 100)
      : email.split("@")[0];

  try {
    return await createUser({
      id: `user_auth_${identity.id}`,
      name,
      email,
      // Supabase is the credential authority; this random hash is never used
      // for authentication and avoids persisting the user's Supabase password.
      password: randomBytes(32).toString("hex"),
      tier: "free",
      authUid: identity.id,
    });
  } catch (error) {
    const racedUser = await getUserByAuthUid(identity.id);
    if (racedUser) return racedUser;

    const emailUser = await getUserByEmail(email);
    if (emailUser && !emailUser.authUid) {
      await linkAuthUid(emailUser.id, identity.id);
      return { ...emailUser, authUid: identity.id };
    }
    if (emailUser?.authUid === identity.id) return emailUser;
    if (emailUser) return null;
    throw error;
  }
}

export function toPublicUser(user: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;
  return rest;
}

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists.");
  }
}

export async function createUser(input: {
  id?: string;
  name: string;
  email: string;
  password: string;
  tier: UserTier;
  /** Supabase auth.users.id to link this row to (optional). */
  authUid?: string;
}): Promise<User> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const existing = await getUserByEmail(email);
  if (existing) throw new EmailTakenError();

  const id = input.id ?? generateId("user");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const createdAt = new Date().toISOString();
  const authUid = input.authUid ?? null;

  await db.insert(schema.users).values({
    id,
    email,
    passwordHash,
    name: input.name.trim(),
    tier: input.tier,
    maskedInbox: "",
    onboarded: false,
    shareAge: false,
    shareGender: false,
    shareSmokerStatus: false,
    shareCoverageNeeds: false,
    shareBudgetRange: false,
    shareOccupation: false,
    shareHealthHistory: false,
    shareIncome: false,
    profile: {},
    createdAt,
    authUid,
  });

  return {
    id,
    email,
    passwordHash,
    name: input.name.trim(),
    tier: input.tier,
    maskedInbox: "",
    onboarded: false,
    consent: { ...DEFAULT_CONSENT },
    profile: {},
    createdAt,
    ...(authUid != null ? { authUid } : {}),
  };
}

/**
 * Read-modify-write a single user. Applies the mutator to a copy of the user,
 * then persists all mutable fields back to the DB. Returns the updated user,
 * or undefined if missing.
 */
export async function updateUser(
  id: string,
  mutate: (user: User) => void
): Promise<User | undefined> {
  const user = await getUserById(id);
  if (!user) return undefined;

  // Apply the mutation to a mutable copy.
  const mutable: User = {
    ...user,
    consent: { ...user.consent },
    profile: { ...(user.profile ?? {}) },
  };
  mutate(mutable);

  // Determine maskedInbox: generate one if the mutation left it blank.
  const maskedInbox = mutable.maskedInbox || generateMaskedAddress(id);

  await getDb()
    .update(schema.users)
    .set({
      tier: mutable.tier,
      name: mutable.name,
      maskedInbox,
      onboarded: mutable.onboarded,
      profile: mutable.profile ?? {},
      shareAge: mutable.consent.shareAge,
      shareGender: mutable.consent.shareGender,
      shareSmokerStatus: mutable.consent.shareSmokerStatus,
      shareCoverageNeeds: mutable.consent.shareCoverageNeeds,
      shareBudgetRange: mutable.consent.shareBudgetRange,
      shareOccupation: mutable.consent.shareOccupation,
      shareHealthHistory: mutable.consent.shareHealthHistory,
      shareIncome: mutable.consent.shareIncome,
    })
    .where(eq(schema.users.id, id));

  return { ...mutable, maskedInbox };
}
