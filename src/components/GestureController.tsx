import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandPosition } from '../types';
import { TreeMode } from '../types';

const joinBase = (base: string, pathname: string) => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${pathname.replace(/^\/+/, '')}`;
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

type Props = {
  currentMode: TreeMode;
  onModeChange: (mode: TreeMode) => void;
  onHandPosition?: (pos: HandPosition) => void;
  onPinch?: () => void;
  enabled: boolean;
};

export const GestureController: React.FC<Props> = ({ currentMode, onModeChange, onHandPosition, onPinch, enabled }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('手势初始化中…');
  const [ready, setReady] = useState(false);
  const lastMode = useRef<TreeMode>(currentMode);
  const onModeChangeRef = useRef(onModeChange);
  const onHandPositionRef = useRef(onHandPosition);
  const onPinchRef = useRef(onPinch);

  const openFrames = useRef(0);
  const closedFrames = useRef(0);
  const pinchFrames = useRef(0);
  const releaseFrames = useRef(0);
  const pinchLatched = useRef(false);
  const pinchUiUntil = useRef(0);
  const pinchUiText = useRef('');
  const CONFIDENCE = 5;
  const PINCH_CONFIDENCE = 4;
  const PINCH_RATIO_ON = 0.32;
  const PINCH_RATIO_OFF = 0.42;

  useEffect(() => {
    lastMode.current = currentMode;
  }, [currentMode]);

  useEffect(() => {
    onModeChangeRef.current = onModeChange;
  }, [onModeChange]);

  useEffect(() => {
    onHandPositionRef.current = onHandPosition;
  }, [onHandPosition]);

  useEffect(() => {
    onPinchRef.current = onPinch;
  }, [onPinch]);

  useEffect(() => {
    let cancelled = false;
    let handLandmarker: HandLandmarker | null = null;
    let rafId = 0;
    let stream: MediaStream | null = null;

    const cleanup = () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      handLandmarker?.close();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setReady(false);
    };

    if (!enabled) {
      setStatus('手势：关闭');
      onHandPositionRef.current?.({ x: 0.5, y: 0.5, detected: false });
      cleanup();
      return cleanup;
    }

    openFrames.current = 0;
    closedFrames.current = 0;
    pinchFrames.current = 0;
    releaseFrames.current = 0;
    pinchLatched.current = false;
    pinchUiUntil.current = 0;
    pinchUiText.current = '';

    const drawSkeleton = (landmarks: any[]) => {
      if (!canvasRef.current || !videoRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
      ];

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#D4AF37';
      connections.forEach(([s, e]) => {
        const a = landmarks[s];
        const b = landmarks[e];
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.stroke();
      });

      landmarks.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#228B22';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });
    };

    const detectGesture = (landmarks: any[]) => {
      const wrist = landmarks[0];
      const palmCenterX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
      const palmCenterY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;

      onHandPositionRef.current?.({ x: palmCenterX, y: palmCenterY, detected: true });

      // Pinch detection (thumb tip 4 + index tip 8), normalized by palm width
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const indexMcp = landmarks[5];
      const pinkyMcp = landmarks[17];
      const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
      const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
      const pinchRatio = pinchDist / Math.max(1e-6, palmWidth);
      const now = performance.now();

      const isPinched = pinchRatio < PINCH_RATIO_ON;
      const isReleased = pinchRatio > PINCH_RATIO_OFF;
      if (isPinched) {
        pinchFrames.current++;
        releaseFrames.current = 0;
      } else if (isReleased) {
        releaseFrames.current++;
        pinchFrames.current = 0;
      } else {
        pinchFrames.current = Math.max(0, pinchFrames.current - 1);
        releaseFrames.current = Math.max(0, releaseFrames.current - 1);
      }

      if (!pinchLatched.current && pinchFrames.current > PINCH_CONFIDENCE) {
        pinchLatched.current = true;
        pinchUiText.current = '捏合 → 下一张回忆';
        pinchUiUntil.current = now + 900;
        onPinchRef.current?.();
      } else if (pinchLatched.current && releaseFrames.current > PINCH_CONFIDENCE) {
        pinchLatched.current = false;
      }

      const fingerTips = [8, 12, 16, 20];
      const fingerBases = [5, 9, 13, 17];
      let extended = 0;

      for (let i = 0; i < 4; i++) {
        const tip = landmarks[fingerTips[i]];
        const base = landmarks[fingerBases[i]];
        const distTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
        const distBase = Math.hypot(base.x - wrist.x, base.y - wrist.y);
        if (distTip > distBase * 1.5) extended++;
      }

      const thumbBase = landmarks[2];
      const distThumbTip = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
      const distThumbBase = Math.hypot(thumbBase.x - wrist.x, thumbBase.y - wrist.y);
      if (distThumbTip > distThumbBase * 1.2) extended++;

      let baseStatus = '检测中…';
      if (extended >= 4) {
        openFrames.current++;
        closedFrames.current = 0;
        baseStatus = '检测：张开（散开）';
        if (openFrames.current > CONFIDENCE && lastMode.current !== TreeMode.CHAOS) {
          lastMode.current = TreeMode.CHAOS;
          onModeChangeRef.current(TreeMode.CHAOS);
        }
      } else if (extended <= 1) {
        closedFrames.current++;
        openFrames.current = 0;
        baseStatus = '检测：握拳（聚合）';
        if (closedFrames.current > CONFIDENCE && lastMode.current !== TreeMode.FORMED) {
          lastMode.current = TreeMode.FORMED;
          onModeChangeRef.current(TreeMode.FORMED);
        }
      } else {
        openFrames.current = 0;
        closedFrames.current = 0;
      }

      if (now < pinchUiUntil.current && pinchUiText.current) {
        setStatus(`${baseStatus} · ${pinchUiText.current}`);
      } else {
        setStatus(baseStatus);
      }
    };

    const predictWebcam = () => {
      rafId = requestAnimationFrame(predictWebcam);
      if (!handLandmarker || !videoRef.current) return;
      const now = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, now);
        if (result.landmarks?.length) {
          const landmarks = result.landmarks[0];
          drawSkeleton(landmarks);
          detectGesture(landmarks);
        } else {
          setStatus('未检测到手');
          onHandPositionRef.current?.({ x: 0.5, y: 0.5, detected: false });
          openFrames.current = 0;
          closedFrames.current = 0;
          pinchFrames.current = 0;
          releaseFrames.current = 0;
          pinchLatched.current = false;
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      }
    };

    const startWebcam = async (): Promise<boolean> => {
      if (!window.isSecureContext) {
        setStatus('摄像头需要 HTTPS（请用 https:// 打开）');
        return false;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('摄像头不可用');
        return false;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
        if (!videoRef.current) return false;
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // ignore (some browsers block autoplay even for muted video)
        }
        if (cancelled) return false;
        setReady(true);
        return true;
      } catch (err) {
        const domErr = err as { name?: string };
        if (domErr?.name === 'NotAllowedError') setStatus('摄像头权限被拒绝');
        else if (domErr?.name === 'NotFoundError') setStatus('未找到摄像头');
        else setStatus('摄像头错误');
        return false;
      }
    };

    const setup = async () => {
      try {
        setStatus('请求摄像头权限…');
        const cameraOk = await startWebcam();
        if (!cameraOk || cancelled) return;

        setStatus('加载手势模型…');
        const base = import.meta.env.BASE_URL || '/';
        const mediapipeBase = joinBase(base, 'mediapipe');
        const modelPath = joinBase(base, 'models/hand_landmarker.task');

        const isMobile =
          /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent || '') ||
          /iPad/i.test(navigator.userAgent || '') ||
          // iPadOS 13+ reports as Mac; detect touch
          (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);

        // Quick local asset probe so we can fail with a helpful message instead of hanging forever.
        try {
          const wasmProbe = await fetch(joinBase(mediapipeBase, 'vision_wasm_internal.wasm'), { method: 'HEAD' });
          const modelProbe = await fetch(modelPath, { method: 'HEAD' });
          if (!wasmProbe.ok || !modelProbe.ok) {
            throw new Error(`asset probe failed (wasm:${wasmProbe.status}, model:${modelProbe.status})`);
          }
        } catch {
          // keep going; resolver may still succeed (or CDN fallback may work)
        }

        let vision;
        try {
          vision = await withTimeout(FilesetResolver.forVisionTasks(mediapipeBase), 12_000, 'local wasm');
        } catch (localErr) {
          // CDN fallback, use same major/minor as the installed package to avoid version mismatch.
          const cdnBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm';
          vision = await withTimeout(FilesetResolver.forVisionTasks(cdnBase), 12_000, 'cdn wasm');
          // If CDN works but local doesn't, surface a hint (once we're stable).
          if (!cancelled) console.warn('mediapipe local wasm failed, using CDN', localErr);
        }
        if (cancelled) return;

        const preferredDelegate: 'GPU' | 'CPU' = isMobile ? 'CPU' : 'GPU';

        const createLandmarker = (delegate: 'GPU' | 'CPU') =>
          withTimeout(
            HandLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: modelPath, delegate },
            runningMode: 'VIDEO',
            numHands: 1
            }),
            18_000,
            `create ${delegate}`
          );

        try {
          handLandmarker = await createLandmarker(preferredDelegate);
        } catch {
          const fallbackDelegate: 'GPU' | 'CPU' = preferredDelegate === 'GPU' ? 'CPU' : 'GPU';
          handLandmarker = await createLandmarker(fallbackDelegate);
        }
        if (cancelled) return;

        setStatus('请把手放到镜头前…');
        rafId = requestAnimationFrame(predictWebcam);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (/timeout/i.test(message)) {
          setStatus('手势模型加载超时（请检查 /mediapipe 和 /models 是否可访问）');
        } else {
          setStatus('手势不可用');
        }
      }
    };

    setup();

    return () => {
      cleanup();
    };
  }, [enabled]);

  return (
    <div
      style={{
        position: 'absolute',
        right: 28,
        bottom: 28,
        zIndex: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.55)',
          color: '#D4AF37',
          fontSize: 11,
          letterSpacing: '1px',
          border: '1px solid rgba(212,175,55,0.35)',
          borderRadius: 6,
          pointerEvents: 'auto'
        }}
      >
        {status}
      </div>

      <div
        style={{
          position: 'relative',
          width: '220px',
          height: '150px',
          border: '1px solid rgba(212,175,55,0.4)',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#000',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          pointerEvents: 'auto'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)',
            opacity: ready ? 1 : 0,
            transition: 'opacity 0.6s ease'
          }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            transform: 'scaleX(-1)'
          }}
        />
      </div>
    </div>
  );
};
