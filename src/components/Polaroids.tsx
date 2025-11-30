import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { PhotoEntry, Theme } from '../types';
import { TreeMode } from '../types';

type Props = {
  mode: TreeMode;
  photos: PhotoEntry[];
  theme: Theme;
  onSelect: (photo: PhotoEntry, origin?: { clientX: number; clientY: number }) => void;
  timeScale?: number;
  focusPhotoId?: string | null;
  focusActive?: boolean;
  focusTarget?: { x: number; y: number; width?: number; height?: number } | null;
  onScreenSelect?: (payload: { id: string; src: string; from: { x: number; y: number; width: number; height: number } }) => void;
};

type PhotoData = {
  id: string;
  photo: PhotoEntry;
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  speed: number;
  sway: number;
  label: string;
};

const PolaroidCard: React.FC<{
  data: PhotoData;
  mode: TreeMode;
  theme: Theme;
  onSelect: (origin: { clientX: number; clientY: number }) => void;
  timeScale: number;
  focusPhotoId?: string | null;
  focusActive?: boolean;
  focusTarget?: { x: number; y: number; width?: number; height?: number } | null;
  onScreenSelect?: (payload: { id: string; src: string; from: { x: number; y: number; width: number; height: number } }) => void;
}> = ({ data, mode, theme, onSelect, timeScale, focusPhotoId, focusActive, focusTarget, onScreenSelect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [loadError, setLoadError] = useState(false);
  const focusPosition = useMemo(() => new THREE.Vector3(0, 9, 8), []);
  const focusDistanceRef = useRef<number>(8);
  const [photoScale, setPhotoScale] = useState<THREE.Vector2>(() => new THREE.Vector2(1, 1));
  const { size, camera } = useThree();

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      data.photo.src,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
        setLoadError(false);
        const img: any = tex.image;
        if (img?.width && img?.height) {
          const aspect = img.width / img.height;
          const w = aspect >= 1 ? aspect : 1;
          const h = aspect >= 1 ? 1 : 1 / aspect;
          setPhotoScale(new THREE.Vector2(w, h));
        }
      },
      undefined,
      () => setLoadError(true)
    );
  }, [data.photo.src]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;
    const isFocus = focusActive && focusPhotoId === data.photo.id;

    let targetPos = isFormed ? data.targetPos : data.chaosPos;
    if (isFocus) {
      if (focusTarget) {
        const ndcX = (focusTarget.x / state.size.width) * 2 - 1;
        const ndcY = -(focusTarget.y / state.size.height) * 2 + 1;
        // 使用靠近相机的 z，避免飞出视野
        const ndc = new THREE.Vector3(ndcX, ndcY, 0.1);
        const world = ndc.unproject(state.camera);
        const dir = world.sub(state.camera.position).normalize();
        const currentDist = groupRef.current.position.distanceTo(state.camera.position);
        const desiredDist = Math.max(6, Math.min(10, currentDist));
        focusDistanceRef.current = THREE.MathUtils.damp(focusDistanceRef.current, desiredDist, 6, delta);
        targetPos = state.camera.position.clone().add(dir.multiplyScalar(focusDistanceRef.current));
      } else {
        targetPos = focusPosition;
      }
    }

    const target = targetPos;
    const scaledDelta = delta * timeScale;
    const step = scaledDelta * data.speed * (isFocus ? 1.4 : isFormed ? 1.3 : 0.8);
    groupRef.current.position.lerp(target, step);

    // 始终面向摄像机，避免看到背面
    const cameraPos = state.camera.getWorldPosition(new THREE.Vector3());
    const orient = new THREE.Object3D();
    orient.position.copy(groupRef.current.position);
    orient.lookAt(cameraPos);
    groupRef.current.quaternion.slerp(orient.quaternion, scaledDelta * (isFocus ? 4 : 6));

    // 轻微位置摆动，不再旋转面朝外
    const floatY = Math.sin(time * 0.6 + data.sway) * 0.05;
    groupRef.current.position.y += floatY * scaledDelta * 10;

    const targetScale = isFocus ? 2.2 : 1;
    groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), scaledDelta * 6);

    // 微调整个卡片厚度，让缩放时看起来更立体
    groupRef.current.position.z += (isFocus ? -0.2 : 0) * scaledDelta;
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        if (onScreenSelect && groupRef.current) {
          const box = new THREE.Box3().setFromObject(groupRef.current);
          const center = box.getCenter(new THREE.Vector3());
          const halfSize = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);

          const toScreen = (vec: THREE.Vector3) => {
            const ndc = vec.clone().project(camera);
            return {
              x: (ndc.x * 0.5 + 0.5) * size.width,
              y: (-ndc.y * 0.5 + 0.5) * size.height
            };
          };

          const corners = [
            new THREE.Vector3(center.x + halfSize.x, center.y + halfSize.y, center.z),
            new THREE.Vector3(center.x - halfSize.x, center.y + halfSize.y, center.z),
            new THREE.Vector3(center.x + halfSize.x, center.y - halfSize.y, center.z),
            new THREE.Vector3(center.x - halfSize.x, center.y - halfSize.y, center.z)
          ].map(toScreen);

          const xs = corners.map((c) => c.x);
          const ys = corners.map((c) => c.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const width = Math.max(40, maxX - minX);
          const height = Math.max(40, maxY - minY);
          const c2d = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
          onScreenSelect({
            id: data.photo.id,
            src: data.photo.fullSrc || data.photo.src,
            from: { x: c2d.x - width / 2, y: c2d.y - height / 2, width, height }
          });
        }
        onSelect({ clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY });
      }}
    >
      <mesh position={[0, 1.25, -0.05]}>
        <cylinderGeometry args={[0.01, 0.01, 1.5]} />
        <meshStandardMaterial color={theme.gold} metalness={1} roughness={0.2} transparent opacity={0.7} />
      </mesh>

      <group>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 1.5, 0.04]} />
          <meshStandardMaterial color={theme.paper} roughness={0.82} />
        </mesh>

        <mesh position={[0, 0.15, 0.025]} scale={[photoScale.x, photoScale.y, 1]}>
          <planeGeometry args={[1.0, 1.0]} />
          {texture && !loadError ? (
            <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
          ) : (
            <meshStandardMaterial color={loadError ? '#5a0a0a' : '#b3b3b3'} />
          )}
        </mesh>

        <mesh position={[0, 0.75, 0.03]}>
          <boxGeometry args={[0.12, 0.05, 0.05]} />
          <meshStandardMaterial color={theme.gold} metalness={0.9} roughness={0.1} />
        </mesh>

        <Text
          position={[0, -0.6, 0.03]}
          fontSize={0.14}
          color={theme.gold}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.05}
        >
          {loadError ? 'Missing' : data.label}
        </Text>
      </group>
    </group>
  );
};

export const Polaroids: React.FC<Props> = ({ mode, photos, theme, onSelect, timeScale = 1, focusPhotoId, focusActive, focusTarget }) => {
  const limited = useMemo(() => photos.slice(0, Math.min(photos.length, 48)), [photos]);

  const photoData = useMemo<PhotoData[]>(() => {
    if (limited.length === 0) return [];
    const height = 9;
    const maxRadius = 5.2;
    return limited.map((photo, i) => {
      const yNorm = 0.2 + (i / limited.length) * 0.65;
      const y = yNorm * height;
      const r = maxRadius * (1 - yNorm) + 0.8;
      const theta = i * 2.39996;
      const targetPos = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));

      const angle = (i / limited.length) * Math.PI * 2;
      const distance = 3 + Math.random() * 3.5;
      const chaosPos = new THREE.Vector3(
        distance * Math.cos(angle) * 1.1,
        5 + (Math.random() - 0.5) * 8,
        18 - 3 + distance * Math.sin(angle) * 0.6
      );

      return {
        id: photo.id,
        photo,
        chaosPos,
        targetPos,
        speed: 0.6 + Math.random() * 0.8,
        sway: Math.random() * 100,
        label: photo.title || `Memory ${i + 1}`
      };
    });
  }, [limited]);

  return (
    <group>
      {photoData.map((data) => (
        <PolaroidCard
          key={data.id}
          data={data}
          mode={mode}
          theme={theme}
          timeScale={timeScale}
          focusPhotoId={focusPhotoId}
          focusActive={focusActive}
          focusTarget={focusTarget}
          onSelect={(origin) => onSelect(data.photo, origin)}
        />
      ))}
    </group>
  );
};
