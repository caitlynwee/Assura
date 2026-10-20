import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  FileSearchIcon,
  InboxIcon,
  LockKeyholeIcon,
  MailCheckIcon,
  ScrollTextIcon,
  ShieldAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

const STEP_ICONS: LucideIcon[] = [FileSearchIcon, MailCheckIcon, InboxIcon];
const SAFEGUARD_ICONS: LucideIcon[] = [LockKeyholeIcon, ShieldAlertIcon, ScrollTextIcon];

export default async function HomePage() {
  const t = (await getT()).home;
  const PLANS = [
    { ...t.plans.free, href: "/signup", primary: false },
    { ...t.plans.premium, href: "/login", primary: true },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-24 px-6 py-16">
      {/* Hero */}
      <section className="space-y-6 text-center">
        <Badge variant="outline" className="mx-auto gap-1.5 px-3 py-1 font-normal">
          <span className="size-1.5 rounded-full bg-primary" />
          {t.badge}
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight">
          {t.heroLine1}
          <br />
          <span className="text-primary">{t.heroLine2}</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          {t.heroBody}
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              {t.ctaPrimary}
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#how-it-works">{t.ctaSecondary}</Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">{t.howTitle}</h2>
          <p className="text-muted-foreground">{t.howSubtitle}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {t.steps.map(({ title, desc }, i) => {
            const Icon = STEP_ICONS[i];
            return (
            <Card key={title} className="gap-4">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <CardDescription>{t.step(i + 1)}</CardDescription>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
            </Card>
            );
          })}
        </div>
      </section>

      {/* Safeguards */}
      <section className="rounded-2xl border bg-card p-8">
        <div className="grid gap-8 md:grid-cols-3">
          {t.safeguards.map(({ title, desc }, i) => {
            const Icon = SAFEGUARD_ICONS[i];
            return (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="space-y-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight">{t.pricingTitle}</h2>
        <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <Card key={plan.tier} className={cn(plan.primary && "border-primary ring-1 ring-primary")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  {plan.tier}
                  {plan.primary && <Badge variant="blue">{t.demoBadge}</Badge>}
                </CardTitle>
                <CardDescription>{plan.price}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full" variant={plan.primary ? "default" : "outline"}>
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
