import Link from "next/link";
import AuthCard from "@/components/auth/auth-card";
import SignupForm from "@/components/auth/signup-form";

export const metadata = { title: "Create account — Assura" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your Assura account"
      subtitle="Compare critical illness plans. Let AI ask insurers the hard questions — with your approval."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
