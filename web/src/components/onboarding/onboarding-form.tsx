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

type ShareableKey = Exclude<keyof ConsentFlags, "shareHealthHistory" | "shareIncome">;

const SHAREABLE: { key: ShareableKey; label: string; describe: (p: UserProfile) => string | null }[] = [
  { key: "shareAge", label: "Age", describe: (p) => (p.age ? `Age ${p.age}` : null) },
  {
    key: "shareGender",
    label: "Gender",
    describe: (p) =>
      p.gender && p.gender !== "prefer_not_to_say" ? (p.gender === "male" ? "Male" : "Female") : null,
  },
  {
    key: "shareSmokerStatus",
    label: "Smoker status",
    describe: (p) => (p.smoker === undefined ? null : p.smoker ? "Smoker" : "Non-smoker"),
  },
  {
    key: "shareCoverageNeeds",
    label: "Coverage needed",
    describe: (p) => (p.coverageNeeded ? `${formatCurrency(p.coverageNeeded)} cover` : null),
  },
  {
    key: "shareBudgetRange",
    label: "Monthly budget",
    describe: (p) => (p.monthlyBudget ? `${formatCurrency(p.monthlyBudget)}/month budget` : null),
  },
  { key: "shareOccupation", label: "Occupation", describe: (p) => p.occupation?.trim() || null },
];

const NEVER_SHARED = [
  "NRIC / FIN",
  "Health or medical history",
  "Income, salary or CPF",
  "Phone number",
  "Your real email address",
];

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

  const preview = useMemo(
    () =>
      SHAREABLE.filter((s) => consent[s.key])
        .map((s) => s.describe(profile))
        .filter((x): x is string => !!x),
    [consent, profile]
  );

  function set<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
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
        consent: { ...consent, shareHealthHistory: false, shareIncome: false },
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
            Outreach is set up
          </p>
          <CardTitle className="text-lg">Your masked inbox is ready</CardTitle>
          <CardDescription>
            Insurers will only ever see this relay address. Replies land in your Assura CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
            <code className="flex-1 break-all font-mono text-sm">{savedInbox}</code>
            <Button variant="outline" size="sm" onClick={() => copyInbox(savedInbox)}>
              <CopyIcon />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/outreach">
                Continue to outreach
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button variant="ghost" onClick={() => setSavedInbox(null)}>
              Edit preferences
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
          <CardTitle>1. Your masked inbox</CardTitle>
          <CardDescription>
            Assura emails insurers from a relay address, so your real contact details stay private.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Your email (private)</p>
              <p className="mt-0.5 font-mono text-sm">{realEmailMasked}</p>
            </div>
            <MoveRightIcon className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <div className="rounded-lg border border-primary/30 bg-accent p-3">
              <p className="text-[11px] uppercase tracking-wide text-accent-foreground">What insurers see</p>
              <p className="mt-0.5 break-all font-mono text-sm text-accent-foreground">{maskedInbox}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 — Profile */}
      <Card>
        <CardHeader>
          <CardTitle>2. About you (optional)</CardTitle>
          <CardDescription>Used to tailor enquiries. Nothing here is sent unless you allow it in step 3.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                min={18}
                max={80}
                inputMode="numeric"
                value={profile.age ?? ""}
                onChange={(e) => set("age", toInt(e.target.value))}
                placeholder="32"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={profile.gender ?? ""}
                onValueChange={(v) => set("gender", (v || undefined) as UserProfile["gender"])}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="smoker">Smoker</Label>
              <Select
                value={profile.smoker === undefined ? "" : profile.smoker ? "yes" : "no"}
                onValueChange={(v) => set("smoker", v === "" ? undefined : v === "yes")}
              >
                <SelectTrigger id="smoker">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">Non-smoker</SelectItem>
                  <SelectItem value="yes">Smoker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                value={profile.occupation ?? ""}
                onChange={(e) => set("occupation", e.target.value)}
                maxLength={80}
                placeholder="Software engineer"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="coverage">Coverage needed (SGD)</Label>
              <Input
                id="coverage"
                inputMode="numeric"
                value={profile.coverageNeeded ?? ""}
                onChange={(e) => set("coverageNeeded", toInt(e.target.value))}
                placeholder="200000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget">Monthly budget (SGD)</Label>
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
          <CardTitle>3. What Assura may share with insurers</CardTitle>
          <CardDescription>The AI can only include what you tick. You still review and approve every email.</CardDescription>
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
                      <span className="text-xs text-muted-foreground">{value ?? "not provided"}</span>
                    </Label>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-4">
              <Alert variant="destructive">
                <ShieldBanIcon />
                <AlertTitle>Never shared — blocked by policy</AlertTitle>
                <AlertDescription>
                  <p>
                    Tier 3 actions. The AI cannot send these even if asked; outgoing emails are scanned and
                    blocked if they appear.
                  </p>
                  <ul className="mt-1 space-y-1">
                    {NEVER_SHARED.map((n) => (
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
                  Insurers will see
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
                  <p className="mt-2 text-sm text-muted-foreground">Only your question — no personal details.</p>
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
          {alreadyOnboarded ? "Save preferences" : "Save & create masked inbox"}
        </Button>
        <p className="text-xs text-muted-foreground">Saved choices are recorded in your audit log.</p>
      </div>
    </form>
  );
}
