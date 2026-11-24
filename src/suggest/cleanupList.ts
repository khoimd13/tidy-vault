import type { Decision, PhotoItem } from '../shared/types';

export interface CleanupEntry {
  item: PhotoItem;
  decision: Decision;
}

/** Items the person confirmed as clutter, grouped by category, oldest first. */
export function buildCleanupList(
  items: readonly PhotoItem[],
  decisions: ReadonlyMap<string, Decision>,
): Map<string, CleanupEntry[]> {
  const groups = new Map<string, CleanupEntry[]>();
  for (const item of items) {
    const decision = decisions.get(item.id);
    if (decision?.kind !== 'clutter') continue;
    const list = groups.get(decision.categoryId) ?? [];
    list.push({ item, decision });
    groups.set(decision.categoryId, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.item.takenAt ?? '9999').localeCompare(b.item.takenAt ?? '9999'));
  }
  return groups;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(entries: readonly CleanupEntry[]): string {
  const header = ['id', 'link', 'date', 'category'];
  const rows = entries.map(({ item, decision }) =>
    [item.id, item.url, item.takenAt ?? '', decision.categoryId].map(csvCell).join(','),
  );
  return [header.join(','), ...rows].join('\n') + '\n';
}
