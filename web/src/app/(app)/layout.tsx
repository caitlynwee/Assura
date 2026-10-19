import { requireUser } from "@/lib/session";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fresh from users.json (not just the JWT), so tier/onboarding changes show immediately.
  const user = await requireUser();

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar tier={user.tier} onboarded={user.onboarded} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar user={user} />
          <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
