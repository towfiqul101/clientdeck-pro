export const metadata = { title: "Terms of Service — ClientDeck Pro" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-100">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: 2026</p>
      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-slate-300">
        <section>
          <h2 className="text-lg font-semibold text-slate-100">1. License</h2>
          <p>ClientDeck Pro is licensed software, not sold. No redistribution is permitted.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-100">2. Nature of the Software</h2>
          <p>
            ClientDeck Pro is practice management software only. It is not legal
            or financial advice. Letters generated are templates; review by a
            qualified professional is recommended before sending.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-100">3. Compliance</h2>
          <p>
            The buyer is responsible for their own CROA / FCRA compliance and any
            other applicable regulations in their jurisdiction.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-100">4. Limitation of Liability</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-100">5. Data Processing</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-100">6. Cancellation Policy</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-100">7. Governing Law</h2>
          <p>[Placeholder — to be completed by counsel.]</p>
        </section>
      </div>
    </div>
  );
}
