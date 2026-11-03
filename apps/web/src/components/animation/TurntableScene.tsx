'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  CatmullRomCurve3,
  ClampToEdgeWrapping,
  DataTexture,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PMREMGenerator,
  RGBAFormat,
  SRGBColorSpace,
  SpotLight,
  TextureLoader,
  Vector2,
  Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

interface SceneProps {
  previewTime?: number;
  onReady: () => void;
  onUnavailable: () => void;
}

function CanvasFallback({ onUnavailable }: Pick<SceneProps, 'onUnavailable'>) {
  useEffect(() => {
    onUnavailable();
  }, [onUnavailable]);

  return null;
}

const ease = (value: number) => {
  const x = MathUtils.clamp(value, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

// A long-short pulse: the first half of the beat occupies two thirds of the bar.
const swingPulse = (time: number) => {
  const beat = (time * 1.72) % 1;
  const swung = beat < 2 / 3 ? beat * 0.75 : 0.5 + (beat - 2 / 3) * 1.5;
  return Math.sin(swung * Math.PI * 2);
};

function makeGrooveTextures() {
  const size = 256;
  const normals = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const slope =
        radius > 0.11 && radius < 0.49
          ? Math.cos(radius * 920 + Math.sin(angle * 5) * 0.8) * 0.22
          : 0;
      const nx = radius ? (-dx / radius) * slope : 0;
      const ny = radius ? (-dy / radius) * slope : 0;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = (y * size + x) * 4;
      normals[i] = (nx * 0.5 + 0.5) * 255;
      normals[i + 1] = (ny * 0.5 + 0.5) * 255;
      normals[i + 2] = nz * 255;
      normals[i + 3] = 255;
      const grain = Math.sin(radius * 920) * 9 + Math.sin(radius * 321) * 5;
      const r = MathUtils.clamp(144 + grain, 110, 175);
      roughness[i] = r;
      roughness[i + 1] = r;
      roughness[i + 2] = r;
      roughness[i + 3] = 255;
    }
  }
  const normalMap = new DataTexture(normals, size, size, RGBAFormat);
  const roughnessMap = new DataTexture(roughness, size, size, RGBAFormat);
  for (const texture of [normalMap, roughnessMap]) {
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.colorSpace = NoColorSpace;
    texture.needsUpdate = true;
  }
  return { normalMap, roughnessMap };
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.03);
    const previous = scene.environment;
    scene.environment = target.texture;
    generator.dispose();
    return () => {
      scene.environment = previous;
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Turntable({ previewTime, onReady }: Pick<SceneProps, 'previewTime' | 'onReady'>) {
  const root = useRef<Group>(null);
  const record = useRef<Group>(null);
  const arm = useRef<Group>(null);
  const waveGold = useRef<Mesh>(null);
  const waveBlue = useRef<Mesh>(null);
  const wavePlum = useRef<Mesh>(null);
  const waveGoldMaterial = useRef<MeshBasicMaterial>(null);
  const waveBlueMaterial = useRef<MeshBasicMaterial>(null);
  const wavePlumMaterial = useRef<MeshBasicMaterial>(null);
  const orbit = useRef<Group>(null);
  const goldLight = useRef<SpotLight>(null);
  const blueLight = useRef<SpotLight>(null);
  const particles = useRef<Group>(null);
  const readyFrames = useRef(0);
  const sceneStartedAt = useRef(0);
  const lastTime = useRef(0);
  const { camera, size } = useThree();
  const sourceLabel = useLoader(TextureLoader, '/images/vinyl_record.webp');
  const label = useMemo(() => {
    const texture = sourceLabel.clone();
    texture.colorSpace = SRGBColorSpace;
    texture.repeat.set(0.365, 0.365);
    texture.offset.set(0.3175, 0.3175);
    texture.needsUpdate = true;
    return texture;
  }, [sourceLabel]);
  const grooves = useMemo(makeGrooveTextures, []);
  const deckGeometry = useMemo(() => new RoundedBoxGeometry(5, 0.48, 3.6, 3, 0.13), []);
  const topGeometry = useMemo(() => new RoundedBoxGeometry(4.88, 0.12, 3.48, 3, 0.1), []);
  const armCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0, 0),
        new Vector3(0.02, 0.01, 0.7),
        new Vector3(-0.06, 0, 1.42),
        new Vector3(-0.2, -0.01, 1.91),
      ]),
    [],
  );
  const dustPositions = useMemo(() => {
    const values = new Float32Array(64 * 3);
    let seed = 821;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < values.length; i += 3) {
      values[i] = (random() - 0.5) * 8;
      values[i + 1] = random() * 4.6 - 0.5;
      values[i + 2] = (random() - 0.5) * 5;
    }
    return values;
  }, []);

  useEffect(
    () => () => {
      label.dispose();
      grooves.normalMap.dispose();
      grooves.roughnessMap.dispose();
      deckGeometry.dispose();
      topGeometry.dispose();
    },
    [label, grooves, deckGeometry, topGeometry],
  );

  useFrame((_, delta) => {
    if (sceneStartedAt.current === 0) sceneStartedAt.current = performance.now();
    const t =
      previewTime ?? MathUtils.clamp((performance.now() - sceneStartedAt.current) / 1000, 0, 2.8);
    const frameDelta =
      previewTime === undefined ? Math.min(delta, 0.05) : Math.max(0, t - lastTime.current);
    lastTime.current = t;
    const arrive = ease(t / 0.72);
    const cameraRise = ease(t / 1.05);
    const swing = swingPulse(t);
    camera.position.set(
      MathUtils.lerp(7.7, 5.65, cameraRise) + swing * 0.035,
      MathUtils.lerp(2.05, 4.35, cameraRise),
      MathUtils.lerp(8.1, 6.35, cameraRise),
    );
    camera.lookAt(-0.08, 0.08, 0);
    if (root.current) {
      root.current.position.y = MathUtils.lerp(1.05, 0.22, arrive) + swing * 0.026;
      root.current.rotation.z = MathUtils.lerp(-0.105, -0.018, arrive) + swing * 0.0035;
      root.current.rotation.y = MathUtils.lerp(-0.3, -0.14, arrive) + Math.sin(t * 0.68) * 0.012;
      const aspect = size.width / Math.max(1, size.height);
      const compactScale =
        aspect <= 1.1 ? 0.69 : aspect < 1.7 ? MathUtils.lerp(0.69, 1, (aspect - 1.1) / 0.6) : 1;
      root.current.scale.setScalar(compactScale * MathUtils.lerp(0.9, 1, arrive));
    }
    if (record.current) {
      const acceleration = ease((t - 0.12) / 0.72);
      record.current.rotation.y -= frameDelta * (3.35 + swing * 0.08) * acceleration;
    }
    if (arm.current) {
      arm.current.rotation.y = MathUtils.lerp(0.035, -0.58, ease((t - 0.38) / 0.72));
      arm.current.rotation.x = MathUtils.lerp(-0.17, 0.012, ease((t - 1.02) / 0.28));
    }
    const pulseWave = (
      mesh: Mesh | null,
      material: MeshBasicMaterial | null,
      start: number,
      duration: number,
      scale: number,
      opacity: number,
    ) => {
      const progress = MathUtils.clamp((t - start) / duration, 0, 1);
      if (!mesh || !material) return;
      mesh.scale.setScalar(MathUtils.lerp(0.1, scale, ease(progress)));
      mesh.rotation.z = t * 0.18;
      material.opacity = Math.sin(progress * Math.PI) * opacity;
      mesh.visible = progress > 0 && progress < 1;
    };
    pulseWave(waveGold.current, waveGoldMaterial.current, 1.19, 0.78, 4.2, 0.72);
    pulseWave(waveBlue.current, waveBlueMaterial.current, 1.52, 0.86, 4.55, 0.5);
    pulseWave(wavePlum.current, wavePlumMaterial.current, 1.96, 0.78, 4.85, 0.4);
    if (orbit.current) {
      const bloom = ease((t - 0.72) / 0.72);
      orbit.current.scale.setScalar(MathUtils.lerp(0.74, 1, bloom));
      orbit.current.rotation.y = t * 0.08;
      orbit.current.rotation.z = -0.14 + swing * 0.018;
      orbit.current.visible = bloom > 0;
    }
    if (particles.current) {
      particles.current.rotation.y = t * 0.035;
      particles.current.rotation.z = Math.sin(t * 0.27) * 0.025;
      particles.current.position.y = Math.sin(t * 0.62) * 0.1;
    }
    if (goldLight.current) {
      goldLight.current.intensity = 72 + Math.max(0, swing) * 16;
    }
    if (blueLight.current) {
      blueLight.current.intensity = 52 + Math.max(0, -swing) * 12;
    }
    if (readyFrames.current < 2) {
      readyFrames.current += 1;
      if (readyFrames.current === 2) onReady();
    }
  });

  return (
    <>
      <Environment />
      <ambientLight intensity={0.28} color="#7284a1" />
      <spotLight
        ref={goldLight}
        position={[-5, 7, 4]}
        color="#d9aa68"
        intensity={72}
        distance={18}
        angle={0.52}
        penumbra={0.72}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <spotLight
        ref={blueLight}
        position={[5, 4, -4]}
        color="#315f9f"
        intensity={52}
        distance={17}
        angle={0.58}
        penumbra={0.82}
      />
      <pointLight position={[0, 1.5, 3]} color="#f0bd75" intensity={6} distance={7} />
      <pointLight position={[2.8, 0.4, 1.2]} color="#862f59" intensity={3.2} distance={5} />
      <group ref={particles}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color="#d9ba87"
            size={0.022}
            transparent
            opacity={0.4}
            sizeAttenuation
            depthWrite={false}
          />
        </points>
      </group>
      <group ref={root}>
        <mesh geometry={deckGeometry} castShadow receiveShadow>
          <meshStandardMaterial color="#201d1b" metalness={0.18} roughness={0.36} />
        </mesh>
        <mesh position={[0, 0.295, 0]} geometry={topGeometry} receiveShadow>
          <meshStandardMaterial color="#151b21" metalness={0.64} roughness={0.24} />
        </mesh>
        <mesh position={[0, 0.222, 0]}>
          <boxGeometry args={[4.94, 0.045, 3.52]} />
          <meshStandardMaterial color="#a67a43" metalness={0.93} roughness={0.2} />
        </mesh>
        {[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => (
            <mesh key={`${x}-${z}`} position={[x * 1.96, -0.38, z * 1.26]} castShadow>
              <cylinderGeometry args={[0.17, 0.2, 0.32, 24]} />
              <meshStandardMaterial color="#171719" metalness={0.48} roughness={0.4} />
            </mesh>
          )),
        )}
        <group position={[-0.64, 0.43, 0.04]}>
          <mesh castShadow>
            <cylinderGeometry args={[1.4, 1.4, 0.18, 96]} />
            <meshStandardMaterial color="#757b80" metalness={0.95} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.098, 0]}>
            <cylinderGeometry args={[1.34, 1.34, 0.045, 96]} />
            <meshStandardMaterial color="#17191d" metalness={0.72} roughness={0.3} />
          </mesh>
          <group ref={record} position={[0, 0.145, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[1.28, 1.28, 0.048, 128]} />
              <meshStandardMaterial
                color="#08090b"
                metalness={0.86}
                roughness={0.3}
                roughnessMap={grooves.roughnessMap}
                normalMap={grooves.normalMap}
                normalScale={new Vector2(0.55, 0.55)}
              />
            </mesh>
            <mesh position={[0, 0.027, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.49, 64]} />
              <meshStandardMaterial map={label} metalness={0.06} roughness={0.72} />
            </mesh>
          </group>
          <mesh position={[0, 0.285, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.05, 0.34, 24]} />
            <meshStandardMaterial color="#e5d1ae" metalness={0.98} roughness={0.13} />
          </mesh>
          <mesh
            ref={waveGold}
            position={[0, 0.31, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.37, 0.385, 96]} />
            <meshBasicMaterial
              ref={waveGoldMaterial}
              color="#e7b66e"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={waveBlue}
            position={[0, 0.325, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.37, 0.382, 96]} />
            <meshBasicMaterial
              ref={waveBlueMaterial}
              color="#5387c8"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={wavePlum}
            position={[0, 0.34, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.37, 0.38, 96]} />
            <meshBasicMaterial
              ref={wavePlumMaterial}
              color="#a14c72"
              transparent
              opacity={0}
              depthWrite={false}
            />
          </mesh>
        </group>
        <group ref={orbit} position={[-0.64, 0.82, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh rotation={[0, 0, 0.16]}>
            <torusGeometry args={[1.63, 0.012, 6, 96, Math.PI * 1.34]} />
            <meshBasicMaterial color="#d8a65e" transparent opacity={0.34} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, 0, 2.05]}>
            <torusGeometry args={[1.78, 0.009, 6, 96, Math.PI * 0.72]} />
            <meshBasicMaterial color="#4e7dbb" transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, 0, 3.76]}>
            <torusGeometry args={[1.92, 0.007, 6, 80, Math.PI * 0.42]} />
            <meshBasicMaterial color="#934264" transparent opacity={0.24} depthWrite={false} />
          </mesh>
          {[
            [-1.41, 0.78, '#d9ac68', 0.045],
            [0.48, -1.69, '#4f7fbe', 0.035],
            [1.68, 0.34, '#a04c70', 0.04],
          ].map(([x, y, color, radius], index) => (
            <mesh key={index} position={[x as number, y as number, 0.015]}>
              <sphereGeometry args={[radius as number, 14, 14]} />
              <meshBasicMaterial color={color as string} transparent opacity={0.82} />
            </mesh>
          ))}
        </group>
        <group ref={arm} position={[1.52, 0.69, -1.02]}>
          <mesh position={[0, -0.27, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.27, 0.42, 32]} />
            <meshStandardMaterial color="#272a2d" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.02, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.19, 0.12, 32]} />
            <meshStandardMaterial color="#d0ad76" metalness={0.95} roughness={0.15} />
          </mesh>
          <mesh castShadow>
            <tubeGeometry args={[armCurve, 28, 0.032, 8, false]} />
            <meshStandardMaterial color="#d8d0c3" metalness={0.98} roughness={0.16} />
          </mesh>
          <mesh position={[-0.21, -0.045, 1.93]} rotation={[0, -0.08, 0]} castShadow>
            <boxGeometry args={[0.28, 0.1, 0.34]} />
            <meshStandardMaterial color="#24272b" metalness={0.7} roughness={0.26} />
          </mesh>
          <mesh position={[-0.24, -0.14, 2.01]}>
            <cylinderGeometry args={[0.014, 0.01, 0.16, 10]} />
            <meshStandardMaterial color="#d5aa6d" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.02, -0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.45, 32]} />
            <meshStandardMaterial color="#696b6e" metalness={0.92} roughness={0.2} />
          </mesh>
        </group>
        <mesh position={[-2, 0.47, 1.3]} castShadow>
          <cylinderGeometry args={[0.15, 0.16, 0.12, 32]} />
          <meshStandardMaterial color="#d0ad76" metalness={0.94} roughness={0.18} />
        </mesh>
        <group position={[1.84, 0.43, 1.3]}>
          <mesh>
            <boxGeometry args={[0.58, 0.035, 0.045]} />
            <meshStandardMaterial color="#4d555f" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[-0.08, 0.04, 0]}>
            <boxGeometry args={[0.1, 0.065, 0.085]} />
            <meshStandardMaterial color="#d4ac70" metalness={0.92} roughness={0.14} />
          </mesh>
        </group>
        <group position={[1.63, 0.43, 0.92]}>
          {['#d8aa65', '#4b78b0', '#8e3d60'].map((color, index) => (
            <mesh key={color} position={[index * 0.21, 0, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.035, 18]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.55}
                metalness={0.35}
                roughness={0.35}
              />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 0.405, -1.55]}>
          <boxGeometry args={[4.25, 0.035, 0.035]} />
          <meshStandardMaterial color="#d0a468" metalness={0.9} roughness={0.18} />
        </mesh>
      </group>
      <mesh position={[0, -0.92, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <shadowMaterial transparent opacity={0.3} />
      </mesh>
    </>
  );
}

export default function TurntableScene(props: SceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      shadows="basic"
      camera={{ fov: 31, near: 0.1, far: 30, position: [7.7, 2.05, 8.1] }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      fallback={<CanvasFallback onUnavailable={props.onUnavailable} />}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      onPointerMissed={() => undefined}
    >
      <Suspense fallback={null}>
        <Turntable previewTime={props.previewTime} onReady={props.onReady} />
      </Suspense>
    </Canvas>
  );
}
