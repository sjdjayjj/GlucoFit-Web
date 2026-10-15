/**
 * 内存级滑动窗口限流（仅服务端使用）：
 * 单实例部署下可防暴力撞库；serverless 多实例时各实例独立计数，属尽力而为。
 * windowMs 内超过 limit 次请求返回 false。
 */

const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // 防内存膨胀：桶数超限时清理已过期条目（forEach 兼容低 target，迭代中删除安全）
  if (buckets.size > 10_000) {
    buckets.forEach((v, k) => {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    });
  }
  return true;
}

/** 从代理头提取客户端 IP（无代理头时退化为固定 key，限流全局共享） */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}
