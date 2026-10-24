/** id 生成：与 store 内部约定一致（career=c / relation=r / reflection=f / account=a / holding=h）。 */
export function nextIdIn(list, kind) {
	const prefix = { career: 'c', relation: 'r', reflection: 'f', account: 'a', holding: 'h' }[kind];
	let max = 0;
	for (const entry of list) {
		const m = /^([a-z])(\d+)$/.exec(String(entry?.id ?? ''));
		if (m !== null && m[1] === prefix) max = Math.max(max, Number(m[2]));
	}
	return prefix + (max + 1);
}
