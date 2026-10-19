"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "lucide-react";
import { signupAction, type FormState } from "@/app/_actions/auth";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import Field from "./field";
import FormError from "./form-error";
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
    <form action={formAction} className="grid gap-4" noValidate>
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

      <div className="grid gap-2">
        <Label id="plan-label">Plan</Label>
        <RadioGroup
          name="tier"
          value={tier}
          onValueChange={setTier}
          aria-labelledby="plan-label"
          className="grid-cols-2"
        >
          {PLANS.map((p) => (
            <Label
              key={p.id}
              htmlFor={`tier-${p.id}`}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-2 rounded-lg border bg-card p-3 font-normal transition-colors",
                tier === p.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
              )}
            >
              <span className="flex w-full items-center gap-2">
                <RadioGroupItem id={`tier-${p.id}`} value={p.id} />
                <span className="font-semibold">{p.title}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{p.tag}</span>
              </span>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-1.5">
                    <CheckIcon className="size-3 text-primary" />
                    {pt}
                  </li>
                ))}
              </ul>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
