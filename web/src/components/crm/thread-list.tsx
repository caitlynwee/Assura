"use client";

import { useThreads } from "@/hooks/use-threads";
import ThreadCard from "./thread-card";
import Spinner from "@/components/ui/spinner";

export default function ThreadList() {
  const { threads, loading, error } = useThreads();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-600 text-sm">{error}</p>;
  }

  if (!threads.length) {
    return (
      <div className="bg-white border rounded-xl p-8 text-center text-gray-400 text-sm">
        No outreach threads yet. Go to Outreach to email an insurer.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} />
      ))}
    </div>
  );
}
