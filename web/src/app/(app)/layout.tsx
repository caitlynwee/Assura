import { requireUser } from "@/lib/session";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fresh from users.json (not just the JWT), so tier/onboarding changes show immediately.
  const user = await requireUser();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar tier={user.tier} onboarded={user.onboarded} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
