import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
  quality?: 'high' | 'low';
};

export const Ornaments: React.FC<Props> = ({ mode, count, theme, timeScale = 1, quality = 'high' }) => {
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const renderer = useThree((state) => state.gl);
  const environment = useThree((state) => state.scene.environment);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const height = 14; // match foliage height
  const baseRadius = 5.8;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // for even turn spacing
  const lowQuality = quality === 'low';
  const ballSegments = lowQuality ? 16 : 32;
  const lightSegments = lowQuality ? 8 : 12;
  const supportsPmrem = useMemo(() => {
    const ctx = renderer.getContext();
    const isWebGL2 = renderer.capabilities.isWebGL2;
    if (isWebGL2) return !!ctx.getExtension('EXT_color_buffer_float');
    return !!(ctx.getExtension('EXT_color_buffer_half_float') || ctx.getExtension('EXT_color_buffer_float'));
  }, [renderer]);
  const usePbrBalls = !!environment && supportsPmrem;

  const { balls, gifts, lights } = useMemo(() => {
    const ballList: InstanceData[] = [];
    const giftList: InstanceData[] = [];
    const lightList: InstanceData[] = [];
    const placedTargets: THREE.Vector3[] = []; // used to avoid dense overlaps
    const slices = 12;
    const sliceWeights: number[] = [];
    for (let s = 0; s < slices; s++) {
      const y0 = s / slices;
      const y1 = (s + 1) / slices;
      const mid = (y0 + y1) * 0.5;
      const r0 = Math.max(0.35, baseRadius * (1 - y0));
      const r1 = Math.max(0.35, baseRadius * (1 - y1));
      const avgCirc = Math.PI * (r0 + r1);
      const dy = (y1 - y0) * height;
      const bias = 1 + (1 - mid) * 0.8; // heavier bottom
      sliceWeights.push(avgCirc * dy * bias);
    }

    const weightSum = sliceWeights.reduce((a, b) => a + b, 0);
    let sliceCounts = sliceWeights.map((w, idx) => {
      const minCount = idx >= slices - 2 ? 6 : 8;
      return Math.max(minCount, Math.round((w / weightSum) * count));
    });
    let diff = sliceCounts.reduce((a, b) => a + b, 0) - count;
    // Adjust counts to match total
    while (diff !== 0) {
      for (let s = 0; s < slices && diff !== 0; s++) {
        if (diff > 0 && sliceCounts[s] > 8) {
          sliceCounts[s]--;
          diff--;
        } else if (diff < 0) {
          sliceCounts[s]++;
          diff++;
        }
      }
    }

    let globalIndex = 0;
    for (let s = 0; s < slices; s++) {
      const bandCount = sliceCounts[s];
      const y0 = s / slices;
      const y1 = (s + 1) / slices;
      const isTopBand = s >= slices - 2;
      const isTop = isTopBand;

      for (let j = 0; j < bandCount; j++) {
        const roll = Math.random();
        const topWeight = isTopBand ? 1 : 0;
        let type: OrnamentKind;
        if (topWeight) {
          // Crown: only balls + lights, no gifts
          type = roll > 0.5 ? 'light' : 'ball';
        } else if (roll > 0.9) {
          type = 'light';
        } else if (roll > 0.75) {
          type = 'gift';
        } else {
          type = 'ball';
        }

        const frac = (j + Math.random()) / bandCount;
        let yNorm = y0 + frac * (y1 - y0);
        yNorm += (Math.random() - 0.5) * 0.01;
        yNorm = Math.min(0.99, Math.max(0, yNorm));

        const rBase = Math.max(0.35, baseRadius * (1 - yNorm));
        const radialFalloff = Math.pow(1 - yNorm, 1.18);
        let radius = rBase + radialFalloff * 0.35 + (Math.random() - 0.5) * 0.2;
        if (isTopBand) {
          radius = Math.max(0.06, radius * 0.25);
        }

        let theta = globalIndex * goldenAngle + (Math.random() - 0.5) * 0.25;
        const yRaw = yNorm * height + 0.6;
        const y = Math.min(yRaw, height - 0.25); // cap near top
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

      let scale =
        type === 'light'
          ? 0.16 + Math.random() * 0.05
          : type === 'gift'
            ? 0.34 + Math.random() * 0.2
            : 0.24 + Math.random() * 0.22;
      if (isTop && type === 'ball') {
        scale = 0.22 + Math.random() * 0.14; // larger balls at the crown
      }

      // Push away from previously placed targets to reduce visible overlaps
      const baseSpacing = type === 'ball' ? 0.65 : 0.85;
      const minSpacing = baseSpacing * (isTop ? 0.65 : 1) * (0.9 + scale);
      let placedPos = targetPos.clone();
      for (let attempt = 0; attempt < 10; attempt++) {
        let adjusted = false;
        for (const p of placedTargets) {
          const dist = placedPos.distanceTo(p);
          if (dist < minSpacing) {
            adjusted = true;
            const dir = dist < 1e-3 ? new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta)) : placedPos.clone().sub(p);
            dir.y = 0;
            if (dir.lengthSq() < 1e-4) dir.set(Math.cos(theta), 0, Math.sin(theta));
            dir.normalize();
            const push = (minSpacing - dist) + 0.04;
            placedPos.add(dir.multiplyScalar(push));
            placedPos.y += isTop ? 0.01 : 0;
            break;
          }
        }
        if (!adjusted) break;
      }
      // Clamp back to a cone envelope to avoid flying out after pushes
      const yRatio = Math.min(1, Math.max(0, (placedPos.y - 0.6) / height));
      const maxRadiusAtY = Math.max(0.35, baseRadius * (1 - yRatio) + 0.6);
      const horiz = new THREE.Vector2(placedPos.x, placedPos.z);
      const len = horiz.length();
      if (len > maxRadiusAtY) {
        horiz.multiplyScalar(maxRadiusAtY / (len + 1e-6));
        placedPos.x = horiz.x;
        placedPos.z = horiz.y;
      }
      placedPos.y = Math.min(placedPos.y, height - 0.2);

      targetPos.copy(placedPos);
      placedTargets.push(placedPos.clone());

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

        globalIndex++;
      }
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
          <sphereGeometry args={[1, ballSegments, ballSegments]} />
          {usePbrBalls ? (
            <meshStandardMaterial roughness={0.1} metalness={0.9} envMapIntensity={1.5} />
          ) : (
            <meshPhongMaterial shininess={110} specular="#ffffff" />
          )}
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
          <sphereGeometry args={[1, lightSegments, lightSegments]} />
          <meshStandardMaterial emissive="white" emissiveIntensity={2.3} toneMapped={false} color="white" />
        </instancedMesh>
      )}
    </>
  );
};
