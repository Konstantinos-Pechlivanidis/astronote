import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ShoppingBag, 
  Store, 
  MessageSquare, 
  BarChart3, 
  Users, 
  Zap,
  Check,
  ArrowRight,
  FileText,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6">
              SMS Marketing
              <span className="block text-blue-400">Made Simple</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
              Reach your customers instantly with powerful SMS campaigns. 
              Built for retail stores and Shopify merchants.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link to="/retail/login">
                  Retail Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-gray-600 text-white hover:bg-gray-800">
                <Link to="/shopify/login">
                  Shopify Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Product Comparison */}
      <section className="py-24 bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Choose Your Platform</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Retail Card */}
            <Card className="bg-gray-700 border-gray-600">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingBag className="h-8 w-8 text-blue-400" />
                  <CardTitle className="text-2xl text-white">Astronote Retail</CardTitle>
                </div>
                <CardDescription className="text-gray-300">
                  Perfect for retail stores, POS systems, QR codes, and NFC tracking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    POS integration & QR code tracking
                  </li>
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    NFC opt-in campaigns
                  </li>
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    Advanced contact segmentation
                  </li>
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    Birthday & welcome automations
                  </li>
                </ul>
                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                  <Link to="/retail/login">Get Started</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Shopify Card */}
            <Card className="bg-gray-700 border-gray-600">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Store className="h-8 w-8 text-purple-400" />
                  <CardTitle className="text-2xl text-white">Astronote Shopify</CardTitle>
                </div>
                <CardDescription className="text-gray-300">
                  Embedded Shopify app for SMS marketing directly in your store
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    Native Shopify integration
                  </li>
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    Customer sync & segmentation
                  </li>
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    Order-based automations
                  </li>
                  <li className="flex items-center gap-2 text-gray-200">
                    <Check className="h-5 w-5 text-green-400" />
                    Discount code campaigns
                  </li>
                </ul>
                <Button asChild className="w-full bg-purple-600 hover:bg-purple-700">
                  <Link to="/shopify/login">Get Started</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Powerful Features</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">SMS Campaigns</h3>
              <p className="text-gray-400">
                Create and send targeted SMS campaigns to your customers with ease
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600 mb-4">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Analytics & Reports</h3>
              <p className="text-gray-400">
                Track performance with detailed analytics and delivery reports
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600 mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Contact Management</h3>
              <p className="text-gray-400">
                Organize and segment your contacts for better targeting
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-600 mb-4">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Automations</h3>
              <p className="text-gray-400">
                Set up automated messages for birthdays, welcome flows, and more
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600 mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Templates</h3>
              <p className="text-gray-400">
                Use pre-built templates or create your own custom messages
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 mb-4">
                <Check className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Compliance</h3>
              <p className="text-gray-400">
                Built-in unsubscribe handling and GDPR compliance features
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of businesses using Astronote to connect with their customers
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Link to="/retail/login">Start with Retail</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
              <Link to="/shopify/login">Start with Shopify</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Astronote</h3>
              <p className="text-gray-400 text-sm">
                SMS marketing platform for retail stores and Shopify merchants.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Products</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/retail/login" className="hover:text-white">Retail</Link></li>
                <li><Link to="/shopify/login" className="hover:text-white">Shopify</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} Astronote. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

