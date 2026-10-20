"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CopyIcon,
  LockIcon,
  MoveRightIcon,
  ShieldBanIcon,
} from "lucide-react";
import { saveOnboardingAction } from "@/app/_actions/onboarding";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import type { ConsentFlags, UserProfile } from "@/lib/types";
import { dateOfBirthInputBounds, profileAge } from "@/lib/profile";
import { COUNTRY_OF_ORIGIN_OPTIONS } from "@/lib/countries";
import { useT } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages";

type ShareableKey = Exclude<
  keyof ConsentFlags,
  "shareHealthHistory" | "shareIncome" | "shareOccupation"
>;

type ProfileT = Messages["profile"];

/** Fields the user may share, each with how its value reads to an insurer. */
function shareable(p: ProfileT): { key: ShareableKey; label: string; describe: (u: UserProfile) => string | null }[] {
  return [
    {
      key: "shareAge",
      label: p.age,
      describe: (u) => {
        const age = profileAge(u);
        return age ? p.ageValue(age) : null;
      },
    },
    {
      key: "shareGender",
      label: p.gender,
      describe: (u) =>
        u.gender && u.gender !== "prefer_not_to_say" ? (u.gender === "male" ? p.male : p.female) : null,
    },
    {
      key: "shareSmokerStatus",
      label: p.smokerStatus,
      describe: (u) => (u.smoker === undefined ? null : u.smoker ? p.smoker : p.nonSmoker),
    },
    {
      key: "shareCoverageNeeds",
      label: p.coverageNeededShort,
      describe: (u) => (u.coverageNeeded ? p.coverValue(formatCurrency(u.coverageNeeded)) : null),
    },
    {
      key: "shareBudgetRange",
      label: p.monthlyBudgetShort,
      describe: (u) => (u.monthlyBudget ? p.budgetValue(formatCurrency(u.monthlyBudget)) : null),
    },
  ];
}

interface Props {
  realEmailMasked: string;
  maskedInbox: string;
  initialConsent: ConsentFlags;
  initialProfile: UserProfile;
  alreadyOnboarded: boolean;
}

function toInt(v: string): number | undefined {
  const n = parseInt(v.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

export default function OnboardingForm({
  realEmailMasked,
  maskedInbox,
  initialConsent,
  initialProfile,
  alreadyOnboarded,
}: Props) {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [consent, setConsent] = useState<ConsentFlags>(initialConsent);
  const [error, setError] = useState<string | null>(null);
  const [savedInbox, setSavedInbox] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const tt = useT();
  const t = tt.account.onboarding;
  const pl = tt.profile;
  const SHAREABLE = useMemo(() => shareable(pl), [pl]);

  const preview = useMemo(
    () =>
      SHAREABLE.filter((s) => consent[s.key])
        .map((s) => s.describe(profile))
        .filter((x): x is string => !!x),
    [consent, profile, SHAREABLE]
  );

  function set<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function setDateOfBirth(value: string) {
    setProfile((current) => {
      const next = { ...current, dateOfBirth: value || undefined };
      if (value) delete next.age;
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanProfile: UserProfile = Object.fromEntries(
      Object.entries(profile).filter(([, v]) => v !== undefined && v !== "")
    );
    startTransition(async () => {
      const res = await saveOnboardingAction({
        profile: cleanProfile,
        consent: {
          ...consent,
          shareHealthHistory: false,
          shareIncome: false,
          shareOccupation: false,
        },
      });
      if (res.ok) setSavedInbox(res.maskedInbox);
      else setError(res.error);
    });
  }

  async function copyInbox(addr: string) {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — address is visible anyway */
    }
  }

  // ─── Success state ──────────────────────────────────────────────────────────
  if (savedInbox) {
    return (
      <Card className="border-green-200">
        <CardHeader>
          <p className="flex items-center gap-1.5 text-sm font-medium text-green-700">
            <CheckCircle2Icon className="size-4" />
            {t.successBadge}
          </p>
          <CardTitle className="text-lg">{t.successTitle}</CardTitle>
          <CardDescription>
            {t.successDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
            <code className="flex-1 break-all font-mono text-sm">{savedInbox}</code>
            <Button variant="outline" size="sm" onClick={() => copyInbox(savedInbox)}>
              <CopyIcon />
              {copied ? t.copied : t.copy}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/outreach">
                {t.continueOutreach}
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button variant="ghost" onClick={() => setSavedInbox(null)}>
              {t.editPreferences}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={submit} className="space-y-6">
      {/* 1 — Masked inbox */}
      <Card>
        <CardHeader>
          <CardTitle>{t.step1Title}</CardTitle>
          <CardDescription>{t.step1Desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.yourEmailPrivate}</p>
              <p className="mt-0.5 font-mono text-sm">{realEmailMasked}</p>
            </div>
            <MoveRightIcon className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <div className="rounded-lg border border-primary/30 bg-accent p-3">
              <p className="text-[11px] uppercase tracking-wide text-accent-foreground">{t.whatInsurersSee}</p>
              <p className="mt-0.5 break-all font-mono text-sm text-accent-foreground">{maskedInbox}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 — Profile */}
      <Card>
        <CardHeader>
          <CardTitle>{t.step2Title}</CardTitle>
          <CardDescription>{t.step2Desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="birthday">{pl.birthday}</Label>
              <Input
                id="birthday"
                type="date"
                {...dateOfBirthInputBounds()}
                value={profile.dateOfBirth ?? ""}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country-of-origin">{pl.country}</Label>
              <Select
                value={profile.countryOfOrigin ?? ""}
                onValueChange={(value) =>
                  set(
                    "countryOfOrigin",
                    COUNTRY_OF_ORIGIN_OPTIONS.find((country) => country === value)
                  )
                }
              >
                <SelectTrigger id="country-of-origin">
                  <SelectValue placeholder={pl.selectCountry} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OF_ORIGIN_OPTIONS.map((country) => (
                    <SelectItem key={country} value={country}>
                      {pl.countries[country] ?? country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gender">{pl.gender}</Label>
              <Select
                value={profile.gender ?? ""}
                onValueChange={(v) => set("gender", (v || undefined) as UserProfile["gender"])}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder={pl.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{pl.female}</SelectItem>
                  <SelectItem value="male">{pl.male}</SelectItem>
                  <SelectItem value="prefer_not_to_say">{pl.preferNotToSay}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smoker">{pl.smokerStatus}</Label>
              <Select
                value={profile.smoker === undefined ? "" : profile.smoker ? "yes" : "no"}
                onValueChange={(v) => set("smoker", v === "" ? undefined : v === "yes")}
              >
                <SelectTrigger id="smoker">
                  <SelectValue placeholder={pl.select} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">{pl.nonSmoker}</SelectItem>
                  <SelectItem value="yes">{pl.smoker}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coverage">{pl.coverageNeeded}</Label>
              <Input
                id="coverage"
                inputMode="numeric"
                value={profile.coverageNeeded ?? ""}
                onChange={(e) => set("coverageNeeded", toInt(e.target.value))}
                placeholder="200000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget">{pl.monthlyBudget}</Label>
              <Input
                id="budget"
                inputMode="numeric"
                value={profile.monthlyBudget ?? ""}
                onChange={(e) => set("monthlyBudget", toInt(e.target.value))}
                placeholder="150"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3 — Consent */}
      <Card>
        <CardHeader>
          <CardTitle>{t.step3Title}</CardTitle>
          <CardDescription>{t.step3Desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <ul className="space-y-2">
              {SHAREABLE.map((s) => {
                const value = s.describe(profile);
                const id = `consent-${s.key}`;
                return (
                  <li key={s.key}>
                    <Label
                      htmlFor={id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 font-normal transition-colors",
                        consent[s.key] ? "border-primary/40 bg-accent/60" : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={consent[s.key]}
                        onCheckedChange={(c) => setConsent((prev) => ({ ...prev, [s.key]: c === true }))}
                      />
                      <span className="flex-1 font-medium">{s.label}</span>
                      <span className="text-xs text-muted-foreground">{value ?? pl.notProvidedLower}</span>
                    </Label>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-4">
              <Alert variant="destructive">
                <ShieldBanIcon />
                <AlertTitle>{t.neverSharedTitle}</AlertTitle>
                <AlertDescription>
                  <p>
                    {t.neverSharedBody}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {t.neverShared.map((n) => (
                      <li key={n} className="flex items-center gap-2">
                        <LockIcon className="size-3.5" aria-hidden="true" />
                        {n}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.insurersWillSee}
                </p>
                {preview.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {preview.map((p) => (
                      <Badge key={p} variant="outline" className="bg-card font-normal">
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">{t.onlyQuestion}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {alreadyOnboarded ? t.savePreferences : t.saveAndCreate}
        </Button>
        <p className="text-xs text-muted-foreground">{t.auditNote}</p>
      </div>
    </form>
  );
}
