import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { policyChatRequestSchema } from "@/lib/validators";
import { evaluateAction } from "@/lib/policy";
import { chatWithPolicy } from "@/lib/ai";
import { getLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";
import {
  getPolicyDocumentById,
  getPolicyConversationById,
  getPolicyConversationMessages,
  insertPolicyConversation,
  appendPolicyMessage,
  truncatePolicyConversationFrom,
} from "@/lib/db";
import { logEvent } from "@/lib/audit";
import type { ChatMessage } from "@/lib/types";

const HISTORY_LIMIT = 50;
const TITLE_MAX = 60;

function titleFrom(message: string): string {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1)}…` : oneLine;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;

  const decision = evaluateAction("policy_chat", { userId, userTier });
  if (decision.outcome !== "allow") {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = policyChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { message, documentId, editMessageId } = parsed.data;
  const now = new Date().toISOString();

  // Ownership-checked document fetch (metadata + extracted text).
  const doc = await getPolicyDocumentById(documentId, userId);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Continue an existing conversation or start a new one.
  let conversationId = parsed.data.conversationId;
  let history: ChatMessage[] = [];
  if (conversationId) {
    const conversation = await getPolicyConversationById(conversationId, userId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (editMessageId) {
      const ok = await truncatePolicyConversationFrom(conversationId, editMessageId);
      if (!ok) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
      void logEvent(userId, "policy_chat.message_edited", {
        conversationId,
        messageId: editMessageId,
      }).catch(() => {});
    }
    history = (await getPolicyConversationMessages(conversationId)).slice(-HISTORY_LIMIT);
  } else {
    conversationId = randomUUID();
    await insertPolicyConversation({
      id: conversationId,
      userId,
      documentId,
      title: titleFrom(message),
      createdAt: now,
      updatedAt: now,
    });
  }

  const userMsgId = randomUUID();
  const assistantMsgId = randomUUID();
  const userMsg: ChatMessage = { role: "user", content: message, timestamp: now };
  await appendPolicyMessage(conversationId, userMsgId, userMsg);

  const locale = await getLocale();
  const fallbackText = getMessages(locale).policyChat.modelUnavailable;
  const documentText = doc.extractedText ?? "";
  const convId = conversationId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let answer = "";
      let clientGone = false;
      try {
        for await (const chunk of chatWithPolicy(
          [...history, userMsg],
          documentText,
          doc.title,
          locale
        )) {
          answer += chunk;
          if (!clientGone) {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              clientGone = true;
            }
          }
        }
      } catch (err) {
        console.error("[policy-chat] model call failed:", err);
        if (!clientGone) {
          try {
            controller.enqueue(
              encoder.encode(`${answer ? "\n\n" : ""}${fallbackText}`)
            );
          } catch {
            clientGone = true;
          }
        }
      } finally {
        if (answer.trim()) {
          await appendPolicyMessage(convId, assistantMsgId, {
            role: "assistant",
            content: answer,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Conversation-Id": convId,
      "X-User-Message-Id": userMsgId,
      "X-Assistant-Message-Id": assistantMsgId,
    },
  });
}
