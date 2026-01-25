import { PublicLayout } from '@/src/components/retail/public/PublicLayout';
import { PublicCard } from '@/src/components/retail/public/PublicCard';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Mail, Store } from 'lucide-react';

export default function AuthPage() {
  return (
    <PublicLayout>
      <div className="space-y-10 text-text-primary">
        <div className="text-center space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-text-tertiary">Access Astronote</p>
          <h1 className="text-4xl md:text-5xl font-bold">Choose your service</h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Retail or Shopify—pick the workspace that fits your business. Same platform, same premium SMS.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <PublicCard className="text-text-primary space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent-light border border-accent mx-auto">
              <Mail className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-semibold text-center">Retail Service</h2>
            <p className="text-sm text-text-secondary text-center">
              Email + password access. Import contacts and launch campaigns instantly.
            </p>
            <ul className="text-sm text-text-secondary space-y-2">
              <li>• Email & password authentication</li>
              <li>• Import contacts via CSV</li>
              <li>• Full campaign management</li>
            </ul>
            <Link href="/auth/retail/login" className="block">
              <Button className="w-full bg-accent text-[#041b1f] hover:bg-accent-hover" size="lg">
                Sign in with Email
              </Button>
            </Link>
            <p className="text-xs text-text-tertiary text-center">
              Don&apos;t have an account?{' '}
              <Link href="/auth/retail/register" className="text-accent hover:underline">
                Sign up
              </Link>
            </p>
          </PublicCard>

          <PublicCard className="text-text-primary space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent-light border border-accent mx-auto">
              <Store className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-2xl font-semibold text-center">Shopify Service</h2>
            <p className="text-sm text-text-secondary text-center">
              Connect your Shopify store. Embedded experience with automatic sync and tracking.
            </p>
            <ul className="text-sm text-text-secondary space-y-2">
              <li>• One-click Shopify connection</li>
              <li>• Embedded in Shopify admin</li>
              <li>• Automatic customer sync</li>
              <li>• Order-based automations</li>
            </ul>
            <Link href="/auth/shopify/connect" className="block">
              <Button className="w-full bg-white/10 text-white border border-white/15 hover:bg-white/15" size="lg">
                Connect Shopify Store
              </Button>
            </Link>
          </PublicCard>
        </div>
      </div>
    </PublicLayout>
  );
}
