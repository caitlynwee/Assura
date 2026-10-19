/**
 * users.ts — User record helpers (Node.js runtime only; uses db.ts).
 *
 * Never import from middleware / auth.config.ts.
 */

import bcrypt from "bcryptjs";
import { readJSON, writeJSON } from "./db";
import { generateId } from "./utils";
import type { ConsentFlags, PublicUser, User, UserTier } from "./types";

const USERS_FILE = "users.json";

export const DEFAULT_CONSENT: ConsentFlags = {
  shareAge: false,
  shareGender: false,
  shareSmokerStatus: false,
  shareCoverageNeeds: false,
  shareBudgetRange: false,
  shareOccupation: false,
  shareHealthHistory: false, // Tier 3 — never shareable by the AI
  shareIncome: false, // Tier 3 — never shareable by the AI
};

export function readUsers(): User[] {
  try {
    return readJSON<User[]>(USERS_FILE);
  } catch {
    return [];
  }
}

export function findUserById(id: string): User | undefined {
  return readUsers().find((u) => u.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  const needle = email.trim().toLowerCase();
  return readUsers().find((u) => u.email.toLowerCase() === needle);
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
  name: string;
  email: string;
  password: string;
  tier: UserTier;
}): Promise<User> {
  const users = readUsers();
  const email = input.email.trim().toLowerCase();
  if (users.some((u) => u.email.toLowerCase() === email)) {
    throw new EmailTakenError();
  }

  const user: User = {
    id: generateId("user"),
    email,
    passwordHash: await bcrypt.hash(input.password, 10),
    name: input.name.trim(),
    tier: input.tier,
    maskedInbox: "", // assigned during onboarding
    onboarded: false,
    consent: { ...DEFAULT_CONSENT },
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeJSON(USERS_FILE, users);
  return user;
}

/** Read-modify-write a single user. Returns the updated user, or undefined if missing. */
export function updateUser(
  id: string,
  mutate: (user: User) => void
): User | undefined {
  const users = readUsers();
  const user = users.find((u) => u.id === id);
  if (!user) return undefined;
  mutate(user);
  writeJSON(USERS_FILE, users);
  return user;
}
