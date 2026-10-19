import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import AuthCard from "@/components/auth/auth-card";
import LoginForm from "@/components/auth/login-form";
import DemoLoginButton from "@/components/auth/demo-login-button";

export const metadata = { title: "Sign in — Assura" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to compare plans and manage your insurer enquiries."
      footer={
        <>
          New to Assura?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error === "demo" && (
        <Alert variant="warning" className="mb-4">
          <TriangleAlertIcon />
          <AlertDescription>
            <p>
              Demo login failed. Run <code className="font-mono">bash seed/reset.sh</code> to seed the demo user.
            </p>
          </AlertDescription>
        </Alert>
      )}

      <LoginForm callbackUrl={callbackUrl} />

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <DemoLoginButton callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
