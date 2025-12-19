import type { Theme, ThemeKey } from './types';

export const THEMES: Record<ThemeKey, Theme> = {
  imperial: {
    label: '鎏金常青',
    emerald: '#0b2a1a',
    gold: '#D4AF37',
    accent: '#F5E6BF',
    formedGradient: { bottom: '#0b2a1a', top: '#0b2a1a' },
    chaosGradient: { bottom: '#D4AF37', top: '#D4AF37' },
    paper: '#fdfdfd', // 稍暖米白，贴近树上拍立得纸色
    ink: '#111827',
    ballColors: ['#D4AF37', '#b3082b', '#f5d492', '#c4161c', '#ffe6a7'],
    lightColors: ['#FFD700', '#fff3c4'],
    giftColors: ['#8B0000', '#D4AF37', '#0b2a1a'],
    background: '#050c07',
    vignette: 0.9
  },
  frost: {
    label: '极光雪夜',
    emerald: '#0c2f42',
    gold: '#a6e3e9',
    accent: '#e0f7ff',
    formedGradient: { bottom: '#0c2f42', top: '#0c2f42' },
    chaosGradient: { bottom: '#a6e3e9', top: '#a6e3e9' },
    paper: '#f7fbff',
    ink: '#0f172a',
    ballColors: ['#a6e3e9', '#71c9ce', '#ffffff', '#c8f0ff'],
    lightColors: ['#b8e2ff', '#ffffff'],
    giftColors: ['#71c9ce', '#d3f1ff', '#0c2f42'],
    background: '#03121c',
    vignette: 0.75
  },
  berry: {
    label: '玫瑰月光',
    emerald: '#2b0a16',
    gold: '#ffb7b2',
    accent: '#ffd9ce',
    formedGradient: { bottom: '#2b0a16', top: '#2b0a16' },
    chaosGradient: { bottom: '#ffb7b2', top: '#ffb7b2' },
    paper: '#fff3f3',
    ink: '#2d0a14',
    ballColors: ['#ffb7b2', '#ff9aa2', '#ffd9ce', '#957dad'],
    lightColors: ['#ffc2d4', '#ffe9f0'],
    giftColors: ['#ff9aa2', '#ffd9ce', '#2b0a16'],
    background: '#12050b',
    vignette: 0.85
  }
};

export const DEFAULT_THEME_KEY: ThemeKey = 'imperial';
