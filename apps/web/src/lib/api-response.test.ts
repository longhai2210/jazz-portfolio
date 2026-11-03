import { parseApiResponse } from './api-response';

describe('parseApiResponse', () => {
  it('returns a successful API envelope', async () => {
    const response = new Response(JSON.stringify({ data: { id: 'post-1' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(
      parseApiResponse<{ id: string }>(response, 'GET', '/posts/post-1'),
    ).resolves.toEqual({
      data: { id: 'post-1' },
    });
  });

  it('preserves validation messages returned by the API', async () => {
    const response = new Response(
      JSON.stringify({ message: ['Slug is invalid', 'Title is required'] }),
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(parseApiResponse(response, 'POST', '/posts')).rejects.toThrow(
      'Slug is invalid, Title is required',
    );
  });

  it('falls back to the HTTP status when an error response is not JSON', async () => {
    const response = new Response('upstream unavailable', {
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(parseApiResponse(response, 'GET', '/profile')).rejects.toThrow(
      'GET /profile failed: Service Unavailable',
    );
  });
});
