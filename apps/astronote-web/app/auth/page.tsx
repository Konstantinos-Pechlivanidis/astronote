import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Mail, Store } from 'lucide-react';

export default function AuthPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Choose Your Service
            </h1>
            <p className="text-xl text-text-secondary max-w-2xl mx-auto">
              Select how you want to access Astronote. Different services, same powerful SMS marketing platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Retail Service */}
            <GlassCard hover className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent-light mb-6 mx-auto">
                <Mail className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-semibold mb-3">Retail Service</h2>
              <p className="text-text-secondary mb-6">
                Perfect for retail businesses. Sign up with email and password. Import your customer database and start sending campaigns.
              </p>
              <ul className="text-left text-sm text-text-secondary space-y-2 mb-8">
                <li>• Email & password authentication</li>
                <li>• Import contacts via CSV</li>
                <li>• No Shopify required</li>
                <li>• Full campaign management</li>
              </ul>
              <Link href="/auth/retail/login" className="block">
                <Button className="w-full" size="lg">
                  Sign In with Email
                </Button>
              </Link>
              <p className="text-sm text-text-tertiary mt-4">
                Don&apos;t have an account?{' '}
                <Link href="/auth/retail/register" className="text-accent hover:underline">
                  Sign up
                </Link>
              </p>
            </GlassCard>

            {/* Shopify Service */}
            <GlassCard hover className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-accent-light mb-6 mx-auto">
                <Store className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-2xl font-semibold mb-3">Shopify Service</h2>
              <p className="text-text-secondary mb-6">
                Connect your Shopify store. Access Astronote directly from your Shopify admin. Automatic customer sync and order tracking.
              </p>
              <ul className="text-left text-sm text-text-secondary space-y-2 mb-8">
                <li>• One-click Shopify connection</li>
                <li>• Embedded in Shopify admin</li>
                <li>• Automatic customer sync</li>
                <li>• Order-based automations</li>
              </ul>
              <Link href="/auth/shopify/connect" className="block">
                <Button className="w-full" size="lg">
                  Connect Shopify Store
                </Button>
              </Link>
            </GlassCard>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

