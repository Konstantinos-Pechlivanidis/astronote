import { Link } from 'react-router-dom';
import { MessageSquare, Users, BarChart3, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            SMS Marketing Made Simple
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Reach your customers instantly with powerful SMS campaigns. 
            Built for retail stores who want to grow their business.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/retail/signup"
              className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              to="/retail/login"
              className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Log In
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-24 grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <MessageSquare className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Send Campaigns</h3>
            <p className="text-gray-600">
              Create and send targeted SMS campaigns to your customers.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <Users className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Manage Contacts</h3>
            <p className="text-gray-600">
              Import and organize your customer contacts with ease.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <BarChart3 className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Track Results</h3>
            <p className="text-gray-600">
              Monitor campaign performance and track conversions.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <Zap className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Automate</h3>
            <p className="text-gray-600">
              Set up automated messages for welcome and birthdays.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

