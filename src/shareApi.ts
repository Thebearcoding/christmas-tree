import type { PhotoEntry, ShareDocument, SharePatch } from './types';

const SHARE_QUERY_KEY = 's';

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; message: string };
type ApiResponse<T> = ApiOk<T> | ApiErr;

const parseResponseJson = async <T>(response: Response): Promise<ApiResponse<T>> => {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return { ok: false, message: '服务返回不是 JSON' };
  }
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
  const data = await parseResponseJson<T>(response);
  if (!response.ok || !data.ok) {
    const message = (data as ApiErr).message || `请求失败（${response.status}）`;
    throw new Error(message);
  }
  const okData = data as ApiOk<T>;
  const { ok: _ok, ...rest } = okData;
  return rest as T;
};

export const getShareIdFromLocation = (): string | null => {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get(SHARE_QUERY_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
};

export const buildShareUrl = (shareId: string): string => {
  const url = new URL(window.location.href);
  url.searchParams.set(SHARE_QUERY_KEY, shareId);
  return url.toString();
};

export const clearShareFromUrl = (): string => {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_QUERY_KEY);
  return `${url.pathname}${url.search}${url.hash}`;
};

export const createShare = async (): Promise<{ shareId: string; doc: ShareDocument }> => {
  return await requestJson<{ shareId: string; doc: ShareDocument }>('/api/shares', {
    method: 'POST'
  });
};

export const fetchShare = async (shareId: string): Promise<{ doc: ShareDocument }> => {
  return await requestJson<{ doc: ShareDocument }>(`/api/shares/${encodeURIComponent(shareId)}`, {
    method: 'GET'
  });
};

export const patchShare = async (shareId: string, patch: SharePatch): Promise<{ doc: ShareDocument }> => {
  return await requestJson<{ doc: ShareDocument }>(`/api/shares/${encodeURIComponent(shareId)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch)
  });
};

export const deleteShare = async (shareId: string): Promise<{ shareId: string }> => {
  return await requestJson<{ shareId: string }>(`/api/shares/${encodeURIComponent(shareId)}`, {
    method: 'DELETE'
  });
};

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return await response.blob();
};

export const uploadSharePhoto = async (shareId: string, payload: { photoId: string; title: string; thumb: Blob; full: Blob }): Promise<{ doc: ShareDocument; photo: PhotoEntry }> => {
  const form = new FormData();
  form.set('photoId', payload.photoId);
  form.set('title', payload.title);
  form.set('thumb', new File([payload.thumb], 'thumb.jpg', { type: 'image/jpeg' }));
  form.set('full', new File([payload.full], 'full.jpg', { type: 'image/jpeg' }));

  return await requestJson<{ doc: ShareDocument; photo: PhotoEntry }>(`/api/shares/${encodeURIComponent(shareId)}/photos`, {
    method: 'POST',
    body: form
  });
};

export const deleteSharePhoto = async (shareId: string, photoId: string): Promise<{ doc: ShareDocument; photoId: string }> => {
  return await requestJson<{ doc: ShareDocument; photoId: string }>(
    `/api/shares/${encodeURIComponent(shareId)}/photos/${encodeURIComponent(photoId)}`,
    { method: 'DELETE' }
  );
};

