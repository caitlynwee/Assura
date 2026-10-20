export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getInsurers, getThreadsByUser } from "@/lib/db";
import OutreachWizard, { type InsurerOption } from "@/components/outreach/outreach-wizard";
import PageHeader from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import type { Insurer, Thread } from "@/lib/types";
import { getInsurerRecipientAddress } from "@/lib/insurer-recipient";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).outreach.meta };
}

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
      agentEmail: getInsurerRecipientAddress(id, agentEmail),
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
  const t = (await getT()).outreach;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
      />
      {insurerOptions.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            {t.noInsurersBefore} <code className="font-mono">bash seed/reset.sh</code> {t.noInsurersAfter}
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
