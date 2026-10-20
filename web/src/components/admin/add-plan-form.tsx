"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type InsurerOption = { id: string; name: string };

const COVERAGE_TERMS = [
  "whole_life",
  "to_age_65",
  "to_age_70",
  "to_age_75",
  "5_years",
  "10_years",
  "20_years",
  "25_years",
] as const;

const TERM_LABELS: Record<(typeof COVERAGE_TERMS)[number], string> = {
  whole_life: "Whole life",
  to_age_65: "To age 65",
  to_age_70: "To age 70",
  to_age_75: "To age 75",
  "5_years": "5 years",
  "10_years": "10 years",
  "20_years": "20 years",
  "25_years": "25 years",
};

const PREMIUM_BUCKETS = [
  { key: "male_30_nonsmoker", label: "Male, 30, non-smoker" },
  { key: "female_30_nonsmoker", label: "Female, 30, non-smoker" },
  { key: "male_40_nonsmoker", label: "Male, 40, non-smoker" },
  { key: "female_40_nonsmoker", label: "Female, 40, non-smoker" },
] as const;

/** shadcn-styled native select (no Radix form-submission quirks for a plain POST). */
const selectClass =
  "flex h-9 w-full items-center rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

/** Split a textarea's lines into a trimmed, non-empty string[]. */
function toLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AddPlanForm() {
  const [insurers, setInsurers] = useState<InsurerOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [insurerId, setInsurerId] = useState("");
  const [planName, setPlanName] = useState("");
  const [coverageAmount, setCoverageAmount] = useState("");
  const [premiumFrequency, setPremiumFrequency] = useState<"annual" | "monthly">("annual");
  const [payoutType, setPayoutType] = useState<"lump_sum" | "monthly_income" | "hybrid">("lump_sum");
  const [illnessesCovered, setIllnessesCovered] = useState("");
  const [earlyStage, setEarlyStage] = useState(false);
  const [country, setCountry] = useState<"Singapore" | "China">("Singapore");
  const [premiums, setPremiums] = useState<Record<string, string>>({});
  const [coverageTerms, setCoverageTerms] = useState<string[]>([]);
  const [keyBenefits, setKeyBenefits] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [brochureFile, setBrochureFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/insurers", { cache: "no-store" });
          const data = (await res.json()) as { insurers?: InsurerOption[]; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Unable to load insurers.");
          setInsurers(data.insurers ?? []);
        } catch (err: unknown) {
          setLoadError(err instanceof Error ? err.message : "Unable to load insurers.");
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleTerm(term: string) {
    setCoverageTerms((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term]
    );
  }

  function resetForm() {
    setPlanName("");
    setCoverageAmount("");
    setIllnessesCovered("");
    setEarlyStage(false);
    setPremiums({});
    setCoverageTerms([]);
    setKeyBenefits("");
    setExclusions("");
    setSourceUrl("");
    setProductUrl("");
    setBrochureFile(null);
  }

  /** Upload the chosen brochure and return its download URL. Throws on failure. */
  async function uploadBrochure(file: File): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/admin/plans/brochure", { method: "POST", body });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? "Unable to upload the brochure.");
    return data.url;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!insurerId) {
      setError("Choose an insurer.");
      return;
    }

    // Only include premium buckets that were actually filled in.
    const premiumPayload: Record<string, number> = {};
    for (const [key, raw] of Object.entries(premiums)) {
      const n = Number(raw);
      if (raw.trim() !== "" && Number.isFinite(n) && n > 0) premiumPayload[key] = n;
    }

    const planNameTrimmed = planName.trim();

    startTransition(async () => {
      try {
        // Upload the brochure first (when provided); its download URL becomes
        // the plan's source URL so the comparison links to the uploaded file.
        let resolvedSourceUrl = sourceUrl.trim();
        if (brochureFile) {
          resolvedSourceUrl = await uploadBrochure(brochureFile);
        }

        const payload = {
          insurerId,
          planName: planNameTrimmed,
          coverageAmount: Number(coverageAmount || 0),
          premiumFrequency,
          premiums: premiumPayload,
          coverageTerms,
          illnessesCovered: Number(illnessesCovered || 0),
          earlyStageConditions: earlyStage,
          payoutType,
          keyBenefits: toLines(keyBenefits),
          exclusions: toLines(exclusions),
          sourceUrl: resolvedSourceUrl,
          productUrl: productUrl.trim(),
          country,
        };

        const res = await fetch("/api/admin/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as { error?: string; planId?: string };
        if (!res.ok) throw new Error(data.error ?? "Unable to add the plan.");
        setSuccess(
          `Added "${planNameTrimmed}"${
            brochureFile ? " with the uploaded brochure" : ""
          }. It now appears in ${country} comparisons.`
        );
        resetForm();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unable to add the plan.");
      }
    });
  }

  const noInsurers = insurers !== null && insurers.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a plan manually</CardTitle>
        <CardDescription>
          Enter plan details by hand when the scraper can&apos;t publish them. The plan appears in
          the comparison table immediately for users in the selected country. This only adds a
          plan; it never changes or removes scraped data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {loadError}
          </p>
        )}
        {noInsurers && (
          <p className="mb-4 text-sm text-muted-foreground">
            No insurers are configured yet. Run the scraper (or seed) to populate insurers before
            adding a plan — a plan must belong to an existing insurer.
          </p>
        )}

        <form onSubmit={submit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="insurerId">Insurer</Label>
            <select
              id="insurerId"
              className={selectClass}
              value={insurerId}
              onChange={(e) => setInsurerId(e.target.value)}
              disabled={!insurers || noInsurers}
              required
            >
              <option value="" disabled>
                {insurers ? "Select an insurer…" : "Loading insurers…"}
              </option>
              {insurers?.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="planName">Plan name</Label>
            <Input
              id="planName"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g. Early Critical Protect"
              maxLength={160}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="coverageAmount">Coverage amount (SGD)</Label>
              <Input
                id="coverageAmount"
                type="number"
                min={0}
                value={coverageAmount}
                onChange={(e) => setCoverageAmount(e.target.value)}
                placeholder="150000"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="illnessesCovered">Illnesses covered</Label>
              <Input
                id="illnessesCovered"
                type="number"
                min={0}
                value={illnessesCovered}
                onChange={(e) => setIllnessesCovered(e.target.value)}
                placeholder="e.g. 37"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="premiumFrequency">Premium frequency</Label>
              <select
                id="premiumFrequency"
                className={selectClass}
                value={premiumFrequency}
                onChange={(e) => setPremiumFrequency(e.target.value as "annual" | "monthly")}
              >
                <option value="annual">Annual</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payoutType">Payout type</Label>
              <select
                id="payoutType"
                className={selectClass}
                value={payoutType}
                onChange={(e) =>
                  setPayoutType(e.target.value as "lump_sum" | "monthly_income" | "hybrid")
                }
              >
                <option value="lump_sum">Lump sum</option>
                <option value="monthly_income">Monthly income</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                className={selectClass}
                value={country}
                onChange={(e) => setCountry(e.target.value as "Singapore" | "China")}
              >
                <option value="Singapore">Singapore</option>
                <option value="China">China</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Indicative annual premiums (SGD)</Label>
            <p className="text-xs text-muted-foreground">
              Fill in the profiles you have. Used to show each user a premium matched to their
              profile; leave blank if unknown.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PREMIUM_BUCKETS.map((bucket) => (
                <div key={bucket.key} className="grid gap-1.5">
                  <Label htmlFor={bucket.key} className="text-xs font-normal text-muted-foreground">
                    {bucket.label}
                  </Label>
                  <Input
                    id={bucket.key}
                    type="number"
                    min={0}
                    value={premiums[bucket.key] ?? ""}
                    onChange={(e) =>
                      setPremiums((prev) => ({ ...prev, [bucket.key]: e.target.value }))
                    }
                    placeholder="e.g. 1200"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Coverage terms</Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {COVERAGE_TERMS.map((term) => (
                <label key={term} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={coverageTerms.includes(term)}
                    onCheckedChange={() => toggleTerm(term)}
                  />
                  {TERM_LABELS[term]}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={earlyStage}
              onCheckedChange={(v) => setEarlyStage(v === true)}
            />
            Covers early-stage conditions
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="keyBenefits">Key benefits (one per line)</Label>
              <textarea
                id="keyBenefits"
                className={`${selectClass} h-24 py-2`}
                value={keyBenefits}
                onChange={(e) => setKeyBenefits(e.target.value)}
                placeholder={"Multi-pay on relapse\nPremium waiver on claim"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exclusions">Exclusions (one per line)</Label>
              <textarea
                id="exclusions"
                className={`${selectClass} h-24 py-2`}
                value={exclusions}
                onChange={(e) => setExclusions(e.target.value)}
                placeholder={"Pre-existing conditions\nSelf-inflicted injury"}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="brochureFile">Brochure file</Label>
            <Input
              id="brochureFile"
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium"
              onChange={(e) => setBrochureFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Upload the plan brochure (PDF, PNG, JPG, or WebP, up to 10 MB). It&apos;s
              stored with the plan and used as the &quot;Brochure&quot; link in the comparison
              table — overriding the source URL below.
            </p>
            {brochureFile && (
              <p className="text-xs text-foreground">
                Selected: {brochureFile.name} ({Math.ceil(brochureFile.size / 1024)} KB)
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sourceUrl">Source / brochure URL</Label>
              <Input
                id="sourceUrl"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://insurer.example/brochure.pdf"
                disabled={brochureFile !== null}
              />
              <p className="text-xs text-muted-foreground">
                Used when no brochure file is uploaded.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="productUrl">Product page URL</Label>
              <Input
                id="productUrl"
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://insurer.example/plan"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              {success}
            </p>
          )}

          <div>
            <Button type="submit" loading={pending} disabled={noInsurers}>
              {pending ? "Adding…" : "Add plan"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
