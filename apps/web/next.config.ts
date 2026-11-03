import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import withBundleAnalyzer from '@next/bundle-analyzer';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

function cdnHostname(): string | undefined {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl) return undefined;
  try {
    return new URL(cdnUrl).hostname;
  } catch {
    return undefined;
  }
}

const configuredCdnHost = cdnHostname();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['framer-motion', 'motion-dom', 'motion-utils'],
  experimental: {
    optimizePackageImports: ['react-icons', 'framer-motion'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      ...(configuredCdnHost
        ? [
            {
              protocol: 'https' as const,
              hostname: configuredCdnHost,
            },
          ]
        : []),
    ],
  },
};

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default bundleAnalyzer(withNextIntl(nextConfig));
