/**
 * validators.ts — Zod schemas for all API request/response validation.
 *
 * All API route handlers validate incoming request bodies against these
 * schemas before passing data to the business logic layer.
 */

import { z } from "zod";
import { COUNTRY_OF_ORIGIN_OPTIONS } from "./countries";
import { ageFromDateOfBirth } from "./profile";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Please enter your name.").max(80),
    email: z.string().trim().toLowerCase().email("Please enter a valid email.").max(254),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(200)
      .regex(/[A-Za-z]/, "Password must contain a letter.")
      .regex(/\d/, "Password must contain a number."),
    confirmPassword: z.string(),
    tier: z.enum(["free", "premium"]).default("premium"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// ─── Plans ────────────────────────────────────────────────────────────────────

export const planFilterSchema = z.object({
  insurerId: z.string().optional(),
  minCoverage: z.coerce.number().optional(),
  maxCoverage: z.coerce.number().optional(),
  earlyStage: z.enum(["true", "false"]).optional(),
  sortBy: z
    .enum(["coverageAmount", "premiums", "illnessesCovered", "planName"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
});

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
  timestamp: z.string(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(chatMessageSchema).max(50).optional().default([]),
});

// ─── Outreach ─────────────────────────────────────────────────────────────────

export const draftRequestSchema = z.object({
  insurerId: z.string().min(1),
  templateId: z.string().min(1),
  userContext: z
    .object({
      age: z.number().int().min(18).max(80).optional(),
      gender: z.enum(["male", "female", "prefer_not_to_say"]).optional(),
      smoker: z.boolean().optional(),
      coverageNeeded: z.number().int().positive().optional(),
      monthlyBudget: z.number().int().positive().optional(),
    })
    .optional()
    .default({}),
});

export const sendRequestSchema = z.object({
  threadId: z.string().optional(),
  insurerId: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  userApproved: z.literal(true),
});

// ─── CRM / Threads ────────────────────────────────────────────────────────────

export const threadUpdateSchema = z.object({
  status: z
    .enum([
      "draft",
      "awaiting_approval",
      "sent",
      "replied",
      "info_received",
      "flagged",
      "closed",
    ])
    .optional(),
  flagReason: z.string().max(500).optional(),
  addedToComparison: z.boolean().optional(),
});

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const profileSchema = z.object({
  age: z.number().int().min(18).max(80).optional(),
  dateOfBirth: z.string().date().refine((value) => {
    const age = ageFromDateOfBirth(value);
    return age !== undefined && age >= 18 && age <= 80;
  }, "Date of birth must be for someone aged 18 to 80.").optional(),
  countryOfOrigin: z.enum(COUNTRY_OF_ORIGIN_OPTIONS).optional(),
  gender: z.enum(["male", "female", "prefer_not_to_say"]).optional(),
  smoker: z.boolean().optional(),
  coverageNeeded: z.number().int().positive().max(10_000_000).optional(),
  monthlyBudget: z.number().int().positive().max(100_000).optional(),
});

export const onboardingSchema = z.object({
  profile: profileSchema.optional(),
  consent: z.object({
    shareAge: z.boolean(),
    shareGender: z.boolean(),
    shareSmokerStatus: z.boolean(),
    shareCoverageNeeds: z.boolean(),
    shareBudgetRange: z.boolean(),
    shareOccupation: z.boolean(),
    shareHealthHistory: z.boolean(),
    shareIncome: z.boolean(),
  }),
});

// ─── Scraper ──────────────────────────────────────────────────────────────────

export const scraperTriggerSchema = z.object({
  sourceId: z.string().optional(), // if omitted, runs all sources
});
