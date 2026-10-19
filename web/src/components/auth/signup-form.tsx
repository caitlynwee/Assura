"use client";

import { useActionState, useState } from "react";
import { signupAction, type FormState } from "@/app/_actions/auth";
import { cn } from "@/lib/utils";
import Field from "./field";
import SubmitButton from "./submit-button";

const PLANS = [
  {
    id: "premium",
    title: "Premium",
    tag: "Demo · no payment",
    points: ["AI outreach to insurers", "Masked inbox + CRM", "Audit log"],
  },
  {
    id: "free",
    title: "Free",
    tag: "Compare only",
    points: ["Plan comparison", "Cited plan Q&A"],
  },
] as const;

export default function SignupForm() {
  const [state, formAction] = useActionState<FormState, FormData>(signupAction, {});
  const [tier, setTier] = useState<string>(state.values?.tier ?? "premium");
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        placeholder="Alex Tan"
        defaultValue={state.values?.name}
        error={fe.name}
        required
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={state.values?.email}
        error={fe.email}
        hint="Used to sign in only. Insurers never see it."
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        error={fe.password}
        hint="At least 8 characters, with a letter and a number."
        required
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={fe.confirmPassword}
        required
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">Plan</legend>
        <div className="grid grid-cols-2 gap-3">
          {PLANS.map((p) => (
            <label
              key={p.id}
              className={cn(
                "cursor-pointer rounded-xl border bg-white p-3 text-sm transition",
                tier === p.id
                  ? "border-blue-500 ring-1 ring-blue-500"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <input
                type="radio"
                name="tier"
                value={p.id}
                checked={tier === p.id}
                onChange={() => setTier(p.id)}
                className="sr-only"
              />
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-900">{p.title}</span>
                <span className="text-[11px] text-gray-500">{p.tag}</span>
              </span>
              <ul className="mt-2 space-y-1 text-xs text-gray-600">
                {p.points.map((pt) => (
                  <li key={pt}>✓ {pt}</li>
                ))}
              </ul>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
