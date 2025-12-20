import { badRequest, photoObjectKey } from '../../../../_lib/shareStore';

export const onRequestGet = async (context: any) => {
  const env = context.env as any;
  const shareId = String(context.params?.shareId ?? '').trim();
  const photoId = String(context.params?.photoId ?? '').trim();
  const kind = String(context.params?.kind ?? '').trim();
  if (!shareId || !photoId) return badRequest('缺少参数', 400);
  if (kind !== 'thumb' && kind !== 'full') return badRequest('无效的图片类型', 400);
  if (!env?.BUCKET) return badRequest('服务端未配置对象存储（R2）', 500);

  try {
    const key = photoObjectKey(shareId, photoId, kind);
    const obj = await env.BUCKET.get(key);
    if (!obj) return badRequest('图片不存在或已删除', 404);
    const headers = new Headers();
    headers.set('content-type', obj.httpMetadata?.contentType ?? 'image/jpeg');
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    if (obj.etag) headers.set('etag', obj.etag);
    return new Response(obj.body, { headers, status: 200 });
  } catch (err) {
    console.warn('serve photo failed', err);
    return badRequest('读取图片失败', 500);
  }
};

