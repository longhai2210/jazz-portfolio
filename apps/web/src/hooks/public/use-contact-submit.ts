'use client';

import { useCallback, useState } from 'react';

export interface ContactSubmitPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  _hp: string;
}

export interface ContactSubmitError {
  status: number;
  messageKey: string;
  retryAfter?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export function useContactSubmit() {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<ContactSubmitError | null>(null);

  const mutate = useCallback(async (payload: ContactSubmitPayload) => {
    setIsPending(true);
    setIsSuccess(false);
    setError(null);

    try {
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/contact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        // Network error, timeout, or other fetch failure
        throw { status: 0, messageKey: 'errorServer' } satisfies ContactSubmitError;
      }

      if (response.ok) {
        setIsSuccess(true);
        return;
      }

      const error: ContactSubmitError = {
        status: response.status,
        messageKey: 'errorServer',
      };

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        error.messageKey = retryAfter ? 'errorRateLimit' : 'errorRateLimitGeneric';
        if (retryAfter) {
          error.retryAfter = retryAfter;
        }
      } else if (response.status === 400) {
        error.messageKey = 'errorValidation';
      }

      throw error;
    } catch (requestError) {
      setError(requestError as ContactSubmitError);
    } finally {
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    mutate,
    reset,
    isPending,
    isSuccess,
    isError: error !== null,
    error,
  };
}
