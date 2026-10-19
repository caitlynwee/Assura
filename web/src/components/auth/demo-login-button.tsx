import { demoLoginAction } from "@/app/_actions/auth";
import SubmitButton from "./submit-button";

export default function DemoLoginButton({ callbackUrl }: { callbackUrl?: string }) {
  return (
    <form action={demoLoginAction}>
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <SubmitButton variant="secondary" className="w-full" pendingText="Signing in…">
        One-click demo login
      </SubmitButton>
      <p className="mt-2 text-center text-xs text-gray-500">
        Premium demo account, already onboarded with a masked inbox.
      </p>
    </form>
  );
}
