import Link from "next/link";
import { ShieldMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = (await getT()).common;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldMark className="size-10" />
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground">{t.notFoundTitle}</p>
      <Button asChild variant="outline">
        <Link href="/">{t.backHome}</Link>
      </Button>
    </div>
  );
}
