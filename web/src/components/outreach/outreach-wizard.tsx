"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AI_DISCLOSURE_PREFIX,
  MAX_INSURERS_PER_OUTREACH,
  OUTREACH_TEMPLATES,
  THREAD_STATUS_LABELS,
} from "@/lib/constants";
import type { ConsentFlags, ThreadStatus, UserProfile } from "@/lib/types";
import ApprovalDialog from "./approval-dialog";
import { previewPII } from "./pii-preview";
import {
  appendNotes,
  defaultSubject,
  stripDisclosure,
  templateDraft,
  type OutreachContext,
} from "./draft-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InsurerOption {
  id: string;
  name: string;
  agentEmail: string;
  website: string;
  existingThread?: { id: string; status: ThreadStatus };
}

type DraftStatus = "drafting" | "ready" | "sending" | "sent" | "blocked" | "failed";

interface Draft {
  insurerId: string;
  subject: string;
  body: string;
  source: "ai" | "template";
  status: DraftStatus;
  approved: boolean;
  error?: string;
  threadId?: string;
}

interface Props {
  insurers: InsurerOption[];
  maskedInbox: string;
  consent: ConsentFlags;
  profile: UserProfile;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

function consentedContext(consent: ConsentFlags, ctx: OutreachContext): OutreachContext {
  return {
    age: consent.shareAge ? ctx.age : undefined,
    gender: consent.shareGender ? ctx.gender : undefined,
    smoker: consent.shareSmokerStatus ? ctx.smoker : undefined,
    coverageNeeded: consent.shareCoverageNeeds ? ctx.coverageNeeded : undefined,
    monthlyBudget: consent.shareBudgetRange ? ctx.monthlyBudget : undefined,
  };
}

/** Drop undefined + values the API schema would reject (it validates ranges). */
function apiContext(ctx: OutreachContext) {
  const out: Record<string, unknown> = {};
  if (ctx.age && ctx.age >= 18 && ctx.age <= 80) out.age = ctx.age;
  if (ctx.gender) out.gender = ctx.gender;
  if (ctx.smoker !== undefined) out.smoker = ctx.smoker;
  if (ctx.coverageNeeded && ctx.coverageNeeded > 0) out.coverageNeeded = ctx.coverageNeeded;
  if (ctx.monthlyBudget && ctx.monthlyBudget > 0) out.monthlyBudget = ctx.monthlyBudget;
  return out;
}

const STATUS_BADGE: Record<DraftStatus, { label: string; variant: "gray" | "blue" | "green" | "red" | "yellow" }> = {
  drafting: { label: "Drafting…", variant: "gray" },
  ready: { label: "Ready for review", variant: "blue" },
  sending: { label: "Sending…", variant: "yellow" },
  sent: { label: "Sent", variant: "green" },
  blocked: { label: "Blocked", variant: "red" },
  failed: { label: "Failed", variant: "red" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OutreachWizard({ insurers, maskedInbox, consent, profile }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState(OUTREACH_TEMPLATES[0].id);
  const [ctx, setCtx] = useState<OutreachContext>({
    age: profile.age,
    gender: profile.gender,
    smoker: profile.smoker,
    coverageNeeded: profile.coverageNeeded,
    monthlyBudget: profile.monthlyBudget,
  });
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [step, setStep] = useState<"compose" | "review">("compose");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const template = OUTREACH_TEMPLATES.find((t) => t.id === templateId)!;
  const byId = useMemo(() => new Map(insurers.map((i) => [i.id, i])), [insurers]);
  const shared = consentedContext(consent, ctx);

  const patchDraft = useCallback((id: string, patch: Partial<Draft>) => {
    setDrafts((d) => (d[id] ? { ...d, [id]: { ...d[id], ...patch } } : d));
  }, []);

  function toggleInsurer(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_INSURERS_PER_OUTREACH ? s : [...s, id]
    );
  }

  // ─── Drafting ──────────────────────────────────────────────────────────────

  async function draftOne(insurerId: string) {
    const insurer = byId.get(insurerId)!;
    setDrafts((d) => ({
      ...d,
      [insurerId]: {
        insurerId,
        subject: d[insurerId]?.subject ?? defaultSubject(template),
        body: "",
        source: "ai",
        status: "drafting",
        approved: false,
      },
    }));

    let body: string;
    let source: Draft["source"] = "ai";
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insurerId, templateId, userContext: apiContext(shared) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.draft !== "string" || !data.draft.trim()) {
        throw new Error(data.error ?? "AI drafting unavailable");
      }
      body = stripDisclosure(data.draft);
    } catch {
      body = templateDraft(insurer.name, template, shared);
      source = "template";
    }

    patchDraft(insurerId, { body: appendNotes(body, notes), source, status: "ready" });
  }

  async function generateDrafts() {
    setStep("review");
    setDrafts({});
    await Promise.all(selected.map((id) => draftOne(id)));
  }

  // ─── Sending ───────────────────────────────────────────────────────────────

  const approvedDrafts = Object.values(drafts).filter(
    (d) => d.approved && (d.status === "ready" || d.status === "blocked" || d.status === "failed")
  );

  async function sendApproved() {
    setConfirmOpen(false);
    for (const d of approvedDrafts) {
      patchDraft(d.insurerId, { status: "sending", error: undefined });
      try {
        const res = await fetch("/api/outreach/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            insurerId: d.insurerId,
            subject: d.subject,
            body: d.body,
            userApproved: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          patchDraft(d.insurerId, { status: "sent", threadId: data.threadId });
        } else if (data.code === "PII_BLOCKED") {
          patchDraft(d.insurerId, { status: "blocked", approved: false, error: data.error });
        } else {
          patchDraft(d.insurerId, {
            status: "failed",
            approved: false,
            error: data.error ?? `Send failed (HTTP ${res.status}).`,
          });
        }
      } catch {
        patchDraft(d.insurerId, {
          status: "failed",
          approved: false,
          error: "Network error — is the dev server and Mailpit running?",
        });
      }
    }
  }

  // ─── Render: compose ───────────────────────────────────────────────────────

  if (step === "compose") {
    const ctxFields: {
      key: keyof OutreachContext;
      consentKey: keyof ConsentFlags;
      label: string;
      input: React.ReactNode;
    }[] = [
      {
        key: "age",
        consentKey: "shareAge",
        label: "Age",
        input: (
          <input
            type="number"
            min={18}
            max={80}
            value={ctx.age ?? ""}
            onChange={(e) => setCtx({ ...ctx, age: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        ),
      },
      {
        key: "gender",
        consentKey: "shareGender",
        label: "Gender",
        input: (
          <select
            value={ctx.gender ?? ""}
            onChange={(e) =>
              setCtx({ ...ctx, gender: (e.target.value || undefined) as OutreachContext["gender"] })
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        ),
      },
      {
        key: "smoker",
        consentKey: "shareSmokerStatus",
        label: "Smoker",
        input: (
          <select
            value={ctx.smoker === undefined ? "" : ctx.smoker ? "yes" : "no"}
            onChange={(e) =>
              setCtx({ ...ctx, smoker: e.target.value === "" ? undefined : e.target.value === "yes" })
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            <option value="no">Non-smoker</option>
            <option value="yes">Smoker</option>
          </select>
        ),
      },
      {
        key: "coverageNeeded",
        consentKey: "shareCoverageNeeds",
        label: "Cover (SGD)",
        input: (
          <input
            inputMode="numeric"
            value={ctx.coverageNeeded ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setCtx({ ...ctx, coverageNeeded: Number.isFinite(n) ? n : undefined });
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        ),
      },
      {
        key: "monthlyBudget",
        consentKey: "shareBudgetRange",
        label: "Budget/mo (SGD)",
        input: (
          <input
            inputMode="numeric"
            value={ctx.monthlyBudget ?? ""}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setCtx({ ...ctx, monthlyBudget: Number.isFinite(n) ? n : undefined });
            }}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        ),
      },
    ];

    return (
      <div className="space-y-6">
        {/* 1 — Insurers */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-semibold text-gray-900">1. Choose insurers</h2>
            <span className="text-sm text-gray-500">
              {selected.length}/{MAX_INSURERS_PER_OUTREACH} selected
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insurers.map((ins) => {
              const isOn = selected.includes(ins.id);
              const disabled = !isOn && selected.length >= MAX_INSURERS_PER_OUTREACH;
              return (
                <button
                  key={ins.id}
                  type="button"
                  onClick={() => toggleInsurer(ins.id)}
                  disabled={disabled}
                  aria-pressed={isOn}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                    isOn
                      ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                      : "border-gray-200 hover:border-gray-300",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                      isOn ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                    )}
                    aria-hidden="true"
                  >
                    {isOn ? "✓" : initials(ins.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{ins.name}</span>
                    {ins.existingThread ? (
                      <span className="block truncate text-xs text-amber-700">
                        Already contacted · {THREAD_STATUS_LABELS[ins.existingThread.status]}
                      </span>
                    ) : (
                      <span className="block truncate text-xs text-gray-500">{ins.agentEmail}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2 — Template */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="font-semibold text-gray-900">2. What do you want to ask?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OUTREACH_TEMPLATES.filter((t) => t.id !== "follow_up").map((t) => (
              <label
                key={t.id}
                className={cn(
                  "cursor-pointer rounded-xl border p-3 transition",
                  templateId === t.id
                    ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={templateId === t.id}
                  onChange={() => setTemplateId(t.id)}
                  className="sr-only"
                />
                <span className="block text-sm font-medium text-gray-900">{t.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{t.description}</span>
              </label>
            ))}
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-medium text-gray-700">Notes for insurers (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="e.g. I'd like to understand how payouts work for early-stage conditions."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-500">Added to every draft. You can still edit each email.</span>
          </label>
        </section>

        {/* 3 — Shared details */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-semibold text-gray-900">3. Details the AI may use</h2>
            <Link href="/onboarding" className="text-sm text-blue-600 hover:underline">
              Change consent
            </Link>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Only fields you consented to share are editable here. Everything else stays private.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ctxFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <span className="text-xs font-medium text-gray-600">{f.label}</span>
                {consent[f.consentKey] ? (
                  f.input
                ) : (
                  <div className="rounded-md border border-dashed border-gray-200 px-2 py-1.5 text-xs text-gray-400">
                    🔒 Not shared
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={generateDrafts} disabled={selected.length === 0}>
            ✨ Draft {selected.length || ""} email{selected.length === 1 ? "" : "s"} with AI
          </Button>
          <p className="text-xs text-gray-500">
            Drafting has no side effects. Nothing is sent until you approve.
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: review ────────────────────────────────────────────────────────

  const list = selected.map((id) => drafts[id]).filter(Boolean);
  const anyDrafting = list.some((d) => d.status === "drafting");
  const anySending = list.some((d) => d.status === "sending");
  const sentCount = list.filter((d) => d.status === "sent").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep("compose")} disabled={anySending}>
          ← Back
        </Button>
        <p className="text-sm text-gray-500">
          From <span className="font-mono text-gray-700">{maskedInbox}</span>
        </p>
      </div>

      {sentCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>
            ✓ {sentCount} email{sentCount === 1 ? "" : "s"} sent. Replies will appear in your CRM.
          </span>
          <Link href="/crm" className="font-medium underline">
            Open CRM →
          </Link>
        </div>
      )}

      {list.map((d) => {
        const insurer = byId.get(d.insurerId)!;
        const hits = d.status === "drafting" ? [] : previewPII(`${d.subject}\n${d.body}`);
        const locked = d.status === "sending" || d.status === "sent";
        const badge = STATUS_BADGE[d.status];

        return (
          <article
            key={d.insurerId}
            className={cn(
              "rounded-2xl border bg-white p-5",
              d.status === "blocked" ? "border-red-300" : d.status === "sent" ? "border-green-300" : "border-gray-200"
            )}
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900">{insurer.name}</h3>
                <p className="text-xs text-gray-500">To {insurer.agentEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                {d.source === "template" && d.status !== "drafting" && (
                  <Badge variant="gray">Template draft · AI unavailable</Badge>
                )}
                {d.source === "ai" && d.status !== "drafting" && <Badge variant="purple">AI draft</Badge>}
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
            </header>

            {d.status === "drafting" ? (
              <div className="mt-4 space-y-2" aria-busy="true">
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-600">Added automatically: </span>
                  {AI_DISCLOSURE_PREFIX}
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-gray-600">Subject</span>
                  <input
                    value={d.subject}
                    onChange={(e) => patchDraft(d.insurerId, { subject: e.target.value, approved: false })}
                    disabled={locked}
                    maxLength={200}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-gray-600">Message</span>
                  <textarea
                    value={d.body}
                    onChange={(e) =>
                      patchDraft(d.insurerId, {
                        body: e.target.value,
                        approved: false,
                        ...(d.status === "blocked" || d.status === "failed"
                          ? { status: "ready" as const, error: undefined }
                          : {}),
                      })
                    }
                    disabled={locked}
                    rows={10}
                    maxLength={5000}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-[13px] leading-relaxed disabled:bg-gray-50"
                  />
                </label>

                {d.status === "blocked" && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <p className="font-semibold">🛑 Blocked by the personal-data guard</p>
                    <p className="mt-0.5">{d.error}</p>
                    <p className="mt-1 text-xs text-red-700">
                      Nothing was sent. This attempt was recorded in your activity log.
                    </p>
                  </div>
                )}
                {d.status === "failed" && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {d.error}
                  </p>
                )}
                {hits.length > 0 && d.status !== "blocked" && !locked && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <p className="font-medium">⚠ This email looks like it contains personal data and will be blocked:</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {hits.map((h, i) => (
                        <span key={`${h.type}-${h.value}-${i}`} className="rounded bg-white px-1.5 py-0.5 font-mono text-xs ring-1 ring-amber-200">
                          {h.type}: {h.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <footer className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {d.status === "sent" ? (
                    <Link
                      href={d.threadId ? `/crm/${d.threadId}` : "/crm"}
                      className="text-sm font-medium text-green-700 hover:underline"
                    >
                      ✓ Sent — view thread →
                    </Link>
                  ) : (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={d.approved}
                        disabled={locked}
                        onChange={(e) => patchDraft(d.insurerId, { approved: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      I&apos;ve reviewed this email and approve sending it
                    </label>
                  )}
                  {!locked && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => draftOne(d.insurerId)}>
                        ↻ Redraft
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelected((s) => s.filter((x) => x !== d.insurerId));
                          setDrafts((all) => {
                            const next = { ...all };
                            delete next[d.insurerId];
                            return next;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </footer>
              </div>
            )}
          </article>
        );
      })}

      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
        <p className="text-sm text-gray-600">
          {approvedDrafts.length} of {list.filter((d) => d.status !== "sent").length} approved
        </p>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={approvedDrafts.length === 0 || anyDrafting || anySending}
          loading={anySending}
        >
          Send {approvedDrafts.length || ""} approved
        </Button>
      </div>

      <ApprovalDialog
        open={confirmOpen}
        from={maskedInbox}
        items={approvedDrafts.map((d) => ({
          insurerName: byId.get(d.insurerId)!.name,
          to: byId.get(d.insurerId)!.agentEmail,
          subject: d.subject,
        }))}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={sendApproved}
      />
    </div>
  );
}
