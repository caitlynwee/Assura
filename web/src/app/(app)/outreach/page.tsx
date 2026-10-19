export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { readJSON } from "@/lib/db";
import OutreachWizard, { type InsurerOption } from "@/components/outreach/outreach-wizard";
import type { Insurer, Thread } from "@/lib/types";

export const metadata = { title: "Outreach — Assura" };

function loadInsurers(userId: string): InsurerOption[] {
  let insurers: Insurer[] = [];
  let threads: Thread[] = [];
  try {
    insurers = readJSON<Insurer[]>("insurers.json");
  } catch {
    /* empty list renders a helpful message */
  }
  try {
    threads = readJSON<Thread[]>("threads.json").filter((t) => t.userId === userId);
  } catch {
    /* no threads yet */
  }

  // Persona is internal (simulation) — never sent to the browser.
  return insurers.map(({ id, name, agentEmail, website }) => {
    const latest = threads
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
  if (user.tier !== "premium") redirect("/upgrade?from=/outreach");
  if (!user.onboarded) redirect("/onboarding");

  const insurers = loadInsurers(user.id);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Outreach</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pick up to 5 insurers and a question. Assura drafts each email — you edit and approve
          before anything is sent.
        </p>
      </div>
      {insurers.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          No insurers found. Run <code className="font-mono">bash seed/reset.sh</code> to load demo data.
        </div>
      ) : (
        <OutreachWizard
          insurers={insurers}
          maskedInbox={user.maskedInbox}
          consent={user.consent}
          profile={user.profile ?? {}}
        />
      )}
    </div>
  );
}
