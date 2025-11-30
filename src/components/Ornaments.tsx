import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Theme } from '../types';
import { TreeMode } from '../types';

type OrnamentKind = 'ball' | 'gift' | 'light';

type InstanceData = {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  color: THREE.Color;
  scale: number;
  speed: number;
  type: OrnamentKind;
  wobble: number;
};

type Props = {
  mode: TreeMode;
  count: number;
  theme: Theme;
  timeScale?: number;
};

export const Ornaments: React.FC<Props> = ({ mode, count, theme, timeScale = 1 }) => {
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const height = 14; // match foliage height
  const baseRadius = 5.8;

  const { balls, gifts, lights } = useMemo(() => {
    const ballList: InstanceData[] = [];
    const giftList: InstanceData[] = [];
    const lightList: InstanceData[] = [];

    const topExtras = Math.max(8, Math.floor(count * 0.08)); // slightly fewer at the crown
    const total = count + topExtras;

    for (let i = 0; i < total; i++) {
      const roll = Math.random();
      const type: OrnamentKind = roll > 0.9 ? 'light' : roll > 0.75 ? 'gift' : 'ball';

      // Reserve a handful that hug the tip
      const isTop = i >= count;
      const yNorm = isTop ? 0.88 + Math.random() * 0.1 : Math.pow(Math.random(), 2.4);
      const yRaw = yNorm * height + 0.6;
      const y = Math.min(yRaw, height - 0.25); // cap near top
      const radius = Math.max(0.5, baseRadius * (1 - yNorm) + (isTop ? 0.25 : 0.6));
      const theta = y * 9 + Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(
        radius * Math.cos(theta),
        y,
        radius * Math.sin(theta)
      );

      const chaosRadius = 18 + Math.random() * 12;
      const cTheta = Math.random() * Math.PI * 2;
      const cPhi = Math.acos(2 * Math.random() - 1);
      const chaosPos = new THREE.Vector3(
        chaosRadius * Math.sin(cPhi) * Math.cos(cTheta),
        chaosRadius * Math.sin(cPhi) * Math.sin(cTheta) + 4,
        chaosRadius * Math.cos(cPhi)
      );

      const scale =
        type === 'light'
          ? 0.16 + Math.random() * 0.05
          : type === 'gift'
            ? 0.34 + Math.random() * 0.2
            : 0.26 + Math.random() * 0.25;

      const palette =
        type === 'light' ? theme.lightColors : type === 'gift' ? theme.giftColors : theme.ballColors;
      const color = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);

      const wobble = Math.random() * 50;

      const data: InstanceData = {
        chaosPos,
        targetPos,
        color,
        scale,
        speed: 0.6 + Math.random() * 1.4,
        type,
        wobble
      };

      if (type === 'ball') ballList.push(data);
      else if (type === 'gift') giftList.push(data);
      else lightList.push(data);
    }

    return { balls: ballList, gifts: giftList, lights: lightList };
  }, [baseRadius, count, height, theme]);

  useLayoutEffect(() => {
    [
      { ref: ballsRef, data: balls },
      { ref: giftsRef, data: gifts },
      { ref: lightsRef, data: lights }
    ].forEach(({ ref, data }) => {
      if (!ref.current) return;
      data.forEach((item, idx) => {
        ref.current!.setColorAt(idx, item.color);
      });
      if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    });
  }, [balls, gifts, lights]);

  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime * timeScale;
    const scaledDelta = delta * timeScale;

    const updateMesh = (ref: React.RefObject<THREE.InstancedMesh>, data: InstanceData[]) => {
      if (!ref.current) return;
      let changed = false;

      data.forEach((item, idx) => {
        ref.current!.getMatrixAt(idx, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

        const dest = isFormed ? item.targetPos : item.chaosPos;
        const lerpSpeed = scaledDelta * item.speed * (isFormed ? 2 : 1.4);
        dummy.position.lerp(dest, lerpSpeed);

        if (item.type === 'gift') {
          dummy.rotation.x += scaledDelta * 0.6;
          dummy.rotation.y += scaledDelta * 0.3;
        } else {
          dummy.lookAt(0, dummy.position.y, 0);
        }

        dummy.scale.setScalar(item.scale);

        if (item.type === 'light') {
          const pulse = 1 + Math.sin(time * 4 + item.wobble) * 0.35;
          dummy.scale.multiplyScalar(pulse);
        }

        dummy.updateMatrix();
        ref.current!.setMatrixAt(idx, dummy.matrix);
        changed = true;
      });

      if (changed) ref.current.instanceMatrix.needsUpdate = true;
    };

    updateMesh(ballsRef, balls);
    updateMesh(giftsRef, gifts);
    updateMesh(lightsRef, lights);
  });

  return (
    <>
      {balls.length > 0 && (
        <instancedMesh ref={ballsRef} args={[undefined, undefined, balls.length]}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial roughness={0.12} metalness={0.9} envMapIntensity={1.4} />
        </instancedMesh>
      )}

      {gifts.length > 0 && (
        <instancedMesh ref={giftsRef} args={[undefined, undefined, gifts.length]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.35} metalness={0.55} />
        </instancedMesh>
      )}

      {lights.length > 0 && (
        <instancedMesh ref={lightsRef} args={[undefined, undefined, lights.length]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial emissive="white" emissiveIntensity={2.3} toneMapped={false} color="white" />
        </instancedMesh>
      )}
    </>
  );
};
