import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '../../lib/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('debounces value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    expect(result.current).toBe('initial');

    // Change value
    rerender({ value: 'updated', delay: 300 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('cancels previous timeout on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 300 },
      }
    );

    // Rapid changes
    rerender({ value: 'change1', delay: 300 });
    vi.advanceTimersByTime(100);

    rerender({ value: 'change2', delay: 300 });
    vi.advanceTimersByTime(100);

    rerender({ value: 'final', delay: 300 });
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(result.current).toBe('final');
    });
  });

  it('respects custom delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    rerender({ value: 'updated', delay: 500 });

    // Should not update after 300ms
    vi.advanceTimersByTime(300);
    expect(result.current).toBe('initial');

    // Should update after 500ms
    vi.advanceTimersByTime(200);

    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });
});

