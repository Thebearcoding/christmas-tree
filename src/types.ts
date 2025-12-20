export enum TreeMode {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export type TwoStopGradient = { bottom: string; top: string };

export interface Theme {
  label: string;
  emerald: string;
  gold: string;
  accent: string;
  formedGradient: TwoStopGradient;
  chaosGradient: TwoStopGradient;
  paper: string;
  ink: string;
  ballColors: string[];
  lightColors: string[];
  giftColors: string[];
  background?: string;
  vignette?: number;
}

export type ThemeKey = 'imperial' | 'frost' | 'berry';

export type ThemeOverrides = Partial<
  Pick<
    Theme,
    | 'emerald'
    | 'gold'
    | 'accent'
    | 'formedGradient'
    | 'chaosGradient'
    | 'paper'
    | 'ink'
    | 'ballColors'
    | 'lightColors'
    | 'giftColors'
    | 'background'
    | 'vignette'
  >
>;

export type ThemeCustomizationStorage = {
  version: 1;
  enabledByThemeKey?: Partial<Record<ThemeKey, boolean>>;
  overridesByThemeKey?: Partial<Record<ThemeKey, ThemeOverrides>>;
};

export interface PhotoEntry {
  id: string;
  src: string;
  fullSrc: string;
  title: string;
}

export interface CommentEntry {
  id: string;
  text: string;
  createdAt: number;
}

export type HandPosition = { x: number; y: number; detected: boolean };

export type ShareDocument = {
  version: 1;
  shareId: string;
  createdAt: number;
  updatedAt: number;
  themeKey: ThemeKey;
  themeCustomization: ThemeCustomizationStorage;
  photos: PhotoEntry[];
  notesByPhoto: Record<string, string>;
  commentsByPhoto: Record<string, CommentEntry[]>;
};

export type SharePatch = Partial<
  Pick<ShareDocument, 'themeKey' | 'themeCustomization' | 'photos' | 'notesByPhoto' | 'commentsByPhoto'>
> & { action?: 'resetShare' };
