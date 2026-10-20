"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BotIcon,
  CheckCircle2Icon,
  CheckIcon,
  FileTextIcon,
  LockIcon,
  RefreshCwIcon,
  SendIcon,
  ShieldBanIcon,
  SparklesIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AI_DISCLOSURE_FOOTER,
  MAX_INSURERS_PER_OUTREACH,
  OUTREACH_TEMPLATES,
  THREAD_STATUS_LABELS,
} from "@/lib/constants";
import type { ConsentFlags, ThreadStatus, UserProfile } from "@/lib/types";
import { profileAge } from "@/lib/profile";
import ApprovalDialog from "./approval-dialog";
import { previewPII } from "./pii-preview";
import {
  appendNotes,
  applyInsurerName,
  defaultSubject,
  INSURER_PLACEHOLDER,
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

function toInt(v: string): number | undefined {
  const n = parseInt(v.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : undefined;
}

const STATUS_BADGE: Record<
  DraftStatus,
  { label: string; variant: "gray" | "blue" | "green" | "red" | "yellow" }
> = {
  drafting: { label: "Drafting…", variant: "gray" },
  ready: { label: "Ready for review", variant: "blue" },
  sending: { label: "Sending…", variant: "yellow" },
  sent: { label: "Sent", variant: "green" },
  blocked: { label: "Blocked", variant: "red" },
  failed: { label: "Failed", variant: "red" },
};

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
        {n}
      </span>
      {children}
    </CardTitle>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OutreachWizard({
  insurers,
  maskedInbox,
  consent,
  profile,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState(OUTREACH_TEMPLATES[0].id);
  const [ctx, setCtx] = useState<OutreachContext>({
    age: profileAge(profile),
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

  /** Request ONE name-agnostic draft (insurer name left as a placeholder). */
  async function generateSharedBody(insurerIdForContext: string): Promise<{
    body: string;
    source: Draft["source"];
  }> {
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurerId: insurerIdForContext,
          templateId,
          userContext: apiContext(shared),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.draft !== "string" || !data.draft.trim()) {
        throw new Error(data.error ?? "AI drafting unavailable");
      }
      return { body: stripDisclosure(data.draft), source: "ai" };
    } catch {
      // Fallback template still uses the placeholder so substitution works.
      return { body: templateDraft(INSURER_PLACEHOLDER, template, shared), source: "template" };
    }
  }

  /** Redraft a SINGLE insurer (user-triggered per-card). Generates afresh and
   *  substitutes this insurer's name — lets the user tailor one email later. */
  async function draftOne(insurerId: string) {
    const insurer = byId.get(insurerId)!;
    patchDraft(insurerId, { status: "drafting" });
    const { body, source } = await generateSharedBody(insurerId);
    patchDraft(insurerId, {
      body: appendNotes(applyInsurerName(body, insurer.name), notes),
      source,
      status: "ready",
    });
  }

  /** Generate ONCE, then fan the same draft out to every selected insurer by
   *  substituting each insurer's name. One AI call regardless of count. */
  async function generateDrafts() {
    setStep("review");
    // Seed every selected insurer as "drafting" with a default subject.
    setDrafts(
      Object.fromEntries(
        selected.map((id) => [
          id,
          {
            insurerId: id,
            subject: defaultSubject(template),
            body: "",
            source: "ai" as Draft["source"],
            status: "drafting" as DraftStatus,
            approved: false,
          },
        ])
      )
    );

    const { body, source } = await generateSharedBody(selected[0]);

    setDrafts((d) => {
      const next = { ...d };
      for (const id of selected) {
        const insurer = byId.get(id)!;
        next[id] = {
          ...next[id],
          body: appendNotes(applyInsurerName(body, insurer.name), notes),
          source,
          status: "ready",
        };
      }
      return next;
    });
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
          <Input
            id="ctx-age"
            type="number"
            min={18}
            max={80}
            value={ctx.age ?? ""}
            onChange={(e) => setCtx({ ...ctx, age: e.target.value ? Number(e.target.value) : undefined })}
          />
        ),
      },
      {
        key: "gender",
        consentKey: "shareGender",
        label: "Gender",
        input: (
          <Select
            value={ctx.gender ?? ""}
            onValueChange={(v) => setCtx({ ...ctx, gender: (v || undefined) as OutreachContext["gender"] })}
          >
            <SelectTrigger id="ctx-gender">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        key: "smoker",
        consentKey: "shareSmokerStatus",
        label: "Smoker",
        input: (
          <Select
            value={ctx.smoker === undefined ? "" : ctx.smoker ? "yes" : "no"}
            onValueChange={(v) => setCtx({ ...ctx, smoker: v === "" ? undefined : v === "yes" })}
          >
            <SelectTrigger id="ctx-smoker">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">Non-smoker</SelectItem>
              <SelectItem value="yes">Smoker</SelectItem>
            </SelectContent>
          </Select>
        ),
      },
      {
        key: "coverageNeeded",
        consentKey: "shareCoverageNeeds",
        label: "Cover (SGD)",
        input: (
          <Input
            id="ctx-coverageNeeded"
            inputMode="numeric"
            value={ctx.coverageNeeded ?? ""}
            onChange={(e) => setCtx({ ...ctx, coverageNeeded: toInt(e.target.value) })}
          />
        ),
      },
      {
        key: "monthlyBudget",
        consentKey: "shareBudgetRange",
        label: "Budget/mo (SGD)",
        input: (
          <Input
            id="ctx-monthlyBudget"
            inputMode="numeric"
            value={ctx.monthlyBudget ?? ""}
            onChange={(e) => setCtx({ ...ctx, monthlyBudget: toInt(e.target.value) })}
          />
        ),
      },
    ];

    return (
      <div className="space-y-6">
        {/* 1 — Insurers */}
        <Card>
          <CardHeader>
            <StepTitle n={1}>Choose insurers</StepTitle>
            <CardDescription>The AI writes one email per insurer.</CardDescription>
            <CardAction>
              <Badge variant={selected.length ? "blue" : "secondary"}>
                {selected.length}/{MAX_INSURERS_PER_OUTREACH} selected
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                      "flex items-center gap-3 rounded-lg border bg-card p-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      isOn ? "border-primary bg-accent/60 ring-1 ring-primary" : "hover:bg-muted/50",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
                        isOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                      aria-hidden="true"
                    >
                      {isOn ? <CheckIcon className="size-4" /> : initials(ins.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{ins.name}</span>
                      {ins.existingThread ? (
                        <span className="block truncate text-xs text-amber-700">
                          Already contacted · {THREAD_STATUS_LABELS[ins.existingThread.status]}
                        </span>
                      ) : (
                        <span className="block truncate text-xs text-muted-foreground">{ins.agentEmail}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 2 — Template */}
        <Card>
          <CardHeader>
            <StepTitle n={2}>What do you want to ask?</StepTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <RadioGroup
              value={templateId}
              onValueChange={setTemplateId}
              aria-label="Question template"
              className="sm:grid-cols-2 lg:grid-cols-3"
            >
              {OUTREACH_TEMPLATES.filter((t) => t.id !== "follow_up").map((t) => (
                <Label
                  key={t.id}
                  htmlFor={`tpl-${t.id}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal transition-colors",
                    templateId === t.id ? "border-primary bg-accent/60 ring-1 ring-primary" : "hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem id={`tpl-${t.id}`} value={t.id} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">{t.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.description}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes for insurers (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="e.g. I'd like to understand how payouts work for early-stage conditions."
              />
              <p className="text-xs text-muted-foreground">Added to every draft. You can still edit each email.</p>
            </div>
          </CardContent>
        </Card>

        {/* 3 — Shared details */}
        <Card>
          <CardHeader>
            <StepTitle n={3}>Details the AI may use</StepTitle>
            <CardDescription>
              Only fields you consented to share are editable here. Everything else stays private.
            </CardDescription>
            <CardAction>
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link href="/onboarding">Change consent</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {ctxFields.map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <Label htmlFor={`ctx-${f.key}`} className="text-xs text-muted-foreground">
                    {f.label}
                  </Label>
                  {consent[f.consentKey] ? (
                    f.input
                  ) : (
                    <div className="flex h-9 items-center gap-1.5 rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                      <LockIcon className="size-3" />
                      Not shared
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={generateDrafts} disabled={selected.length === 0}>
            <SparklesIcon />
            Draft {selected.length || ""} email{selected.length === 1 ? "" : "s"} with AI
          </Button>
          <p className="text-xs text-muted-foreground">Drafting has no side effects. Nothing is sent until you approve.</p>
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
          <ArrowLeftIcon />
          Back
        </Button>
        <p className="text-sm text-muted-foreground">
          From{" "}
          <span className="font-mono text-foreground">
            {maskedInbox}
          </span>
        </p>
      </div>

      {sentCount > 0 && (
        <Alert variant="success">
          <CheckCircle2Icon />
          <AlertTitle>
            {sentCount} email{sentCount === 1 ? "" : "s"} sent
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <p>Replies will appear in your CRM.</p>
            <Button asChild size="sm" variant="outline" className="bg-card">
              <Link href="/crm">
                Open CRM
                <ArrowRightIcon />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {list.map((d) => {
        const insurer = byId.get(d.insurerId)!;
        const hits = d.status === "drafting" ? [] : previewPII(`${d.subject}\n${d.body}`);
        const locked = d.status === "sending" || d.status === "sent";
        const badge = STATUS_BADGE[d.status];
        const approveId = `approve-${d.insurerId}`;

        return (
          <Card
            key={d.insurerId}
            role="article"
            aria-label={`Email to ${insurer.name}`}
            className={cn(
              d.status === "blocked" && "border-red-300",
              d.status === "sent" && "border-green-300"
            )}
          >
            <CardHeader>
              <CardTitle>{insurer.name}</CardTitle>
              <CardDescription>To {insurer.agentEmail}</CardDescription>
              <CardAction className="flex items-center gap-2">
                {d.status !== "drafting" &&
                  (d.source === "template" ? (
                    <Badge variant="gray">
                      <FileTextIcon />
                      Template draft · AI unavailable
                    </Badge>
                  ) : (
                    <Badge variant="purple">
                      <BotIcon />
                      AI draft
                    </Badge>
                  ))}
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </CardAction>
            </CardHeader>

            {d.status === "drafting" ? (
              <CardContent className="space-y-2" aria-busy="true">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            ) : (
              <>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Added automatically: </span>
                    {AI_DISCLOSURE_FOOTER}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={`subject-${d.insurerId}`}>Subject</Label>
                    <Input
                      id={`subject-${d.insurerId}`}
                      value={d.subject}
                      onChange={(e) => patchDraft(d.insurerId, { subject: e.target.value, approved: false })}
                      disabled={locked}
                      maxLength={200}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`body-${d.insurerId}`}>Message</Label>
                    <Textarea
                      id={`body-${d.insurerId}`}
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
                      className="font-mono text-[13px] leading-relaxed"
                    />
                  </div>

                  {d.status === "blocked" && (
                    <Alert variant="destructive">
                      <ShieldBanIcon />
                      <AlertTitle>Blocked by the personal-data guard</AlertTitle>
                      <AlertDescription>
                        <p>{d.error}</p>
                        <p className="text-xs">Nothing was sent. This attempt was recorded in your activity log.</p>
                      </AlertDescription>
                    </Alert>
                  )}
                  {d.status === "failed" && (
                    <Alert variant="destructive">
                      <TriangleAlertIcon />
                      <AlertDescription>{d.error}</AlertDescription>
                    </Alert>
                  )}
                  {hits.length > 0 && d.status !== "blocked" && !locked && (
                    <Alert variant="warning">
                      <TriangleAlertIcon />
                      <AlertTitle>This email contains personal data and will be blocked</AlertTitle>
                      <AlertDescription>
                        <div className="flex flex-wrap gap-1.5">
                          {hits.map((h, i) => (
                            <Badge
                              key={`${h.type}-${h.value}-${i}`}
                              variant="outline"
                              className="border-amber-300 bg-card font-mono font-normal"
                            >
                              {h.type}: {h.value}
                            </Badge>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>

                <CardFooter className="flex-wrap justify-between gap-3 border-t">
                  {d.status === "sent" ? (
                    <Button asChild variant="link" className="h-auto p-0 text-green-700">
                      <Link href={d.threadId ? `/crm/${d.threadId}` : "/crm"}>
                        <CheckCircle2Icon />
                        Sent — view thread
                        <ArrowRightIcon />
                      </Link>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={approveId}
                        checked={d.approved}
                        disabled={locked}
                        onCheckedChange={(c) => patchDraft(d.insurerId, { approved: c === true })}
                      />
                      <Label htmlFor={approveId} className="font-normal">
                        I&apos;ve reviewed this email and approve sending it
                      </Label>
                    </div>
                  )}
                  {!locked && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => draftOne(d.insurerId)}>
                        <RefreshCwIcon />
                        Redraft
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
                        <Trash2Icon />
                        Remove
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </>
            )}
          </Card>
        );
      })}

      <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t bg-card/95 px-6 py-3 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {approvedDrafts.length} of {list.filter((d) => d.status !== "sent").length} approved
        </p>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={approvedDrafts.length === 0 || anyDrafting || anySending}
          loading={anySending}
        >
          <SendIcon />
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
