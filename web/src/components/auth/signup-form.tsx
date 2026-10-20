"use client";

import { useActionState } from "react";
import { CheckIcon } from "lucide-react";
import { signupAction, type FormState } from "@/app/_actions/auth";
import { Label } from "@/components/ui/label";
import Field from "./field";
import FormError from "./form-error";
import SubmitButton from "./submit-button";

export default function SignupForm() {
  const [state, formAction] = useActionState<FormState, FormData>(signupAction, {});
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

      <div className="rounded-lg border bg-card p-3">
        <Label className="flex items-center gap-2 font-semibold">
          <CheckIcon className="size-4 text-primary" />
          Free account
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Compare plans and use cited Q&amp;A for free. Upgrade to Premium with Stripe whenever you need outreach.
        </p>
      </div>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
