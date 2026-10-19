"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/_actions/auth";
import Field from "./field";
import FormError from "./form-error";
import SubmitButton from "./submit-button";

export default function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        defaultValue={state.values?.email}
        required
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
