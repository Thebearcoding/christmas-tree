import type { Theme, ThemeKey } from '../types';
import { TreeMode } from '../types';

type Props = {
  themeKey: ThemeKey;
  themes: Record<ThemeKey, Theme>;
  onThemeChange: (key: ThemeKey) => void;
  onOpenUpload: () => void;
  onReset: () => void;
  mode: TreeMode;
  onToggleMode: () => void;
  photoCount: number;
  ornamentCount: number;
  usingUploads: boolean;
  gestureEnabled: boolean;
  onToggleGesture: () => void;
};

export const UIOverlay: React.FC<Props> = ({
  themeKey,
  themes,
  onThemeChange,
  onOpenUpload,
  onReset,
  mode,
  onToggleMode,
  photoCount,
  ornamentCount,
  usingUploads,
  gestureEnabled,
  onToggleGesture
}) => {
  const currentTheme = themes[themeKey];
  const accent = currentTheme.gold;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px',
        zIndex: 10
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            pointerEvents: 'auto',
            background: 'rgba(0,0,0,0.45)',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 14px 40px rgba(0,0,0,0.45)'
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: '2px', color: '#c9b27a', textTransform: 'uppercase' }}>Themes</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => onThemeChange(key as ThemeKey)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  border: themeKey === key ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.2)',
                  background: themeKey === key ? 'rgba(212,175,55,0.16)' : 'rgba(0,0,0,0.35)',
                  color: '#f5f5f5',
                  fontSize: 12,
                  letterSpacing: '1px',
                  cursor: 'pointer'
                }}
              >
                {theme.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onOpenUpload}
              style={{
                padding: '10px 14px',
                background: `linear-gradient(135deg, ${accent}, #fff7d1)`,
                color: '#0d0d0d',
                border: 'none',
                borderRadius: 10,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(212,175,55,0.35)'
              }}
            >
              上传照片
            </button>
            <button
              onClick={onReset}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(0,0,0,0.35)',
                color: accent,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              使用示例
            </button>
            <button
              onClick={onToggleGesture}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${accent}`,
                background: gestureEnabled ? 'rgba(212,175,55,0.14)' : 'rgba(0,0,0,0.35)',
                color: accent,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '1px'
              }}
            >
              {gestureEnabled ? '关闭手势' : '开启手势'}
            </button>
          </div>
        </div>

        <div
          style={{
            pointerEvents: 'auto',
            background: 'rgba(0,0,0,0.4)',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#e7e0d0',
            minWidth: 220,
            boxShadow: '0 14px 40px rgba(0,0,0,0.45)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#c6b37a' }}>Mode</div>
            <button
              onClick={onToggleMode}
              style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.35)',
                border: `1px solid ${accent}`,
                color: accent,
                borderRadius: 8,
                cursor: 'pointer',
                letterSpacing: '1px'
              }}
            >
              {mode === TreeMode.FORMED ? 'Unleash' : 'Reform'}
            </button>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: accent }}>
            {ornamentCount.toLocaleString()} <span style={{ fontSize: 12, color: '#9d8f6c', fontWeight: 500 }}>POLAROIDS</span>
          </div>
          <div style={{ fontSize: 12, color: '#b6b1a3', marginTop: 2 }}>
            {photoCount} Photos · {usingUploads ? 'Your Memories' : 'Default Demo'}
          </div>
        </div>
      </div>
    </div>
  );
};
