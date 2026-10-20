export const dynamic = "force-dynamic";

import PolicyChatWorkspace from "@/components/policy-chat/policy-chat-workspace";
import PageHeader from "@/components/layout/page-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  return { title: (await getT()).policyChat.meta };
}

export default async function PoliciesPage() {
  const t = (await getT()).policyChat;
  return (
    <div className="flex h-full flex-col space-y-4">
      <PageHeader title={t.title} description={t.description} />
      <div className="min-h-0 flex-1">
        <PolicyChatWorkspace />
      </div>
    </div>
  );
}
