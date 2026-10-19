import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">
      {/* Hero */}
      <section className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900">
          Stop chasing insurance quotes.
          <br />
          <span className="text-blue-600">Let AI do it for you.</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Assura compares critical illness plans from Singapore&apos;s top
          insurers, then emails them on your behalf to collect personalised
          quotes — while keeping your data private.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/signup"
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Get started free
          </Link>
          <Link
            href="#how-it-works"
            className="px-8 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="space-y-10">
        <h2 className="text-3xl font-semibold text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Compare plans",
              desc: "Browse and filter 13 critical illness plans from 5 insurers. Every data point is sourced directly from public brochures.",
            },
            {
              step: "2",
              title: "AI emails insurers",
              desc: "Pick up to 5 insurers and a question template. Assura drafts the email — you review and approve before anything is sent.",
            },
            {
              step: "3",
              title: "Track replies in your CRM",
              desc: "All responses are organised in one place. AI extracts the key quote details and flags anything suspicious.",
            },
          ].map((item) => (
            <div key={item.step} className="bg-white rounded-xl border p-6 space-y-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                {item.step}
              </div>
              <h3 className="font-semibold text-lg">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="space-y-8">
        <h2 className="text-3xl font-semibold text-center">Free vs Premium</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {[
            {
              tier: "Free",
              price: "Free forever",
              features: [
                "Full plan comparison table",
                "Filter & sort all 13 plans",
                "Plan Q&A chat (cited answers)",
              ],
              cta: "Get started",
              href: "/signup",
              primary: false,
            },
            {
              tier: "Premium",
              price: "Demo: included",
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
          ].map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-xl border p-6 space-y-4 ${plan.primary ? "border-blue-500 ring-1 ring-blue-500" : ""}`}
            >
              <div>
                <h3 className="font-semibold text-xl">{plan.tier}</h3>
                <p className="text-gray-500 text-sm">{plan.price}</p>
              </div>
              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-blue-500 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`block text-center py-2 rounded-lg font-medium transition ${
                  plan.primary
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
