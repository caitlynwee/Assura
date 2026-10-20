"use client";

import Link from "next/link";
import { InboxIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { useThreads } from "@/hooks/use-threads";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ThreadCard from "./thread-card";
import { useT } from "@/lib/i18n/client";

export default function ThreadList() {
  const { threads, loading, error } = useThreads();
  const t = useT().crm;

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
        <AlertDescription>{t.loadThreadsFailed}</AlertDescription>
      </Alert>
    );
  }

  if (!threads.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <InboxIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">{t.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">{t.emptyBody}</p>
          </div>
          <Button asChild size="sm">
            <Link href="/outreach">
              <SendIcon />
              {t.goToOutreach}
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
