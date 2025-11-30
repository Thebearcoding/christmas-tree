import React, { useRef } from 'react';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
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
  focusTarget?: { x: number; y: number } | null;
};

export const Experience: React.FC<Props> = ({ mode, theme, photos, onSelectPhoto, handPosition, timeScale = 1, focusPhotoId, focusActive, focusTarget }) => {
  const controlsRef = useRef<any>(null);

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

      <Environment preset="lobby" background={false} blur={0.8} />

      <ambientLight intensity={0.2} color={theme.emerald} />
      <spotLight position={[10, 20, 10]} angle={0.2} penumbra={1} intensity={2.2} color="#fff4d4" castShadow />
      <pointLight position={[-10, 5, -10]} intensity={1.1} color={theme.gold} />

      <group position={[0, -5, 0]}>
        <Foliage mode={mode} theme={theme} count={12000} height={14} radius={5.8} timeScale={timeScale} />
        <Ornaments mode={mode} theme={theme} count={600} timeScale={timeScale} />
        <Polaroids
          mode={mode}
          theme={theme}
          photos={photos}
          onSelect={onSelectPhoto}
          timeScale={timeScale}
          focusPhotoId={focusPhotoId}
          focusActive={focusActive}
          focusTarget={focusTarget}
        />
        <TreeStar mode={mode} theme={theme} height={14} timeScale={timeScale} />
        <ContactShadows opacity={0.75} scale={30} blur={2} far={5} color="#000000" />
      </group>

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.8} mipmapBlur intensity={1.2} radius={0.6} />
        <Vignette eskil={false} offset={0.1} darkness={theme.vignette ?? 0.8} />
        <Noise opacity={0.025} blendFunction={BlendFunction.OVERLAY} />
      </EffectComposer>
    </>
  );
};
