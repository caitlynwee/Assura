"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button";
import Spinner from "@/components/ui/spinner";
import Badge from "@/components/ui/badge";
import { MAX_INSURERS_PER_OUTREACH, OUTREACH_TEMPLATES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type InsurerSummary = {
  id: string;
  name: string;
  agentEmail: string;
  logo: string;
  website: string;
};

type Gender = "male" | "female" | "prefer_not_to_say";

interface UserContext {
  age: string;
  gender: Gender | "";
  smoker: boolean;
  coverageNeeded: string;
  monthlyBudget: string;
}

const EMPTY_CONTEXT: UserContext = {
  age: "",
  gender: "",
  smoker: false,
  coverageNeeded: "",
  monthlyBudget: "",
};

export default function OutreachForm() {
  const [insurers, setInsurers] = useState<InsurerSummary[]>([]);
  const [loadingInsurers, setLoadingInsurers] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState(OUTREACH_TEMPLATES[0].id);
  const [context, setContext] = useState<UserContext>(EMPTY_CONTEXT);

  // The insurer currently being drafted / sent to.
  const [activeInsurerId, setActiveInsurerId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [piiBlocked, setPiiBlocked] = useState<string | null>(null);
  const [sentThreadId, setSentThreadId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/insurers")
      .then((r) => r.json())
      .then((d) => {
        setInsurers(d.insurers ?? []);
        setLoadError(null);
      })
      .catch(() => setLoadError("Failed to load insurers."))
      .finally(() => setLoadingInsurers(false));
  }, []);

  const atCap = selected.length >= MAX_INSURERS_PER_OUTREACH;

  function toggleInsurer(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_INSURERS_PER_OUTREACH) return prev;
      return [...prev, id];
    });
  }

  function buildUserContext() {
    const ctx: Record<string, unknown> = {};
    if (context.age.trim()) ctx.age = Number(context.age);
    if (context.gender) ctx.gender = context.gender;
    ctx.smoker = context.smoker;
    if (context.coverageNeeded.trim()) ctx.coverageNeeded = Number(context.coverageNeeded);
    if (context.monthlyBudget.trim()) ctx.monthlyBudget = Number(context.monthlyBudget);
    return ctx;
  }

  async function handleGenerate(insurerId: string) {
    setActiveInsurerId(insurerId);
    setDrafting(true);
    setDraftError(null);
    setSendError(null);
    setPiiBlocked(null);
    setSentThreadId(null);
    setSubject("");
    setBody("");

    const template = OUTREACH_TEMPLATES.find((t) => t.id === templateId);

    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurerId,
          templateId,
          userContext: buildUserContext(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDraftError(data.error ?? "Could not generate a draft. Please try again.");
        return;
      }
      const data = await res.json();
      // The API returns the draft as a single string; place it in the body
      // textarea and seed the subject from the chosen template.
      setSubject(template?.label ?? "Insurance enquiry");
      setBody(typeof data.draft === "string" ? data.draft : "");
    } catch {
      setDraftError("Could not generate a draft. Please try again.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend() {
    if (!activeInsurerId) return;
    setSending(true);
    setSendError(null);
    setPiiBlocked(null);

    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insurerId: activeInsurerId,
          subject,
          body,
          userApproved: true,
        }),
      });

      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "PII_BLOCKED") {
          setPiiBlocked(
            data.error ??
              "The draft contains personal information that must not be shared."
          );
          return;
        }
        setSendError(data.error ?? "Could not send the email. Please try again.");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSendError(data.error ?? "Could not send the email. Please try again.");
        return;
      }

      const data = await res.json();
      setSentThreadId(data.threadId ?? null);
    } catch {
      setSendError("Could not send the email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loadingInsurers) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return <p className="text-red-600 text-sm">{loadError}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Step 1 — Select insurers */}
      <section className="bg-white border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            1. Choose insurers
          </h2>
          <Badge variant={atCap ? "orange" : "gray"}>
            {selected.length} / {MAX_INSURERS_PER_OUTREACH} selected
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {insurers.map((insurer) => {
            const isSelected = selected.includes(insurer.id);
            const disabled = !isSelected && atCap;
            return (
              <label
                key={insurer.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition",
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200",
                  disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:bg-gray-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => toggleInsurer(insurer.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900">{insurer.name}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Step 2 — Template + context */}
      <section className="bg-white border rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">
          2. Choose a question &amp; optional details
        </h2>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Template
          </label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {OUTREACH_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {OUTREACH_TEMPLATES.find((t) => t.id === templateId)?.description}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Age
            </label>
            <input
              type="number"
              min={18}
              max={80}
              value={context.age}
              onChange={(e) => setContext((c) => ({ ...c, age: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={context.gender}
              onChange={(e) =>
                setContext((c) => ({ ...c, gender: e.target.value as Gender | "" }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Coverage needed (SGD)
            </label>
            <input
              type="number"
              min={1}
              value={context.coverageNeeded}
              onChange={(e) =>
                setContext((c) => ({ ...c, coverageNeeded: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Monthly budget (SGD)
            </label>
            <input
              type="number"
              min={1}
              value={context.monthlyBudget}
              onChange={(e) =>
                setContext((c) => ({ ...c, monthlyBudget: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={context.smoker}
            onChange={(e) =>
              setContext((c) => ({ ...c, smoker: e.target.checked }))
            }
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          I am a smoker
        </label>
      </section>

      {/* Step 3 — Generate draft per insurer */}
      <section className="bg-white border rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">3. Generate a draft</h2>
        {selected.length === 0 ? (
          <p className="text-sm text-gray-500">
            Select at least one insurer above to generate a draft.
          </p>
        ) : (
          <div className="space-y-2">
            {selected.map((id) => {
              const insurer = insurers.find((i) => i.id === id);
              if (!insurer) return null;
              return (
                <div
                  key={id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-3",
                    activeInsurerId === id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  )}
                >
                  <span className="text-sm font-medium text-gray-900">
                    {insurer.name}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={drafting && activeInsurerId === id}
                    onClick={() => handleGenerate(id)}
                  >
                    {activeInsurerId === id ? "Regenerate" : "Generate draft"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {draftError && <p className="text-red-600 text-sm">{draftError}</p>}
      </section>

      {/* Step 4 — Review, approve & send */}
      {activeInsurerId && (subject || body || drafting) && (
        <section className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">
            4. Review &amp; approve
          </h2>
          <p className="text-xs text-gray-500">
            Nothing is sent until you approve. You can edit the subject and body
            before sending.
          </p>

          {piiBlocked && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800">
                Email blocked — not sent
              </p>
              <p className="text-sm text-red-700 mt-1">
                The PII guard detected personal information (such as an NRIC,
                phone number, health, or income detail) in this draft, so the
                email was NOT sent. Remove the flagged details below and try
                again.
              </p>
              <p className="text-xs text-red-600 mt-2">{piiBlocked}</p>
            </div>
          )}

          {sentThreadId ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-semibold text-green-800">Email sent</p>
              <p className="text-sm text-green-700 mt-1">
                Your enquiry was sent through your masked inbox.
              </p>
              <Link
                href={`/crm/${sentThreadId}`}
                className="inline-block mt-2 text-sm font-medium text-blue-600 hover:underline"
              >
                View thread in CRM →
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {sendError && <p className="text-red-600 text-sm">{sendError}</p>}
              <div>
                <Button
                  onClick={handleSend}
                  loading={sending}
                  disabled={drafting || !subject.trim() || !body.trim()}
                >
                  Approve &amp; send
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
