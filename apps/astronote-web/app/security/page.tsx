import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { GlassCard } from '@/components/ui/glass-card';
import { Shield, Lock, Eye, CheckCircle2 } from 'lucide-react';

const securityFeatures = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    description: 'All data is encrypted in transit and at rest. Your customer information is protected with industry-standard security measures.',
  },
  {
    icon: Shield,
    title: 'GDPR Compliant',
    description: 'Built with privacy and compliance in mind. Opt-in management, consent tracking, and secure data handling.',
  },
  {
    icon: Eye,
    title: 'Data Privacy',
    description: 'We never sell your data. Your customer information belongs to you, and we treat it with the highest level of care.',
  },
  {
    icon: CheckCircle2,
    title: 'Regular Audits',
    description: 'Our security practices are regularly audited. We maintain SOC 2 compliance and follow industry best practices.',
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Security & Trust
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              Your data security and customer privacy are our top priorities. We take trust seriously.
            </p>
          </div>

          {/* Security Features */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {securityFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <GlassCard key={feature.title} hover>
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent-light mb-4">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-text-secondary">{feature.description}</p>
                </GlassCard>
              );
            })}
          </div>

          {/* Additional Info */}
          <GlassCard>
            <h2 className="text-2xl font-semibold mb-4">Our Commitment</h2>
            <div className="space-y-4 text-text-secondary">
              <p>
                At Astronote, we understand that trust is earned, not given. That&apos;s why we&apos;ve built our platform with security and privacy at its core.
              </p>
              <p>
                We use industry-standard encryption, maintain strict access controls, and regularly audit our security practices. Your customer data is never shared with third parties, and we comply with GDPR and other privacy regulations.
              </p>
              <p>
                If you have questions about our security practices or need to report a security concern, please contact us at security@astronote.com.
              </p>
            </div>
          </GlassCard>
        </div>
      </main>

      <Footer />
    </div>
  );
}

