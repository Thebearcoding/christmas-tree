import { badRequest, ok, photoObjectKey, readShare, writeShare } from '../../../../_lib/shareStore';

export const onRequestDelete = async (context: any) => {
  const env = context.env as any;
  const shareId = String(context.params?.shareId ?? '').trim();
  const photoId = String(context.params?.photoId ?? '').trim();
  if (!shareId || !photoId) return badRequest('缺少参数', 400);
  if (!env?.DB) return badRequest('服务端未配置数据库（D1）', 500);
  if (!env?.BUCKET) return badRequest('服务端未配置对象存储（R2）', 500);

  try {
    const doc = await readShare(env, shareId);
    if (!doc) return badRequest('分享不存在或已删除', 404);

    const nextDoc = {
      ...doc,
      updatedAt: Date.now(),
      photos: doc.photos.filter((p) => p.id !== photoId),
      notesByPhoto: Object.fromEntries(Object.entries(doc.notesByPhoto ?? {}).filter(([id]) => id !== photoId)),
      commentsByPhoto: Object.fromEntries(Object.entries(doc.commentsByPhoto ?? {}).filter(([id]) => id !== photoId))
    };

    const keys = [photoObjectKey(shareId, photoId, 'thumb'), photoObjectKey(shareId, photoId, 'full')];
    await env.BUCKET.delete(keys);
    await writeShare(env, nextDoc);
    return ok({ doc: nextDoc, photoId });
  } catch (err) {
    console.warn('delete photo failed', err);
    return badRequest('删除失败，请稍后再试', 500);
  }
};

