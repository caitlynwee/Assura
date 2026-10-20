export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getInsurers, getThreadsByUser } from "@/lib/db";
import OutreachWizard, { type InsurerOption } from "@/components/outreach/outreach-wizard";
import PageHeader from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { Insurer, Thread } from "@/lib/types";

export const metadata = { title: "Outreach — Assura" };

function buildInsurerOptions(
  insurers: Insurer[],
  threads: Thread[],
  userId: string
): InsurerOption[] {
  const userThreads = threads.filter((t) => t.userId === userId);
  // Persona is internal (simulation) — never sent to the browser.
  return insurers.map(({ id, name, agentEmail, website }) => {
    const latest = userThreads
      .filter((t) => t.insurerId === id && t.status !== "closed")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return {
      id,
      name,
      agentEmail,
      website,
      existingThread: latest ? { id: latest.id, status: latest.status } : undefined,
    };
  });
}

export default async function OutreachPage() {
  const user = await requireUser();
  if (user.tier !== "premium" && user.tier !== "admin") redirect("/upgrade?from=/outreach");
  if (!user.onboarded) redirect("/onboarding");

  let insurers: Insurer[] = [];
  let threads: Thread[] = [];
  try {
    insurers = await getInsurers();
  } catch {
    /* empty list renders a helpful message */
  }
  try {
    threads = await getThreadsByUser(user.id);
  } catch {
    /* no threads yet */
  }

  const insurerOptions = buildInsurerOptions(insurers, threads, user.id);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Outreach"
        description="Pick up to 5 insurers and a question. Assura drafts each email — you edit and approve before anything is sent."
      />
      {insurerOptions.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No insurers found. Run <code className="font-mono">bash seed/reset.sh</code> to load demo data.
          </CardContent>
        </Card>
      ) : (
        <OutreachWizard
          insurers={insurerOptions}
          maskedInbox={user.maskedInbox}
          consent={user.consent}
          profile={user.profile ?? {}}
        />
      )}
    </div>
  );
}
