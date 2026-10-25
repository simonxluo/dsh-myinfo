/**
 * id 生成（单一来源）：前缀 c/r/f/a/h + 序号。
 * 序号取 max(列表当前最大, meta.idSeq 水位线) + 1 并回写水位线——
 * 删除最大 id 条目后新条目不会复用旧 id，避免外部引用歧义（design.md §3.2）。
 */
const PREFIX = { career: 'c', relation: 'r', reflection: 'f', account: 'a', holding: 'h' };

export function nextIdIn(list, kind, meta) {
	const prefix = PREFIX[kind];
	if (prefix === undefined) throw new Error(`unknown id kind: ${kind}`);
	let max = 0;
	for (const entry of list) {
		const m = /^([a-z])(\d+)$/.exec(String(entry?.id ?? ''));
		if (m !== null && m[1] === prefix) max = Math.max(max, Number(m[2]));
	}
	const seq = (meta && typeof meta.idSeq === 'object' && meta.idSeq !== null) ? meta.idSeq : {};
	const waterline = Number(seq[prefix]) || 0;
	const next = Math.max(max, waterline) + 1;
	if (meta && typeof meta === 'object') {
		if (meta.idSeq === null || typeof meta.idSeq !== 'object') meta.idSeq = {};
		meta.idSeq[prefix] = next;
	}
	return prefix + next;
}
