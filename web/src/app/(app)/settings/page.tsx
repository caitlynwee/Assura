export const dynamic = "force-dynamic";

import PageHeader from "@/components/layout/page-header";
import SettingsForm from "@/components/settings/settings-form";
import { requireUser } from "@/lib/session";
import { DEMO_EMAIL } from "@/lib/demo";
import { findUserById } from "@/lib/users";
import { getT } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";

export async function generateMetadata() {
  return { title: (await getT()).account.settings.meta };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; emailError?: string; billing?: string }>;
}) {
  const user = await requireUser();
  const appUser = await findUserById(user.id);
  const params = await searchParams;
  const t = (await getT()).account.settings;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
      />
      <SettingsEmailNotice t={t} email={params.email} emailError={params.emailError} />
      <SettingsBillingNotice t={t} billing={params.billing} />
      <SettingsForm
        initialName={user.name}
        email={user.email}
        tier={user.tier}
        hasStripeCustomer={Boolean(appUser?.stripeCustomerId)}
        initialProfile={user.profile ?? {}}
        isDemoAccount={user.email.toLowerCase() === DEMO_EMAIL}
      />
    </div>
  );
}

type T = Messages["account"]["settings"];

function SettingsBillingNotice({ t, billing }: { t: T; billing?: string }) {
  if (!billing) return null;
  const message =
    billing === "unavailable"
      ? t.billingUnavailable
      : t.billingPortalFailed;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function SettingsEmailNotice({
  t,
  email,
  emailError,
}: {
  t: T;
  email?: string;
  emailError?: string;
}) {
  if (email === "updated") {
    return (
      <p role="status" className="text-sm text-green-700">
        {t.emailUpdated}
      </p>
    );
  }
  if (email === "pending") {
    return (
      <p role="status" className="text-sm">
        {t.emailPending}
      </p>
    );
  }
  if (emailError) {
    const message =
      emailError === "email-conflict"
        ? t.emailConflict
        : emailError === "invalid-link"
          ? t.emailInvalidLink
          : t.emailConfirmFailed;
    return (
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
    );
  }
  return null;
}
