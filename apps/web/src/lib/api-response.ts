import type { ApiResponse } from '@jazz-portfolio/shared';

function errorMessageFrom(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || !('message' in payload)) return undefined;

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const messages = message.filter((item): item is string => typeof item === 'string');
    if (messages.length > 0) return messages.join(', ');
  }
  return undefined;
}

export async function parseApiResponse<T>(
  response: Response,
  method: string,
  path: string,
): Promise<ApiResponse<T>> {
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(
      errorMessageFrom(payload) ||
        `${method} ${path} failed: ${response.statusText || response.status}`,
    );
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error(`${method} ${path} returned an invalid JSON response`);
  }

  return payload as ApiResponse<T>;
}
