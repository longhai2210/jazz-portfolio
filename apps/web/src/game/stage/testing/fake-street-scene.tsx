/**
 * A stand-in for the 3D street module, for tests of `StageGame` in jsdom, which has no WebGL. It
 * renders a plain element and records its props, so a test can see what the stage passes down
 * and play the scene's part: report it is ready, that the character is by the door, or that WebGL
 * failed. Test-only.
 *
 *   const scene = createFakeStreetScene();
 *   render(<StageGame loadScene={scene.load} />);
 *   act(() => scene.props().onReady());
 */
import { useEffect } from 'react';
import type { StreetSceneModule } from '../StageGame';
import type { StreetSceneProps } from '../scenes/StreetScene';

export interface FakeStreetScene {
  /** The loader to pass as `loadScene`; counts its calls in `loads`. */
  readonly load: () => Promise<StreetSceneModule>;
  /** Times the module was asked for. */
  readonly loads: number;
  /** Times the scene mounted and unmounted. */
  readonly mounts: number;
  readonly unmounts: number;
  readonly mounted: boolean;
  /** The props of the latest render; throws if the scene never rendered. */
  props(): StreetSceneProps;
}

export function createFakeStreetScene(): FakeStreetScene {
  let loads = 0;
  let mounts = 0;
  let unmounts = 0;
  let latest: StreetSceneProps | null = null;

  function FakeScene(props: StreetSceneProps) {
    latest = props;
    useEffect(() => {
      mounts += 1;
      return () => {
        unmounts += 1;
      };
    }, []);
    return (
      <div
        role="img"
        aria-label={props.label}
        data-testid="street-scene"
        data-paused={props.paused}
        data-audio={props.audio !== null}
      />
    );
  }

  const sceneModule: StreetSceneModule = { default: FakeScene };
  return {
    load: () => {
      loads += 1;
      return Promise.resolve(sceneModule);
    },
    get loads() {
      return loads;
    },
    get mounts() {
      return mounts;
    },
    get unmounts() {
      return unmounts;
    },
    get mounted() {
      return mounts > unmounts;
    },
    props() {
      if (latest === null) throw new Error('the fake street scene never rendered');
      return latest;
    },
  };
}
