import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CommentEntry, PhotoEntry, Theme } from '../types';

type Props = {
  photo: PhotoEntry | null;
  state: 'idle' | 'enter' | 'active' | 'exit';
  origin: { x: number; y: number } | null;
  theme: Theme;
  onTitleCommit: (photoId: string, title: string) => void;
  note: string;
  onNoteChange: (text: string) => void;
  comments: CommentEntry[];
  commentDraft: string;
  onCommentChange: (text: string) => void;
  onSubmitComment: () => void;
  onClose: () => void;
  cardAnchor?: { x: number; y: number; width?: number; height?: number } | null;
  onAnchorChange?: (pos: { x: number; y: number; width: number; height: number } | null) => void;
};

export const MemoryOverlay: React.FC<Props> = ({
  photo,
  state,
  origin,
  theme,
  onTitleCommit,
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
  const shouldRender = !!photo && state !== 'idle';
  const [narrowLayout, setNarrowLayout] = useState(() => window.innerWidth < 860);
  const [titleDraft, setTitleDraft] = useState('');

  const centerOrigin = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const anchor = cardAnchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const translateX = centerOrigin.x - anchor.x;
  const translateY = centerOrigin.y - anchor.y;
  const scaleFrom = 0.3;
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!photo) return;
    setTitleDraft(photo.title ?? '');
  }, [photo?.id]);

  useLayoutEffect(() => {
    if (!shouldRender || !imageRef.current || !onAnchorChange || state === 'exit') return;
    const measure = () => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (rect) {
        onAnchorChange({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height
        });
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
  }, [onAnchorChange, shouldRender, state]);

  useLayoutEffect(() => {
    if (!shouldRender || state === 'exit') return;
    const onResize = () => setNarrowLayout(window.innerWidth < 860);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [shouldRender, state]);

  if (!shouldRender || !photo) return null;

  const isActive = state === 'active';
  const isExiting = state === 'exit';

  const baseCenter = 'translate(-50%, -50%)';
  const cardTransform = isActive ? `${baseCenter} translate3d(0,0,0) scale(1)` : `${baseCenter} translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleFrom})`;
  const backdropOpacity = isActive ? 0.45 : 0;
  const cardOpacity = isActive ? 1 : 0;

  const commitTitle = () => {
    if (!photo) return;
    const next = titleDraft.trim();
    if (next === photo.title) return;
    onTitleCommit(photo.id, next);
  };

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
          width: narrowLayout ? '92vw' : '82vw',
          maxWidth: '1100px',
          maxHeight: narrowLayout ? '86vh' : '80vh',
          display: 'grid',
          gridTemplateColumns: narrowLayout ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(320px, 0.9fr)',
          gap: narrowLayout ? '14px' : '18px',
          padding: narrowLayout ? '14px' : '18px',
          background: 'linear-gradient(180deg, rgba(18,18,18,0.66), rgba(8,8,8,0.52))',
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
              width: '92%',
              maxWidth: '560px',
              aspectRatio: '0.72',
              background: theme.paper,
              borderRadius: 16,
              boxShadow: '0 26px 70px rgba(0,0,0,0.6)',
              padding: '14px 14px 44px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden',
              border: '1px solid rgba(0,0,0,0.14)',
              transform: 'rotate(-1.2deg)'
            }}
          >
            {/* paper texture + subtle edge shading */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 16,
                pointerEvents: 'none',
                backgroundImage:
                  'radial-gradient(circle at 18% 12%, rgba(0,0,0,0.08), transparent 42%), radial-gradient(circle at 84% 76%, rgba(0,0,0,0.06), transparent 45%), repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 4px), linear-gradient(180deg, rgba(255,255,255,0.42), rgba(0,0,0,0.02))',
                opacity: 0.35
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 16,
                pointerEvents: 'none',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -10px 24px rgba(0,0,0,0.08)'
              }}
            />
            <div
              style={{
                flex: 1,
                borderRadius: 14,
                overflow: 'hidden',
                background: '#0b0f17',
                display: 'flex',
                border: '1px solid rgba(0,0,0,0.18)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)'
              }}
            >
              <img
                src={photo.fullSrc || photo.src}
                alt={photo.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div
              style={{
                textAlign: 'center',
                fontSize: 15,
                color: theme.ink,
                letterSpacing: '0.12em',
                fontWeight: 900,
                textShadow: '0 1px 0 rgba(255,255,255,0.55)'
              }}
            >
              {photo.title || '回忆'}
            </div>
          </div>
        </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: '2px', textTransform: 'uppercase', color: theme.gold }}>
                  回忆工坊
                </div>
                <input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitTitle();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setTitleDraft(photo.title ?? '');
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="给这段回忆起个名字…"
                  style={{
                    width: 'min(420px, 60vw)',
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#f7f2e8',
                    lineHeight: 1.2,
                    padding: '6px 10px',
                    borderRadius: 12,
                    border: `1px solid ${theme.gold}35`,
                    background: 'rgba(0,0,0,0.28)',
                    outline: 'none'
                  }}
                />
	            </div>
	            <div style={{ display: 'flex', gap: 8 }}>
	              <button
	                onClick={onClose}
	                aria-label="返回树"
	                title="返回树"
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

          {/* Note */}
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(90deg, rgba(212,175,55,0.16), rgba(0,0,0,0))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ fontSize: 12, letterSpacing: '1px', color: '#f0e6d2', fontWeight: 800 }}>回忆主题</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>心情 / 地点 / 人</div>
            </div>
            <div style={{ padding: 12 }}>
              <textarea
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="写下这一刻的心情、地点或人…"
                style={{
                  width: '100%',
                  minHeight: 110,
                  padding: 12,
                  background: 'rgba(0,0,0,0.28)',
                  border: `1px solid ${theme.gold}35`,
                  color: '#f7f2e8',
                  borderRadius: 12,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                }}
              />
            </div>
          </div>

          {/* Comments */}
          <div
            style={{
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.28)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(90deg, rgba(212,175,55,0.12), rgba(0,0,0,0))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div style={{ fontSize: 12, letterSpacing: '1px', color: '#f0e6d2', fontWeight: 800 }}>回忆评论</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{comments.length} 条</div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 140,
                overflowY: 'auto',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              {comments.length === 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: '1px dashed rgba(255,255,255,0.14)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.03)'
                  }}
                >
                  还没有评论，留下你的祝福吧。
                </div>
              )}
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div style={{ fontSize: 12, color: '#f1eee6', lineHeight: 1.5 }}>{comment.text}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
                    {new Date(comment.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.22)' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={commentDraft}
                  onChange={(e) => onCommentChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSubmitComment();
                    }
                  }}
                  placeholder="输入祝福或想说的话…"
                  style={{
                    flex: 1,
                    padding: 12,
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${theme.gold}35`,
                    color: '#f7f2e8',
                    borderRadius: 12,
                    fontFamily: 'inherit',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                  }}
                />
                <button
                  onClick={onSubmitComment}
                  style={{
                    padding: '12px 14px',
                    background: `linear-gradient(135deg, ${theme.gold}, #fff7d1)`,
                    border: 'none',
                    color: '#000',
                    fontFamily: 'inherit',
                    fontWeight: 900,
                    borderRadius: 12,
                    cursor: 'pointer',
                    boxShadow: '0 14px 34px rgba(212,175,55,0.25)'
                  }}
                >
                  送出
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
