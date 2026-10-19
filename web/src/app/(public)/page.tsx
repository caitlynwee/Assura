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

const STEPS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: FileSearchIcon,
    title: "Compare plans",
    desc: "Browse and filter critical illness plans from Singapore insurers. Every figure links back to its public brochure and \"data as of\" date.",
  },
  {
    icon: MailCheckIcon,
    title: "AI emails insurers",
    desc: "Pick up to 5 insurers and a question. Assura drafts each email — you review and approve before anything is sent.",
  },
  {
    icon: InboxIcon,
    title: "Track replies in your CRM",
    desc: "Responses land in one place. Quote details are extracted, and pushy or suspicious replies are flagged.",
  },
];

const SAFEGUARDS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: LockKeyholeIcon, title: "Masked inbox", desc: "Insurers never see your real email or phone." },
  { icon: ShieldAlertIcon, title: "Personal-data guard", desc: "NRIC, health and income details are blocked from outgoing email." },
  { icon: ScrollTextIcon, title: "Tamper-evident log", desc: "Every AI action is recorded in a verifiable hash chain." },
];

const PLANS = [
  {
    tier: "Free",
    price: "Free forever",
    features: ["Full plan comparison table", "Filter & sort every plan", "Plan Q&A chat with cited answers"],
    cta: "Get started",
    href: "/signup",
    primary: false,
  },
  {
    tier: "Premium",
    price: "Included in the demo",
    features: [
      "Everything in Free",
      "AI outreach to up to 5 insurers",
      "Masked inbox — real email stays private",
      "CRM with quote extraction",
      "Activity log + audit chain",
    ],
    cta: "Try the demo",
    href: "/login",
    primary: true,
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-24 px-6 py-16">
      {/* Hero */}
      <section className="space-y-6 text-center">
        <Badge variant="outline" className="mx-auto gap-1.5 px-3 py-1 font-normal">
          <span className="size-1.5 rounded-full bg-primary" />
          Critical illness insurance · Singapore
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight">
          Stop chasing insurance quotes.
          <br />
          <span className="text-primary">Let AI do it for you.</span>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Assura compares critical illness plans from Singapore&apos;s top insurers, then emails them on
          your behalf to collect personalised quotes — while keeping your data private.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Get started free
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <p className="text-muted-foreground">Three steps, with you in control of every message.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <Card key={title} className="gap-4">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </div>
                <CardDescription>Step {i + 1}</CardDescription>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Safeguards */}
      <section className="rounded-2xl border bg-card p-8">
        <div className="grid gap-8 md:grid-cols-3">
          {SAFEGUARDS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="space-y-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Free vs Premium</h2>
        <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <Card key={plan.tier} className={cn(plan.primary && "border-primary ring-1 ring-primary")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  {plan.tier}
                  {plan.primary && <Badge variant="blue">Demo</Badge>}
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
