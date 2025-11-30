export enum TreeMode {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface Theme {
  label: string;
  emerald: string;
  gold: string;
  accent: string;
  paper: string;
  ink: string;
  ballColors: string[];
  lightColors: string[];
  giftColors: string[];
  background?: string;
  vignette?: number;
}

export type ThemeKey = 'imperial' | 'frost' | 'berry';

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
