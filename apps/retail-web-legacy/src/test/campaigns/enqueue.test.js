import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEnqueueCampaign } from '../../features/campaigns/hooks/useEnqueueCampaign';
import { campaignsApi } from '../../api/modules/campaigns';

// Mock campaignsApi
vi.mock('../../api/modules/campaigns', () => ({
  campaignsApi: {
    enqueue: vi.fn(),
  },
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock queryKeys
vi.mock('../../lib/queryKeys', () => ({
  queryKeys: {
    campaigns: {
      detail: (id) => ['campaigns', 'detail', id],
      status: (id) => ['campaigns', 'status', id],
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useEnqueueCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates unique idempotency key per mutation call', async () => {
    const { result } = renderHook(() => useEnqueueCampaign(), {
      wrapper: createWrapper(),
    });

    campaignsApi.enqueue.mockResolvedValue({
      data: { queued: 10 },
    });

    // Call mutation twice
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.reset();
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify enqueue was called twice
    expect(campaignsApi.enqueue).toHaveBeenCalledTimes(2);

    // Verify each call had an idempotency key
    const firstCall = campaignsApi.enqueue.mock.calls[0];
    const secondCall = campaignsApi.enqueue.mock.calls[1];

    expect(firstCall[1]).toBeDefined();
    expect(secondCall[1]).toBeDefined();
    expect(typeof firstCall[1]).toBe('string');
    expect(typeof secondCall[1]).toBe('string');

    // Keys should be different (UUIDs are unique)
    expect(firstCall[1]).not.toBe(secondCall[1]);
  });

  it('includes idempotency key in request header', async () => {
    const { result } = renderHook(() => useEnqueueCampaign(), {
      wrapper: createWrapper(),
    });

    campaignsApi.enqueue.mockResolvedValue({
      data: { queued: 5 },
    });

    result.current.mutate(123);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify enqueue was called with campaign ID and idempotency key
    expect(campaignsApi.enqueue).toHaveBeenCalledWith(123, expect.any(String));
    expect(campaignsApi.enqueue.mock.calls[0][1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('does not retry on error', async () => {
    const { result } = renderHook(() => useEnqueueCampaign(), {
      wrapper: createWrapper(),
    });

    const error = new Error('Network error');
    campaignsApi.enqueue.mockRejectedValue(error);

    result.current.mutate(1);

    await waitFor(() => expect(result.current.isError).toBe(true));

    // Should only be called once (no retry)
    expect(campaignsApi.enqueue).toHaveBeenCalledTimes(1);
  });
});

