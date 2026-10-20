import type { User } from "./types";

export const seedUsers: User[] = [
  {
    "id": "user_demo",
    "email": "demo@assura.local",
    "passwordHash": "$2b$10$fl8xtGoL3PPh77IWiCHgk.2MAjn6iN7MRofEki3Q7DWDh7MtHzyA2",
    "name": "Demo User",
    "tier": "premium",
    "maskedInbox": "user-demo@relay.assura.local",
    "onboarded": true,
    "consent": {
      "shareAge": true,
      "shareGender": true,
      "shareSmokerStatus": true,
      "shareCoverageNeeds": true,
      "shareBudgetRange": true,
      "shareOccupation": false,
      "shareHealthHistory": false,
      "shareIncome": false
    },
    "createdAt": "2026-10-01T00:00:00.000Z"
  },
  ...["jeff", "caitlyn", "marcus", "dominic"].map((slug) => ({
    id: `user_${slug}`,
    email: `${slug}@assura.local`,
    // bcrypt hash of "demo1234" (shared demo password for the team accounts).
    passwordHash: "$2b$10$j16DH8zDlfroLtlOc0XE1.DVSdj1i3lGMjSGlhuTKUjGB/H1iiLki",
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    tier: "premium" as const,
    maskedInbox: `user-${slug}@relay.assura.local`,
    onboarded: true,
    consent: {
      shareAge: true,
      shareGender: true,
      shareSmokerStatus: true,
      shareCoverageNeeds: true,
      shareBudgetRange: true,
      shareOccupation: false,
      shareHealthHistory: false,
      shareIncome: false,
    },
    createdAt: "2026-10-01T00:00:00.000Z",
  })),
];
