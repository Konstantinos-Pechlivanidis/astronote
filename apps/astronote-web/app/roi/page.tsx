'use client';

import { MarketingShell } from '@/components/layout/marketing-shell';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { TrendingUp, Info, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { marketingCopy } from '@/lib/content/marketingCopy';

const presets = [
  {
    name: 'Small Store',
    monthlyOrders: 100,
    aov: 50,
    recoveryRate: 20,
    optInRate: 15,
    conversionUplift: 5,
  },
  {
    name: 'Medium Store',
    monthlyOrders: 500,
    aov: 75,
    recoveryRate: 25,
    optInRate: 20,
    conversionUplift: 7,
  },
  {
    name: 'Large Store',
    monthlyOrders: 2000,
    aov: 100,
    recoveryRate: 30,
    optInRate: 25,
    conversionUplift: 10,
  },
];

export default function ROIPage() {
  const [monthlyOrders, setMonthlyOrders] = useState(500);
  const [aov, setAov] = useState(75);
  const [recoveryRate, setRecoveryRate] = useState(25);
  const [optInRate, setOptInRate] = useState(20);
  const [costPerCredit, setCostPerCredit] = useState(0.045);
  const [conversionUplift, setConversionUplift] = useState(7);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showUseCases, setShowUseCases] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const calculateROI = () => {
    // Abandoned carts (assuming 70% cart abandonment rate - industry standard)
    const abandonedCarts = monthlyOrders * 0.7;
    const optInCarts = abandonedCarts * (optInRate / 100);
    const recoveredCarts = optInCarts * (recoveryRate / 100);
    const recoveredRevenue = recoveredCarts * aov;

    // Additional revenue from conversion uplift
    const additionalOrders = monthlyOrders * (conversionUplift / 100);
    const additionalRevenue = additionalOrders * aov;

    // Total revenue
    const totalRevenue = recoveredRevenue + additionalRevenue;

    // Costs (assuming 1 credit per message, 2 messages per campaign on average)
    const messagesPerCampaign = 2;
    const creditsUsed = optInCarts * messagesPerCampaign;
    const totalCost = creditsUsed * costPerCredit;

    // Net profit
    const netProfit = totalRevenue - totalCost;

    // ROI
    const roi = totalCost > 0 ? ((netProfit / totalCost) * 100).toFixed(1) : '0';

    return {
      abandonedCarts: Math.round(abandonedCarts),
      optInCarts: Math.round(optInCarts),
      recoveredCarts: Math.round(recoveredCarts),
      recoveredRevenue: Math.round(recoveredRevenue),
      additionalRevenue: Math.round(additionalRevenue),
      totalRevenue: Math.round(totalRevenue),
      creditsUsed: Math.round(creditsUsed),
      totalCost: Math.round(totalCost * 100) / 100,
      netProfit: Math.round(netProfit),
      roi: parseFloat(roi),
    };
  };

  const results = calculateROI();

  const loadPreset = (preset: typeof presets[0]) => {
    setMonthlyOrders(preset.monthlyOrders);
    setAov(preset.aov);
    setRecoveryRate(preset.recoveryRate);
    setOptInRate(preset.optInRate);
    setConversionUplift(preset.conversionUplift);
  };

  return (
    <MarketingShell>
      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              {marketingCopy.roi.title}
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-2">
              {marketingCopy.roi.subtitle}
            </p>
            <p className="text-text-secondary max-w-2xl mx-auto">
              {marketingCopy.roi.description}
            </p>
          </div>

          {/* Results Banner - Always Visible */}
          <div className="mb-8">
            <GlassCard className="bg-accent-light border-accent">
              <div className="grid md:grid-cols-4 gap-6">
                <div className="text-center md:text-left">
                  <div className="text-sm text-text-secondary mb-1">Total Revenue</div>
                  <div className="text-3xl font-bold text-accent">
                    €{results.totalRevenue.toLocaleString()}
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-sm text-text-secondary mb-1">Net Profit</div>
                  <div className="text-3xl font-bold text-accent">
                    €{results.netProfit.toLocaleString()}
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-sm text-text-secondary mb-1">ROI</div>
                  <div className="text-3xl font-bold text-accent">
                    {results.roi}x
                  </div>
                </div>
                <div className="text-center md:text-left md:text-right">
                  <div className="text-sm text-text-secondary mb-1">Total Cost</div>
                  <div className="text-3xl font-bold text-accent">
                    €{results.totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Input Section - Left Column */}
            <div className="lg:col-span-1">
              <GlassCard className="sticky top-24">
                <h2 className="text-xl font-semibold mb-6">Your Store Metrics</h2>

                {/* Presets */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Quick Presets
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((preset) => (
                      <Button
                        key={preset.name}
                        variant="ghost"
                        size="sm"
                        onClick={() => loadPreset(preset)}
                        className="text-xs"
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Monthly Orders
                    </label>
                    <Input
                      type="number"
                      value={monthlyOrders}
                      onChange={(e) => setMonthlyOrders(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Average Order Value (€)
                    </label>
                    <Input
                      type="number"
                      value={aov}
                      onChange={(e) => setAov(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Recovery Rate (%)
                    </label>
                    <Input
                      type="number"
                      value={recoveryRate}
                      onChange={(e) => setRecoveryRate(Number(e.target.value))}
                    />
                    <p className="text-xs text-text-tertiary mt-1">
                      Typical: 15-30%
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      SMS Opt-in Rate (%)
                    </label>
                    <Input
                      type="number"
                      value={optInRate}
                      onChange={(e) => setOptInRate(Number(e.target.value))}
                    />
                    <p className="text-xs text-text-tertiary mt-1">
                      Typical: 15-25%
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Conversion Uplift (%)
                    </label>
                    <Input
                      type="number"
                      value={conversionUplift}
                      onChange={(e) => setConversionUplift(Number(e.target.value))}
                    />
                    <p className="text-xs text-text-tertiary mt-1">
                      Additional orders from SMS
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Cost per Credit (€)
                    </label>
                    <Input
                      type="number"
                      step="0.001"
                      value={costPerCredit}
                      onChange={(e) => setCostPerCredit(Number(e.target.value))}
                    />
                    <p className="text-xs text-text-tertiary mt-1">
                      Default: €0.045
                    </p>
                  </div>
                </div>

                {/* Assumptions - Collapsible */}
                <div className="mt-6 pt-6 border-t border-border">
                  <button
                    onClick={() => setShowAssumptions(!showAssumptions)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-accent" />
                      <span className="text-sm font-medium text-text-primary">
                        {marketingCopy.roi.assumptions.title}
                      </span>
                    </div>
                    {showAssumptions ? (
                      <ChevronUp className="w-4 h-4 text-text-tertiary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-tertiary" />
                    )}
                  </button>
                  {showAssumptions && (
                    <ul className="space-y-2 text-xs text-text-secondary mt-3">
                      {marketingCopy.roi.assumptions.points.map((point, idx) => (
                        <li key={idx}>• {point}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Results & Details - Right Columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Detailed Breakdown */}
              <GlassCard>
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="w-6 h-6 text-accent" />
                  <h2 className="text-2xl font-semibold">Detailed Breakdown</h2>
                </div>

                <div className="space-y-4">
                  {/* Revenue Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary mb-3">Revenue</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Abandoned Carts</span>
                        <span className="text-text-primary font-medium">{results.abandonedCarts}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Opt-in Carts</span>
                        <span className="text-text-primary font-medium">{results.optInCarts}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Recovered Carts</span>
                        <span className="text-text-primary font-medium">{results.recoveredCarts}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Recovered Revenue</span>
                        <span className="text-accent font-semibold">€{results.recoveredRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Additional Revenue</span>
                        <span className="text-accent font-semibold">€{results.additionalRevenue.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-3 pt-3 border-t-2 border-accent mt-2">
                        <span className="text-text-primary font-semibold">Total Revenue</span>
                        <span className="text-accent font-bold text-lg">€{results.totalRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Costs Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary mb-3">Costs</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-border">
                        <span className="text-text-secondary">Credits Used</span>
                        <span className="text-text-primary font-medium">{results.creditsUsed.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-3 pt-3 border-t-2 border-border mt-2">
                        <span className="text-text-primary font-semibold">Total Cost</span>
                        <span className="text-text-primary font-bold text-lg">€{results.totalCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Profit Section */}
                  <div className="glass-light rounded-xl p-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-text-primary font-semibold">Net Profit</span>
                      <span className="text-accent font-bold text-2xl">€{results.netProfit.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary text-sm">ROI</span>
                      <span className="text-accent font-bold text-xl">{results.roi}x</span>
                    </div>
                    <p className="text-xs text-text-tertiary mt-3">
                      For every €1 spent, you earn €{results.roi.toFixed(2)}
                    </p>
                  </div>
                </div>
              </GlassCard>

              {/* Best Use Cases - Collapsible */}
              <GlassCard>
                <button
                  onClick={() => setShowUseCases(!showUseCases)}
                  className="flex items-center justify-between w-full text-left mb-4"
                >
                  <h3 className="text-lg font-semibold text-text-primary">
                    {marketingCopy.roi.bestUseCases.title}
                  </h3>
                  {showUseCases ? (
                    <ChevronUp className="w-5 h-5 text-text-tertiary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-tertiary" />
                  )}
                </button>
                {showUseCases && (
                  <div className="space-y-4 text-sm">
                    {marketingCopy.roi.bestUseCases.cases.map((useCase, idx) => (
                      <div key={idx} className="border-l-2 border-accent pl-4">
                        <div className="font-medium text-text-primary mb-1">{useCase.scenario}</div>
                        <p className="text-text-secondary mb-1">{useCase.whyItWorks}</p>
                        <p className="text-xs text-text-tertiary">{useCase.typicalResults}</p>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* When SMS Wins - Collapsible */}
              <GlassCard>
                <button
                  onClick={() => setShowSources(!showSources)}
                  className="flex items-center justify-between w-full text-left mb-4"
                >
                  <h3 className="text-lg font-semibold text-text-primary">
                    {marketingCopy.roi.whenSmsWins.title} & Sources
                  </h3>
                  {showSources ? (
                    <ChevronUp className="w-5 h-5 text-text-tertiary" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-text-tertiary" />
                  )}
                </button>
                {showSources && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary mb-2">
                        {marketingCopy.roi.whenSmsWins.title}
                      </h4>
                      <ul className="space-y-2 text-sm text-text-secondary">
                        {marketingCopy.roi.whenSmsWins.points.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-accent mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <h4 className="text-sm font-semibold text-text-primary mb-2">
                        {marketingCopy.roi.sources.title}
                      </h4>
                      <ul className="space-y-2 text-xs text-text-secondary">
                        {marketingCopy.roi.sources.points.map((point, idx) => (
                          <li key={idx}>• {point}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-text-tertiary mt-3">
                        {marketingCopy.roi.sources.note}
                      </p>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* CTA */}
              <GlassCard className="bg-accent-light border-accent">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Ready to start earning?</h3>
                  <p className="text-text-secondary text-sm mb-4">
                    See how SMS can drive revenue for your business.
                  </p>
                  <Link href="/pricing" className="block">
                    <Button size="lg" className="w-full sm:w-auto">
                      {marketingCopy.cta.primary.start}
                    </Button>
                  </Link>
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </main>
    </MarketingShell>
  );
}
