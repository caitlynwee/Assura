"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  downgradeToFreeAction,
  requestEmailChangeAction,
  saveSettingsAction,
} from "@/app/_actions/settings";
import DeleteAccountDialog from "@/components/account/delete-account-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserProfile } from "@/lib/types";
import { dateOfBirthInputBounds } from "@/lib/profile";
import { COUNTRY_OF_ORIGIN_OPTIONS } from "@/lib/countries";
import { Trash2Icon } from "lucide-react";

export default function SettingsForm({
  initialName,
  email,
  tier,
  initialProfile,
  isDemoAccount,
}: {
  initialName: string;
  email: string;
  tier: "free" | "premium";
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
        toast.success("Your settings have been saved.");
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
        setEmailNotice(`Check ${result.pendingEmail} for a confirmation link to finish changing your email.`);
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
          <CardTitle>Account email</CardTitle>
          <CardDescription>
            Your email is used to sign in. Supabase will send a confirmation link before the new
            address takes effect. Depending on project settings, you may need to confirm from both
            your current and new email inboxes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="settings-email">Current email</Label>
            <Input id="settings-email" type="email" value={email} readOnly />
          </div>
          {isDemoAccount ? (
            <p className="text-sm text-muted-foreground">
              The shared demo account email is fixed. Create a personal account to use your own
              sign-in email.
            </p>
          ) : (
            <form onSubmit={submitEmailChange} className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="settings-new-email">New email</Label>
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
                Send confirmation link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
            <CardDescription>
              Your details are stored in your Assura account. Your birthday and country are never
              sent to insurers; you can separately consent to sharing your derived age.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="settings-name">Name</Label>
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
              <Label htmlFor="settings-birthday">Birthday</Label>
              <Input
                id="settings-birthday"
                type="date"
                {...dateOfBirthInputBounds()}
                value={profile.dateOfBirth ?? ""}
                onChange={(event) => updateDateOfBirth(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-country">Country of origin</Label>
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
                  <SelectValue placeholder="Select country…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not provided</SelectItem>
                  {COUNTRY_OF_ORIGIN_OPTIONS.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-gender">Gender</Label>
              <Select
                value={profile.gender ?? "unset"}
                onValueChange={(value) =>
                  update("gender", value === "unset" ? undefined : (value as UserProfile["gender"]))
                }
              >
                <SelectTrigger id="settings-gender">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not provided</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-smoker">Smoker status</Label>
              <Select
                value={profile.smoker === undefined ? "unset" : profile.smoker ? "yes" : "no"}
                onValueChange={(value) =>
                  update("smoker", value === "unset" ? undefined : value === "yes")
                }
              >
                <SelectTrigger id="settings-smoker">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">Not provided</SelectItem>
                  <SelectItem value="no">Non-smoker</SelectItem>
                  <SelectItem value="yes">Smoker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="settings-coverage">Coverage needed (SGD)</Label>
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
              <Label htmlFor="settings-budget">Monthly budget (SGD)</Label>
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
          Save personal information
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            Current plan: <strong>{tier === "premium" ? "Premium" : "Free"}</strong>.
            {tier === "premium"
              ? " Downgrading removes access to outreach and CRM features; your account and saved data remain."
              : " Free includes plan comparison and cited Q&A."}
          </CardDescription>
        </CardHeader>
        {tier === "premium" && (
          <CardContent>
            {isDemoAccount ? (
              <p className="text-sm text-muted-foreground">
                The shared demo account stays on Premium so the demo features remain available.
              </p>
            ) : (
              <form
                action={downgradeToFreeAction}
                onSubmit={(event) => {
                  if (!window.confirm("Downgrade to Free? Premium outreach and CRM access will end immediately.")) {
                    event.preventDefault();
                  }
                }}
              >
                <Button type="submit" variant="outline">
                  Downgrade to Free
                </Button>
              </form>
            )}
          </CardContent>
        )}
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently delete your profile, outreach threads, and extracted quotes.
            Your append-only audit entries are retained.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDemoAccount && (
            <p className="mb-3 text-sm text-muted-foreground">
              The shared demo account is protected from deletion.
            </p>
          )}
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={isDemoAccount}
          >
            <Trash2Icon />
            Delete account
          </Button>
        </CardContent>
      </Card>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
