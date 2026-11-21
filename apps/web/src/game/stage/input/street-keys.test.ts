/**
 * @jest-environment jsdom
 */
import {
  handlesEnterItself,
  isEnterClubKey,
  keyId,
  NO_SIDES,
  walkDirection,
  walkSideForKey,
} from './street-keys';

describe('street keys', () => {
  it('AC-STAGE-003.1: A and the left arrow walk left, D and the right arrow walk right, by physical key', () => {
    expect(walkSideForKey({ code: 'KeyA', key: 'a' })).toBe('left');
    expect(walkSideForKey({ code: 'ArrowLeft', key: 'ArrowLeft' })).toBe('left');
    expect(walkSideForKey({ code: 'KeyD', key: 'd' })).toBe('right');
    expect(walkSideForKey({ code: 'ArrowRight', key: 'ArrowRight' })).toBe('right');
    // Caps Lock, another layout or an input method: the physical key decides.
    expect(walkSideForKey({ code: 'KeyD', key: 'D' })).toBe('right');
    expect(walkSideForKey({ code: 'KeyA', key: 'ă' })).toBe('left');
    expect(walkSideForKey({ code: 'KeyW', key: 'w' })).toBeNull();
    expect(walkSideForKey({ code: 'KeyF', key: 'f' })).toBeNull();
  });

  it('falls back to the key when the browser reports no code', () => {
    expect(walkSideForKey({ code: '', key: 'A' })).toBe('left');
    expect(walkSideForKey({ code: 'Unidentified', key: 'd' })).toBe('right');
    expect(keyId({ code: '', key: 'A' })).toBe('a');
    expect(keyId({ code: 'KeyA', key: 'a' })).toBe('KeyA');
    expect(isEnterClubKey({ code: '', key: 'E' })).toBe(true);
  });

  it('AC-STAGE-003.3: E, Enter and the keypad Enter are the club keys', () => {
    expect(isEnterClubKey({ code: 'KeyE', key: 'e' })).toBe(true);
    expect(isEnterClubKey({ code: 'Enter', key: 'Enter' })).toBe(true);
    expect(isEnterClubKey({ code: 'NumpadEnter', key: 'Enter' })).toBe(true);
    expect(isEnterClubKey({ code: 'Space', key: ' ' })).toBe(false);
    expect(isEnterClubKey({ code: 'KeyD', key: 'd' })).toBe(false);
  });

  it('AC-STAGE-003.1: left and right held together cancel out, across keys and touch', () => {
    expect(walkDirection(NO_SIDES)).toBe(0);
    expect(walkDirection({ left: true, right: false })).toBe(-1);
    expect(walkDirection({ left: false, right: true })).toBe(1);
    expect(walkDirection({ left: true, right: true })).toBe(0);
    expect(walkDirection({ left: true, right: false }, { left: false, right: true })).toBe(0);
    expect(walkDirection(NO_SIDES, { left: false, right: true })).toBe(1);
  });

  it('leaves Enter to a focused button, link or field', () => {
    const button = document.createElement('button');
    const link = document.createElement('a');
    link.href = '/en';
    const input = document.createElement('input');
    const inside = document.createElement('span');
    button.append(inside);
    expect(handlesEnterItself(button)).toBe(true);
    expect(handlesEnterItself(inside)).toBe(true);
    expect(handlesEnterItself(link)).toBe(true);
    expect(handlesEnterItself(input)).toBe(true);
    expect(handlesEnterItself(document.body)).toBe(false);
    expect(handlesEnterItself(window)).toBe(false);
    expect(handlesEnterItself(null)).toBe(false);
  });
});
