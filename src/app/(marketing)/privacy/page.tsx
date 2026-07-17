export const metadata = { title: "Privacy Policy — RoundTrack Pro" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-100">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">
        Effective Date: July 18, 2026 · Last Updated: July 18, 2026
      </p>
      <div className="mt-8 max-w-none space-y-6 text-slate-300">
        <section>
          <h2 className="text-lg font-semibold text-slate-100">1. Scope of This Policy</h2>
          <p>
            This Privacy Policy explains how RoundTrack Pro (&ldquo;RoundTrack Pro,&rdquo;
            &ldquo;we&rdquo;) collects, uses, and shares information through the RoundTrack
            Pro platform. It covers two distinct groups of people:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-slate-100">Agency Users</strong> — the credit repair
              agency staff who sign up for and use RoundTrack Pro directly.
            </li>
            <li>
              <strong className="text-slate-100">End Clients</strong> — the agency&rsquo;s
              own clients, whose information is submitted into RoundTrack Pro by the Agency
              (or by the End Client directly, via an onboarding form or client portal the
              Agency provides).
            </li>
          </ul>
          <p>
            <strong className="text-slate-100">If you are an End Client:</strong> RoundTrack
            Pro is a software tool used by the credit repair agency you engaged directly. We
            process your information on that Agency&rsquo;s behalf and at their direction.
            Questions about your own data, your service, or your rights should generally go
            to your Agency first; see Section 7 for how to reach us directly if needed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">2. Information We Collect</h2>
          <p>
            <strong className="text-slate-100">From Agency Users:</strong> Name, email,
            phone, business/agency information, payment information (processed by our
            payment processor, Stripe, not stored by us directly), and usage data.
          </p>
          <p>
            <strong className="text-slate-100">
              From or About End Clients (submitted by the Agency or the End Client):
            </strong>{" "}
            Depending on how the Agency configures onboarding, this may include:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Name, contact information, mailing address</li>
            <li>
              The last four digits of a Social Security number (and, only where an Agency
              has specifically enabled full-SSN collection with additional safeguards, the
              full number — see Section 4)
            </li>
            <li>Date of birth</li>
            <li>Signed service agreement status and e-signature metadata</li>
            <li>
              Copies of government-issued photo ID, proof of address, and credit report
              documents, where uploaded
            </li>
            <li>
              Credit scores and credit report data, whether entered manually, uploaded, or
              obtained via a third-party credit monitoring service the Agency connects
            </li>
            <li>
              Employment status, bankruptcy history, and other intake information the
              Agency&rsquo;s onboarding form collects
            </li>
            <li>Communications sent through the platform&rsquo;s messaging features</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">3. How We Use Information</h2>
          <p>
            We use information to: provide and operate the Service; generate
            dispute-related correspondence at the Agency&rsquo;s direction (including using
            AI-assisted drafting); enable the Agency&rsquo;s client portal and two-way
            messaging; process payments; send transactional emails (invites, password
            resets, notifications); detect and prevent fraud or abuse; and comply with legal
            obligations.
          </p>
          <p>
            <strong className="text-slate-100">We do not sell personal information.</strong>{" "}
            We do not use End Client data to train AI models beyond what is necessary to
            generate that specific client&rsquo;s own documents in that specific request.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            4. Sensitive Data — Extra Safeguards
          </h2>
          <p>
            Social Security numbers and similar sensitive identifiers receive additional
            protection:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>By default, only the last four digits of a Social Security number are retained.</li>
            <li>
              Where an Agency has enabled full-SSN storage for its own operational reasons,
              that value is encrypted at rest and accessible only through a
              narrowly-scoped, logged process tied to generating dispute correspondence — it
              is never included in exports, API responses, or general account displays.
            </li>
            <li>
              We do not collect or store login credentials for third-party credit monitoring
              or bureau accounts.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            5. Who We Share Information With
          </h2>
          <p>
            We share information with the service providers who help us operate the
            platform, each acting under contractual confidentiality and security
            obligations:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Hosting and database infrastructure providers</li>
            <li>Our AI processing provider, for generating letters and other AI-assisted features</li>
            <li>Our email delivery provider, for transactional communications</li>
            <li>Document storage providers, where an Agency connects its own Google Drive</li>
            <li>
              The Agency&rsquo;s own CRM/communications platform (GoHighLevel), which the
              Agency controls and configures independently
            </li>
            <li>Payment processors, for billing</li>
            <li>
              Optional third-party credit monitoring or print-mail providers, only where an
              Agency elects to use those features
            </li>
          </ul>
          <p>
            We may also disclose information if required by law, subpoena, or court order,
            or to protect the rights, property, or safety of RoundTrack Pro, our users, or
            others.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">6. Data Retention &amp; Deletion</h2>
          <p>
            We retain information for as long as the Agency&rsquo;s account is active, and
            for a reasonable period afterward to comply with legal obligations, resolve
            disputes, and enforce agreements. An Agency may request deletion of its account
            and associated End Client data by contacting{" "}
            <a href="mailto:support@roundtrackpro.com" className="text-blue-400 hover:underline">
              support@roundtrackpro.com
            </a>
            , subject to any legal retention requirements that may apply to financial or
            identity-related records.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">7. Your Rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, or request
            deletion of your personal information. End Clients should generally direct these
            requests to their Agency, since the Agency controls the underlying relationship;
            where that isn&rsquo;t practical, you may contact us directly at{" "}
            <a href="mailto:support@roundtrackpro.com" className="text-blue-400 hover:underline">
              support@roundtrackpro.com
            </a>{" "}
            and we will coordinate with the relevant Agency.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">8. Security</h2>
          <p>
            We use reasonable technical and organizational measures to protect information,
            including encryption in transit, restricted and logged access to sensitive
            fields, and access controls scoped per Agency so that one Agency cannot access
            another&rsquo;s data. No system is completely secure, and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            9. International Data Transfers
          </h2>
          <p>
            Data may be processed and stored in the United States and other countries where
            our service providers operate. By using the Service, you acknowledge this
            cross-border processing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">10. Children&rsquo;s Privacy</h2>
          <p>
            RoundTrack Pro is not directed at, and we do not knowingly collect information
            from, individuals under 18.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated
            policy with a new &ldquo;Last Updated&rdquo; date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">12. Contact Us</h2>
          <p>
            Questions about this Privacy Policy:{" "}
            <a href="mailto:support@roundtrackpro.com" className="text-blue-400 hover:underline">
              support@roundtrackpro.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
