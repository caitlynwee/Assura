import OutreachForm from "@/components/outreach/outreach-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach — Fineprint" };

export default function OutreachPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Outreach</h1>
        <p className="text-gray-500 text-sm mt-1">
          Pick up to 5 insurers, choose a question template, and let AI draft
          the email. You approve before anything is sent.
        </p>
      </div>
      <OutreachForm />
    </div>
  );
}
