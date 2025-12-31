import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { SmsPhonePreviewDark } from '@/src/components/marketing/SmsPhonePreviewDark';
import Link from 'next/link';
import { CheckCircle2, Clock } from 'lucide-react';
import { marketingCopy } from '@/lib/content/marketingCopy';

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {marketingCopy.howItWorks.title}
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              {marketingCopy.howItWorks.subtitle}
            </p>
          </div>

          {/* Time to Value Banner */}
          <GlassCard className="mb-12 bg-accent-light border-accent">
            <div className="flex items-center gap-4">
              <Clock className="w-8 h-8 text-accent" />
              <div>
                <h3 className="text-lg font-semibold text-text-primary mb-1">
                  {marketingCopy.howItWorks.timeToValue.title}
                </h3>
                <div className="space-y-1">
                  {marketingCopy.howItWorks.timeToValue.blocks.map((block, idx) => (
                    <p key={idx} className="text-text-secondary text-sm">
                      <strong>{block.time}:</strong> {block.action}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-text-tertiary mt-2">
                  {marketingCopy.howItWorks.timeToValue.note}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Steps */}
          <div className="space-y-12 mb-16">
            {marketingCopy.howItWorks.steps.map((step, idx) => (
              <div key={idx} className="relative">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent text-white text-xl font-bold">
                      {idx + 1}
                    </div>
                  </div>
                  <div className="flex-1">
                    <GlassCard hover>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h2 className="text-2xl font-semibold mb-1">{step.title}</h2>
                          <p className="text-text-secondary text-sm mb-2">{step.subtitle}</p>
                          <p className="text-text-secondary">{step.description}</p>
                        </div>
                        {step.timeToValue && (
                          <div className="text-right">
                            <div className="text-xs text-text-tertiary mb-1">Time to Value</div>
                            <div className="text-sm font-medium text-accent">{step.timeToValue}</div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-border">
                        <ul className="space-y-2">
                          {step.details.map((detail, detailIdx) => (
                            <li key={detailIdx} className="flex items-start gap-2 text-sm text-text-secondary">
                              <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* What to Send */}
          <div className="mb-12">
            <GlassCard className="mb-8">
              <h2 className="text-2xl font-semibold mb-2">{marketingCopy.howItWorks.whatToSend.title}</h2>
              <p className="text-text-secondary mb-6">{marketingCopy.howItWorks.whatToSend.subtitle}</p>
              <div className="space-y-6">
                {marketingCopy.howItWorks.whatToSend.examples.map((example, idx) => (
                  <div key={idx} className="border-l-2 border-accent pl-4">
                    <h3 className="font-semibold text-text-primary mb-1">{example.type}</h3>
                    <p className="text-sm text-text-secondary mb-2">
                      <strong>Message:</strong> {example.message}
                    </p>
                    <p className="text-sm text-text-tertiary italic mb-2">
                      &quot;{example.example}&quot;
                    </p>
                    <p className="text-sm text-text-secondary">
                      <strong>Why it works:</strong> {example.whyItWorks}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Message Preview */}
            <div className="flex justify-center">
              <GlassCard className="p-8 max-w-md w-full">
                <SmsPhonePreviewDark
                  message="Hi Maria — your 15% code is ready: ASTR15. Tap to claim: https://astronote.com/redeem"
                  senderName="Astronote"
                  showCounts={true}
                />
              </GlassCard>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <GlassCard>
              <h2 className="text-2xl font-semibold mb-4">Ready to get started?</h2>
              <p className="text-text-secondary mb-6">
                Launch in minutes. First revenue in days. See the impact immediately.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/pricing">
                  <Button size="lg">
                    {marketingCopy.cta.secondary.pricing}
                  </Button>
                </Link>
                <Link href="/roi">
                  <Button variant="outline" size="lg">
                    {marketingCopy.cta.secondary.calculateRoi}
                  </Button>
                </Link>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
