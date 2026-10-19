import Link from "next/link";
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
          <Link href="/signup" className="font-medium text-blue-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error === "demo" && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Demo login failed. Run <code className="font-mono">bash seed/reset.sh</code> to seed the demo user.
        </p>
      )}

      <LoginForm callbackUrl={callbackUrl} />

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-2 text-xs text-gray-400">or</span>
        </div>
      </div>

      <DemoLoginButton callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
