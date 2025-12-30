import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { marketingCopy } from '@/lib/content/marketingCopy';

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {marketingCopy.pricing.title}
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              {marketingCopy.pricing.subtitle}
            </p>
          </div>

          {/* Subscription Plans */}
          <div className="mb-20">
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Monthly Plan */}
              <GlassCard hover>
                <h3 className="text-2xl font-bold mb-2">{marketingCopy.pricing.plans.monthly.name}</h3>
                <p className="text-text-secondary text-sm mb-6">{marketingCopy.pricing.plans.monthly.tagline}</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{marketingCopy.pricing.plans.monthly.price}</span>
                    <span className="text-text-secondary">{marketingCopy.pricing.plans.monthly.period}</span>
                  </div>
                  <p className="text-sm text-text-tertiary mt-1">
                    {marketingCopy.pricing.plans.monthly.credits} FREE SMS credits {marketingCopy.pricing.plans.monthly.creditsPeriod}
                  </p>
                </div>
                <p className="text-text-secondary text-sm mb-6">
                  {marketingCopy.pricing.plans.monthly.description}
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary text-sm">
                      {marketingCopy.pricing.plans.monthly.credits} free credits per billing cycle
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary text-sm">
                      All core features
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary text-sm">
                      Buy extra credits anytime
                    </span>
                  </li>
                </ul>
                <Link href="/auth" className="block">
                  <Button variant="outline" className="w-full">
                    {marketingCopy.cta.primary.subscribe}
                  </Button>
                </Link>
              </GlassCard>

              {/* Yearly Plan */}
              <GlassCard hover className="ring-2 ring-accent">
                <div className="flex items-center justify-center mb-2">
                  <span className="px-2 py-1 rounded-full bg-accent-light text-accent text-xs font-medium">
                    Best Value
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-2">{marketingCopy.pricing.plans.yearly.name}</h3>
                <p className="text-text-secondary text-sm mb-6">{marketingCopy.pricing.plans.yearly.tagline}</p>
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{marketingCopy.pricing.plans.yearly.price}</span>
                    <span className="text-text-secondary">{marketingCopy.pricing.plans.yearly.period}</span>
                  </div>
                  <p className="text-sm text-accent font-medium mt-1">
                    {marketingCopy.pricing.plans.yearly.effectiveMonthly}
                  </p>
                  <p className="text-sm text-text-tertiary mt-1">
                    {marketingCopy.pricing.plans.yearly.credits} FREE SMS credits {marketingCopy.pricing.plans.yearly.creditsPeriod}
                  </p>
                </div>
                <p className="text-text-secondary text-sm mb-6">
                  {marketingCopy.pricing.plans.yearly.description}
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary text-sm">
                      {marketingCopy.pricing.plans.yearly.credits} free credits per billing cycle (5x more than monthly)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary text-sm">
                      All Monthly features
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary text-sm">
                      Save €240 per year (50% off)
                    </span>
                  </li>
                </ul>
                <Link href="/auth" className="block">
                  <Button className="w-full">
                    {marketingCopy.cta.primary.subscribeYearly}
                  </Button>
                </Link>
              </GlassCard>
            </div>
          </div>

          {/* Math That Matters */}
          <GlassCard className="mb-8">
            <h3 className="text-xl font-semibold mb-3">{marketingCopy.pricing.mathThatMatters.title}</h3>
            <p className="text-text-secondary mb-2">
              {marketingCopy.pricing.mathThatMatters.description}
            </p>
            <p className="text-xs text-text-tertiary">
              {marketingCopy.pricing.mathThatMatters.note}
            </p>
          </GlassCard>

          {/* Credit Add-ons */}
          <div className="mb-16">
            <h2 className="text-2xl font-semibold mb-4 text-center">{marketingCopy.pricing.credits.title}</h2>
            <p className="text-text-secondary text-center mb-4">
              {marketingCopy.pricing.credits.description}
            </p>
            <GlassCard light>
              <p className="text-text-secondary text-center">
                {marketingCopy.pricing.credits.note}
              </p>
            </GlassCard>
          </div>

          {/* FAQ */}
          <div>
            <GlassCard light>
              <h3 className="text-xl font-semibold mb-4">Frequently Asked Questions</h3>
              <div className="space-y-4 text-sm text-text-secondary">
                {marketingCopy.pricing.faq.map((item, idx) => (
                  <div key={idx}>
                    <strong className="text-text-primary">{item.q}</strong>
                    <p>{item.a}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
