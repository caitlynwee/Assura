import { Sparkles } from "lucide-react";
import { demoLoginAction } from "@/app/_actions/auth";
import SubmitButton from "./submit-button";
import { getT } from "@/lib/i18n/server";

export default async function DemoLoginButton({ callbackUrl }: { callbackUrl?: string }) {
  const a = (await getT()).auth;
  return (
    <form action={demoLoginAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <SubmitButton variant="outline" className="w-full" pendingText={a.signingIn}>
        <Sparkles />
        {a.demoLogin}
      </SubmitButton>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        {a.demoLoginHint}
      </p>
    </form>
  );
}
