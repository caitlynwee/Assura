export const dynamic = "force-dynamic";

import PageHeader from "@/components/layout/page-header";
import ScraperControls from "@/components/admin/scraper-controls";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Admin dashboard — Assura" };

export default async function AdminPage() {
  const user = await requireAdmin();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Admin dashboard"
        description={`Signed in as ${user.email}. Manage data refreshes and monitor scraper health.`}
      />
      <ScraperControls />
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-medium">Admin safeguards</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manual refreshes are audit-logged, protected by the internal scraper key, and restricted
          to accounts with the admin tier. Scraped data is only published when the scraper
          validation succeeds.
        </p>
      </section>
    </div>
  );
}
