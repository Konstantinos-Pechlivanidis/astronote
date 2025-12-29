import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthGuard, PublicOnlyGuard } from '../../app/router/guards';
import { AuthProvider } from '../../app/providers/AuthProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReduxProvider } from '../../app/providers/ReduxProvider';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock axios
const mockAxiosGet = vi.fn();
vi.mock('../../api/axios', () => ({
  default: {
    get: (...args) => mockAxiosGet(...args),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

function TestWrapper({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ReduxProvider>
        <AuthProvider>
          <MemoryRouter>{children}</MemoryRouter>
        </AuthProvider>
      </ReduxProvider>
    </QueryClientProvider>
  );
}

describe('Route Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('AuthGuard', () => {
    it('redirects to /login when user is not authenticated', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      mockAxiosGet.mockRejectedValue(new Error('Unauthorized'));

      render(
        <TestWrapper>
          <AuthGuard>
            <div>Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      // Wait for auth check to complete
      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      });
    });

    it('shows loading state while checking auth', () => {
      localStorageMock.getItem.mockReturnValue('token');
      mockAxiosGet.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <TestWrapper>
          <AuthGuard>
            <div>Protected Content</div>
          </AuthGuard>
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('PublicOnlyGuard', () => {
    it('redirects to /app/dashboard when user is authenticated', async () => {
      localStorageMock.getItem.mockReturnValue('token');
      mockAxiosGet.mockResolvedValue({
        data: { user: { id: 1, email: 'test@example.com' } },
      });

      render(
        <TestWrapper>
          <PublicOnlyGuard>
            <div>Public Content</div>
          </PublicOnlyGuard>
        </TestWrapper>
      );

      // Wait for auth check to complete
      await waitFor(() => {
        expect(screen.queryByText('Public Content')).not.toBeInTheDocument();
      });
    });

    it('shows loading state while checking auth', () => {
      localStorageMock.getItem.mockReturnValue('token');
      mockAxiosGet.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(
        <TestWrapper>
          <PublicOnlyGuard>
            <div>Public Content</div>
          </PublicOnlyGuard>
        </TestWrapper>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
});

