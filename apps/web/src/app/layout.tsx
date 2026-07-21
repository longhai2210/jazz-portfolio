import type { Metadata } from 'next';
import '@/styles/globals.css';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Jazz Portfolio',
    template: '%s · Jazz Portfolio',
  },
  description: 'A jazz-themed developer portfolio',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Jazz Portfolio',
    title: 'Jazz Portfolio',
    description: 'A jazz-themed developer portfolio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jazz Portfolio',
    description: 'A jazz-themed developer portfolio',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
