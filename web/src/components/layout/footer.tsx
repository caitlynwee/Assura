import { getT } from "@/lib/i18n/server";

export default async function Footer() {
  const t = (await getT()).layout.footer;
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>{t.demo}</p>
        <p>{t.disclaimer}</p>
      </div>
    </footer>
  );
}
