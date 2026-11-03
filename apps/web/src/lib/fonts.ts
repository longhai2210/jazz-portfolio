import {
  Playfair_Display,
  Inter,
  JetBrains_Mono,
  Noto_Serif_JP,
  Noto_Sans_JP,
} from 'next/font/google';

export const playfairDisplay = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-heading',
  weight: 'variable',
});

export const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-body',
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const notoSerifJP = Noto_Serif_JP({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-heading-jp',
  weight: 'variable',
});

export const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-jp',
  weight: 'variable',
});
