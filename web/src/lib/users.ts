/**
 * users.ts — User record helpers (Node.js runtime only; uses db.ts / Drizzle).
 *
 * Never import from middleware / auth.config.ts.
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, getUserById, getUserByEmail } from "./db";
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

export { getUserById as findUserById, getUserByEmail as findUserByEmail };

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
  name: string;
  email: string;
  password: string;
  tier: UserTier;
}): Promise<User> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const existing = await getUserByEmail(email);
  if (existing) throw new EmailTakenError();

  const id = generateId("user");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const createdAt = new Date().toISOString();

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
    createdAt,
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
    createdAt,
  };
}

/**
 * Read-modify-write a single user. Applies the mutator to a copy of the user,
 * then persists all mutable fields back to the DB. Returns the updated user,
 * or undefined if missing.
 *
 * Note: `profile` on the User type is not persisted (no DB column yet).
 */
export async function updateUser(
  id: string,
  mutate: (user: User) => void
): Promise<User | undefined> {
  const user = await getUserById(id);
  if (!user) return undefined;

  // Apply the mutation to a mutable copy.
  const mutable: User = { ...user, consent: { ...user.consent } };
  mutate(mutable);

  // Determine maskedInbox: generate one if the mutation left it blank.
  const maskedInbox = mutable.maskedInbox || generateMaskedAddress(id);

  await getDb()
    .update(schema.users)
    .set({
      tier: mutable.tier,
      maskedInbox,
      onboarded: mutable.onboarded,
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
