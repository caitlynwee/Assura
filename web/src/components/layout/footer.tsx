export default function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>© 2026 Assura. Demo only — not a licensed financial adviser.</p>
        <p>
          Information sourced from public brochures. Not financial advice. Always consult a licensed
          adviser before purchasing insurance.
        </p>
      </div>
    </footer>
  );
}
