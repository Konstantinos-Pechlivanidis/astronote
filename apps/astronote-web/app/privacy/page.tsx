import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { GlassCard } from '@/components/ui/glass-card';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <GlassCard className="mb-4">
            <p className="text-sm text-text-tertiary text-center italic">
              Draft – requires legal review
            </p>
          </GlassCard>

          <GlassCard>
            <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
            <p className="text-text-secondary mb-6 text-sm">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <div className="space-y-8 text-text-secondary">
              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">1. Introduction</h2>
                <p>
                  Astronote (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our SMS marketing platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">2. Data Categories</h2>
                <p className="mb-3">We collect the following categories of data:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Account Data:</strong> Email address, password (hashed), company name, sender name</li>
                  <li><strong>Contact Data:</strong> Phone numbers, names, email addresses, and other contact information you provide</li>
                  <li><strong>Usage Data:</strong> Campaign performance, message delivery status, engagement metrics</li>
                  <li><strong>Technical Data:</strong> IP address, browser type, device information, usage patterns</li>
                  <li><strong>Payment Data:</strong> Processed securely through Stripe; we do not store full payment card details</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">3. How We Process Your Data</h2>
                <p className="mb-3">We process your data for the following purposes:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>To provide and maintain our Service</li>
                  <li>To process payments and manage subscriptions</li>
                  <li>To send SMS messages on your behalf</li>
                  <li>To provide customer support</li>
                  <li>To improve our Service and develop new features</li>
                  <li>To comply with legal obligations</li>
                  <li>To detect and prevent fraud or abuse</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">4. Cookies and Tracking</h2>
                <p>
                  We use cookies and similar tracking technologies to track activity on our Service and store certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">5. Data Retention</h2>
                <p>
                  We retain your personal data only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When we no longer need your data, we will securely delete or anonymize it.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">6. Your Rights</h2>
                <p className="mb-3">Depending on your location, you may have the following rights:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
                  <li><strong>Erasure:</strong> Request deletion of your personal data</li>
                  <li><strong>Restriction:</strong> Request limitation of processing</li>
                  <li><strong>Portability:</strong> Request transfer of your data</li>
                  <li><strong>Objection:</strong> Object to processing of your data</li>
                  <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
                </ul>
                <p className="mt-3">
                  To exercise these rights, please contact us at privacy@astronote.com.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">7. Data Sharing and Subprocessors</h2>
                <p className="mb-3">We may share your data with the following categories of third parties:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>SMS Providers:</strong> To deliver SMS messages (e.g., Mitto)</li>
                  <li><strong>Payment Processors:</strong> To process payments (e.g., Stripe)</li>
                  <li><strong>Cloud Infrastructure:</strong> To host our Service (e.g., AWS, Render)</li>
                  <li><strong>Analytics Providers:</strong> To analyze usage patterns (anonymized data)</li>
                </ul>
                <p className="mt-3">
                  All subprocessors are bound by data processing agreements and are required to maintain appropriate security measures.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">8. Security Measures</h2>
                <p className="mb-3">We implement appropriate technical and organizational measures to protect your data, including:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Encryption in transit (TLS/SSL) and at rest</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Secure data centers and infrastructure</li>
                  <li>Employee training on data protection</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">9. International Data Transfers</h2>
                <p>
                  Your data may be transferred to and processed in countries other than your country of residence. We ensure that appropriate safeguards are in place, such as Standard Contractual Clauses, to protect your data in accordance with this Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">10. Children&apos;s Privacy</h2>
                <p>
                  Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information, please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">11. Changes to This Privacy Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-text-primary mb-4">12. Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy or wish to exercise your rights, please contact us at:
                </p>
                <p className="mt-3">
                  Email: privacy@astronote.com<br />
                  Address: [Your Company Address]
                </p>
              </section>
            </div>
          </GlassCard>
        </div>
      </main>

      <Footer />
    </div>
  );
}

