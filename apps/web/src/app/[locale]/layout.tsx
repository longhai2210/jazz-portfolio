import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { playfairDisplay, inter, jetbrainsMono, notoSerifJP, notoSansJP } from '@/lib/fonts';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;

  // Base font classes (always loaded)
  const baseFontClasses = [playfairDisplay.variable, inter.variable, jetbrainsMono.variable];

  // Conditionally add JP fonts only for Japanese locale (~1.5MB savings for en/vi)
  const jpFontClasses = locale === 'ja' ? [notoSerifJP.variable, notoSansJP.variable] : [];

  const fontClasses = [...baseFontClasses, ...jpFontClasses].join(' ');

  return (
    <html lang={locale} className={fontClasses} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storage = localStorage.getItem('jazz-theme-storage');
                  if (storage) {
                    var parsed = JSON.parse(storage);
                    if (parsed && parsed.state && parsed.state.theme) {
                      document.documentElement.setAttribute('data-theme', parsed.state.theme);
                    }
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var shouldPlay = false;
                try {
                  var home = /^\\/(?:en|vi|ja)?\\/?$/.test(window.location.pathname);
                  var params = new URLSearchParams(window.location.search);
                  var forced = params.get('forceLoader') === 'true';
                  var played = sessionStorage.getItem('jazz-loader-complete') === 'true';
                  shouldPlay = home && (forced || !played);
                } catch (e) {
                  shouldPlay = true;
                }
                document.documentElement.dataset.jazzIntro = shouldPlay ? 'play' : 'skip';
                if (shouldPlay) {
                  document.documentElement.dataset.jazzIntroStartedAt = String(performance.now());
                  window.setTimeout(function() {
                    if (document.documentElement.dataset.jazzIntro === 'play') {
                      document.documentElement.dataset.jazzIntro = 'skip';
                    }
                  }, 4100);
                }
              })()
            `,
          }}
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-6 focus:py-3 focus:rounded-full focus:bg-jazz-gold focus:text-jazz-black focus:font-semibold focus:shadow-[0_0_20px_rgba(212,165,116,0.5)] focus:outline-none"
        >
          Skip to main content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
