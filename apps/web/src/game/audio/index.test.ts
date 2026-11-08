import * as audio from './index';

describe('audio module on the server', () => {
  it('AC-DUEL-013.2: imports without a window and reports Web Audio as unsupported', async () => {
    expect(typeof window).toBe('undefined');
    expect(audio.isWebAudioSupported()).toBe(false);

    await expect(audio.unlockAudio()).resolves.toEqual({ ok: false, reason: 'unsupported' });
  });
});
