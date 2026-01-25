import { MarketingShell } from '@/components/layout/marketing-shell';
import { GlassCard } from '@/components/ui/glass-card';

export default function TermsPage() {
  return (
    <MarketingShell>
      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="mb-4">
            <p className="text-sm text-text-tertiary text-center italic">
              Draft – requires legal review
            </p>
          </GlassCard>

          <GlassCard>
            <h1 className="text-4xl font-bold mb-8">Terms & Conditions</h1>
            <p className="text-text-secondary mb-6 text-sm">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <div className="space-y-8 text-text-secondary">
              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">1. Acceptance of Terms</h2>
                <p>
                  By accessing and using Astronote (&quot;Service&quot;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, you should not use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">2. Acceptable Use</h2>
                <p className="mb-3">You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Send spam, unsolicited messages, or messages that violate applicable laws</li>
                  <li>Use the Service to send messages to individuals who have not provided explicit consent</li>
                  <li>Impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
                  <li>Violate any applicable local, state, national, or international law or regulation</li>
                  <li>Interfere with or disrupt the Service or servers or networks connected to the Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">3. Anti-Spam Policy</h2>
                <p className="mb-3">
                  Astronote is committed to preventing spam and ensuring compliance with anti-spam laws, including but not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>CAN-SPAM Act (United States)</li>
                  <li>GDPR (European Union)</li>
                  <li>CASL (Canada)</li>
                  <li>Other applicable anti-spam regulations</li>
                </ul>
                <p className="mt-3">
                  You must obtain explicit opt-in consent before sending SMS messages to any recipient. You are responsible for maintaining proof of consent for all contacts in your account.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">4. Consent Requirements</h2>
                <p>
                  You must ensure that all recipients have provided clear, affirmative consent to receive SMS messages. Consent must be:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
                  <li>Freely given, specific, informed, and unambiguous</li>
                  <li>Documented and verifiable</li>
                  <li>Easily revocable at any time</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">5. Prohibited Content</h2>
                <p className="mb-3">You may not use the Service to send messages containing:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Illegal content or content promoting illegal activities</li>
                  <li>Harassing, abusive, or threatening content</li>
                  <li>Misleading or fraudulent content</li>
                  <li>Content that infringes on intellectual property rights</li>
                  <li>Adult content without appropriate age verification</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">6. Account Suspension and Termination</h2>
                <p className="mb-3">
                  We reserve the right to suspend or terminate your account immediately, without notice, if:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>You violate these Terms or our Acceptable Use Policy</li>
                  <li>You engage in spam or other prohibited activities</li>
                  <li>You fail to maintain proof of consent for your contacts</li>
                  <li>You use the Service in a manner that could harm our reputation or business</li>
                  <li>You fail to pay fees when due</li>
                </ul>
                <p className="mt-3">
                  Upon termination, you will lose access to your account and all data associated with it. We may delete your account data after a reasonable retention period.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">7. Limitation of Liability</h2>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, ASTRONOTE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">8. Dispute Resolution</h2>
                <p>
                  Any disputes arising out of or relating to these Terms shall be resolved through binding arbitration in accordance with the rules of [Arbitration Organization], except where prohibited by law. The arbitration shall take place in [Location], and the language of the arbitration shall be English.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">9. Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction], without regard to its conflict of law provisions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">10. Contact Information</h2>
                <p>
                  If you have questions about these Terms, please contact us at legal@astronote.com.
                </p>
              </section>
            </div>
          </GlassCard>
        </div>
      </main>
    </MarketingShell>
  );
}
