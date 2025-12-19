import { useMemo, useState } from 'react';
import type { Theme, ThemeKey, ThemeOverrides, TwoStopGradient } from '../types';
import { TreeMode } from '../types';

const HUE_TRACK =
  'linear-gradient(90deg, #ff2d2d 0%, #ffcc00 16%, #3dff57 33%, #22f0ff 50%, #2b6bff 66%, #c52bff 83%, #ff2d2d 100%)';

type Props = {
  themeKey: ThemeKey;
  themes: Record<ThemeKey, Theme>;
  baseTheme: Theme;
  activeTheme: Theme;
  customTheme: Theme;
  customEnabled: boolean;
  onToggleCustomEnabled: () => void;
  onPatchThemeOverrides: (patch: ThemeOverrides) => void;
  onResetThemeOverrides: () => void;
  onThemeChange: (key: ThemeKey) => void;
  onOpenUpload: () => void;
  onReset: () => void;
  onExportScenePng: () => void;
  onExportPostcardPng: () => void;
  exportEnabled: boolean;
  exportBusy: boolean;
  exportMessage: string | null;
  mode: TreeMode;
  onToggleMode: () => void;
  photoCount: number;
  ornamentCount: number;
  usingUploads: boolean;
  gestureEnabled: boolean;
  onToggleGesture: () => void;
  musicEnabled: boolean;
  musicAvailable: boolean;
  musicBlocked: boolean;
  onToggleMusic: () => void;
};

export const UIOverlay: React.FC<Props> = ({
  themeKey,
  themes,
  baseTheme,
  activeTheme,
  customTheme,
  customEnabled,
  onToggleCustomEnabled,
  onPatchThemeOverrides,
  onResetThemeOverrides,
  onThemeChange,
  onOpenUpload,
  onReset,
  onExportScenePng,
  onExportPostcardPng,
  exportEnabled,
  exportBusy,
  exportMessage,
  mode,
  onToggleMode,
  photoCount,
  ornamentCount,
  usingUploads,
  gestureEnabled,
  onToggleGesture,
  musicEnabled,
  musicAvailable,
  musicBlocked,
  onToggleMusic
}) => {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [paletteSliderOpen, setPaletteSliderOpen] = useState<string | null>(null);
  const accent = activeTheme.gold;

  const gradientPreview = useMemo(() => {
    const formed = customTheme.formedGradient;
    const chaos = customTheme.chaosGradient;
    return {
      formedCss: `linear-gradient(180deg, ${formed.top}, ${formed.bottom})`,
      chaosCss: `linear-gradient(180deg, ${chaos.top}, ${chaos.bottom})`
    };
  }, [customTheme.chaosGradient, customTheme.formedGradient]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

  const hexToRgb = (hex: string) => {
    if (!isHexColor(hex)) return { r: 0, g: 0, b: 0 };
    const raw = hex.slice(1);
    const num = Number.parseInt(raw, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case rn:
          h = ((gn - bn) / d) % 6;
          break;
        case gn:
          h = (bn - rn) / d + 2;
          break;
        default:
          h = (rn - gn) / d + 4;
          break;
      }
      h *= 60;
      if (h < 0) h += 360;
    }

    return { h, s: s * 100, l: l * 100 };
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    const hn = ((h % 360) + 360) % 360;
    const sn = clamp(s, 0, 100) / 100;
    const ln = clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
    const m = ln - c / 2;

    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (hn < 60) [rp, gp, bp] = [c, x, 0];
    else if (hn < 120) [rp, gp, bp] = [x, c, 0];
    else if (hn < 180) [rp, gp, bp] = [0, c, x];
    else if (hn < 240) [rp, gp, bp] = [0, x, c];
    else if (hn < 300) [rp, gp, bp] = [x, 0, c];
    else [rp, gp, bp] = [c, 0, x];

    return {
      r: Math.round((rp + m) * 255),
      g: Math.round((gp + m) * 255),
      b: Math.round((bp + m) * 255)
    };
  };

  const hexToHsl = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHsl(r, g, b);
  };

  const hslToHex = (h: number, s: number, l: number) => {
    const { r, g, b } = hslToRgb(h, s, l);
    return rgbToHex(r, g, b);
  };

  const patchGradient = (key: 'formedGradient' | 'chaosGradient', next: TwoStopGradient) => {
    onPatchThemeOverrides({ [key]: next });
  };

  const ColorSliders: React.FC<{ value: string; onChange: (hex: string) => void }> = ({ value, onChange }) => {
    const { h, s, l } = useMemo(() => hexToHsl(value), [value]);
    const hueThumb = useMemo(() => hslToHex(h, 100, 50), [h]);
    const satTrack = useMemo(() => {
      const hh = Math.round(h);
      const ll = Math.round(l);
      return `linear-gradient(90deg, hsl(${hh}, 0%, ${ll}%), hsl(${hh}, 100%, ${ll}%))`;
    }, [h, l]);
    const lightTrack = useMemo(() => {
      const hh = Math.round(h);
      const ss = Math.round(s);
      return `linear-gradient(90deg, hsl(${hh}, ${ss}%, 0%), hsl(${hh}, ${ss}%, 50%), hsl(${hh}, ${ss}%, 100%))`;
    }, [h, s]);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 52px', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#b6b1a3' }}>色相</div>
          <input
            className="gt-range"
            type="range"
            min={0}
            max={360}
            value={Math.round(h)}
            style={{ ['--track' as any]: HUE_TRACK, ['--thumb' as any]: hueThumb }}
            onChange={(e) => onChange(hslToHex(Number(e.target.value), s, l))}
          />
          <div style={{ fontSize: 12, color: '#d9d9d9', textAlign: 'right' }}>{Math.round(h)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 52px', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#b6b1a3' }}>饱和</div>
          <input
            className="gt-range"
            type="range"
            min={0}
            max={100}
            value={Math.round(s)}
            style={{ ['--track' as any]: satTrack, ['--thumb' as any]: value }}
            onChange={(e) => onChange(hslToHex(h, Number(e.target.value), l))}
          />
          <div style={{ fontSize: 12, color: '#d9d9d9', textAlign: 'right' }}>{Math.round(s)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 52px', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#b6b1a3' }}>亮度</div>
          <input
            className="gt-range"
            type="range"
            min={0}
            max={100}
            value={Math.round(l)}
            style={{ ['--track' as any]: lightTrack, ['--thumb' as any]: value }}
            onChange={(e) => onChange(hslToHex(h, s, Number(e.target.value)))}
          />
          <div style={{ fontSize: 12, color: '#d9d9d9', textAlign: 'right' }}>{Math.round(l)}</div>
        </div>
      </div>
    );
  };

  const ColorEditor: React.FC<{
    title: string;
    value: string;
    onChange: (hex: string) => void;
  }> = ({ title, value, onChange }) => {
    return (
      <div
        style={{
          padding: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          background: 'rgba(0,0,0,0.22)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12, color: '#d9d9d9', letterSpacing: '1px' }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 6,
                background: value,
                border: '1px solid rgba(255,255,255,0.25)',
                boxShadow: '0 8px 18px rgba(0,0,0,0.45)'
              }}
            />
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          </div>
        </div>
        <ColorSliders value={value} onChange={onChange} />
      </div>
    );
  };

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
          <div style={{ fontSize: 12, letterSpacing: '2px', color: '#c9b27a', textTransform: 'uppercase' }}>主题</div>
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={onToggleCustomEnabled}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: `1px solid ${accent}`,
                background: customEnabled ? 'rgba(212,175,55,0.18)' : 'rgba(0,0,0,0.35)',
                color: accent,
                fontWeight: 800,
                cursor: 'pointer',
                letterSpacing: '1px'
              }}
            >
              {customEnabled ? '自定义：开' : '自定义：关'}
            </button>
            <button
              onClick={() => setCustomizerOpen(true)}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: `1px solid ${accent}`,
                background: 'rgba(0,0,0,0.35)',
                color: '#f5f5f5',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              自定义配色
            </button>
            <button
              onClick={() => {
                onResetThemeOverrides();
                setPaletteSliderOpen(null);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(0,0,0,0.35)',
                color: accent,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              重置主题
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              onClick={onExportPostcardPng}
              disabled={!exportEnabled || exportBusy}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${accent}`,
                background: exportBusy ? 'rgba(212,175,55,0.22)' : 'rgba(0,0,0,0.35)',
                color: accent,
                fontWeight: 700,
                cursor: exportEnabled && !exportBusy ? 'pointer' : 'not-allowed',
                letterSpacing: '1px',
                opacity: exportEnabled ? 1 : 0.55
              }}
            >
              {exportBusy ? '导出中…' : '导出明信片'}
            </button>
            <button
              onClick={onExportScenePng}
              disabled={!exportEnabled || exportBusy}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${accent}`,
                background: 'rgba(0,0,0,0.35)',
                color: accent,
                fontWeight: 700,
                cursor: exportEnabled && !exportBusy ? 'pointer' : 'not-allowed',
                letterSpacing: '1px',
                opacity: exportEnabled ? 1 : 0.55
              }}
            >
              {exportBusy ? '导出中…' : '导出场景'}
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
            <button
              onClick={onToggleMusic}
              disabled={!musicAvailable}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${accent}`,
                background: musicEnabled ? 'rgba(212,175,55,0.14)' : 'rgba(0,0,0,0.35)',
                color: accent,
                fontWeight: 700,
                cursor: musicAvailable ? 'pointer' : 'not-allowed',
                letterSpacing: '1px',
                opacity: musicAvailable ? 1 : 0.55
              }}
            >
              {musicAvailable ? (musicBlocked ? '点一下开音乐' : musicEnabled ? '关闭音乐' : '开启音乐') : '无音乐'}
            </button>
          </div>
          {exportMessage && (
            <div style={{ fontSize: 12, color: '#e7e0d0', opacity: 0.9 }}>
              {exportMessage}
            </div>
          )}
        </div>

        {customizerOpen && (
          <div
            onClick={() => setCustomizerOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              zIndex: 80,
              pointerEvents: 'auto'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 24,
                right: 24,
                width: 'min(560px, calc(100vw - 48px))',
                maxHeight: 'calc(100vh - 48px)',
                overflow: 'auto',
                background: 'rgba(10,10,10,0.72)',
                border: `1px solid ${accent}40`,
                borderRadius: 16,
                boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(16px)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
	                  <div style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#c6b37a' }}>
	                    主题自定义
	                  </div>
	                  <div style={{ fontSize: 18, fontWeight: 800, color: '#f7f2e8', marginTop: 4 }}>
	                    {baseTheme.label} {customEnabled ? '(自定义：开)' : '(自定义：关)'}
	                  </div>
                </div>
                <button
                  onClick={() => setCustomizerOpen(false)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
	                  <div style={{ fontSize: 12, letterSpacing: '1px', color: '#d9d9d9', marginBottom: 10 }}>树身渐变</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    <div>
	                      <div style={{ fontSize: 12, color: '#b6b1a3', marginBottom: 6 }}>聚合（FORMED）</div>
                      <div style={{ height: 10, borderRadius: 999, background: gradientPreview.formedCss, border: '1px solid rgba(255,255,255,0.12)' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                        <ColorEditor
                          title="底部"
                          value={customTheme.formedGradient.bottom}
                          onChange={(hex) => patchGradient('formedGradient', { ...customTheme.formedGradient, bottom: hex })}
                        />
                        <ColorEditor
                          title="顶部"
                          value={customTheme.formedGradient.top}
                          onChange={(hex) => patchGradient('formedGradient', { ...customTheme.formedGradient, top: hex })}
                        />
                      </div>
                    </div>

                    <div>
	                      <div style={{ fontSize: 12, color: '#b6b1a3', marginBottom: 6 }}>散开（CHAOS）</div>
                      <div style={{ height: 10, borderRadius: 999, background: gradientPreview.chaosCss, border: '1px solid rgba(255,255,255,0.12)' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                        <ColorEditor
                          title="底部"
                          value={customTheme.chaosGradient.bottom}
                          onChange={(hex) => patchGradient('chaosGradient', { ...customTheme.chaosGradient, bottom: hex })}
                        />
                        <ColorEditor
                          title="顶部"
                          value={customTheme.chaosGradient.top}
                          onChange={(hex) => patchGradient('chaosGradient', { ...customTheme.chaosGradient, top: hex })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
	                  <div style={{ fontSize: 12, letterSpacing: '1px', color: '#d9d9d9', marginBottom: 10 }}>高光 / 界面材质</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                    <ColorEditor title="高光" value={customTheme.accent} onChange={(hex) => onPatchThemeOverrides({ accent: hex })} />
                    <ColorEditor
                      title="背景"
                      value={customTheme.background ?? '#000000'}
                      onChange={(hex) => onPatchThemeOverrides({ background: hex })}
                    />
                    <ColorEditor title="纸张" value={customTheme.paper} onChange={(hex) => onPatchThemeOverrides({ paper: hex })} />
                    <ColorEditor title="墨色" value={customTheme.ink} onChange={(hex) => onPatchThemeOverrides({ ink: hex })} />
                  </div>
                </div>

                <div style={{ padding: 12, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
	                  <div style={{ fontSize: 12, letterSpacing: '1px', color: '#d9d9d9', marginBottom: 10 }}>调色板</div>

                  {[
	                    { key: 'ballColors', label: '彩球', colors: customTheme.ballColors },
	                    { key: 'lightColors', label: '彩灯', colors: customTheme.lightColors },
	                    { key: 'giftColors', label: '礼物', colors: customTheme.giftColors }
	                  ].map((group) => (
                    <div key={group.key} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 12, color: '#b6b1a3' }}>{group.label}</div>
                        <button
                          onClick={() => {
                            const next = [...group.colors, '#ffffff'];
                            onPatchThemeOverrides({ [group.key]: next } as ThemeOverrides);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 10,
                            border: `1px solid ${accent}55`,
                            background: 'rgba(0,0,0,0.35)',
                            color: accent,
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
	                          添加颜色
	                        </button>
	                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 8 }}>
                        {group.colors.map((color, index) => {
                          const id = `${group.key}-${index}`;
                          return (
                            <div key={id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <input
                                type="color"
                                value={color}
                                onChange={(e) => {
                                  const next = [...group.colors];
                                  next[index] = e.target.value;
                                  onPatchThemeOverrides({ [group.key]: next } as ThemeOverrides);
                                }}
                              />
                              <button
                                onClick={() => setPaletteSliderOpen((prev) => (prev === id ? null : id))}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  border: `1px solid ${accent}55`,
                                  background: 'rgba(0,0,0,0.35)',
                                  color: accent,
                                  cursor: 'pointer',
                                  fontWeight: 800
                                }}
                              >
                                {paletteSliderOpen === id ? '收起' : '调节'}
                              </button>
                              <button
                                onClick={() => {
                                  if (group.colors.length <= 1) return;
                                  const next = group.colors.filter((_, i) => i !== index);
                                  onPatchThemeOverrides({ [group.key]: next } as ThemeOverrides);
                                }}
                                disabled={group.colors.length <= 1}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  border: '1px solid rgba(255,255,255,0.16)',
                                  background: 'rgba(0,0,0,0.35)',
                                  color: group.colors.length <= 1 ? 'rgba(255,255,255,0.35)' : '#f5f5f5',
                                  cursor: group.colors.length <= 1 ? 'not-allowed' : 'pointer'
                                }}
                              >
                                删除
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {group.colors.map((color, index) => {
                        const id = `${group.key}-${index}`;
                        if (paletteSliderOpen !== id) return null;
                        return (
                          <div key={`${id}-sliders`} style={{ marginTop: 8, paddingLeft: 10, paddingRight: 10 }}>
                            <ColorSliders
                              value={color}
                              onChange={(hex) => {
                                const next = [...group.colors];
                                next[index] = hex;
                                onPatchThemeOverrides({ [group.key]: next } as ThemeOverrides);
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <div style={{ fontSize: 12, color: '#9a9a9a' }}>
                    提示：主题自定义仅保存在本机浏览器（清理缓存/换设备会丢失）。
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <button
                    onClick={onToggleCustomEnabled}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${accent}`,
                      background: customEnabled ? 'rgba(212,175,55,0.18)' : 'rgba(0,0,0,0.35)',
                      color: accent,
                      fontWeight: 900,
                      cursor: 'pointer',
                      letterSpacing: '1px'
                    }}
                  >
	                    {customEnabled ? '关闭自定义' : '开启自定义'}
                  </button>
                  <button
                    onClick={() => {
                      onResetThemeOverrides();
                      setPaletteSliderOpen(null);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(0,0,0,0.35)',
                      color: '#f5f5f5',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    重置为默认
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
	            <div style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: '#c6b37a' }}>模式</div>
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
	              {mode === TreeMode.FORMED ? '散开' : '聚合'}
	            </button>
	          </div>
	          <div style={{ fontSize: 22, fontWeight: 700, color: accent }}>
	            {ornamentCount.toLocaleString()} <span style={{ fontSize: 12, color: '#9d8f6c', fontWeight: 500 }}>拍立得</span>
	          </div>
	          <div style={{ fontSize: 12, color: '#b6b1a3', marginTop: 2 }}>
	            {photoCount} 张照片 · {usingUploads ? '你的回忆' : '示例照片'}
	          </div>
	        </div>
      </div>
    </div>
  );
};
