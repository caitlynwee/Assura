"use client";

import Link from "next/link";
import { InboxIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { useThreads } from "@/hooks/use-threads";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ThreadCard from "./thread-card";

export default function ThreadList() {
  const { threads, loading, error } = useThreads();

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!threads.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <InboxIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No outreach threads yet</p>
            <p className="text-sm text-muted-foreground">Email an insurer and the conversation will appear here.</p>
          </div>
          <Button asChild size="sm">
            <Link href="/outreach">
              <SendIcon />
              Go to Outreach
            </Link>
          </Button>
        </CardContent>
      </Card>
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
