export const metadata = { title: "Terms of Service — RoundTrack Pro" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-100">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500">
        Effective Date: July 18, 2026 · Last Updated: July 18, 2026
      </p>
      <div className="prose prose-sm mt-8 max-w-none space-y-6 text-slate-300">
        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            1. Who We Are, What This Is
          </h2>
          <p>
            RoundTrack Pro (&ldquo;RoundTrack Pro,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
            is a software platform operated by RoundTrack Pro.
          </p>
          <p>
            RoundTrack Pro is <strong className="text-slate-100">practice management
            software</strong> built for credit repair agencies and similar professionals
            (&ldquo;Agency,&rdquo; &ldquo;you,&rdquo; &ldquo;your&rdquo;). It is a tool that
            helps an Agency track disputes, generate correspondence, manage client records,
            and communicate with its own clients (&ldquo;End Clients&rdquo;).
          </p>
          <p>
            <strong className="text-slate-100">
              RoundTrack Pro is not a credit repair organization.
            </strong>{" "}
            We do not provide credit repair services, credit counseling, or legal advice to
            consumers. We do not have a direct relationship with your End Clients. Any
            services provided to End Clients are provided solely by the Agency, under the
            Agency&rsquo;s own name, at the Agency&rsquo;s own direction, and the Agency is
            solely responsible for those services and for complying with all laws
            applicable to them, including but not limited to the Credit Repair
            Organizations Act (CROA) and any applicable state credit services organization
            statutes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            2. Eligibility &amp; Account Registration
          </h2>
          <p>
            You must be at least 18 years old and able to form a binding contract to use
            RoundTrack Pro. You are responsible for the accuracy of the information you
            provide when registering, for maintaining the confidentiality of your account
            credentials, and for all activity that occurs under your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            3. Your Responsibilities as an Agency
          </h2>
          <p>By using RoundTrack Pro, you represent and warrant that:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You are lawfully authorized and, where required, licensed or registered to
              provide credit repair or related services in every jurisdiction where you
              operate;
            </li>
            <li>
              You will obtain all consents required by law from your End Clients before
              collecting, storing, or transmitting their personal information through
              RoundTrack Pro, including sensitive information such as Social Security
              numbers, dates of birth, financial account information, and government-issued
              identification;
            </li>
            <li>
              You are solely responsible for the content of any letter, communication, or
              document generated or sent using RoundTrack Pro, including AI-assisted letter
              generation —{" "}
              <strong className="text-slate-100">
                RoundTrack Pro does not review, verify, or guarantee the legal accuracy of
                AI-generated content
              </strong>
              , and you must review and approve every communication before it is sent;
            </li>
            <li>
              You will comply with all applicable federal and state laws governing credit
              repair services, data privacy, telemarketing/SMS communications (including
              TCPA), and electronic signatures.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            4. Fees, Trials, and Cancellation
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Current plans and pricing are described at{" "}
              <a href="/#pricing" className="text-blue-400 hover:underline">
                roundtrackpro.com/#pricing
              </a>
              .
            </li>
            <li>
              <strong className="text-slate-100">Free Trial:</strong> New subscriptions
              include a 7-day free trial. If you do not cancel before the trial ends, your
              payment method will be charged the full subscription price for the plan you
              selected.
            </li>
            <li>
              Subscriptions are billed in advance on a monthly or annual basis, as selected
              at signup, and processed through our third-party payment processor, Stripe.
            </li>
            <li>
              <strong className="text-slate-100">All fees are non-refundable</strong>,
              except where required by law or expressly stated otherwise at the time of
              purchase.
            </li>
            <li>
              You may cancel your subscription at any time; cancellation takes effect at the
              end of your then-current billing period.
            </li>
            <li>
              Certain features (e.g., letter print-and-mail services, if enabled) are billed
              separately on a pay-as-you-go basis and are non-refundable once used.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            5. Data You Provide; Sub-Processors
          </h2>
          <p>
            RoundTrack Pro processes data on your behalf, including data about your End
            Clients that you or they submit through onboarding forms, the client portal, or
            integrations you configure (such as GoHighLevel). We use the following
            categories of third-party service providers (&ldquo;Sub-Processors&rdquo;) to
            operate the Service:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Cloud hosting and infrastructure (e.g., Vercel, Supabase)</li>
            <li>AI-assisted content generation (Anthropic)</li>
            <li>Transactional email delivery (Resend)</li>
            <li>
              Document storage, at your election (Google Drive, connected to your own
              account)
            </li>
            <li>
              CRM/communication platform integration (GoHighLevel), which you connect and
              control directly
            </li>
            <li>Payment processing (Stripe)</li>
            <li>Optional third-party credit monitoring integrations, at your election</li>
            <li>Optional print-and-mail delivery providers, at your election</li>
          </ul>
          <p>
            We require our Sub-Processors to protect data with security measures
            appropriate to its sensitivity. A current list of Sub-Processors is available
            upon request at{" "}
            <a href="mailto:support@roundtrackpro.com" className="text-blue-400 hover:underline">
              support@roundtrackpro.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">6. Intellectual Property</h2>
          <p>
            RoundTrack Pro and its underlying software, design, and branding are owned by
            RoundTrack Pro and are protected by intellectual property laws. You retain
            ownership of the data you and your End Clients submit (&ldquo;Your
            Data&rdquo;). You grant us a limited license to use Your Data solely to provide
            and improve the Service to you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">7. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo;
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING
            WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
            NON-INFRINGEMENT. WE DO NOT WARRANT THAT AI-GENERATED LETTER CONTENT WILL BE
            LEGALLY SUFFICIENT, ACCURATE, OR RESULT IN ANY PARTICULAR OUTCOME WITH ANY
            CREDIT BUREAU OR FURNISHER.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">
            8. Limitation of Liability
          </h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, ROUNDTRACK PRO SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
            LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR
            TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS SHALL NOT EXCEED THE
            AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">9. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless RoundTrack Pro from any claims,
            damages, or expenses (including reasonable attorneys&rsquo; fees) arising from
            your use of the Service, your violation of these Terms, your violation of any
            law, or any claim brought by or on behalf of your End Clients relating to
            services you provided them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">10. Termination</h2>
          <p>
            We may suspend or terminate your account for violation of these Terms, for
            non-payment, or for conduct that we reasonably believe poses a risk to the
            Service, other users, or their data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">11. Governing Law</h2>
          <p>
            These Terms are governed by applicable law. Any dispute arising out of or
            relating to these Terms shall first be attempted to be resolved through
            good-faith negotiation between the parties; if unresolved, it may be brought
            before a court of competent jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">12. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will post the updated Terms
            with a new &ldquo;Last Updated&rdquo; date. Continued use of the Service after
            changes take effect constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-100">13. Contact</h2>
          <p>
            Questions about these Terms:{" "}
            <a href="mailto:support@roundtrackpro.com" className="text-blue-400 hover:underline">
              support@roundtrackpro.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
