import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { chatRequestSchema } from "@/lib/validators";
import { evaluateAction } from "@/lib/policy";
import { chatWithPlans } from "@/lib/ai";
import {
  getPlans,
  getConversationById,
  getConversationMessages,
  insertConversation,
  appendConversationMessage,
} from "@/lib/db";
import type { ChatMessage } from "@/lib/types";

/** How many earlier messages are sent to the model as context. */
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
  const decision = evaluateAction("chat_qa", { userId, userTier });
  if (decision.outcome !== "allow") {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { message } = parsed.data;
  const now = new Date().toISOString();

  // Continue an existing conversation (ownership-checked) or start a new one.
  let conversationId = parsed.data.conversationId;
  let history: ChatMessage[] = [];
  if (conversationId) {
    const conversation = await getConversationById(conversationId, userId);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    history = (await getConversationMessages(conversationId)).slice(-HISTORY_LIMIT);
  } else {
    conversationId = randomUUID();
    await insertConversation({
      id: conversationId,
      userId,
      title: titleFrom(message),
      createdAt: now,
      updatedAt: now,
    });
  }

  const userMsg: ChatMessage = { role: "user", content: message, timestamp: now };
  await appendConversationMessage(conversationId, randomUUID(), userMsg);

  const plans = await getPlans();
  const convId = conversationId;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let answer = "";
      let clientGone = false;
      try {
        for await (const chunk of chatWithPlans([...history, userMsg], plans)) {
          answer += chunk;
          if (!clientGone) {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              // Client navigated away — keep generating so the answer is saved.
              clientGone = true;
            }
          }
        }
      } catch (err) {
        // Don't controller.error(): a stream that dies before its first byte
        // makes the server drop the connection with no response, and browsers
        // silently retry the POST — creating duplicate conversations. Finish
        // the response normally with a readable message instead.
        console.error("[chat] model call failed:", err);
        if (!clientGone) {
          try {
            controller.enqueue(
              encoder.encode(
                `${answer ? "\n\n" : ""}Sorry, the assistant couldn't answer right now. Please try again.`
              )
            );
          } catch {
            clientGone = true;
          }
        }
      } finally {
        // Persist whatever was generated so a refresh shows the full exchange.
        if (answer.trim()) {
          await appendConversationMessage(convId, randomUUID(), {
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
    },
  });
}
