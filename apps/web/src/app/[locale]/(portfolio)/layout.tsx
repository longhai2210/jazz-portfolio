import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import PortfolioShell from '@/components/layout/PortfolioShell';
import {
  LazyMusicPlayer,
  LazyPlaylistFetcher,
} from '@/components/music/MusicChrome';
import { getProfile } from '@/lib/portfolio-data';

export default async function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const isMusicEnabled = profile?.isMusicEnabled ?? true;

  return (
    <>
      <PortfolioShell>
        <div className="flex flex-col min-h-screen">
          {isMusicEnabled && <LazyPlaylistFetcher />}
          <Header />
          <div className="flex-1 pt-20 pb-24">
            {children}
          </div>
          <Footer />
        </div>
      </PortfolioShell>
      {isMusicEnabled && <LazyMusicPlayer />}
    </>
  );
}
