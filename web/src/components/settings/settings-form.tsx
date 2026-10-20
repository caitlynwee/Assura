"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  downgradeToFreeAction,
  requestEmailChangeAction,
  saveSettingsAction,
} from "@/app/_actions/settings";
import { openBillingPortalAction } from "@/app/_actions/billing";
import DeleteAccountDialog from "@/components/account/delete-account-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserProfile, UserTier } from "@/lib/types";
import { dateOfBirthInputBounds } from "@/lib/profile";
import { COUNTRY_OF_ORIGIN_OPTIONS } from "@/lib/countries";
import { Trash2Icon } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export default function SettingsForm({
  initialName,
  email,
  tier,
  hasStripeCustomer,
  initialProfile,
  isDemoAccount,
}: {
  initialName: string;
  email: string;
  tier: UserTier;
  hasStripeCustomer: boolean;
  initialProfile: UserProfile;
  isDemoAccount: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [newEmail, setNewEmail] = useState("");
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [emailPending, startEmailTransition] = useTransition();
  const tt = useT();
  const t = tt.account.settings;
  const p = tt.profile;

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function updateDateOfBirth(value: string) {
    setProfile((current) => {
      const next = { ...current, dateOfBirth: value || undefined };
      if (value) delete next.age;
      return next;
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const cleanProfile = Object.fromEntries(
      Object.entries(profile).filter(([, value]) => value !== undefined && value !== "")
    );

    startTransition(async () => {
      const result = await saveSettingsAction({ name, profile: cleanProfile });
      if (result.ok) {
        toast.success(t.saved);
      } else {
        setError(result.error);
      }
    });
  }

  function submitEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setEmailNotice(null);

    startEmailTransition(async () => {
      const result = await requestEmailChangeAction({ email: newEmail });
      if (result.ok) {
        setEmailNotice(t.checkInbox(result.pendingEmail));
        setNewEmail("");
      } else {
        setEmailError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t.emailCardTitle}</CardTitle>
          <CardDescription>{t.emailCardDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-email">{t.currentEmail}</Label>
            <Input id="settings-email" type="email" value={email} readOnly />
          </div>
          {isDemoAccount ? (
            <p className="text-sm text-muted-foreground">
              {t.demoEmailFixed}
            </p>
          ) : (
            <form onSubmit={submitEmailChange} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="settings-new-email">{t.newEmail}</Label>
                <Input
                  id="settings-new-email"
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  required
                />
              </div>
              {emailError && (
                <Alert variant="destructive">
                  <AlertDescription>{emailError}</AlertDescription>
                </Alert>
              )}
              {emailNotice && (
                <Alert>
                  <AlertDescription>{emailNotice}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" loading={emailPending}>
                {t.sendConfirmation}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.personalTitle}</CardTitle>
            <CardDescription>{t.personalDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="settings-name">{t.name}</Label>
              <Input
                id="settings-name"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-birthday">{p.birthday}</Label>
              <Input
                id="settings-birthday"
                type="date"
                {...dateOfBirthInputBounds()}
                value={profile.dateOfBirth ?? ""}
                onChange={(event) => updateDateOfBirth(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-country">{p.country}</Label>
              <Select
                value={profile.countryOfOrigin ?? "unset"}
                onValueChange={(value) =>
                  update(
                    "countryOfOrigin",
                    value === "unset"
                      ? undefined
                      : COUNTRY_OF_ORIGIN_OPTIONS.find((country) => country === value)
                  )
                }
              >
                <SelectTrigger id="settings-country">
                  <SelectValue placeholder={p.selectCountry} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">{p.notProvided}</SelectItem>
                  {COUNTRY_OF_ORIGIN_OPTIONS.map((country) => (
                    <SelectItem key={country} value={country}>
                      {p.countries[country] ?? country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-gender">{p.gender}</Label>
              <Select
                value={profile.gender ?? "unset"}
                onValueChange={(value) =>
                  update("gender", value === "unset" ? undefined : (value as UserProfile["gender"]))
                }
              >
                <SelectTrigger id="settings-gender">
                  <SelectValue placeholder={p.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">{p.notProvided}</SelectItem>
                  <SelectItem value="female">{p.female}</SelectItem>
                  <SelectItem value="male">{p.male}</SelectItem>
                  <SelectItem value="prefer_not_to_say">{p.preferNotToSay}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-smoker">{p.smokerStatus}</Label>
              <Select
                value={profile.smoker === undefined ? "unset" : profile.smoker ? "yes" : "no"}
                onValueChange={(value) =>
                  update("smoker", value === "unset" ? undefined : value === "yes")
                }
              >
                <SelectTrigger id="settings-smoker">
                  <SelectValue placeholder={p.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">{p.notProvided}</SelectItem>
                  <SelectItem value="no">{p.nonSmoker}</SelectItem>
                  <SelectItem value="yes">{p.smoker}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-coverage">{p.coverageNeeded}</Label>
              <Input
                id="settings-coverage"
                type="number"
                min={1}
                max={10_000_000}
                value={profile.coverageNeeded ?? ""}
                onChange={(event) =>
                  update("coverageNeeded", event.target.value ? Number(event.target.value) : undefined)
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-budget">{p.monthlyBudget}</Label>
              <Input
                id="settings-budget"
                type="number"
                min={1}
                max={100_000}
                value={profile.monthlyBudget ?? ""}
                onChange={(event) =>
                  update("monthlyBudget", event.target.value ? Number(event.target.value) : undefined)
                }
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" loading={pending}>
          {t.savePersonal}
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{t.planTitle}</CardTitle>
          <CardDescription>
            {t.currentPlan} <strong>{tier === "admin" ? tt.common.admin : tier === "premium" ? tt.common.premium : tt.common.free}</strong>.
            {tier === "premium" ? t.premiumPlanNote : t.freePlanNote}
          </CardDescription>
        </CardHeader>
        {tier === "premium" && (
          <CardContent>
            {isDemoAccount ? (
              <p className="text-sm text-muted-foreground">
                {t.demoStaysPremium}
              </p>
            ) : hasStripeCustomer ? (
              <form action={openBillingPortalAction}>
                <Button type="submit" variant="outline">
                  {t.manageSubscription}
                </Button>
              </form>
            ) : (
              <form
                action={downgradeToFreeAction}
                onSubmit={(event) => {
                  if (!window.confirm(t.confirmDowngrade)) {
                    event.preventDefault();
                  }
                }}
              >
                <Button type="submit" variant="outline">
                  {t.downgrade}
                </Button>
              </form>
            )}
          </CardContent>
        )}
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>{t.deleteTitle}</CardTitle>
          <CardDescription>{t.deleteDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {isDemoAccount && (
            <p className="mb-3 text-sm text-muted-foreground">
              {t.demoProtected}
            </p>
          )}
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={isDemoAccount}
          >
            <Trash2Icon />
            {t.deleteButton}
          </Button>
        </CardContent>
      </Card>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
