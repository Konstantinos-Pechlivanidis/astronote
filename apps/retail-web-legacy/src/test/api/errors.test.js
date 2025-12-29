import { describe, it, expect } from 'vitest';
import { normalizeError, getErrorMessage } from '../../api/errors';

describe('Error Normalization', () => {
  it('normalizes API errors with message', () => {
    const error = {
      response: {
        status: 400,
        data: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
      },
    };

    const normalized = normalizeError(error);
    expect(normalized.message).toBe('Validation failed');
    expect(normalized.code).toBe('VALIDATION_ERROR');
    expect(normalized.status).toBe(400);
  });

  it('provides default message for 400 errors', () => {
    const error = {
      response: {
        status: 400,
        data: {},
      },
    };

    const normalized = normalizeError(error);
    expect(normalized.message).toContain('Invalid request');
  });

  it('provides default message for 401 errors', () => {
    const error = {
      response: {
        status: 401,
        data: {},
      },
    };

    const normalized = normalizeError(error);
    expect(normalized.message).toContain('session has expired');
  });

  it('normalizes network errors', () => {
    const error = {
      request: {},
    };

    const normalized = normalizeError(error);
    expect(normalized.message).toContain('Network error');
    expect(normalized.code).toBe('NETWORK_ERROR');
  });

  it('normalizes unknown errors', () => {
    const error = {
      message: 'Something went wrong',
    };

    const normalized = normalizeError(error);
    expect(normalized.message).toBe('Something went wrong');
    expect(normalized.code).toBe('UNKNOWN_ERROR');
  });

  it('getErrorMessage returns message from normalized error', () => {
    const error = {
      response: {
        status: 404,
        data: {
          message: 'Not found',
        },
      },
    };

    const message = getErrorMessage(error);
    expect(message).toBe('Not found');
  });

  it('getErrorMessage handles null/undefined', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred.');
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred.');
  });
});

