'use client';

import React, { Component, ReactNode } from 'react';
import { RetailCard } from '@/src/components/retail/RetailCard';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for Shopify App Pages
 * Catches React errors and displays a user-friendly error state
 */
export class ShopifyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Shopify Error Boundary caught error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Reload page to reset state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <RetailCard className="max-w-md w-full p-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
              <h2 className="text-xl font-semibold text-text-primary">
                Something went wrong
              </h2>
              <p className="text-sm text-text-secondary">
                {this.state.error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={this.handleReset} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Button
                  onClick={() => {
                    window.location.href = '/app/shopify/dashboard';
                  }}
                  variant="default"
                  size="sm"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </RetailCard>
        </div>
      );
    }

    return this.props.children;
  }
}

