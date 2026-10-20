import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import AuthCard from "@/components/auth/auth-card";
import LoginForm from "@/components/auth/login-form";
import DemoLoginButton from "@/components/auth/demo-login-button";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).auth.signInMeta };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const t = await getT();
  const a = t.auth;

  return (
    <AuthCard
      title={a.welcomeBack}
      subtitle={a.signInSubtitle}
      footer={
        <>
          {a.newToAssura}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {a.createAccountLink}
          </Link>
        </>
      }
    >
      {error === "session-expired" && (
        <Alert variant="warning" className="mb-4">
          <TriangleAlertIcon />
          <AlertDescription>
            {a.sessionExpired}
          </AlertDescription>
        </Alert>
      )}

      {error === "demo" && (
        <Alert variant="warning" className="mb-4">
          <TriangleAlertIcon />
          <AlertDescription>
            <p>
              {a.demoFailedBefore} <code className="font-mono">bash seed/reset.sh</code> {a.demoFailedAfter}
            </p>
          </AlertDescription>
        </Alert>
      )}

      <LoginForm callbackUrl={callbackUrl} />

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t.common.or}</span>
        <Separator className="flex-1" />
      </div>

      <DemoLoginButton callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
