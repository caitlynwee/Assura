export const dynamic = "force-dynamic";

import PageHeader from "@/components/layout/page-header";
import ScraperControls from "@/components/admin/scraper-controls";
import AddPlanForm from "@/components/admin/add-plan-form";
import { requireAdmin } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).admin.meta };
}

export default async function AdminPage() {
  const user = await requireAdmin();
  const t = (await getT()).admin;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description(user.email)}
      />
      <ScraperControls />
      <AddPlanForm />
      <section className="rounded-lg border bg-card p-5">
        <h2 className="font-medium">{t.safeguardsTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.safeguardsBody}
        </p>
      </section>
    </div>
  );
}
