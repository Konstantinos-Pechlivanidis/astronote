/**
 * Normalize API errors into a consistent shape for UI
 * Provides user-friendly messages and safe error handling
 */
export function normalizeError(error) {
  if (error.response) {
    // API error
    const status = error.response.status;
    const data = error.response.data || {};
    const code = data.code || 'UNKNOWN_ERROR';

    // User-friendly messages based on status codes
    let message = data.message;
    if (!message) {
      switch (status) {
      case 400:
        message = 'Invalid request. Please check your input and try again.';
        break;
      case 401:
        message = 'Your session has expired. Please log in again.';
        break;
      case 403:
        message = 'You do not have permission to perform this action.';
        break;
      case 404:
        message = 'The requested resource was not found.';
        break;
      case 409:
        message = 'This action conflicts with the current state. Please refresh and try again.';
        break;
      case 422:
        message = 'Validation failed. Please check your input.';
        break;
      case 429:
        message = 'Too many requests. Please wait a moment and try again.';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        break;
      case 503:
        message = 'Service temporarily unavailable. Please try again later.';
        break;
      default:
        message = 'An error occurred. Please try again.';
      }
    }

    return {
      message,
      code,
      status,
      originalError: import.meta.env.DEV ? error : undefined, // Only in dev
    };
  }

  if (error.request) {
    // Network error
    return {
      message: 'Network error. Please check your connection and try again.',
      code: 'NETWORK_ERROR',
      status: null,
    };
  }

  // Other error (e.g., thrown in code)
  return {
    message: error.message || 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    status: null,
  };
}

/**
 * Get user-friendly error message from any error object
 */
export function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';
  const normalized = normalizeError(error);
  return normalized.message;
}

