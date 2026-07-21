import { ApiResponse } from '@jazz-portfolio/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/**
 * Admin / authenticated API helpers.
 * Always `cache: 'no-store'` — never write into the Next Data Cache.
 * Session JWT is sent via httpOnly cookie (`credentials: 'include'`).
 */
export class AdminApiClient {
  private static getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  private static async parse<T>(response: Response, method: string, path: string): Promise<ApiResponse<T>> {
    if (!response.ok) {
      throw new Error(`${method} ${path} failed: ${response.statusText}`);
    }
    return response.json();
  }

  static async get<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include',
      cache: 'no-store',
    });
    return this.parse<T>(response, 'GET', path);
  }

  static async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
    });
    return this.parse<T>(response, 'POST', path);
  }

  static async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
    });
    return this.parse<T>(response, 'PUT', path);
  }

  static async patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
    });
    return this.parse<T>(response, 'PATCH', path);
  }

  static async delete<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include',
      cache: 'no-store',
    });
    return this.parse<T>(response, 'DELETE', path);
  }
}
