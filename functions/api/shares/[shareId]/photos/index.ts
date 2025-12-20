import { badRequest, ok, photoObjectKey, photoUrlPath, readShare, writeShare } from '../../../_lib/shareStore';

export const onRequestPost = async (context: any) => {
  const env = context.env as any;
  const shareId = String(context.params?.shareId ?? '').trim();
  if (!shareId) return badRequest('缺少分享ID', 400);
  if (!env?.DB) return badRequest('服务端未配置数据库（D1）', 500);
  if (!env?.BUCKET) return badRequest('服务端未配置对象存储（R2）', 500);

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return badRequest('上传失败：无法读取表单数据', 400);
  }

  const thumb = form.get('thumb');
  const full = form.get('full');
  if (!(thumb instanceof File) || !(full instanceof File)) {
    return badRequest('上传失败：缺少图片数据（thumb/full）', 400);
  }

  const title = typeof form.get('title') === 'string' ? String(form.get('title')) : '回忆';
  const photoIdRaw = form.get('photoId');
  const photoId = typeof photoIdRaw === 'string' && photoIdRaw.trim() ? photoIdRaw.trim() : crypto.randomUUID();

  try {
    const doc = await readShare(env, shareId);
    if (!doc) return badRequest('分享不存在或已删除', 404);

    const thumbKey = photoObjectKey(shareId, photoId, 'thumb');
    const fullKey = photoObjectKey(shareId, photoId, 'full');

    await env.BUCKET.put(thumbKey, thumb, { httpMetadata: { contentType: thumb.type || 'image/jpeg' } });
    await env.BUCKET.put(fullKey, full, { httpMetadata: { contentType: full.type || 'image/jpeg' } });

    const entry = {
      id: photoId,
      src: photoUrlPath(shareId, photoId, 'thumb'),
      fullSrc: photoUrlPath(shareId, photoId, 'full'),
      title
    };

    const existingIdx = doc.photos.findIndex((p) => p.id === photoId);
    const nextPhotos = existingIdx >= 0 ? [...doc.photos] : [entry, ...doc.photos];
    if (existingIdx >= 0) nextPhotos[existingIdx] = entry;

    const nextDoc = {
      ...doc,
      updatedAt: Date.now(),
      photos: nextPhotos,
      notesByPhoto: { ...doc.notesByPhoto, [photoId]: doc.notesByPhoto?.[photoId] ?? '' },
      commentsByPhoto: { ...doc.commentsByPhoto, [photoId]: doc.commentsByPhoto?.[photoId] ?? [] }
    };

    await writeShare(env, nextDoc);
    return ok({ doc: nextDoc, photo: entry });
  } catch (err) {
    console.warn('upload photo failed', err);
    return badRequest('上传失败，请稍后再试', 500);
  }
};

