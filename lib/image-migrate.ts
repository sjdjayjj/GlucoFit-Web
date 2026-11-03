/**
 * 历史图片迁移：把 localStorage 中的大体积 Base64 原图转存 IndexedDB，
 * store 内只保留缩略图，降低持久化体积与配额风险。
 * 单条失败不阻断整体流程；IndexedDB 不可用时保持原样（降级）。
 */

import { useGlucoFitStore } from "@/lib/storage";
import { downscaleDataUrl } from "@/lib/image";
import { isIndexedDbAvailable, putFullImage } from "@/lib/image-idb";

/** 超过该长度的 dataURL 视为原图（正常缩略图约 5-12KB） */
const FULL_IMAGE_THRESHOLD = 20_000;

export async function migrateLegacyImages(): Promise<number> {
  if (!isIndexedDbAvailable()) return 0;

  const state = useGlucoFitStore.getState();
  const targets: Array<{ id: string; dataUrl: string }> = [];
  for (const log of state.mealLogs) {
    if (log.imageUrl && log.imageUrl.length > FULL_IMAGE_THRESHOLD) {
      targets.push({ id: log.id, dataUrl: log.imageUrl });
    }
  }
  for (const record of state.bodyRecords) {
    if (record.imageUrl && record.imageUrl.length > FULL_IMAGE_THRESHOLD) {
      targets.push({ id: record.id, dataUrl: record.imageUrl });
    }
  }
  if (!targets.length) return 0;

  const thumbnails = new Map<string, string>();
  for (const target of targets) {
    try {
      const thumb = await downscaleDataUrl(target.dataUrl, 160, 0.6);
      const stored = await putFullImage(target.id, target.dataUrl);
      if (stored && thumb.length < target.dataUrl.length) {
        thumbnails.set(target.id, thumb);
      }
    } catch {
      // 单张图片损坏/解码失败：保留原样
    }
  }
  if (!thumbnails.size) return 0;

  useGlucoFitStore.setState((s) => ({
    mealLogs: s.mealLogs.map((log) =>
      thumbnails.has(log.id) ? { ...log, imageUrl: thumbnails.get(log.id) } : log
    ),
    bodyRecords: s.bodyRecords.map((record) =>
      thumbnails.has(record.id)
        ? { ...record, imageUrl: thumbnails.get(record.id) }
        : record
    ),
  }));

  return thumbnails.size;
}
