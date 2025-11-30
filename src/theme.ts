import type { Theme, ThemeKey } from './types';

export const THEMES: Record<ThemeKey, Theme> = {
  imperial: {
    label: '帝王金绿',
    emerald: '#0b2a1a',
    gold: '#D4AF37',
    accent: '#F5E6BF',
    paper: '#fdfdfd',
    ink: '#111827',
    ballColors: ['#D4AF37', '#b3082b', '#f5d492', '#c4161c', '#ffe6a7'],
    lightColors: ['#FFD700', '#fff3c4'],
    giftColors: ['#8B0000', '#D4AF37', '#0b2a1a'],
    background: '#050c07',
    vignette: 0.9
  },
  frost: {
    label: '极地晶蓝',
    emerald: '#0c2f42',
    gold: '#a6e3e9',
    accent: '#e0f7ff',
    paper: '#f7fbff',
    ink: '#0f172a',
    ballColors: ['#a6e3e9', '#71c9ce', '#ffffff', '#c8f0ff'],
    lightColors: ['#b8e2ff', '#ffffff'],
    giftColors: ['#71c9ce', '#d3f1ff', '#0c2f42'],
    background: '#03121c',
    vignette: 0.75
  },
  berry: {
    label: '玫瑰奢金',
    emerald: '#2b0a16',
    gold: '#ffb7b2',
    accent: '#ffd9ce',
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
