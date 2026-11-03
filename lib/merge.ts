/**
 * 记录合并（纯函数，无框架依赖）：
 * - 版本号 = updatedAt（毫秒）；缺失时回退到 timestamp / date（历史数据兼容）
 * - 严格比较：远端版本 **大于** 本地才采纳；相等时本地优先
 * - 本地待上行（dirty）或已删除（tombstone）的记录绝不覆盖
 * - 采纳远端时保留本地图片（缩略图），避免推送剥离图片后被空值覆盖
 */

export interface VersionedRecord {
  id: string;
  updatedAt?: number;
  timestamp?: string;
  date?: string;
  imageUrl?: string;
}

/** 记录版本：优先 updatedAt，其次 timestamp/date（兼容旧数据） */
export function recordVersion(record: VersionedRecord): number {
  if (
    typeof record.updatedAt === "number" &&
    Number.isFinite(record.updatedAt) &&
    record.updatedAt > 0
  ) {
    return record.updatedAt;
  }
  const iso = record.timestamp ?? (record.date ? `${record.date}T00:00:00` : undefined);
  const parsed = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 为缺失 updatedAt 的历史记录补版本号 */
export function backfillUpdatedAt<T extends VersionedRecord>(records: T[]): T[] {
  return records.map((record) =>
    record.updatedAt === undefined
      ? { ...record, updatedAt: recordVersion(record) }
      : record
  );
}

export interface MergeRecordOptions {
  /** 本地已修改、尚未上行的记录 id */
  dirtyIds?: string[];
  /** 本地已删除、待云端删除的记录 id */
  tombstoneIds?: string[];
}

/**
 * 合并远端记录到本地列表。
 * 返回新数组；采纳的远端记录会写入版本号并继承本地图片。
 */
export function mergeRecordList<T extends VersionedRecord>(
  local: T[],
  remote: T[],
  options: MergeRecordOptions = {}
): T[] {
  const dirty = new Set(options.dirtyIds ?? []);
  const tombstones = new Set(options.tombstoneIds ?? []);
  const byId = new Map<string, T>(local.map((record) => [record.id, record]));

  for (const incoming of remote) {
    if (!incoming?.id || tombstones.has(incoming.id)) continue;

    const current = byId.get(incoming.id);
    if (!current) {
      byId.set(incoming.id, {
        ...incoming,
        updatedAt: recordVersion(incoming),
      });
      continue;
    }

    // 本地有未上行修改：绝不覆盖，等待推送
    if (dirty.has(incoming.id)) continue;

    const remoteVersion = recordVersion(incoming);
    const localVersion = recordVersion(current);
    // 严格大于才采纳；相等时本地优先
    if (remoteVersion <= localVersion) continue;

    const hasImageField = "imageUrl" in incoming || "imageUrl" in current;
    byId.set(incoming.id, {
      ...incoming,
      updatedAt: remoteVersion,
      ...(hasImageField
        ? { imageUrl: incoming.imageUrl ?? current.imageUrl }
        : {}),
    });
  }

  return Array.from(byId.values());
}
