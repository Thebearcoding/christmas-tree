import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Theme } from '../types';
import { TreeMode } from '../types';

type Props = {
  mode: TreeMode;
  theme: Theme;
  height?: number;
  timeScale?: number;
};

export const TreeStar: React.FC<Props> = ({ mode, theme, height = 14, timeScale = 1 }) => {
  const starRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const scaleRef = useRef(new THREE.Vector3(1, 1, 1));

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.05;
    const innerRadius = 0.45;
    const points = 5;

    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }

    shape.closePath();
    return shape;
  }, []);

  const extrudeSettings = {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 4
  };

  const formedPos = useMemo(() => new THREE.Vector3(0, height + 0.8, 0), [height]);
  const chaosPos = useMemo(
    () => new THREE.Vector3(Math.random() * 4 - 2, height + 2.5 + Math.random() * 2, Math.random() * 4 - 2),
    [height]
  );

  useFrame((state, delta) => {
    if (!starRef.current) return;
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime * timeScale;
    const scaledDelta = delta * timeScale;
    const target = isFormed ? formedPos : chaosPos;

    starRef.current.position.lerp(target, scaledDelta * 1.8);

    const targetScale = isFormed ? 1 : 0.65;
    scaleRef.current.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), scaledDelta * 2);
    starRef.current.scale.copy(scaleRef.current);

    if (isFormed) {
      starRef.current.rotation.x = THREE.MathUtils.damp(starRef.current.rotation.x, 0, 6, scaledDelta);
      starRef.current.rotation.y += scaledDelta * 0.45;
      starRef.current.position.y = formedPos.y + Math.sin(time * 2.2) * 0.12;
    } else {
      starRef.current.rotation.x += scaledDelta * 1.3;
      starRef.current.rotation.y += scaledDelta * 1.8;
    }

    if (lightRef.current) {
      const pulse = 2 + Math.sin(time * 3) * 0.5;
      lightRef.current.intensity = pulse;
    }
  });

  return (
    <group ref={starRef} position={formedPos.toArray()}>
      <mesh>
        <extrudeGeometry args={[starShape, extrudeSettings]} />
        <meshStandardMaterial
          color={theme.gold}
          emissive={theme.gold}
          emissiveIntensity={2}
          metalness={0.92}
          roughness={0.08}
          toneMapped={false}
        />
      </mesh>

      {/* Slim mount to visually connect to tree tip */}
      <mesh position={[0, -0.8, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.18, 0.8, 16]} />
        <meshStandardMaterial color={theme.gold} metalness={0.9} roughness={0.1} emissive={theme.gold} emissiveIntensity={0.4} />
      </mesh>

      <pointLight ref={lightRef} color={theme.gold} intensity={2} distance={5} decay={2} />
    </group>
  );
};
