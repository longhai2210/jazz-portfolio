import { isWebGL2Supported } from './webgl';

describe('T-018 webgl probe', () => {
  it('probe (used by T-021): answers yes or no and never throws', () => {
    expect(isWebGL2Supported({ createCanvas: () => ({ getContext: () => ({ getExtension: () => null }) }) })).toBe(true);
    expect(isWebGL2Supported({ createCanvas: () => ({ getContext: () => null }) })).toBe(false);
    expect(isWebGL2Supported({ createCanvas: () => null })).toBe(false);
    expect(
      isWebGL2Supported({
        createCanvas: () => {
          throw new Error('x');
        },
      }),
    ).toBe(false);
    expect(isWebGL2Supported()).toBe(false);
  });
});
