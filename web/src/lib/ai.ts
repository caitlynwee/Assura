/**
 * ai.ts — DeepSeek (OpenAI-compatible) API helpers for trusted interactions.
 *
 * This module handles AI calls where the input is trusted (user messages,
 * plan data from our own database). For untrusted external text, use
 * quarantine.ts instead.
 *
 * All functions include system prompts that enforce:
 * - Factual comparison only — never "buy this plan"
 * - No financial advice — describe, don't recommend
 * - Cite sources in responses
 */

import OpenAI from "openai";
import type { Plan, ChatMessage, ConsentFlags } from "./types";


let _client: OpenAI | null = null;

function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
    });
  }
  return _client;
}

const FACTUAL_GUARDRAIL = `IMPORTANT: You provide factual information and comparisons only. You NEVER recommend that a user buy, choose, or purchase any specific plan. You NEVER provide financial advice. When describing plans, use neutral, factual language. Always cite the source plan name when referencing specific data.`;

// ─── Plan Q&A Chat ────────────────────────────────────────────────────────────

export async function* chatWithPlans(
  messages: ChatMessage[],
  plans: Plan[]
): AsyncGenerator<string> {
  const planContext = plans
    .map(
      (p) =>
        `Plan: ${p.planName} (${p.insurerName})\n` +
        `Coverage: SGD ${p.coverageAmount.toLocaleString()}\n` +
        `Illnesses covered: ${p.illnessesCovered}\n` +
        `Early stage: ${p.earlyStageConditions ? "Yes" : "No"}\n` +
        `Key benefits: ${p.keyBenefits.join("; ")}\n` +
        `Exclusions: ${p.exclusions.join("; ")}\n` +
        `Source: ${p.sourceUrl} (data as of ${p.dataAsOf})`
    )
    .join("\n\n---\n\n");

  const stream = await client().chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 1024,
    stream: true,
    messages: [
      {
        role: "system",
        content: `You are Fineprint's plan information assistant. You answer questions about critical illness insurance plans using only the plan data provided below. ${FACTUAL_GUARDRAIL}\n\nWhen citing plan data, always mention the plan name and insurer. Format citations as [Plan Name — Insurer].\n\n---PLAN DATA---\n${planContext}`,
      },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

// ─── Outreach Email Drafting ──────────────────────────────────────────────────

export async function draftOutreachEmail(params: {
  insurerName: string;
  templatePromptHint: string;
  consent: ConsentFlags;
  userName?: string;
  userContext: {
    age?: number;
    gender?: string;
    smoker?: boolean;
    coverageNeeded?: number;
    monthlyBudget?: number;
  };
}): Promise<string> {
  const { insurerName, templatePromptHint, consent, userName, userContext } = params;
  const signOffName = (userName ?? "").trim() || "A prospective customer";

  // Only include what the user consented to share
  const sharedDetails: string[] = [];
  if (consent.shareAge && userContext.age) sharedDetails.push(`Age: ${userContext.age}`);
  if (consent.shareGender && userContext.gender) sharedDetails.push(`Gender: ${userContext.gender}`);
  if (consent.shareSmokerStatus && userContext.smoker !== undefined)
    sharedDetails.push(`Smoker: ${userContext.smoker ? "Yes" : "No"}`);
  if (consent.shareCoverageNeeds && userContext.coverageNeeded)
    sharedDetails.push(`Coverage needed: SGD ${userContext.coverageNeeded.toLocaleString()}`);
  if (consent.shareBudgetRange && userContext.monthlyBudget)
    sharedDetails.push(`Monthly budget: SGD ${userContext.monthlyBudget}`);

  const response = await client().chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 600,
    messages: [
      {
        role: "system",
        content: `You are writing an email IN THE FIRST PERSON AS the customer (named below) — as if the customer themselves is reaching out to the insurer to enquire about critical illness cover. Write it the way a real person would: first person ("I'm looking at...", "Could you tell me..."), warm but concise, no corporate boilerplate. ${FACTUAL_GUARDRAIL}\n\nRULES:\n1. Write in the first person as the customer. Sign off with the customer's name: "${signOffName}".\n2. Do NOT describe yourself as an AI or assistant in the body, and do NOT say "on behalf of" — the customer is speaking directly. (A short system disclosure footer is appended separately; you do not write it.)\n3. Only include the personal details explicitly provided below. NEVER invent or request NRIC, health history, income, or phone number.\n4. Do not agree to any purchases, sign-ups, or appointments.\n5. Keep it to a few short paragraphs.`,
      },
      {
        role: "user",
        content: `Write my email to ${insurerName}.\n\nWhat I want to ask about: ${templatePromptHint}\n\nDetails about me I'm willing to share:\n${sharedDetails.length > 0 ? sharedDetails.join("\n") : "No personal details to share at this time."}\n\nSign off as: ${signOffName}`,
      },
    ],
  });

  return response.choices[0]?.message?.content ?? "";
}

// ─── Quote Extraction (from thread — uses quarantine.ts) ──────────────────────
// See quarantine.ts for the actual implementation. This is a convenience wrapper.

export async function extractQuoteFromThread(
  threadMessages: Array<{ direction: string; body: string }>
): Promise<{
  annualPremium?: number;
  coverageAmount?: number;
  waitingPeriod?: string;
  exclusionsNoted?: string[];
  riderOptions?: string[];
  validUntil?: string;
  rawNotes?: string;
}> {
  const { parseUntrustedText } = await import("./quarantine");
  const { z } = await import("zod");

  const schema = z.object({
    annualPremium: z.number().optional(),
    coverageAmount: z.number().optional(),
    waitingPeriod: z.string().optional(),
    exclusionsNoted: z.array(z.string()).optional(),
    riderOptions: z.array(z.string()).optional(),
    validUntil: z.string().optional(),
    rawNotes: z.string().optional(),
  });

  // Only pass inbound (insurer) messages to the quarantine reader
  const inboundText = threadMessages
    .filter((m) => m.direction === "inbound")
    .map((m) => m.body)
    .join("\n\n---\n\n");

  if (!inboundText.trim()) {
    return {};
  }

  return parseUntrustedText(
    inboundText,
    schema,
    "Extract any insurance quote details from this email thread reply. Look for: annual premium amount (SGD), coverage amount (SGD), waiting period, exclusions mentioned, available riders, and quote validity date."
  );
}
