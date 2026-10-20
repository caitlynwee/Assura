"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/_actions/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
      <div className="flex items-center gap-2">
        {/* Hidden mirror so an unchecked box still posts "remember=0". The
            Radix Checkbox submits "remember=on" only when checked. */}
        <input type="hidden" name="remember" value="0" />
        <Checkbox id="remember" name="remember" value="on" defaultChecked />
        <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
          {a.keepSignedIn}
        </Label>
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText={a.signingIn}>
        {a.signIn}
      </SubmitButton>
    </form>
  );
}
