"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import type { ConsentFlags } from "@/lib/types";

const CONSENT_FIELDS: Array<{ key: keyof ConsentFlags; label: string; hint: string }> = [
  { key: "shareAge", label: "Age", hint: "Share your age so insurers can quote accurately." },
  { key: "shareGender", label: "Gender", hint: "Share your gender for profile-based pricing." },
  { key: "shareSmokerStatus", label: "Smoker status", hint: "Share whether you smoke — it affects premiums." },
  { key: "shareCoverageNeeds", label: "Coverage needs", hint: "Share the coverage amount you're looking for." },
  { key: "shareBudgetRange", label: "Budget range", hint: "Share your monthly budget range." },
  { key: "shareOccupation", label: "Occupation", hint: "Share your occupation for risk assessment." },
  { key: "shareHealthHistory", label: "Health history", hint: "Share relevant health history details." },
  { key: "shareIncome", label: "Income", hint: "Share your income range." },
];

const DEFAULT_CONSENT: ConsentFlags = {
  shareAge: false,
  shareGender: false,
  shareSmokerStatus: false,
  shareCoverageNeeds: false,
  shareBudgetRange: false,
  shareOccupation: false,
  shareHealthHistory: false,
  shareIncome: false,
};

export default function OnboardingForm() {
  const [consent, setConsent] = useState<ConsentFlags>(DEFAULT_CONSENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedInbox, setMaskedInbox] = useState<string | null>(null);

  function toggle(key: keyof ConsentFlags) {
    setConsent((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save your preferences. Please try again.");
        return;
      }
      const data = await res.json();
      setMaskedInbox(data.maskedInbox ?? null);
    } catch {
      setError("Could not save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Only the details you allow below are ever shared with insurers, and
          always through your masked inbox — never your real email.
        </p>
        <div className="space-y-3">
          {CONSENT_FIELDS.map((field) => (
            <label
              key={field.key}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={consent[field.key]}
                onChange={() => toggle(field.key)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  {field.label}
                </span>
                <span className="block text-xs text-gray-500">{field.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <Button onClick={handleSave} loading={saving}>
            Save preferences
          </Button>
        </div>
      </div>

      {maskedInbox && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-sm font-semibold text-green-800">
            You&apos;re set up
          </h2>
          <p className="text-sm text-green-700 mt-1">
            Insurers will reach you at your masked inbox. Your real email stays
            private.
          </p>
          <div className="mt-3 rounded-lg bg-white border border-green-200 px-4 py-3 font-mono text-sm text-gray-900 break-all">
            {maskedInbox}
          </div>
        </div>
      )}
    </div>
  );
}
