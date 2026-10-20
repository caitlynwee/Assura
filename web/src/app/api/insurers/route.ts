import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getInsurers } from "@/lib/db";
import { getInsurerRecipientAddress } from "@/lib/insurer-recipient";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const insurers = await getInsurers();

  // Strip internal persona field from response
  const safe = insurers.map(({ id, name, agentEmail, logo, website }) => ({
    id,
    name,
    agentEmail: getInsurerRecipientAddress(id, agentEmail),
    logo,
    website,
  }));

  return NextResponse.json({ insurers: safe });
}
