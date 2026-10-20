import { Suspense } from "react";
import { readViewCookie, requireUser } from "@/lib/session";
import { resolveEffectiveViewTier } from "@/lib/view-mode";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { ViewModeProvider } from "@/components/view-mode/view-mode-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import ToastOnParam from "@/components/toast-on-param";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fresh from PostgreSQL (not just the JWT), so tier/onboarding changes show immediately.
  const user = await requireUser();

  // COSMETIC view-as (admin-only). The cookie seeds the first server render so the
  // nav is correct with no flash; the client provider hydrates from the same value.
  // `resolveEffectiveViewTier` ignores the cookie for non-admins, so this can never
  // grant a cosmetic upgrade — real authorization stays in the edge middleware.
  const requestedView = await readViewCookie();
  const effectiveViewTier = resolveEffectiveViewTier(user.tier, requestedView);

  return (
    <ViewModeProvider realTier={user.tier} initialViewTier={effectiveViewTier}>
      <TooltipProvider>
        <Suspense fallback={null}>
          <ToastOnParam />
        </Suspense>
        <div className="flex h-screen overflow-hidden">
          <Sidebar tier={effectiveViewTier} onboarded={user.onboarded} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Topbar user={user} />
            <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </ViewModeProvider>
  );
}
