import { useEffect, useState } from 'react';

type Props = {
  src: string;
  from: { x: number; y: number; width: number; height: number };
  to: { x: number; y: number; width?: number; height?: number };
  onDone: () => void;
};

export const FlyingPolaroid: React.FC<Props> = ({ src, from, to, onDone }) => {
  const [style, setStyle] = useState(() => ({
    left: from.x,
    top: from.y,
    width: from.width,
    height: from.height,
    opacity: 1,
    rotate: '-3deg',
    scale: 1
  }));

  useEffect(() => {
    const targetW = to.width ?? from.width;
    const targetH = to.height ?? from.height;
    const targetLeft = to.x - targetW / 2;
    const targetTop = to.y - targetH / 2;

    requestAnimationFrame(() => {
      setStyle({
        left: targetLeft,
        top: targetTop,
        width: targetW,
        height: targetH,
        opacity: 1,
        rotate: '-4deg',
        scale: 1
      });
    });

    const timer = setTimeout(onDone, 700);
    return () => clearTimeout(timer);
  }, [onDone, to]);

  return (
    <div
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 50,
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
        transform: `scale(${style.scale}) rotate(${style.rotate})`,
        transition: 'all 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
        filter: 'drop-shadow(0 12px 24px rgba(0,0,0,0.35))'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          background: '#fdfdfd',
          borderRadius: 12,
          padding: '8px 8px 18px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxShadow: '0 15px 35px rgba(0,0,0,0.45)'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 8,
            width: '40%',
            height: 6,
            left: '30%',
            background: '#d4af37',
            borderRadius: 4,
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))'
          }}
        />
        <div style={{ flex: 1, borderRadius: 8, overflow: 'hidden', background: '#0f172a' }}>
          <img src={src} alt="memory" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: '#111827', letterSpacing: '0.1em', fontWeight: 700 }}>
          Memory
        </div>
      </div>
    </div>
  );
};
