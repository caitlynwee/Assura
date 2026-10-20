"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/_actions/auth";
import Field from "./field";
import FormError from "./form-error";
import SubmitButton from "./submit-button";
import { useT } from "@/lib/i18n/client";

export default function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, {});
  const a = useT().auth;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field
        label={a.email}
        name="email"
        type="email"
        autoComplete="email"
        placeholder={a.emailPlaceholder}
        defaultValue={state.values?.email}
        required
      />
      <Field
        label={a.password}
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText={a.signingIn}>
        {a.signIn}
      </SubmitButton>
    </form>
  );
}
