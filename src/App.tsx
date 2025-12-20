import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import type { WebGLRenderer } from 'three';
import { Experience } from './components/Experience';
import { GestureController } from './components/GestureController';
import { UIOverlay } from './components/UIOverlay';
import { MemoryOverlay } from './components/MemoryOverlay';
import { FlyingPolaroid } from './components/FlyingPolaroid';
import type { CommentEntry, HandPosition, PhotoEntry, ShareDocument, Theme, ThemeCustomizationStorage, ThemeKey, ThemeOverrides } from './types';
import { TreeMode } from './types';
import { DEFAULT_THEME_KEY, THEMES } from './theme';
import { MUSIC_TRACKS } from './music';
import { buildShareUrl, clearShareFromUrl, createShare, dataUrlToBlob, fetchShare, getShareIdFromLocation, patchShare, uploadSharePhoto } from './shareApi';
import './App.css';

const MUSIC_STORAGE_KEY = 'grand-tree-music-enabled';
const DEFAULT_MUSIC_VOLUME = 0.35;

const THUMB_MAX_SIZE = 640;
const FULL_MAX_SIZE = 1920;
const isProbablyMobileDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);
  return isIPad || isMobile;
};

const DEFAULT_PHOTO_FILES = [
  '1.JPG',
  '042161097c88df0fe1cf99b4423f19b8.JPG',
  '137f8a10a9b84ed51e7e9e8dedf530d8.JPG',
  '23a9686d45855ccecd51e9e7181f880e.JPG',
  '28b3b30f5a2215f671999e4577f89e6f.JPG',
  '341a66a359ed85a3b080a45cf442cdbc.JPG',
  '47d16e7c26a35abf7116fd57e23e161b.JPG',
  '490a28aa3b273431b7593476500cb6c5.JPG',
  '60cef57d196c7fe24f10f2adefe5c8b5.JPG',
  '7c938e59f5a9ff3bd74e24f54ed127b8.JPG',
  'a0818fb6fab2899fe3a4d8b5a2428395.JPG',
  'c522840f4cfb328031dd00d434f9dc0f.JPG',
  'e916b855455a77839eda20c4383afc9d.JPG',
  'eaabfa455eec925a0ea544c445e29a9b.JPG',
  'fd1f8abe251a8cdd1fb5e2a2dbbba43a.JPG'
];

const DEFAULT_PHOTO_PATHS = DEFAULT_PHOTO_FILES.map((name) => `/photos/${name}`);

const DEFAULT_PHOTO_ENTRIES: PhotoEntry[] = DEFAULT_PHOTO_PATHS.map((src, index) => ({
  id: index === 0 ? 'default-top' : `default-${index}`,
  src,
  fullSrc: src,
  title: index === 0 ? '树顶之光' : `记忆 ${index}`
}));
const STORAGE_KEY = 'grand-tree-photos';
const THEME_CUSTOMIZATION_STORAGE_KEY = 'grand-tree-theme-customization-v1';

const emptyThemeCustomizationStorage = (): ThemeCustomizationStorage => ({ version: 1, enabledByThemeKey: {}, overridesByThemeKey: {} });

const pad2 = (value: number) => String(value).padStart(2, '0');
const formatTimestamp = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

const createScaledImageUrl = (file: File, maxSize: number, quality = 0.9): Promise<string> => {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const targetW = Math.max(1, Math.round(img.width * ratio));
      const targetH = Math.max(1, Math.round(img.height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } else {
        fileToDataUrl(file).then((dataUrl) => {
          if (dataUrl) {
            URL.revokeObjectURL(objectUrl);
            resolve(dataUrl);
            return;
          }
          resolve(objectUrl);
        });
      }
    };
    img.onerror = () => {
      fileToDataUrl(file).then((dataUrl) => {
        if (dataUrl) {
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl);
          return;
        }
        resolve(objectUrl);
      });
    };
    img.src = objectUrl;
  });
};

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

const normalizeTwoStopGradient = (value: unknown, fallback: { bottom: string; top: string }) => {
  if (!value || typeof value !== 'object') return fallback;
  const v = value as { bottom?: unknown; top?: unknown };
  const bottom = typeof v.bottom === 'string' && isHexColor(v.bottom) ? v.bottom : fallback.bottom;
  const top = typeof v.top === 'string' && isHexColor(v.top) ? v.top : fallback.top;
  return { bottom, top };
};

const normalizeColorArray = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const filtered = value.filter((v) => typeof v === 'string' && isHexColor(v)) as string[];
  return filtered.length ? filtered : fallback;
};

const mergeThemeWithOverrides = (base: Theme, overrides: ThemeOverrides | undefined): Theme => {
  const baseFormed = base.formedGradient ?? { bottom: base.emerald, top: base.emerald };
  const baseChaos = base.chaosGradient ?? { bottom: base.gold, top: base.gold };
  const formedGradient = overrides?.formedGradient
    ? normalizeTwoStopGradient(overrides.formedGradient, baseFormed)
    : baseFormed;
  const chaosGradient = overrides?.chaosGradient
    ? normalizeTwoStopGradient(overrides.chaosGradient, baseChaos)
    : baseChaos;

  const emerald = overrides?.emerald && isHexColor(overrides.emerald) ? overrides.emerald : formedGradient.bottom;
  const gold = overrides?.gold && isHexColor(overrides.gold) ? overrides.gold : chaosGradient.bottom;

  return {
    ...base,
    ...overrides,
    emerald,
    gold,
    accent: overrides?.accent && isHexColor(overrides.accent) ? overrides.accent : base.accent,
    formedGradient,
    chaosGradient,
    paper: overrides?.paper && isHexColor(overrides.paper) ? overrides.paper : base.paper,
    ink: overrides?.ink && isHexColor(overrides.ink) ? overrides.ink : base.ink,
    background: overrides?.background && isHexColor(overrides.background) ? overrides.background : base.background,
    ballColors: overrides?.ballColors ? normalizeColorArray(overrides.ballColors, base.ballColors) : base.ballColors,
    lightColors: overrides?.lightColors ? normalizeColorArray(overrides.lightColors, base.lightColors) : base.lightColors,
    giftColors: overrides?.giftColors ? normalizeColorArray(overrides.giftColors, base.giftColors) : base.giftColors
  };
};

export default function App() {
  const [shareId, setShareId] = useState<string | null>(() => getShareIdFromLocation());
  const [shareBusy, setShareBusy] = useState(false);
  const [shareLoaded, setShareLoaded] = useState(false);

  const [mode, setMode] = useState<TreeMode>(TreeMode.CHAOS);
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [themeCustomization, setThemeCustomization] = useState<ThemeCustomizationStorage>(() => {
    const empty: ThemeCustomizationStorage = emptyThemeCustomizationStorage();
    try {
      const raw = localStorage.getItem(THEME_CUSTOMIZATION_STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as Partial<ThemeCustomizationStorage> | null;
      if (!parsed || parsed.version !== 1) return empty;
      return {
        version: 1 as const,
        enabledByThemeKey: parsed.enabledByThemeKey ?? {},
        overridesByThemeKey: parsed.overridesByThemeKey ?? {}
      };
    } catch {
      return empty;
    }
  });
  const [photoEntries, setPhotoEntries] = useState<PhotoEntry[]>(DEFAULT_PHOTO_ENTRIES);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'enter' | 'active' | 'exit'>('idle');
  const [detailOrigin, setDetailOrigin] = useState<{ x: number; y: number } | null>(null);
  const [notesByPhoto, setNotesByPhoto] = useState<Record<string, string>>({});
  const [commentsByPhoto, setCommentsByPhoto] = useState<Record<string, CommentEntry[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [handPosition, setHandPosition] = useState<HandPosition>({ x: 0.5, y: 0.5, detected: false });
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [lowQuality] = useState(() => isProbablyMobileDevice());
  const [detailCardPos, setDetailCardPos] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null);
  const [handoff, setHandoff] = useState<{ id: string; src: string; from: { x: number; y: number; width: number; height: number } } | null>(null);
  const [exportReady, setExportReady] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [musicEnabled, setMusicEnabled] = useState(() => {
    if (MUSIC_TRACKS.length === 0) return false;
    try {
      const saved = localStorage.getItem(MUSIC_STORAGE_KEY);
      if (saved === '0') return false;
      if (saved === '1') return true;
    } catch {
      // ignore
    }
    return true; // default autoplay when tracks exist
  });
  const [musicIndex, setMusicIndex] = useState(0);
  const [musicBlocked, setMusicBlocked] = useState(false);

  const musicRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const overlayCaptureRef = useRef<HTMLDivElement>(null);
  const exportMessageTimeoutRef = useRef<number | null>(null);
  const musicAvailable = MUSIC_TRACKS.length > 0;
  const themeSyncTimeoutRef = useRef<number | null>(null);
  const lastThemeSyncRef = useRef<string>('');
  const noteSyncTimeoutsRef = useRef<Record<string, number>>({});

  const shareMode = !!shareId;

  useEffect(() => {
    const handler = () => setShareId(getShareIdFromLocation());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  useEffect(() => {
    if (musicRef.current) musicRef.current.volume = DEFAULT_MUSIC_VOLUME;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MUSIC_STORAGE_KEY, musicEnabled ? '1' : '0');
    } catch {
      // ignore
    }
  }, [musicEnabled]);

  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    if (!musicEnabled) {
      audio.pause();
      setMusicBlocked(false);
      return;
    }
    if (!musicAvailable) return;
    audio.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true));
  }, [musicAvailable, musicEnabled, musicIndex]);

  useEffect(() => {
    if (!musicEnabled) return;
    if (!musicAvailable) return;
    const audio = musicRef.current;
    if (!audio) return;

    const handler = () => {
      if (!audio.paused) {
        window.removeEventListener('pointerdown', handler);
        window.removeEventListener('keydown', handler);
        return;
      }

      audio.play().then(() => {
        setMusicBlocked(false);
        window.removeEventListener('pointerdown', handler);
        window.removeEventListener('keydown', handler);
      }).catch(() => {
        setMusicBlocked(true);
      });
    };

    window.addEventListener('pointerdown', handler, { passive: true });
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [musicAvailable, musicEnabled, musicIndex]);

  const applyShareDoc = (doc: ShareDocument, opts?: { resetUi?: boolean }) => {
    setThemeKey(doc.themeKey ?? DEFAULT_THEME_KEY);
    setThemeCustomization(doc.themeCustomization ?? emptyThemeCustomizationStorage());
    setPhotoEntries(doc.photos?.length ? doc.photos : DEFAULT_PHOTO_ENTRIES);
    setNotesByPhoto(doc.notesByPhoto ?? {});
    setCommentsByPhoto(doc.commentsByPhoto ?? {});
    if (opts?.resetUi) {
      setSelectedPhotoId(null);
      setDetailState('idle');
      setCommentDraft('');
    }
    setShareLoaded(true);
    lastThemeSyncRef.current = JSON.stringify({ themeKey: doc.themeKey, themeCustomization: doc.themeCustomization });
  };

  const loadLocalPhotos = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed: PhotoEntry[] = JSON.parse(saved);
      if (parsed.length) {
        setPhotoEntries(parsed);
        setSelectedPhotoId(null);
        setDetailState('idle');
      }
    } catch (err) {
      console.warn('failed to load saved photos', err);
    }
  };

  const loadLocalThemeCustomization = () => {
    const empty: ThemeCustomizationStorage = emptyThemeCustomizationStorage();
    try {
      const raw = localStorage.getItem(THEME_CUSTOMIZATION_STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw) as Partial<ThemeCustomizationStorage> | null;
      if (!parsed || parsed.version !== 1) return empty;
      return {
        version: 1 as const,
        enabledByThemeKey: parsed.enabledByThemeKey ?? {},
        overridesByThemeKey: parsed.overridesByThemeKey ?? {}
      };
    } catch {
      return empty;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!shareId) {
        setShareLoaded(false);
        setNotesByPhoto({});
        setCommentsByPhoto({});
        setThemeCustomization(loadLocalThemeCustomization());
        loadLocalPhotos();
        return;
      }

      setShareBusy(true);
      setShareLoaded(false);
      try {
        const { doc } = await fetchShare(shareId);
        if (cancelled) return;
        applyShareDoc(doc, { resetUi: true });
      } catch (err) {
        console.warn('failed to load share', err);
        if (!cancelled) {
          showExportMessage('加载分享失败：请检查网络或链接是否有效', 3500);
        }
      } finally {
        if (!cancelled) setShareBusy(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  const persistPhotos = (entries: PhotoEntry[]) => {
    if (shareMode) return true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (err) {
      console.warn('failed to save photos', err);
      return false;
    }
  };

  useEffect(() => {
    return () => {
      if (exportMessageTimeoutRef.current) window.clearTimeout(exportMessageTimeoutRef.current);
      Object.values(noteSyncTimeoutsRef.current).forEach((id) => window.clearTimeout(id));
      if (themeSyncTimeoutRef.current) window.clearTimeout(themeSyncTimeoutRef.current);
    };
  }, []);

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const processed = await Promise.all(
      Array.from(files).map(async (file, index) => {
        const thumbUrl = await createScaledImageUrl(file, THUMB_MAX_SIZE, 0.88);
        const fullUrl = await createScaledImageUrl(file, FULL_MAX_SIZE, 0.92);
        return {
          entry: {
            id: uuidv4(),
            src: thumbUrl,
            fullSrc: fullUrl,
            title: `回忆 ${index + 1}`
          }
        };
      })
    );

    const newEntries = processed.map((p) => p.entry);
    const baseEntries = photoEntries.every((p) => p.src.startsWith('/photos/')) ? [] : photoEntries;
    const nextEntries = [...newEntries, ...baseEntries];
    setPhotoEntries(nextEntries);
    if (!shareMode) {
      const savedOk = persistPhotos(nextEntries);
      if (!savedOk) showExportMessage('保存失败：空间不足（刷新后可能会丢失）', 3500);
      if (nextEntries.some((p) => p.src.startsWith('blob:') || p.fullSrc.startsWith('blob:'))) {
        showExportMessage('提示：部分照片无法持久化（刷新后会丢失）', 3500);
      }
    } else if (shareId) {
      setShareBusy(true);
      try {
        for (const entry of newEntries) {
          const thumb = await dataUrlToBlob(entry.src);
          const full = await dataUrlToBlob(entry.fullSrc);
          const { doc } = await uploadSharePhoto(shareId, { photoId: entry.id, title: entry.title, thumb, full });
          applyShareDoc(doc);
        }
        showExportMessage('已同步到共享链接', 2500);
      } catch (err) {
        console.warn('share upload failed', err);
        showExportMessage('同步失败：请检查网络后重试', 3500);
      } finally {
        setShareBusy(false);
      }
    }

    const firstNew = newEntries[0];
    setSelectedPhotoId(firstNew?.id ?? null);
    setDetailState(firstNew ? 'enter' : 'idle');
    requestAnimationFrame(() => setDetailState(firstNew ? 'active' : 'idle'));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetPhotos = () => {
    if (!shareMode) {
      setPhotoEntries(DEFAULT_PHOTO_ENTRIES);
      const savedOk = persistPhotos(DEFAULT_PHOTO_ENTRIES);
      if (!savedOk) showExportMessage('保存失败：空间不足（刷新后可能会丢失）', 3500);
      setSelectedPhotoId(null);
      setDetailState('idle');
      setCommentDraft('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!shareId) return;
    const confirmed = window.confirm('确定清空共享内容吗？拿到链接的人都会看到被清空后的结果。');
    if (!confirmed) return;
    setShareBusy(true);
    void patchShare(shareId, { action: 'resetShare' })
      .then(({ doc }) => {
        applyShareDoc(doc, { resetUi: true });
        showExportMessage('已清空共享内容', 2500);
      })
      .catch((err) => {
        console.warn('reset share failed', err);
        showExportMessage('清空失败：请检查网络后重试', 3500);
      })
      .finally(() => setShareBusy(false));
  };

  const selectedPhoto = selectedPhotoId ? photoEntries.find((p) => p.id === selectedPhotoId) ?? null : null;
  const selectedNote = selectedPhoto ? notesByPhoto[selectedPhoto.id] ?? '' : '';
  const selectedComments = selectedPhoto ? commentsByPhoto[selectedPhoto.id] ?? [] : [];

  const baseTheme = THEMES[themeKey];
  const themeOverrides = themeCustomization.overridesByThemeKey?.[themeKey];
  const customEnabled =
    themeCustomization.enabledByThemeKey?.[themeKey] ??
    (themeOverrides ? Object.keys(themeOverrides).length > 0 : false);
  const customTheme = mergeThemeWithOverrides(baseTheme, themeOverrides);
  const theme = customEnabled ? customTheme : baseTheme;
  const usingUploads = photoEntries.some((p) => !p.src.startsWith('/photos/'));
  const polaroidCount = Math.min(photoEntries.length, 48);
  const timeScale = detailState === 'idle' ? 1 : 0.22;
  const focusPhotoId = selectedPhoto?.id ?? null;
  const focusActive = detailState !== 'idle';

  const handleSelectPhoto = (photo: PhotoEntry, origin?: { clientX: number; clientY: number }) => {
    setSelectedPhotoId(photo.id);
    setCommentDraft('');
    setDetailOrigin(origin ? { x: origin.clientX, y: origin.clientY } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setDetailCardPos(null); // 等待弹窗测量真实位置
    setDetailState('enter');
    requestAnimationFrame(() => setDetailState('active'));
  };

  const handleNoteChange = (text: string) => {
    if (!selectedPhoto) return;
    setNotesByPhoto((prev) => ({ ...prev, [selectedPhoto.id]: text }));
    if (!shareId || !shareLoaded) return;
    const key = selectedPhoto.id;
    if (noteSyncTimeoutsRef.current[key]) window.clearTimeout(noteSyncTimeoutsRef.current[key]);
    noteSyncTimeoutsRef.current[key] = window.setTimeout(() => {
      void patchShare(shareId, { notesByPhoto: { [key]: text } })
        .then(({ doc }) => applyShareDoc(doc))
        .catch((err) => {
          console.warn('save note failed', err);
          showExportMessage('同步失败：回忆主题可能未保存', 3500);
        });
    }, 700);
  };

  const handleAddComment = () => {
    if (!selectedPhoto) return;
    const text = commentDraft.trim();
    if (!text) return;
    const photoId = selectedPhoto.id;
    const comment = { id: uuidv4(), text, createdAt: Date.now() };
    setCommentsByPhoto((prev) => {
      const existing = prev[photoId] ?? [];
      return { ...prev, [photoId]: [...existing, comment] };
    });
    setCommentDraft('');
    if (!shareId || !shareLoaded) return;
    void patchShare(shareId, { commentsByPhoto: { [photoId]: [comment] } })
      .then(({ doc }) => applyShareDoc(doc))
      .catch((err) => {
        console.warn('save comment failed', err);
        showExportMessage('同步失败：评论可能未保存', 3500);
      });
  };

  const closeDetail = () => {
    setDetailState('exit');
    setTimeout(() => {
      setSelectedPhotoId(null);
      setCommentDraft('');
      setDetailState('idle');
      setDetailCardPos(null);
      setHandoff(null);
    }, 500);
  };

  const handleToggleMusic = () => {
    if (!musicAvailable) return;
    const audio = musicRef.current;
    if (!musicEnabled) {
      setMusicEnabled(true);
      audio?.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true));
      return;
    }

    if (musicBlocked) {
      audio?.play().then(() => setMusicBlocked(false)).catch(() => setMusicBlocked(true));
      return;
    }

    audio?.pause();
    setMusicEnabled(false);
  };

  const handleToggleGesture = () => {
    if (!gestureEnabled) {
      if (!window.isSecureContext) {
        window.alert('手势需要 HTTPS 才能打开摄像头（请用 https:// 地址访问）');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        window.alert('当前浏览器不支持摄像头手势功能');
        return;
      }
    }
    setGestureEnabled((g) => !g);
  };

  const handleGesturePinch = () => {
    if (detailState === 'exit') return;
    if (photoEntries.length === 0) return;

    const currentIndex = selectedPhotoId ? photoEntries.findIndex((p) => p.id === selectedPhotoId) : -1;
    const nextIndex = (currentIndex + 1) % photoEntries.length;
    const nextPhoto = photoEntries[nextIndex];
    if (!nextPhoto) return;

    if (detailState === 'idle' || !selectedPhotoId) {
      handleSelectPhoto(nextPhoto, { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 });
      return;
    }

    setSelectedPhotoId(nextPhoto.id);
    setCommentDraft('');
  };

  const showExportMessage = (message: string, ttlMs = 2200) => {
    setExportMessage(message);
    if (exportMessageTimeoutRef.current) window.clearTimeout(exportMessageTimeoutRef.current);
    exportMessageTimeoutRef.current = window.setTimeout(() => setExportMessage(null), ttlMs);
  };

  useEffect(() => {
    if (shareMode) return;
    try {
      localStorage.setItem(THEME_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(themeCustomization));
    } catch (err) {
      console.warn('failed to save theme customization', err);
      showExportMessage('主题保存失败：空间不足（刷新后可能会丢失）', 3500);
    }
  }, [themeCustomization]);

  useEffect(() => {
    if (!shareId || !shareLoaded) return;
    const nextKey = JSON.stringify({ themeKey, themeCustomization });
    if (nextKey === lastThemeSyncRef.current) return;
    if (themeSyncTimeoutRef.current) window.clearTimeout(themeSyncTimeoutRef.current);
    themeSyncTimeoutRef.current = window.setTimeout(() => {
      void patchShare(shareId, { themeKey, themeCustomization })
        .then(({ doc }) => applyShareDoc(doc))
        .catch((err) => {
          console.warn('save theme failed', err);
          showExportMessage('同步失败：主题可能未保存', 3500);
        });
    }, 500);
  }, [shareId, shareLoaded, themeCustomization, themeKey]);

  const handleCreateShare = async () => {
    if (shareBusy) return;
    const confirmed = window.confirm('生成分享链接会把照片/回忆上传到云端，且拿到链接的人都能修改。确定继续？');
    if (!confirmed) return;

    setShareBusy(true);
    try {
      const { shareId: newShareId } = await createShare();
      await patchShare(newShareId, { themeKey, themeCustomization, notesByPhoto, commentsByPhoto });

      const uploads = photoEntries.filter((p) => !p.src.startsWith('/photos/'));
      for (const entry of uploads) {
        const thumb = await dataUrlToBlob(entry.src);
        const full = await dataUrlToBlob(entry.fullSrc);
        await uploadSharePhoto(newShareId, { photoId: entry.id, title: entry.title, thumb, full });
      }

      const url = buildShareUrl(newShareId);
      window.history.pushState(null, '', url);
      setShareId(newShareId);
      showExportMessage('分享链接已生成', 2500);
    } catch (err) {
      console.warn('create share flow failed', err);
      showExportMessage('生成失败：请检查网络后重试', 3500);
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareId) return;
    const url = buildShareUrl(shareId);
    try {
      await navigator.clipboard.writeText(url);
      showExportMessage('已复制分享链接', 2000);
    } catch (err) {
      console.warn('clipboard failed', err);
      window.prompt('复制分享链接：', url);
    }
  };

  const handleExitShare = () => {
    if (!shareId) return;
    const confirmed = window.confirm('确定退出共享吗？退出后会回到本机数据。');
    if (!confirmed) return;
    window.history.pushState(null, '', clearShareFromUrl());
    setShareId(null);
    showExportMessage('已退出共享', 1800);
  };

  const handleToggleCustomTheme = () => {
    setThemeCustomization((prev) => {
      const enabledByThemeKey = { ...(prev.enabledByThemeKey ?? {}) };
      enabledByThemeKey[themeKey] = !(enabledByThemeKey[themeKey] ?? false);
      return { ...prev, enabledByThemeKey };
    });
  };

  const patchThemeOverrides = (patch: ThemeOverrides) => {
    setThemeCustomization((prev) => {
      const overridesByThemeKey = { ...(prev.overridesByThemeKey ?? {}) };
      const existing = overridesByThemeKey[themeKey] ?? {};
      overridesByThemeKey[themeKey] = { ...existing, ...patch };
      const enabledByThemeKey = { ...(prev.enabledByThemeKey ?? {}) };
      enabledByThemeKey[themeKey] = true;
      return { ...prev, overridesByThemeKey, enabledByThemeKey };
    });
  };

  const resetThemeOverrides = () => {
    setThemeCustomization((prev) => {
      const overridesByThemeKey = { ...(prev.overridesByThemeKey ?? {}) };
      delete overridesByThemeKey[themeKey];
      const enabledByThemeKey = { ...(prev.enabledByThemeKey ?? {}) };
      enabledByThemeKey[themeKey] = false;
      return { ...prev, overridesByThemeKey, enabledByThemeKey };
    });
  };

  const downloadPngBlob = async (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const canvasToPngBlob = async (canvas: HTMLCanvasElement): Promise<Blob | null> => {
    return await new Promise((resolve) => {
      try {
        canvas.toBlob((value) => resolve(value), 'image/png');
      } catch {
        resolve(null);
      }
    });
  };

  const exportFilename = (kind: 'scene' | 'postcard') => {
    return `grand-tree-${formatTimestamp(new Date())}-${themeKey.toLowerCase()}-${String(mode).toLowerCase()}-${kind}.png`;
  };

  const handleExportScenePng = async () => {
    if (exportBusy) return;
    const renderer = rendererRef.current;
    if (!renderer) {
      showExportMessage('导出失败：渲染器未就绪');
      return;
    }

    setExportBusy(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const canvas = renderer.domElement;
      const filename = exportFilename('scene');
      const blob = await canvasToPngBlob(canvas);

      if (blob) {
        await downloadPngBlob(blob, filename);
        showExportMessage('已导出场景 PNG');
        return;
      }

      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl || dataUrl === 'data:,') throw new Error('empty data URL');

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      link.click();
      showExportMessage('已导出场景 PNG');
    } catch (err) {
      console.warn('export failed', err);
      showExportMessage('导出失败：请稍后再试');
    } finally {
      setExportBusy(false);
    }
  };

  const elementToImage = async (element: HTMLElement): Promise<HTMLImageElement> => {
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('video').forEach((node) => node.remove());
    clone.querySelectorAll('canvas').forEach((node) => node.remove());

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.appendChild(clone);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${width}px;height:${height}px;">
            ${wrapper.innerHTML}
          </div>
        </foreignObject>
      </svg>
    `.trim();

    const img = new Image();
    img.decoding = 'async';
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('overlay image load failed'));
    });
    img.src = url;
    await loaded;
    return img;
  };

  const handleExportPostcardPng = async () => {
    if (exportBusy) return;
    const renderer = rendererRef.current;
    const overlayEl = overlayCaptureRef.current;
    if (!renderer) {
      showExportMessage('导出失败：渲染器未就绪');
      return;
    }
    if (!overlayEl) {
      showExportMessage('导出失败：界面未就绪');
      return;
    }

    setExportBusy(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const glCanvas = renderer.domElement;
      const out = document.createElement('canvas');
      out.width = glCanvas.width;
      out.height = glCanvas.height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('2d context missing');

      ctx.drawImage(glCanvas, 0, 0);

      const overlayImg = await elementToImage(overlayEl);
      ctx.drawImage(overlayImg, 0, 0, out.width, out.height);

      const filename = exportFilename('postcard');
      const blob = await canvasToPngBlob(out);
      if (!blob) throw new Error('postcard blob missing');

      await downloadPngBlob(blob, filename);
      showExportMessage('已导出明信片 PNG');
    } catch (err) {
      console.warn('postcard export failed', err);
      showExportMessage('导出失败：部分界面可能无法截图（建议用浏览器截图）', 3500);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: theme.background ?? '#000', position: 'relative', overflow: 'hidden' }}>
      <Canvas
        dpr={lowQuality ? 1 : [1, 2]}
        camera={{ position: [0, 4, 20], fov: 45 }}
        gl={{
          antialias: false,
          stencil: false,
          alpha: false,
          preserveDrawingBuffer: true,
          precision: lowQuality ? 'mediump' : 'highp',
          powerPreference: 'high-performance'
        }}
        onCreated={({ gl }) => {
          rendererRef.current = gl;
          setExportReady(true);
        }}
        shadows={!lowQuality}
      >
        <Suspense fallback={null}>
          <Experience
            mode={mode}
            theme={theme}
            photos={photoEntries}
            onSelectPhoto={handleSelectPhoto}
            handPosition={handPosition}
            timeScale={timeScale}
            focusPhotoId={focusPhotoId}
            focusActive={focusActive}
            focusTarget={focusActive ? detailCardPos : null}
            onScreenSelect={(payload) => setHandoff(payload)}
            quality={lowQuality ? 'low' : 'high'}
          />
        </Suspense>
      </Canvas>

      <Loader
        containerStyles={{ background: '#000' }}
        innerStyles={{ width: '300px', height: '10px', background: '#333' }}
        barStyles={{ background: theme.gold, height: '10px' }}
        dataStyles={{ color: theme.gold, fontFamily: 'serif' }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleUploadPhotos(e.target.files)}
      />

      <audio
        ref={musicRef}
        src={musicAvailable ? MUSIC_TRACKS[musicIndex] : undefined}
        autoPlay={musicEnabled}
        playsInline
        preload={lowQuality ? 'metadata' : 'auto'}
        onEnded={() => {
          if (!musicAvailable) return;
          setMusicIndex((idx) => (idx + 1) % MUSIC_TRACKS.length);
        }}
        style={{ display: 'none' }}
      />

      <div ref={overlayCaptureRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <UIOverlay
          themeKey={themeKey}
          themes={THEMES}
          baseTheme={baseTheme}
          activeTheme={theme}
          customTheme={customTheme}
          customEnabled={customEnabled}
          onToggleCustomEnabled={handleToggleCustomTheme}
          onPatchThemeOverrides={patchThemeOverrides}
          onResetThemeOverrides={resetThemeOverrides}
          onThemeChange={(key) => setThemeKey(key)}
          onOpenUpload={() => fileInputRef.current?.click()}
          onReset={resetPhotos}
          onExportScenePng={handleExportScenePng}
          onExportPostcardPng={handleExportPostcardPng}
          exportEnabled={exportReady}
          exportBusy={exportBusy}
          exportMessage={exportMessage}
          mode={mode}
          onToggleMode={() => setMode((prev) => (prev === TreeMode.CHAOS ? TreeMode.FORMED : TreeMode.CHAOS))}
          photoCount={photoEntries.length}
          ornamentCount={polaroidCount}
          usingUploads={usingUploads}
          gestureEnabled={gestureEnabled}
          onToggleGesture={handleToggleGesture}
          musicEnabled={musicEnabled}
          musicAvailable={musicAvailable}
          musicBlocked={musicBlocked}
          onToggleMusic={handleToggleMusic}
          shareId={shareId}
          shareBusy={shareBusy}
          onCreateShare={handleCreateShare}
          onCopyShareLink={handleCopyShareLink}
          onExitShare={handleExitShare}
          onResetShare={resetPhotos}
        />

        <MemoryOverlay
          photo={selectedPhoto}
          state={detailState}
          origin={detailOrigin}
          theme={theme}
          note={selectedNote}
          onNoteChange={handleNoteChange}
          comments={selectedComments}
          commentDraft={commentDraft}
          onCommentChange={setCommentDraft}
          onSubmitComment={handleAddComment}
          onClose={closeDetail}
          cardAnchor={detailCardPos}
          onAnchorChange={setDetailCardPos}
        />

        {/* 手动共享元素过渡（从 3D 拍立得飞到左侧卡片） */}
        {handoff && detailCardPos && (
          <FlyingPolaroid
            src={handoff.src}
            from={handoff.from}
            to={detailCardPos}
            colors={{ paper: theme.paper, gold: theme.gold }}
            onDone={() => setHandoff(null)}
          />
        )}

        <GestureController
          currentMode={mode}
          onModeChange={setMode}
          onHandPosition={setHandPosition}
          onPinch={handleGesturePinch}
          enabled={gestureEnabled}
        />
      </div>
    </div>
  );
}
