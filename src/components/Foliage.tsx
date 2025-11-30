import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Theme } from '../types';
import { TreeMode } from '../types';

type Props = {
  mode: TreeMode;
  count: number;
  theme: Theme;
  height?: number;
  radius?: number;
  timeScale?: number;
};

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;

  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aRandom;

  varying float vMix;
  varying float vSparkle;

  float cubicInOut(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    float localProgress = clamp(uProgress * 1.1 - aRandom * 0.15, 0.0, 1.0);
    float eased = cubicInOut(localProgress);

    vec3 pos = mix(aChaosPos, aTargetPos, eased);
    if (eased > 0.8) {
      pos.x += sin(uTime * 2.0 + pos.y) * 0.05;
      pos.z += cos(uTime * 1.6 + pos.y) * 0.05;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (4.0 + aRandom * 3.0) * (24.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    vMix = eased;
    vSparkle = sin(uTime * 4.0 + aRandom * 50.0);
  }
`;

const fragmentShader = `
  uniform vec3 uChaosColor;
  uniform vec3 uFormedColor;
  uniform vec3 uSparkleColor;

  varying float vMix;
  varying float vSparkle;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;

    float alpha = pow(1.0 - r * 2.0, 1.8);
    vec3 base = mix(uChaosColor, uFormedColor, vMix);

    float sparkle = smoothstep(0.92, 1.0, vSparkle);
    base += uSparkleColor * sparkle * 0.35;

    gl_FragColor = vec4(base, alpha);
  }
`;

export const Foliage: React.FC<Props> = ({ mode, count, theme, height = 14, radius = 5.6, timeScale = 1 }) => {
  const meshRef = useRef<THREE.Points>(null);
  const progressRef = useRef(0);
  const timeRef = useRef(0);

  const { chaos, targets, randoms } = useMemo(() => {
    const chaosPositions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const randomVals = new Float32Array(count);

    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < count; i++) {
      const rChaos = 24 * Math.cbrt(Math.random());
      const thetaChaos = Math.random() * Math.PI * 2;
      const phiChaos = Math.acos(2 * Math.random() - 1);

      chaosPositions[i * 3] = rChaos * Math.sin(phiChaos) * Math.cos(thetaChaos);
      chaosPositions[i * 3 + 1] = rChaos * Math.sin(phiChaos) * Math.sin(thetaChaos) + 4;
      chaosPositions[i * 3 + 2] = rChaos * Math.cos(phiChaos);

      const yNorm = i / count;
      const y = yNorm * height;
      const currentRadius = radius * (1 - yNorm);
      const angle = 2 * Math.PI * goldenRatio * i;

      targetPositions[i * 3] = Math.cos(angle) * currentRadius;
      targetPositions[i * 3 + 1] = y;
      targetPositions[i * 3 + 2] = Math.sin(angle) * currentRadius;

      randomVals[i] = Math.random();
    }

    return { chaos: chaosPositions, targets: targetPositions, randoms: randomVals };
  }, [count, height, radius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uChaosColor: { value: new THREE.Color(theme.gold) },
      uFormedColor: { value: new THREE.Color(theme.emerald) },
      uSparkleColor: { value: new THREE.Color(theme.accent) }
    }),
    [theme]
  );

  useEffect(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uChaosColor.value.set(theme.gold);
      material.uniforms.uFormedColor.value.set(theme.emerald);
      material.uniforms.uSparkleColor.value.set(theme.accent);
    }
  }, [theme]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const scaledDelta = delta * timeScale;
    timeRef.current += scaledDelta;
    const material = meshRef.current.material as THREE.ShaderMaterial;
    material.uniforms.uTime.value = timeRef.current;

    const target = mode === TreeMode.FORMED ? 1 : 0;
    progressRef.current = THREE.MathUtils.damp(progressRef.current, target, 2.1, scaledDelta);
    material.uniforms.uProgress.value = progressRef.current;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={chaos} itemSize={3} />
        <bufferAttribute attach="attributes-aChaosPos" count={count} array={chaos} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={count} array={targets} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={count} array={randoms} itemSize={1} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
