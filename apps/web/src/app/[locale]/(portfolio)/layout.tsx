import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PortfolioShell from '@/components/layout/PortfolioShell';
import RouteProgress from '@/components/layout/RouteProgress';
import ScrollToTop from '@/components/common/ScrollToTop';
import { LazyMusicPlayer, LazyPlaylistFetcher } from '@/components/music/MusicChrome';
import { getProfile, getPublicSettings } from '@/lib/portfolio-data';

export default async function PortfolioLayout({
  children,
  params: paramsPromise,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, profile, settings] = await Promise.all([
    paramsPromise,
    getProfile(),
    getPublicSettings(),
  ]);
  const isMusicEnabled = profile?.isMusicEnabled ?? true;

  return (
    <>
      <RouteProgress />
      <PortfolioShell>
        <div className="flex flex-col min-h-screen">
          {isMusicEnabled && <LazyPlaylistFetcher />}
          <Header isBlogEnabled={settings.isBlogEnabled} />
          <div className="flex-1 pt-20 pb-24">{children}</div>
          <Footer locale={locale} />
        </div>
      </PortfolioShell>
      {isMusicEnabled && <LazyMusicPlayer />}
      <ScrollToTop />
    </>
  );
}
