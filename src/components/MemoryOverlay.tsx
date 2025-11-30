import { useLayoutEffect, useRef } from 'react';
import type { CommentEntry, PhotoEntry, Theme } from '../types';

type Props = {
  photo: PhotoEntry | null;
  state: 'idle' | 'enter' | 'active' | 'exit';
  origin: { x: number; y: number } | null;
  theme: Theme;
  note: string;
  onNoteChange: (text: string) => void;
  comments: CommentEntry[];
  commentDraft: string;
  onCommentChange: (text: string) => void;
  onSubmitComment: () => void;
  onClose: () => void;
  cardAnchor?: { x: number; y: number } | null;
  onAnchorChange?: (pos: { x: number; y: number } | null) => void;
};

export const MemoryOverlay: React.FC<Props> = ({
  photo,
  state,
  origin,
  theme,
  note,
  onNoteChange,
  comments,
  commentDraft,
  onCommentChange,
  onSubmitComment,
  onClose,
  cardAnchor,
  onAnchorChange
}) => {
  if (!photo || state === 'idle') return null;

  const centerOrigin = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const anchor = cardAnchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const translateX = centerOrigin.x - anchor.x;
  const translateY = centerOrigin.y - anchor.y;
  const scaleFrom = 0.3;
  const imageRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!imageRef.current || !onAnchorChange || state === 'exit') return;
    const measure = () => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (rect) {
        onAnchorChange({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(imageRef.current);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [onAnchorChange, state]);
  const isActive = state === 'active';
  const isExiting = state === 'exit';

  const baseCenter = 'translate(-50%, -50%)';
  const cardTransform = isActive ? `${baseCenter} translate3d(0,0,0) scale(1)` : `${baseCenter} translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleFrom})`;
  const backdropOpacity = isActive ? 0.45 : 0;
  const cardOpacity = isActive ? 1 : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'auto' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255,215,0,0.12), transparent 40%), rgba(0,0,0,0.7)',
          opacity: backdropOpacity,
          transition: 'opacity 0.45s ease'
        }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: cardTransform,
          opacity: cardOpacity,
          transition: isExiting
            ? 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease'
            : 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease',
          transformOrigin: 'center center',
          width: '82vw',
          maxWidth: '1100px',
          maxHeight: '80vh',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.9fr)',
          gap: '18px',
          padding: '18px',
          background: 'rgba(10,10,10,0.55)',
          border: `1px solid ${theme.gold}40`,
          borderRadius: '18px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(14px)'
        }}
      >
        <div
          ref={imageRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '88%',
              maxWidth: '520px',
              aspectRatio: '0.72',
              background: '#fdfdfd',
              borderRadius: 12,
              boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
              padding: '12px 12px 26px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.08)'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 10,
                width: '38%',
                height: 6,
                left: '31%',
                background: '#d4af37',
                borderRadius: 4,
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))'
              }}
            />
            <div style={{ flex: 1, borderRadius: 10, overflow: 'hidden', background: '#0f172a', display: 'flex' }}>
              <img
                src={photo.fullSrc || photo.src}
                alt={photo.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ textAlign: 'center', fontSize: 15, color: '#111827', letterSpacing: '0.12em', fontWeight: 800 }}>
              {photo.title || 'Memory'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: theme.gold }}>
                Memory Studio
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f7f2e8', lineHeight: 1.2 }}>{photo.title}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                返回树
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  borderRadius: 12,
                  width: 40,
                  height: 40,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, letterSpacing: '1px', color: '#d9d9d9' }}>心情 / 记录</label>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="写下这一刻的心情、地点或人..."
              style={{
                width: '100%',
                minHeight: 90,
                padding: 10,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${theme.gold}30`,
                color: '#f7f2e8',
                borderRadius: 10,
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: 12, letterSpacing: '1px', color: '#d9d9d9' }}>回忆评论</div>
            <div
              style={{
                flex: 1,
                minHeight: 120,
                maxHeight: 200,
                overflowY: 'auto',
                paddingRight: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              {comments.length === 0 && <div style={{ fontSize: 12, color: '#9a9a9a' }}>还没有评论，留下你的祝福吧。</div>}
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div style={{ fontSize: 12, color: '#d0d0d0' }}>{comment.text}</div>
                  <div style={{ fontSize: 10, color: '#8f8f8f', marginTop: 4 }}>{new Date(comment.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={commentDraft}
                onChange={(e) => onCommentChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSubmitComment();
                  }
                }}
                placeholder="输入祝福或想说的话..."
                style={{
                  flex: 1,
                  padding: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${theme.gold}30`,
                  color: '#f7f2e8',
                  borderRadius: 10,
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={onSubmitComment}
                style={{
                  padding: '10px 12px',
                  background: `linear-gradient(135deg, ${theme.gold}, #fff7d1)`,
                  border: 'none',
                  color: '#000',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  borderRadius: 10,
                  cursor: 'pointer'
                }}
              >
                送出
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
