import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { SmsPhonePreviewDark } from '@/src/components/marketing/SmsPhonePreviewDark';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Zap, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { marketingCopy } from '@/lib/content/marketingCopy';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Copy */}
              <div className="text-center lg:text-left">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in">
                  {marketingCopy.hero.headline}
                </h1>
                <p className="text-xl md:text-2xl text-text-secondary mb-8 max-w-2xl mx-auto lg:mx-0 animate-slide-up">
                  {marketingCopy.hero.subhead}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center animate-scale-in">
                  <Link href="/pricing">
                    <Button size="lg" className="w-full sm:w-auto">
                      {marketingCopy.hero.primaryCta}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/how-it-works">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                      {marketingCopy.hero.secondaryCta}
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right: Phone Preview */}
              <div className="flex justify-center lg:justify-end">
                <div className="w-full max-w-[360px] lg:max-w-[420px]">
                  <SmsPhonePreviewDark
                    title="Live preview"
                    message="Hi Maria — your 15% code is ready: ASTR15. Tap to claim: https://astronote.com/redeem"
                    senderName="Astronote"
                    showCounts={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How You Make Money */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background-elevated">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
              How you make money
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {marketingCopy.hero.howYouMakeMoney.map((point, idx) => (
                <GlassCard key={idx} hover>
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-accent-light mb-4">
                    <CheckCircle2 className="w-6 h-6 text-accent" />
                  </div>
                  <p className="text-text-secondary text-lg">{point}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* The Money Loop */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {marketingCopy.moneyLoop.title}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {marketingCopy.moneyLoop.steps.map((step) => (
                <GlassCard key={step.number} hover>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white text-xl font-bold mb-4">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-sm">{step.description}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* Why SMS Works */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background-elevated">
          <div className="max-w-4xl mx-auto">
            <GlassCard>
              <h2 className="text-2xl font-semibold mb-4">{marketingCopy.hero.whySmsWorks.title}</h2>
              <ul className="space-y-3 mb-4">
                {marketingCopy.hero.whySmsWorks.points.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary">{point}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-text-tertiary mt-4">{marketingCopy.hero.whySmsWorks.note}</p>
            </GlassCard>
          </div>
        </section>

        {/* Evidence-Based Performance */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Evidence-Based Performance
              </h2>
              <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                SMS marketing performance metrics from industry research and platform benchmarks.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <GlassCard>
                <div className="flex items-center gap-3 mb-4">
                  <MessageSquare className="w-8 h-8 text-accent" />
                  <div>
                    <div className="text-3xl font-bold text-accent mb-1">98%</div>
                    <div className="text-sm text-text-secondary">Open Rate</div>
                  </div>
                </div>
                <p className="text-text-secondary text-sm mb-3">
                  SMS messages are reported to have an average open rate of approximately 98%, significantly higher than email marketing.
                </p>
                <p className="text-xs text-text-tertiary">
                  Sources: Twilio (2024), GSMA (2024). Open rates refer to messages being read, not just delivered.
                </p>
              </GlassCard>

              <GlassCard>
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-8 h-8 text-accent" />
                  <div>
                    <div className="text-3xl font-bold text-accent mb-1">~3 min</div>
                    <div className="text-sm text-text-secondary">Average Read Time</div>
                  </div>
                </div>
                <p className="text-text-secondary text-sm mb-3">
                  SMS messages are typically read within 3 minutes of delivery, enabling immediate customer engagement and faster conversion cycles.
                </p>
                <p className="text-xs text-text-tertiary">
                  Sources: Twilio (2024), GSMA (2024). Response times vary by industry and message type.
                </p>
              </GlassCard>

              <GlassCard>
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-8 h-8 text-accent" />
                  <div>
                    <div className="text-3xl font-bold text-accent mb-1">21-35%</div>
                    <div className="text-sm text-text-secondary">Click-Through Rate</div>
                  </div>
                </div>
                <p className="text-text-secondary text-sm mb-3">
                  SMS campaigns show click-through rates ranging from 21% to 35%, compared to email marketing averages around 3.25% CTR.
                </p>
                <p className="text-xs text-text-tertiary">
                  Source: Omnisend SMS Marketing Statistics (2025). Email CTR benchmark: Bloomreach (2025).
                </p>
              </GlassCard>

              <GlassCard>
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-8 h-8 text-accent" />
                  <div>
                    <div className="text-3xl font-bold text-accent mb-1">45%</div>
                    <div className="text-sm text-text-secondary">Response Rate</div>
                  </div>
                </div>
                <p className="text-text-secondary text-sm mb-3">
                  SMS marketing campaigns are reported to achieve response rates around 45%, indicating high engagement when messages are well-designed.
                </p>
                <p className="text-xs text-text-tertiary">
                  Source: Twilio (2024). Response rates vary by campaign type, audience, and message quality.
                </p>
              </GlassCard>
            </div>

            <GlassCard light className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Why SMS Converts</h3>
              <p className="text-text-secondary text-sm mb-3">
                SMS is seen fast → action is more likely → conversion lift when designed well. The combination of high open rates, fast read times, and strong click-through rates creates a powerful channel for revenue recovery and customer engagement.
              </p>
              <p className="text-xs text-text-tertiary">
                <strong>Note:</strong> Performance metrics are industry benchmarks and may vary based on your specific use case, audience, message quality, and timing. Always test and optimize your campaigns.
              </p>
            </GlassCard>
          </div>
        </section>

        {/* Objection Killer */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-background-elevated">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-4 gap-4">
              {marketingCopy.objectionKiller.points.map((point, idx) => (
                <GlassCard key={idx} className="text-center">
                  <CheckCircle2 className="w-6 h-6 text-accent mx-auto mb-2" />
                  <p className="text-text-secondary font-medium">{point}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <GlassCard className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to turn messaging into revenue?
              </h2>
              <p className="text-lg text-text-secondary mb-8">
                Start in minutes. First revenue in days. See the impact immediately.
              </p>
              <Link href="/pricing">
                <Button size="lg">
                  {marketingCopy.cta.primary.start}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </GlassCard>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
