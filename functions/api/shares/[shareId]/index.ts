import { badRequest, normalizeAndMerge, ok, readShare, writeShare } from '../../_lib/shareStore';

export const onRequestGet = async (context: any) => {
  const env = context.env as any;
  const shareId = String(context.params?.shareId ?? '').trim();
  if (!shareId) return badRequest('缺少分享ID', 400);

  try {
    const doc = await readShare(env, shareId);
    if (!doc) return badRequest('分享不存在或已删除', 404);
    return ok({ doc });
  } catch (err) {
    console.warn('get share failed', err);
    return badRequest('读取分享失败，请稍后再试', 500);
  }
};

export const onRequestPatch = async (context: any) => {
  const env = context.env as any;
  const shareId = String(context.params?.shareId ?? '').trim();
  if (!shareId) return badRequest('缺少分享ID', 400);
  if (!env?.DB) return badRequest('服务端未配置数据库（D1）', 500);

  let patch: any = null;
  try {
    patch = await context.request.json();
  } catch {
    return badRequest('请求内容不是有效的 JSON', 400);
  }

  try {
    const doc = await readShare(env, shareId);
    if (!doc) return badRequest('分享不存在或已删除', 404);
    if (patch?.action === 'resetShare' && env.BUCKET?.list && env.BUCKET?.delete) {
      const prefix = `shares/${shareId}/photos/`;
      const listed = await env.BUCKET.list({ prefix });
      const keys = (listed?.objects ?? []).map((o: any) => o.key).filter(Boolean);
      if (keys.length) await env.BUCKET.delete(keys);
    }
    const next = normalizeAndMerge(doc, patch);
    await writeShare(env, next);
    return ok({ doc: next });
  } catch (err) {
    console.warn('patch share failed', err);
    return badRequest('保存失败，请稍后再试', 500);
  }
};

export const onRequestDelete = async (context: any) => {
  const env = context.env as any;
  const shareId = String(context.params?.shareId ?? '').trim();
  if (!shareId) return badRequest('缺少分享ID', 400);
  if (!env?.DB) return badRequest('服务端未配置数据库（D1）', 500);

  try {
    // Best-effort: delete objects first to avoid orphaned blobs.
    if (env.BUCKET?.list && env.BUCKET?.delete) {
      const prefix = `shares/${shareId}/photos/`;
      const listed = await env.BUCKET.list({ prefix });
      const keys = (listed?.objects ?? []).map((o: any) => o.key).filter(Boolean);
      if (keys.length) await env.BUCKET.delete(keys);
    }

    await env.DB.prepare('DELETE FROM shares WHERE share_id = ?1').bind(shareId).run();
    return ok({ shareId });
  } catch (err) {
    console.warn('delete share failed', err);
    return badRequest('删除分享失败，请稍后再试', 500);
  }
};
