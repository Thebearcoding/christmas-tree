type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type ThemeKey = 'imperial' | 'frost' | 'berry';

type ThemeCustomizationStorage = {
  version: 1;
  enabledByThemeKey?: Partial<Record<ThemeKey, boolean>>;
  overridesByThemeKey?: Record<string, unknown>;
};

type PhotoEntry = {
  id: string;
  src: string;
  fullSrc: string;
  title: string;
};

type CommentEntry = {
  id: string;
  text: string;
  createdAt: number;
};

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

type Env = {
  DB?: {
    prepare: (query: string) => { bind: (...params: unknown[]) => { first: <T>() => Promise<T | null>; run: () => Promise<void> } };
  };
  BUCKET?: {
    put: (key: string, value: unknown, opts?: unknown) => Promise<void>;
    get: (key: string) => Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; etag?: string } | null>;
    delete: (keys: string[] | string) => Promise<void>;
    list: (opts: { prefix: string }) => Promise<{ objects: Array<{ key: string }> }>;
  };
};

export const json = (data: JsonValue, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
};

export const badRequest = (message: string, status = 400) => json({ ok: false, message }, { status });

export const ok = (payload: Record<string, JsonValue>, status = 200) => json({ ok: true, ...payload }, { status });

export const photoObjectKey = (shareId: string, photoId: string, kind: 'thumb' | 'full') => {
  return `shares/${shareId}/photos/${photoId}/${kind}.jpg`;
};

export const photoUrlPath = (shareId: string, photoId: string, kind: 'thumb' | 'full') => {
  return `/api/shares/${shareId}/photos/${photoId}/${kind}`;
};

const emptyThemeCustomization = (): ThemeCustomizationStorage => ({
  version: 1,
  enabledByThemeKey: {},
  overridesByThemeKey: {}
});

export const defaultShare = (shareId: string): ShareDocument => {
  const now = Date.now();
  return {
    version: 1,
    shareId,
    createdAt: now,
    updatedAt: now,
    themeKey: 'imperial',
    themeCustomization: emptyThemeCustomization(),
    photos: [],
    notesByPhoto: {},
    commentsByPhoto: {}
  };
};

const mergeUniqueComments = (base: CommentEntry[], incoming: CommentEntry[]) => {
  const seen = new Set(base.map((c) => c.id));
  const out = [...base];
  for (const c of incoming) {
    if (typeof c?.id !== 'string') continue;
    if (seen.has(c.id)) continue;
    if (typeof c.text !== 'string') continue;
    if (typeof c.createdAt !== 'number') continue;
    out.push(c);
    seen.add(c.id);
  }
  out.sort((a, b) => a.createdAt - b.createdAt);
  return out;
};

export const normalizeAndMerge = (doc: ShareDocument, patch: SharePatch): ShareDocument => {
  const next: ShareDocument = { ...doc, updatedAt: Date.now() };

  if (patch.action === 'resetShare') {
    next.themeKey = 'imperial';
    next.themeCustomization = emptyThemeCustomization();
    next.photos = [];
    next.notesByPhoto = {};
    next.commentsByPhoto = {};
    return next;
  }

  if (patch.themeKey) next.themeKey = patch.themeKey;
  if (patch.themeCustomization) next.themeCustomization = patch.themeCustomization;
  if (patch.photos) next.photos = patch.photos;

  if (patch.notesByPhoto) {
    next.notesByPhoto = { ...next.notesByPhoto, ...patch.notesByPhoto };
  }

  if (patch.commentsByPhoto) {
    const merged: Record<string, CommentEntry[]> = { ...next.commentsByPhoto };
    for (const [photoId, incoming] of Object.entries(patch.commentsByPhoto)) {
      if (!Array.isArray(incoming)) continue;
      const base = merged[photoId] ?? [];
      merged[photoId] = mergeUniqueComments(base, incoming as CommentEntry[]);
    }
    next.commentsByPhoto = merged;
  }

  return next;
};

export const readShare = async (env: Env, shareId: string): Promise<ShareDocument | null> => {
  const db = env.DB;
  if (!db) return null;
  const row = await db
    .prepare('SELECT doc_json as docJson FROM shares WHERE share_id = ?1 LIMIT 1')
    .bind(shareId)
    .first<{ docJson: string }>();
  if (!row?.docJson) return null;
  try {
    const parsed = JSON.parse(row.docJson) as ShareDocument;
    if (!parsed || parsed.version !== 1 || parsed.shareId !== shareId) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const writeShare = async (env: Env, doc: ShareDocument) => {
  const db = env.DB;
  if (!db) throw new Error('missing db');
  await db
    .prepare('UPDATE shares SET doc_json = ?2, updated_at = ?3 WHERE share_id = ?1')
    .bind(doc.shareId, JSON.stringify(doc), doc.updatedAt)
    .run();
};

export const createShare = async (env: Env, doc: ShareDocument) => {
  const db = env.DB;
  if (!db) throw new Error('missing db');
  await db
    .prepare('INSERT INTO shares (share_id, doc_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(doc.shareId, JSON.stringify(doc), doc.createdAt, doc.updatedAt)
    .run();
};

