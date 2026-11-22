'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { HomeLink, PanelText, PanelTitle, ScreenShell } from './ui';

/**
 * Screen 2, Unsupported (AC-DUEL-013.2): the browser has no Web Audio. It says so and offers the
 * way back to the portfolio, so the page is never blank.
 */
export default function UnsupportedScreen() {
  const t = useTranslations('game');
  const titleId = useId();
  return (
    <ScreenShell role="alert" labelledBy={titleId}>
      <PanelTitle id={titleId}>{t('unsupported.title')}</PanelTitle>
      <PanelText>{t('unsupported.body')}</PanelText>
      <HomeLink variant="primary" />
    </ScreenShell>
  );
}
