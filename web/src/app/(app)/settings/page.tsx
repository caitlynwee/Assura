export const dynamic = "force-dynamic";

import PageHeader from "@/components/layout/page-header";
import SettingsForm from "@/components/settings/settings-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Settings — Assura" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your personal information and account."
      />
      <SettingsForm
        initialName={user.name}
        email={user.email}
        initialProfile={user.profile ?? {}}
        isDemoAccount={user.email.toLowerCase() === "demo@fineprint.local"}
      />
    </div>
  );
}
