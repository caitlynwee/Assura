export const dynamic = "force-dynamic";

import PageHeader from "@/components/layout/page-header";
import SettingsForm from "@/components/settings/settings-form";
import { requireUser } from "@/lib/session";
import { DEMO_EMAIL } from "@/lib/demo";
import { findUserById } from "@/lib/users";

export const metadata = { title: "Settings — Assura" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; emailError?: string; billing?: string }>;
}) {
  const user = await requireUser();
  const appUser = await findUserById(user.id);
  const params = await searchParams;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your personal information and account."
      />
      <SettingsEmailNotice email={params.email} emailError={params.emailError} />
      <SettingsBillingNotice billing={params.billing} />
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

function SettingsBillingNotice({ billing }: { billing?: string }) {
  if (!billing) return null;
  const message =
    billing === "unavailable"
      ? "No Stripe subscription is linked to this account yet."
      : "We couldn't open Stripe Billing Portal. Please try again later.";
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function SettingsEmailNotice({
  email,
  emailError,
}: {
  email?: string;
  emailError?: string;
}) {
  if (email === "updated") {
    return (
      <p role="status" className="text-sm text-green-700">
        Your email address has been updated.
      </p>
    );
  }
  if (email === "pending") {
    return (
      <p role="status" className="text-sm">
        Confirmation received. Follow any remaining confirmation instructions from Supabase; the
        new address will appear here when the change is complete.
      </p>
    );
  }
  if (emailError) {
    const message =
      emailError === "email-conflict"
        ? "The confirmed email is already linked to another Assura account. Contact support."
        : emailError === "invalid-link"
          ? "This email confirmation link is invalid or incomplete."
          : "We couldn't confirm the email change. Request a new confirmation email and try again.";
    return (
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
    );
  }
  return null;
}
