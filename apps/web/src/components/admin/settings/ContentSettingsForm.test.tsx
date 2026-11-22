/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CommentModerationMode,
  FeatureSettingsDto,
  FeatureSettingsStatusDto,
  UpdateFeatureSettingsDto,
} from '@jazz-portfolio/shared';
import ContentSettingsForm from './ContentSettingsForm';

// Every field the form sends on save: FeatureSettingsDto without updatedAt.
const basePayload: Required<UpdateFeatureSettingsDto> = {
  isBlogEnabled: true,
  isGameEnabled: false,
  areCommentsEnabled: true,
  commentModerationMode: CommentModerationMode.ALL,
  isCommentCaptchaEnabled: false,
  commentAutoCloseDays: 0,
  commentMaxPerPost: 500,
  commentSpamThreshold: 60,
  commentNotifyEmail: true,
};

const baseSettings: FeatureSettingsDto = {
  ...basePayload,
  updatedAt: '2026-11-08T00:00:00.000Z',
};

const baseStatus: FeatureSettingsStatusDto = {
  captchaConfigured: true,
  tokenSecretConfigured: true,
  ipSaltConfigured: true,
  pendingCommentCount: 0,
};

type FormProps = Parameters<typeof ContentSettingsForm>[0];

function renderForm(overrides: Partial<FormProps> = {}) {
  const onSave = jest
    .fn<Promise<void>, [UpdateFeatureSettingsDto]>()
    .mockResolvedValue(undefined);
  const props: FormProps = {
    settings: baseSettings,
    status: baseStatus,
    loading: false,
    saving: false,
    error: null,
    successMessage: null,
    loadError: null,
    onClearError: jest.fn(),
    onSave,
    ...overrides,
  };
  render(<ContentSettingsForm {...props} />);
  return { onSave, user: userEvent.setup() };
}

const gameSwitch = () => screen.getByRole('checkbox', { name: 'Enable Public Game' });
const saveButton = () => screen.getByRole('button', { name: 'Save Settings' });
// The Blog switch has no accessible name of its own, so find it through its card heading.
const blogSwitch = () => {
  const heading = screen.getByRole('heading', { name: 'Enable Public Blog / Posts' });
  const row = heading.closest('.justify-between');
  if (!(row instanceof HTMLElement)) throw new Error('Blog toggle row not found');
  return within(row).getByRole('checkbox');
};

describe('ContentSettingsForm Game toggle', () => {
  it('AC-DUEL-015.7: turning the Game switch on and saving sends isGameEnabled true', async () => {
    const { onSave, user } = renderForm();
    expect(gameSwitch()).not.toBeChecked();

    await user.click(gameSwitch());
    expect(gameSwitch()).toBeChecked();
    await user.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ ...basePayload, isGameEnabled: true });
  });

  it('AC-DUEL-015.7: saving without touching the switch sends the stored isGameEnabled value', async () => {
    const { onSave, user } = renderForm({ settings: { ...baseSettings, isGameEnabled: true } });
    expect(gameSwitch()).toBeChecked();

    await user.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ ...basePayload, isGameEnabled: true });
  });

  it('AC-DUEL-015.7: turning the Game switch off and saving sends isGameEnabled false', async () => {
    const { onSave, user } = renderForm({ settings: { ...baseSettings, isGameEnabled: true } });

    await user.click(gameSwitch());
    await user.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ ...basePayload, isGameEnabled: false });
  });

  it('AC-DUEL-015.7: the Game switch stays usable while Blog is off, and the Blog switch keeps the Game value', async () => {
    const { onSave, user } = renderForm({
      settings: { ...baseSettings, isBlogEnabled: false, areCommentsEnabled: false },
    });
    expect(gameSwitch()).toBeEnabled();

    await user.click(gameSwitch());
    expect(gameSwitch()).toBeChecked();
    await user.click(blogSwitch());
    expect(gameSwitch()).toBeChecked();
    await user.click(saveButton());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      ...basePayload,
      isBlogEnabled: true,
      areCommentsEnabled: false,
      isGameEnabled: true,
    });
  });

  it('AC-DUEL-015.7: shows the 404 note while the Game is off and the live note once it is on', async () => {
    const { user } = renderForm();
    expect(screen.getByText(/returns 404 Not Found while the Game is disabled/)).toBeInTheDocument();
    expect(screen.queryByText(/The page is live for anyone with the link/)).not.toBeInTheDocument();

    await user.click(gameSwitch());

    expect(
      screen.queryByText(/returns 404 Not Found while the Game is disabled/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/The page is live for anyone with the link/)).toBeInTheDocument();
  });

  it('AC-DUEL-015.7: while saving, the save button is disabled and shows progress', () => {
    renderForm({ saving: true });
    const button = screen.getByRole('button', { name: 'Saving Configurations...' });
    expect(button).toBeDisabled();
  });

  it('AC-DUEL-015.7: while loading, the form and the Game switch are not shown', () => {
    renderForm({ loading: true, settings: null });
    expect(screen.getByText(/Fetching Content Feature Settings/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Enable Public Game' })).not.toBeInTheDocument();
  });

  it('AC-DUEL-015.7: when settings fail to load, the load error is shown instead of the switch', () => {
    renderForm({ settings: null, loadError: 'Failed to load feature settings.' });
    expect(screen.getByText('Failed to load feature settings.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Enable Public Game' })).not.toBeInTheDocument();
  });

  it('AC-DUEL-015.7: a failed save shows the error banner with the Game switch still in place', () => {
    renderForm({ error: 'Failed to save feature settings.' });
    expect(screen.getByText('Failed to save feature settings.')).toBeInTheDocument();
    expect(gameSwitch()).toBeInTheDocument();
  });
});
