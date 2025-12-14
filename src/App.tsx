import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { v4 as uuidv4 } from 'uuid';
import { Experience } from './components/Experience';
import { GestureController } from './components/GestureController';
import { UIOverlay } from './components/UIOverlay';
import { MemoryOverlay } from './components/MemoryOverlay';
import { FlyingPolaroid } from './components/FlyingPolaroid';
import type { CommentEntry, HandPosition, PhotoEntry, ThemeKey } from './types';
import { TreeMode } from './types';
import { DEFAULT_THEME_KEY, THEMES } from './theme';
import { MUSIC_TRACKS } from './music';
import './App.css';

const MUSIC_STORAGE_KEY = 'grand-tree-music-enabled';
const DEFAULT_MUSIC_VOLUME = 0.35;

const THUMB_MAX_SIZE = 640;
const FULL_MAX_SIZE = 1920;
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
        URL.revokeObjectURL(objectUrl);
        resolve(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(objectUrl);
    };
    img.src = objectUrl;
  });
};

export default function App() {
  const [mode, setMode] = useState<TreeMode>(TreeMode.CHAOS);
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME_KEY);
  const [photoEntries, setPhotoEntries] = useState<PhotoEntry[]>(DEFAULT_PHOTO_ENTRIES);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'enter' | 'active' | 'exit'>('idle');
  const [detailOrigin, setDetailOrigin] = useState<{ x: number; y: number } | null>(null);
  const [notesByPhoto, setNotesByPhoto] = useState<Record<string, string>>({});
  const [commentsByPhoto, setCommentsByPhoto] = useState<Record<string, CommentEntry[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [handPosition, setHandPosition] = useState<HandPosition>({ x: 0.5, y: 0.5, detected: false });
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [detailCardPos, setDetailCardPos] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null);
  const [handoff, setHandoff] = useState<{ id: string; src: string; from: { x: number; y: number; width: number; height: number } } | null>(null);
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
  const uploadedUrlsRef = useRef<string[]>([]);
  const musicAvailable = MUSIC_TRACKS.length > 0;

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: PhotoEntry[] = JSON.parse(saved);
        if (parsed.length) {
          setPhotoEntries(parsed);
          setSelectedPhotoId(null);
          setDetailState('idle');
        }
      }
    } catch (err) {
      console.warn('failed to load saved photos', err);
    }
  }, []);

  const persistPhotos = (entries: PhotoEntry[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (err) {
      console.warn('failed to save photos', err);
    }
  };

  useEffect(() => {
    return () => {
      uploadedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
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
            title: `Memory ${index + 1}`
          },
          urls: [thumbUrl, fullUrl]
        };
      })
    );

    uploadedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadedUrlsRef.current = processed.flatMap((p) => p.urls);

    const entries = processed.map((p) => p.entry);
    setPhotoEntries(entries);
    persistPhotos(entries);
    setSelectedPhotoId(entries[0]?.id ?? null);
    setDetailState(entries[0] ? 'enter' : 'idle');
    requestAnimationFrame(() => setDetailState(entries[0] ? 'active' : 'idle'));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetPhotos = () => {
    uploadedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadedUrlsRef.current = [];
    setPhotoEntries(DEFAULT_PHOTO_ENTRIES);
    persistPhotos(DEFAULT_PHOTO_ENTRIES);
    setSelectedPhotoId(null);
    setDetailState('idle');
    setCommentDraft('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectedPhoto = selectedPhotoId ? photoEntries.find((p) => p.id === selectedPhotoId) ?? null : null;
  const selectedNote = selectedPhoto ? notesByPhoto[selectedPhoto.id] ?? '' : '';
  const selectedComments = selectedPhoto ? commentsByPhoto[selectedPhoto.id] ?? [] : [];

  const theme = THEMES[themeKey];
  const usingUploads = uploadedUrlsRef.current.length > 0;
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
  };

  const handleAddComment = () => {
    if (!selectedPhoto) return;
    const text = commentDraft.trim();
    if (!text) return;
    setCommentsByPhoto((prev) => {
      const existing = prev[selectedPhoto.id] ?? [];
      return { ...prev, [selectedPhoto.id]: [...existing, { id: uuidv4(), text, createdAt: Date.now() }] };
    });
    setCommentDraft('');
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

  return (
    <div style={{ width: '100vw', height: '100vh', background: theme.background ?? '#000', position: 'relative', overflow: 'hidden' }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 4, 20], fov: 45 }} gl={{ antialias: false, stencil: false, alpha: false }} shadows>
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
        preload="auto"
        onEnded={() => {
          if (!musicAvailable) return;
          setMusicIndex((idx) => (idx + 1) % MUSIC_TRACKS.length);
        }}
        style={{ display: 'none' }}
      />

      <UIOverlay
        themeKey={themeKey}
        themes={THEMES}
        onThemeChange={(key) => setThemeKey(key)}
        onOpenUpload={() => fileInputRef.current?.click()}
        onReset={resetPhotos}
        mode={mode}
        onToggleMode={() => setMode((prev) => (prev === TreeMode.CHAOS ? TreeMode.FORMED : TreeMode.CHAOS))}
        photoCount={photoEntries.length}
        ornamentCount={polaroidCount}
        usingUploads={usingUploads}
        gestureEnabled={gestureEnabled}
        onToggleGesture={() => setGestureEnabled((g) => !g)}
        musicEnabled={musicEnabled}
        musicAvailable={musicAvailable}
        musicBlocked={musicBlocked}
        onToggleMusic={handleToggleMusic}
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
  );
}
