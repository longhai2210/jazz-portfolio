import * as crypto from 'crypto';

function getSecret(): string {
  const secret = process.env.COMMENT_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('COMMENT_TOKEN_SECRET must be configured with at least 32 characters');
  }
  return secret;
}

/**
 * Generates an HMAC comment token incorporating postId, IP address, and timestamp.
 * Format: `<timestamp>.<signatureHex>`
 */
export function generateCommentToken(postId: string, ip: string, secret = getSecret()): string {
  const timestamp = Date.now();
  const payload = `${postId}:${ip}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  return `${timestamp}.${hmac}`;
}

/**
 * Verifies if the comment token is valid for the given postId and IP within 15 minutes.
 */
export function verifyCommentToken(
  token: string,
  postId: string,
  ip: string,
  maxAgeMs = 15 * 60 * 1000,
  minAgeMs = 0,
  secret = getSecret(),
): boolean {
  if (!token || !token.includes('.')) return false;

  const [tsStr, signature] = token.split('.');
  const timestamp = parseInt(tsStr, 10);

  if (isNaN(timestamp)) return false;

  // Expiration check
  const age = Date.now() - timestamp;
  if (age < minAgeMs || age > maxAgeMs) return false;

  // Signature check
  const payload = `${postId}:${ip}:${timestamp}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}
