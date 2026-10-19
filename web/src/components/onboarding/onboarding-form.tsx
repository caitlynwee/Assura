"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { saveOnboardingAction } from "@/app/_actions/onboarding";
import Button from "@/components/ui/button";
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
      <div className="rounded-2xl border border-green-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-green-700">✓ Outreach is set up</p>
        <h2 className="mt-1 text-lg font-semibold text-gray-900">Your masked inbox is ready</h2>
        <p className="mt-1 text-sm text-gray-600">
          Insurers will only ever see this relay address. Replies land in your Assura CRM.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 p-3">
          <code className="flex-1 break-all font-mono text-sm text-gray-900">{savedInbox}</code>
          <Button variant="secondary" size="sm" onClick={() => copyInbox(savedInbox)}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/outreach"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Continue to outreach →
          </Link>
          <Button variant="ghost" onClick={() => setSavedInbox(null)}>
            Edit preferences
          </Button>
        </div>
      </div>
    );
  }

  // ─── Form ───────────────────────────────────────────────────────────────────
  const inputCls =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* 1 — Masked inbox */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">1. Your masked inbox</h2>
        <p className="mt-1 text-sm text-gray-500">
          Assura emails insurers from a relay address, so your real contact details stay private.
        </p>
        <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Your email (private)</p>
            <p className="mt-0.5 font-mono text-sm text-gray-700">{realEmailMasked}</p>
          </div>
          <span className="text-center text-gray-400" aria-hidden="true">→</span>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-blue-500">What insurers see</p>
            <p className="mt-0.5 break-all font-mono text-sm text-blue-900">{maskedInbox}</p>
          </div>
        </div>
      </section>

      {/* 2 — Profile */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">2. About you (optional)</h2>
        <p className="mt-1 text-sm text-gray-500">
          Used to tailor enquiries. Nothing here is sent unless you allow it in step 3.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Age</span>
            <input
              type="number"
              min={18}
              max={80}
              inputMode="numeric"
              value={profile.age ?? ""}
              onChange={(e) => set("age", toInt(e.target.value))}
              className={inputCls}
              placeholder="32"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Gender</span>
            <select
              value={profile.gender ?? ""}
              onChange={(e) => set("gender", (e.target.value || undefined) as UserProfile["gender"])}
              className={inputCls}
            >
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Smoker</span>
            <select
              value={profile.smoker === undefined ? "" : profile.smoker ? "yes" : "no"}
              onChange={(e) =>
                set("smoker", e.target.value === "" ? undefined : e.target.value === "yes")
              }
              className={inputCls}
            >
              <option value="">Select…</option>
              <option value="no">Non-smoker</option>
              <option value="yes">Smoker</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Occupation</span>
            <input
              value={profile.occupation ?? ""}
              onChange={(e) => set("occupation", e.target.value)}
              maxLength={80}
              className={inputCls}
              placeholder="Software engineer"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Coverage needed (SGD)</span>
            <input
              inputMode="numeric"
              value={profile.coverageNeeded ?? ""}
              onChange={(e) => set("coverageNeeded", toInt(e.target.value))}
              className={inputCls}
              placeholder="200000"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-gray-700">Monthly budget (SGD)</span>
            <input
              inputMode="numeric"
              value={profile.monthlyBudget ?? ""}
              onChange={(e) => set("monthlyBudget", toInt(e.target.value))}
              className={inputCls}
              placeholder="150"
            />
          </label>
        </div>
      </section>

      {/* 3 — Consent */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900">3. What Assura may share with insurers</h2>
        <p className="mt-1 text-sm text-gray-500">
          The AI can only include what you tick. You still review and approve every email.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <ul className="space-y-2">
            {SHAREABLE.map((s) => {
              const value = s.describe(profile);
              return (
                <li key={s.key}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition",
                      consent[s.key] ? "border-blue-300 bg-blue-50/50" : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={consent[s.key]}
                      onChange={(e) => setConsent((c) => ({ ...c, [s.key]: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 font-medium text-gray-800">{s.label}</span>
                    <span className="text-xs text-gray-400">{value ?? "not provided"}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
              <p className="text-sm font-semibold text-red-800">Never shared — blocked by policy</p>
              <p className="mt-0.5 text-xs text-red-700">
                Tier 3 actions. The AI cannot send these even if asked; outgoing emails are scanned
                and blocked if they appear.
              </p>
              <ul className="mt-2 space-y-1">
                {NEVER_SHARED.map((n) => (
                  <li key={n} className="flex items-center gap-2 text-sm text-red-900">
                    <span aria-hidden="true">🔒</span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Insurers will see
              </p>
              {preview.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preview.map((p) => (
                    <span key={p} className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200">
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Only your question — no personal details.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {alreadyOnboarded ? "Save preferences" : "Save & create masked inbox"}
        </Button>
        <p className="text-xs text-gray-500">Saved choices are recorded in your audit log.</p>
      </div>
    </form>
  );
}
