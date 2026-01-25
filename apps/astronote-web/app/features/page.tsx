import { MarketingShell } from '@/components/layout/marketing-shell';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { marketingCopy } from '@/lib/content/marketingCopy';

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {marketingCopy.features.title}
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              {marketingCopy.features.subtitle}
            </p>
          </div>

          {/* Outcome Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {marketingCopy.features.sections.map((section, idx) => (
              <GlassCard key={idx} hover>
                <h2 className="text-2xl font-semibold mb-3 text-accent">
                  {section.outcome}
                </h2>
                <p className="text-text-secondary mb-3">
                  <strong>What it does:</strong> {section.whatItDoes}
                </p>
                <p className="text-text-primary font-medium mb-4">
                  <strong>How it makes money:</strong> {section.howItMakesMoney}
                </p>
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium text-text-secondary mb-2">Use cases:</p>
                  <ul className="space-y-1">
                    {section.useCases.map((useCase, useIdx) => (
                      <li key={useIdx} className="flex items-start gap-2 text-sm text-text-secondary">
                        <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        <span>{useCase}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link href="/pricing">
              <Button size="lg">
                {marketingCopy.cta.primary.start}
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </MarketingShell>
  );
}
