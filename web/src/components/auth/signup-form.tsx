"use client";

import { useActionState } from "react";
import { CheckIcon } from "lucide-react";
import { signupAction, type FormState } from "@/app/_actions/auth";
import { Label } from "@/components/ui/label";
import Field from "./field";
import FormError from "./form-error";
import SubmitButton from "./submit-button";
import { useT } from "@/lib/i18n/client";

export default function SignupForm() {
  const [state, formAction] = useActionState<FormState, FormData>(signupAction, {});
  const fe = state.fieldErrors ?? {};
  const a = useT().auth;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <Field
        label={a.name}
        name="name"
        autoComplete="name"
        placeholder={a.namePlaceholder}
        defaultValue={state.values?.name}
        error={fe.name}
        required
      />
      <Field
        label={a.email}
        name="email"
        type="email"
        autoComplete="email"
        placeholder={a.emailPlaceholder}
        defaultValue={state.values?.email}
        error={fe.email}
        hint={a.emailHint}
        required
      />
      <Field
        label={a.password}
        name="password"
        type="password"
        autoComplete="new-password"
        error={fe.password}
        hint={a.passwordHint}
        required
      />
      <Field
        label={a.confirmPassword}
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={fe.confirmPassword}
        required
      />

      <div className="rounded-lg border bg-card p-3">
        <Label className="flex items-center gap-2 font-semibold">
          <CheckIcon className="size-4 text-primary" />
          {a.freeAccount}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {a.freeAccountBody}
        </p>
      </div>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText={a.creatingAccount}>
        {a.createAccount}
      </SubmitButton>
    </form>
  );
}
