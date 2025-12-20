import { createShare, defaultShare, ok, badRequest } from '../_lib/shareStore';

export const onRequestPost = async (context: any) => {
  const env = context.env as any;
  if (!env?.DB) return badRequest('服务端未配置数据库（D1）', 500);

  const shareId = crypto.randomUUID();
  const doc = defaultShare(shareId);

  try {
    await createShare(env, doc);
    return ok({ shareId, doc });
  } catch (err) {
    console.warn('create share failed', err);
    return badRequest('创建分享失败，请稍后再试', 500);
  }
};
