import React, { useRef } from 'react';
import { Environment, OrbitControls, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useFrame } from '@react-three/fiber';
import { Foliage } from './Foliage';
import { Ornaments } from './Ornaments';
import { Polaroids } from './Polaroids';
import { TreeStar } from './TreeStar';
import type { HandPosition, PhotoEntry, Theme } from '../types';
import { TreeMode } from '../types';

type Props = {
  mode: TreeMode;
  theme: Theme;
  photos: PhotoEntry[];
  onSelectPhoto: (photo: PhotoEntry, origin?: { clientX: number; clientY: number }) => void;
  handPosition: HandPosition;
  timeScale?: number;
  focusPhotoId: string | null;
  focusActive: boolean;
  focusTarget?: { x: number; y: number; width?: number; height?: number } | null;
  onScreenSelect?: (payload: { id: string; src: string; from: { x: number; y: number; width: number; height: number } }) => void;
  quality?: 'high' | 'low';
};

class EnvironmentErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback: React.ReactNode }>,
  { hasError: boolean }
> {
  state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export const Experience: React.FC<Props> = ({ mode, theme, photos, onSelectPhoto, handPosition, timeScale = 1, focusPhotoId, focusActive, focusTarget, onScreenSelect, quality = 'high' }) => {
  const controlsRef = useRef<any>(null);
  const lowQuality = quality === 'low';

  useFrame((_, delta) => {
    if (controlsRef.current && handPosition.detected) {
      const controls = controlsRef.current;
      const targetAzimuth = (handPosition.x - 0.5) * Math.PI * 3;
      const adjustedY = (handPosition.y - 0.2) * 2.0;
      const clampedY = Math.max(0, Math.min(1, adjustedY));
      const minPolar = Math.PI / 4;
      const maxPolar = Math.PI / 1.8;
      const targetPolar = minPolar + clampedY * (maxPolar - minPolar);

      const currentAzimuth = controls.getAzimuthalAngle();
      const currentPolar = controls.getPolarAngle();

      let azimuthDiff = targetAzimuth - currentAzimuth;
      if (azimuthDiff > Math.PI) azimuthDiff -= Math.PI * 2;
      if (azimuthDiff < -Math.PI) azimuthDiff += Math.PI * 2;

      const lerpSpeed = 8;
      const newAzimuth = currentAzimuth + azimuthDiff * delta * lerpSpeed;
      const newPolar = currentPolar + (targetPolar - currentPolar) * delta * lerpSpeed;

      const radius = controls.getDistance();
      const targetY = 4;

      const x = radius * Math.sin(newPolar) * Math.sin(newAzimuth);
      const y = targetY + radius * Math.cos(newPolar);
      const z = radius * Math.sin(newPolar) * Math.cos(newAzimuth);

      controls.object.position.set(x, y, z);
      controls.target.set(0, targetY, 0);
      controls.update();
    }
  });

  return (
    <>
      <color attach="background" args={[theme.background ?? '#050c07']} />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
        minDistance={12}
        maxDistance={32}
      />

      {/* Prefer the original "lobby" HDR when available (keeps the classic ball look); fallback stays offline-safe. */}
      {lowQuality ? (
        <Environment resolution={128} background={false} blur={0.8} frames={1}>
          <Lightformer color="#fff5cc" form="rect" intensity={1.9} position={[0, 8, -8]} scale={[12, 6, 1]} rotation={[0, 0, 0]} />
          <Lightformer color="#ffffff" form="rect" intensity={1.25} position={[-8, 3, 4]} scale={[8, 4, 1]} rotation={[0, Math.PI / 2.2, 0]} />
          <Lightformer color="#d7e3ff" form="rect" intensity={1.15} position={[8, 3, 4]} scale={[8, 4, 1]} rotation={[0, -Math.PI / 2.2, 0]} />
        </Environment>
      ) : (
        <EnvironmentErrorBoundary
          fallback={
            <Environment resolution={256} background={false} blur={0.8} frames={1}>
              <Lightformer color="#fff5cc" form="rect" intensity={2.1} position={[0, 8, -8]} scale={[12, 6, 1]} rotation={[0, 0, 0]} />
              <Lightformer color="#ffffff" form="rect" intensity={1.45} position={[-8, 3, 4]} scale={[8, 4, 1]} rotation={[0, Math.PI / 2.2, 0]} />
              <Lightformer color="#d7e3ff" form="rect" intensity={1.35} position={[8, 3, 4]} scale={[8, 4, 1]} rotation={[0, -Math.PI / 2.2, 0]} />
            </Environment>
          }
        >
          <React.Suspense
            fallback={
              <Environment resolution={256} background={false} blur={0.8} frames={1}>
                <Lightformer color="#fff5cc" form="rect" intensity={2.1} position={[0, 8, -8]} scale={[12, 6, 1]} rotation={[0, 0, 0]} />
                <Lightformer color="#ffffff" form="rect" intensity={1.45} position={[-8, 3, 4]} scale={[8, 4, 1]} rotation={[0, Math.PI / 2.2, 0]} />
                <Lightformer color="#d7e3ff" form="rect" intensity={1.35} position={[8, 3, 4]} scale={[8, 4, 1]} rotation={[0, -Math.PI / 2.2, 0]} />
              </Environment>
            }
          >
            <Environment preset="lobby" background={false} blur={0.8} />
          </React.Suspense>
        </EnvironmentErrorBoundary>
      )}

      <ambientLight intensity={0.2} color={theme.emerald} />
      <spotLight position={[10, 20, 10]} angle={0.2} penumbra={1} intensity={2.2} color="#fff4d4" castShadow={!lowQuality} />
      <pointLight position={[-10, 5, -10]} intensity={1.1} color={theme.gold} />

      <group position={[0, -5, 0]}>
        <Foliage mode={mode} theme={theme} count={lowQuality ? 9000 : 12000} height={14} radius={5.8} timeScale={timeScale} />
        <Ornaments mode={mode} theme={theme} count={600} timeScale={timeScale} quality={quality} />
        <Polaroids
          mode={mode}
          theme={theme}
          photos={photos}
          onSelect={onSelectPhoto}
          timeScale={timeScale}
          focusPhotoId={focusPhotoId}
          focusActive={focusActive}
          focusTarget={focusTarget}
          onScreenSelect={onScreenSelect}
	        />
	        <TreeStar mode={mode} theme={theme} height={14} timeScale={timeScale} />
	      </group>

	      {!lowQuality && (
	        <EffectComposer enableNormalPass={false}>
	          <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.2} radius={0.6} />
	          <Vignette eskil={false} offset={0.1} darkness={theme.vignette ?? 0.8} />
	          <Noise opacity={0.012} blendFunction={BlendFunction.SOFT_LIGHT} />
	        </EffectComposer>
	      )}
	    </>
	  );
};
