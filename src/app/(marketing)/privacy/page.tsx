export const metadata = { title: "Privacy Policy — ClientDeck Pro" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: 2025</p>
      <div className="mt-8 max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data We Collect</h2>
          <p>
            Agency account information, and client data entered by the agency. We
            never store full Social Security Numbers — only the last four digits.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Where Data Lives</h2>
          <p>Data is hosted on Supabase (US region). Payments are processed by Stripe.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Data Deletion</h2>
          <p>
            To request deletion of your data, email us. We retain data for 30 days
            after cancellation, after which it is permanently removed.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
          <p>towfiqul5040@gmail.com</p>
        </section>
      </div>
    </div>
  );
}
