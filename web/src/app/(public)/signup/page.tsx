import Link from "next/link";
import AuthCard from "@/components/auth/auth-card";
import SignupForm from "@/components/auth/signup-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).auth.signUpMeta };
}

export default async function SignupPage() {
  const a = (await getT()).auth;
  return (
    <AuthCard
      title={a.signUpTitle}
      subtitle={a.signUpSubtitle}
      footer={
        <>
          {a.haveAccount}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {a.signInLink}
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
