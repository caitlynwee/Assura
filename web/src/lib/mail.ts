/**
 * mail.ts — Mailpit SMTP integration.
 *
 * Sends from per-user relay addresses to Mailpit sandbox.
 * Nothing leaves the machine.
 *
 * Every email is prefixed with the AI disclosure text.
 * Rate limits are enforced here.
 */

import nodemailer from "nodemailer";
import { AI_DISCLOSURE_PREFIX, MAX_EMAILS_PER_USER_PER_DAY, FOLLOWUP_COOLDOWN_MS } from "./constants";
import { getThreadsByUser, getThreadById } from "./db";
import { logEvent } from "./audit";

const MAILPIT_HOST = process.env.MAILPIT_SMTP_HOST ?? "localhost";
const MAILPIT_PORT = parseInt(process.env.MAILPIT_SMTP_PORT ?? "1025", 10);

function createTransport() {
  return nodemailer.createTransport({
    host: MAILPIT_HOST,
    port: MAILPIT_PORT,
    secure: false,
    auth: undefined, // Mailpit requires no auth
  });
}

export function generateMaskedAddress(userId: string): string {
  // Deterministic: same userId always gets same relay address
  const slug = userId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12);
  return `user-${slug}@relay.fineprint.local`;
}

interface SendEmailParams {
  from: string; // masked relay address
  to: string; // insurer agent email
  subject: string;
  body: string;
  userId: string;
  threadId?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<string> {
  const { from, to, subject, body, userId, threadId } = params;

  // Check daily rate limit
  await checkDailyLimit(userId);

  // Check follow-up cooldown if this is a reply
  if (threadId) {
    await checkFollowUpCooldown(userId, threadId);
  }

  const transport = createTransport();

  const fullBody = `${AI_DISCLOSURE_PREFIX}\n\n${"─".repeat(60)}\n\n${body}`;

  const info = await transport.sendMail({
    from,
    to,
    subject,
    text: fullBody,
  });

  await logEvent(userId, "email.sent", {
    messageId: info.messageId,
    to,
    subject,
    threadId: threadId ?? null,
  });

  return info.messageId as string;
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
