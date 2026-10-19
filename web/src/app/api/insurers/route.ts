import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readJSON } from "@/lib/db";
import type { Insurer } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const insurers = readJSON<Insurer[]>("insurers.json");

  // Strip internal persona field from response
  const safe = insurers.map(({ id, name, agentEmail, logo, website }) => ({
    id,
    name,
    agentEmail,
    logo,
    website,
  }));

  return NextResponse.json({ insurers: safe });
}
