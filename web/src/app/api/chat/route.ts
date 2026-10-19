import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatRequestSchema } from "@/lib/validators";
import { evaluateAction } from "@/lib/policy";
import { chatWithPlans } from "@/lib/ai";
import { readJSON } from "@/lib/db";
import type { Plan, ChatMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userTier = (session.user as any).tier;
  const decision = evaluateAction("chat_qa", {
    userId: session.user.id!,
    userTier,
  });
  if (decision.outcome !== "allow") {
    return NextResponse.json({ error: decision.reason }, { status: 403 });
  }

  const body = await req.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { message, history } = parsed.data;
  const plans = readJSON<Plan[]>("plans.json");

  const messages: ChatMessage[] = [
    ...(history as ChatMessage[]),
    {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    },
  ];

  // Return a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const encoder = new TextEncoder();
        for await (const chunk of chatWithPlans(messages, plans)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
