/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CommentModerationMode,
  FeatureSettingsDto,
  UpdateFeatureSettingsDto,
} from '@jazz-portfolio/shared';
import ContentSettingsForm from './ContentSettingsForm';

const settings = (over: Partial<FeatureSettingsDto> = {}): FeatureSettingsDto => ({
  isBlogEnabled: false,
  isGameEnabled: false,
  areCommentsEnabled: true,
  commentModerationMode: CommentModerationMode.ALL,
  isCommentCaptchaEnabled: false,
  commentAutoCloseDays: 0,
  commentMaxPerPost: 500,
  commentSpamThreshold: 60,
  commentNotifyEmail: true,
  updatedAt: '2026-11-08T00:00:00.000Z',
  ...over,
});

function setup(s: FeatureSettingsDto | null, extra: Record<string, unknown> = {}) {
  const onSave = jest.fn<Promise<void>, [UpdateFeatureSettingsDto]>().mockResolvedValue();
  render(
    <ContentSettingsForm
      settings={s}
      status={null}
      loading={false}
      saving={false}
      error={null}
      successMessage={null}
      loadError={null}
      onClearError={jest.fn()}
      onSave={onSave}
      {...extra}
    />,
  );
  return onSave;
}

describe('ContentSettingsForm game switch', () => {
  it('AC-DUEL-015.7: enabling the Game switch and saving sends isGameEnabled: true', async () => {
    const onSave = setup(settings());
    const sw = await screen.findByRole('checkbox', { name: /enable public game/i });
    expect(sw).not.toBeChecked();
    await userEvent.click(sw);
    expect(sw).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ isGameEnabled: true });
  });

  it('AC-DUEL-015.7: switch starts from the saved value and can be turned off', async () => {
    const onSave = setup(settings({ isGameEnabled: true }));
    const sw = await screen.findByRole('checkbox', { name: /enable public game/i });
    expect(sw).toBeChecked();
    await userEvent.click(sw);
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ isGameEnabled: false });
  });

  it('AC-DUEL-015.7: saving without touching the switch keeps the saved value in the payload', async () => {
    const onSave = setup(settings({ isGameEnabled: true }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save Settings' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ isGameEnabled: true });
  });

  it('AC-DUEL-015.7: Game switch is independent of the Blog switch (Blog off, Game usable)', async () => {
    const onSave = setup(settings({ isBlogEnabled: false }));
    const sw = await screen.findByRole('checkbox', { name: /enable public game/i });
    expect(sw).toBeEnabled();
    await userEvent.click(sw);
    await userEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(onSave.mock.calls[0][0]).toMatchObject({ isGameEnabled: true, isBlogEnabled: false });
  });

  it('AC-DUEL-015.7: 404 warning shows while off, and is replaced by a neutral note when on', async () => {
    setup(settings());
    expect(
      await screen.findByText(/returns 404 Not Found while the Game is disabled/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: /enable public game/i }));
    expect(screen.queryByText(/returns 404 Not Found/i)).not.toBeInTheDocument();
    expect(screen.getByText(/live for anyone with the link/i)).toBeInTheDocument();
  });

  it('AC-DUEL-015.7: while loading the Game switch is not rendered', () => {
    setup(null, { loading: true });
    expect(screen.queryByRole('checkbox', { name: /enable public game/i })).not.toBeInTheDocument();
  });

  it('AC-DUEL-015.7: load error shows the message and no switch', () => {
    setup(null, { loadError: 'boom' });
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /enable public game/i })).not.toBeInTheDocument();
  });

  it('AC-DUEL-015.7: save button is disabled and relabelled while saving', async () => {
    setup(settings(), { saving: true });
    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
  });
});
