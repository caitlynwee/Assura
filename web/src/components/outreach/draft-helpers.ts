import { AI_DISCLOSURE_FOOTER } from "@/lib/constants";
import type { OutreachTemplate } from "@/lib/types";

export interface OutreachContext {
  age?: number;
  gender?: "male" | "female" | "prefer_not_to_say";
  smoker?: boolean;
  coverageNeeded?: number;
  monthlyBudget?: number;
}

/** Placeholder the AI writes in place of the insurer name (see lib/ai.ts). */
export const INSURER_PLACEHOLDER = "[INSURER]";

/** The relay appends the AI disclosure footer on send, so drop it from the editable body. */
export function stripDisclosure(body: string): string {
  let out = body.trimStart();
  // Safety net: strip a stray "Subject:" line if the model emitted one despite
  // being told not to (the subject is a separate field).
  out = out.replace(/^subject:.*(\r?\n)+/i, "").trimStart();
  if (out.startsWith(AI_DISCLOSURE_FOOTER)) {
    out = out.slice(AI_DISCLOSURE_FOOTER.length).replace(/^[\s─-]+/, "");
  }
  return out.trim();
}

/** Substitute the insurer-name placeholder with a real insurer name, so one
 *  generated draft can be reused across all selected insurers. */
export function applyInsurerName(body: string, insurerName: string): string {
  return body.split(INSURER_PLACEHOLDER).join(insurerName);
}

export function defaultSubject(template: OutreachTemplate): string {
  return `${template.label}: critical illness cover`;
}

export function appendNotes(body: string, notes: string): string {
  const n = notes.trim();
  return n ? `${body.trimEnd()}\n\nAdditional notes:\n${n}` : body;
}

const TEMPLATE_ASK: Record<string, string> = {
  request_quote:
    "Could you share a personalised premium quote for your critical illness plans, including the coverage amount and any optional riders?",
  ask_exclusions:
    "Could you clarify the main exclusions, waiting periods and any conditions that affect eligibility under your critical illness plans?",
  ask_riders:
    "Could you outline the optional riders available with your critical illness plans, such as early-stage cover, premium waiver or multi-pay options?",
  compare_plans:
    "Could you briefly outline the critical illness plan options you offer and the key differences in coverage, premiums and terms?",
  follow_up:
    "I'm following up on my earlier enquiry and would appreciate an update when convenient.",
};

/**
 * Deterministic fallback used when AI drafting is unavailable (e.g. no API key
 * at the venue). Only includes fields the user consented to share.
 */
export function templateDraft(
  insurerName: string,
  template: OutreachTemplate,
  ctx: OutreachContext
): string {
  const details: string[] = [];
  if (ctx.age) details.push(`- Age: ${ctx.age}`);
  if (ctx.gender && ctx.gender !== "prefer_not_to_say") details.push(`- Gender: ${ctx.gender}`);
  if (ctx.smoker !== undefined) details.push(`- Smoker: ${ctx.smoker ? "Yes" : "No"}`);
  if (ctx.coverageNeeded) details.push(`- Coverage sought: SGD ${ctx.coverageNeeded.toLocaleString()}`);
  if (ctx.monthlyBudget) details.push(`- Monthly budget: around SGD ${ctx.monthlyBudget}`);

  return [
    `Dear ${insurerName} team,`,
    "",
    `I'm comparing critical illness cover options. ${TEMPLATE_ASK[template.id] ?? template.description}`,
    ...(details.length ? ["", "Relevant details:", ...details] : []),
    "",
    "Please reply to this address. I'm gathering information only at this stage and am not able to commit to a purchase or book a call.",
    "",
    "Thank you,",
    "An Assura customer",
  ].join("\n");
}
