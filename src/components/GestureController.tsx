import { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandPosition } from '../types';
import { TreeMode } from '../types';

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
  const [status, setStatus] = useState('Initializing gesture AI...');
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
    let handLandmarker: HandLandmarker | null = null;
    let rafId = 0;
    let stream: MediaStream | null = null;

    const cleanup = () => {
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
      setStatus('Gesture off');
      onHandPositionRef.current?.({ x: 0.5, y: 0.5, detected: false });
      cleanup();
      return cleanup;
    }

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
        pinchUiText.current = 'Pinch → Next Memory';
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

      let baseStatus = 'Detected: ...';
      if (extended >= 4) {
        openFrames.current++;
        closedFrames.current = 0;
        baseStatus = 'Detected: OPEN (Unleash)';
        if (openFrames.current > CONFIDENCE && lastMode.current !== TreeMode.CHAOS) {
          lastMode.current = TreeMode.CHAOS;
          onModeChangeRef.current(TreeMode.CHAOS);
        }
      } else if (extended <= 1) {
        closedFrames.current++;
        openFrames.current = 0;
        baseStatus = 'Detected: CLOSED (Restore)';
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
      if (!handLandmarker || !videoRef.current) return;
      const now = performance.now();
      if (videoRef.current.videoWidth > 0) {
        const result = handLandmarker.detectForVideo(videoRef.current, now);
        if (result.landmarks?.length) {
          const landmarks = result.landmarks[0];
          drawSkeleton(landmarks);
          detectGesture(landmarks);
        } else {
          setStatus('No hand detected');
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
      rafId = requestAnimationFrame(predictWebcam);
    };

    const startWebcam = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('Camera unavailable');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
        setReady(true);
        setStatus('Waiting for hand...');
      } catch (err) {
        setStatus('Permission denied');
      }
    };

    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1
        });
        startWebcam();
      } catch (err) {
        setStatus('Gesture unavailable');
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
