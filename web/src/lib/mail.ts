/**
 * mail.ts — Mailpit SMTP integration.
 *
 * Sends approved outreach through the local relay service to Mailpit only.
 *
 * The outreach service appends the AI disclosure footer and owns SMTP delivery.
 * Rate limits are enforced here before forwarding an approved send.
 */

import { MAX_EMAILS_PER_USER_PER_DAY, FOLLOWUP_COOLDOWN_MS } from "./constants";
import { getThreadsByUser, getThreadById } from "./db";
import { logEvent } from "./audit";

const SCRAPER_URL = process.env.SCRAPER_URL ?? "http://localhost:8100";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "dev-internal-key";

export function generateMaskedAddress(userId: string): string {
  // Deterministic: same userId always gets same relay address
  const slug = userId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12);
  return `user-${slug}@relay.assura.local`;
}

interface SendEmailParams {
  from: string; // masked relay address
  to: string; // insurer agent email
  subject: string;
  body: string;
  userId: string;
  threadId?: string;
}

export async function sendEmail(
  params: SendEmailParams
): Promise<{ messageId: string; from: string; to: string }> {
  const { from, to, subject, body, userId, threadId } = params;

  // Check daily rate limit
  await checkDailyLimit(userId);

  // Check follow-up cooldown if this is a reply
  if (threadId) {
    await checkFollowUpCooldown(userId, threadId);
  }

  const response = await fetch(`${SCRAPER_URL}/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-api-key": INTERNAL_API_SECRET,
    },
    body: JSON.stringify({
      from_address: from,
      to_address: to,
      subject,
      body,
      user_id: userId,
      thread_id: threadId,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Outreach server rejected email (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    message_id?: string;
    from_address?: string;
    to_address?: string;
  };
  const messageId = result.message_id;
  if (!messageId || !result.from_address || !result.to_address) {
    throw new Error("Outreach server returned an incomplete send confirmation.");
  }

  logEvent(userId, "email.sent", {
    messageId,
    to: result.to_address,
    subject,
    threadId: threadId ?? null,
  });
  return { messageId, from: result.from_address, to: result.to_address };
}

async function checkDailyLimit(userId: string): Promise<void> {
  const threads = await getThreadsByUser(userId);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCount = threads
    .flatMap((t) => t.messages)
    .filter(
      (m) =>
        m.direction === "outbound" &&
        new Date(m.timestamp) >= todayStart
    ).length;

  if (todayCount >= MAX_EMAILS_PER_USER_PER_DAY) {
    throw new Error(
      `Daily email limit reached (${MAX_EMAILS_PER_USER_PER_DAY} emails per day). Try again tomorrow.`
    );
  }
}

async function checkFollowUpCooldown(
  userId: string,
  threadId: string
): Promise<void> {
  const thread = await getThreadById(threadId, userId);

  if (!thread) return;

  const lastOutbound = thread.messages
    .filter((m) => m.direction === "outbound")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

  if (!lastOutbound) return;

  const elapsed = Date.now() - new Date(lastOutbound.timestamp).getTime();
  if (elapsed < FOLLOWUP_COOLDOWN_MS) {
    const hoursLeft = Math.ceil((FOLLOWUP_COOLDOWN_MS - elapsed) / (1000 * 60 * 60));
    throw new Error(
      `Follow-up cooldown active. You can send another message to this insurer in ${hoursLeft} hour(s).`
    );
  }
}
