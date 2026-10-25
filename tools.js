/**
 * dsh-myinfo — agent 工具：personal_identity / personal_career /
 * personal_relations / personal_reflections / personal_assets，外加一次性
 * 摘要工具 personal_context（对话中实时拉取用户个人上下文）。
 *
 * 工具是档案的唯一写入方之一（另一方是设置页面板）；两者共用 store.js
 * 的校验与 mutate 事务。list/get 返回结构化 JSON，render 同时给出可读
 * 的 Markdown 摘要。
 */
import {
	StoreError, accountEntry, careerEntry, holdingEntry, identityPatch,
	loadProfile, mutate, profileView, reflectionEntry, relationEntry, validId,
} from './store.js';
import { nextIdIn } from './ids.js';

const OBJ_SCHEMA = { type: 'object', additionalProperties: true };

function block(text) {
	return [{ type: 'text', text }];
}

function str(args, key) {
	return typeof args[key] === 'string' ? args[key].trim() : '';
}

function fmtMoney(value, currency = 'CNY') {
	if (value === null || value === undefined) return '—';
	const symbol = currency === 'CNY' ? '¥' : currency + ' ';
	return symbol + Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

function renderIdentity(view) {
	const id = view.identity;
	const rows = [
		['姓名', id.name], ['性别', id.gender], ['出生日期', id.birthDate],
		['年龄', id.age === null ? '' : `${id.age} 岁`], ['出生地', id.birthplace],
		['归属地', id.origin], ['现居地', id.residence], ['电话', id.phone], ['邮箱', id.email],
	];
	const lines = ['### 基本信息'];
	for (const [label, value] of rows) if (value) lines.push(`- **${label}**：${value}`);
	if (id.notes) lines.push(`- 备注：${id.notes}`);
	if (lines.length === 1) lines.push('（尚未填写，用 personal_identity 的 patch 动作录入）');
	return lines.join('\n');
}

function periodOf(entry) {
	return entry.endDate ? `${entry.startDate} ~ ${entry.endDate}` : `${entry.startDate} 至今`;
}

function salaryOf(entry) {
	const s = entry.salary ?? {};
	if (s.amount === null || s.amount === undefined) return '';
	const unit = { monthly: '/月', annual: '/年', hourly: '/时', total: '合计', other: '' }[s.period] ?? '';
	return fmtMoney(s.amount, s.currency) + unit + (s.notes ? `（${s.notes}）` : '');
}

function renderCareer(view) {
	if (view.career.length === 0) return '### 工作经历\n（空，用 personal_career 的 add 动作录入）';
	const lines = ['### 工作经历'];
	for (const entry of view.career) {
		const parts = [entry.company, entry.title, entry.location].filter(Boolean).join(' · ');
		lines.push(`- **${parts}**${entry.current ? '（在职）' : ''}`);
		lines.push(`  ${periodOf(entry)}${salaryOf(entry) ? ' · ' + salaryOf(entry) : ''}`);
		if (entry.content) lines.push(`  ${entry.content.replace(/\n/g, ' ').slice(0, 120)}`);
	}
	return lines.join('\n');
}

function renderRelations(view) {
	if (view.relations.length === 0) return '### 周围的人\n（空，用 personal_relations 的 add 动作录入）';
	const lines = ['### 周围的人'];
	for (const entry of view.relations) {
		const tags = (entry.tags ?? []).length > 0 ? ` [${entry.tags.join(', ')}]` : '';
		lines.push(`- **${entry.name}** — ${entry.relation}（${entry.group}）${tags}`);
		if (entry.contact) lines.push(`  联系方式：${entry.contact}`);
		if (entry.notes) lines.push(`  ${entry.notes.replace(/\n/g, ' ').slice(0, 120)}`);
	}
	return lines.join('\n');
}

function renderReflections(view) {
	if (view.reflections.length === 0) return '### 人生感悟\n（空，用 personal_reflections 的 add 动作按日期记录）';
	const lines = ['### 人生感悟（按时间倒序）'];
	let year = '';
	for (const entry of view.reflections) {
		const y = entry.date.slice(0, 4);
		if (y !== year) {
			year = y;
			lines.push(`\n**${y}**`);
		}
		const title = entry.title ? `《${entry.title}》` : '';
		const tags = (entry.tags ?? []).length > 0 ? ` [${entry.tags.join(', ')}]` : '';
		lines.push(`- ${entry.date} ${title}${tags}`);
		lines.push(`  ${entry.content.replace(/\n/g, ' ').slice(0, 140)}`);
	}
	return lines.join('\n');
}

function renderAssets(view) {
	const lines = ['### 资产台账'];
	const { accounts, holdings, totals } = view.assets;
	if (accounts.length === 0 && holdings.length === 0) {
		lines.push('（空，用 personal_assets 的 save-account / save-holding 动作录入）');
		return lines.join('\n');
	}
	const byKind = { bank: '银行卡', pay: '支付软件', stock: '股票账户' };
	for (const kind of ['bank', 'pay', 'stock']) {
		const list = accounts.filter((x) => x.kind === kind);
		if (list.length === 0) continue;
		lines.push(`\n**${byKind[kind]}**`);
		for (const account of list) {
			const mask = account.mask ? `（${account.mask}）` : '';
			lines.push(`- ${account.name}${mask}：${fmtMoney(account.balance, account.currency)}${account.notes ? ' · ' + account.notes : ''}`);
		}
	}
	if (holdings.length > 0) {
		lines.push('\n**持仓明细**');
		const accountName = new Map(accounts.map((x) => [x.id, x.name + (x.mask ? `（${x.mask}）` : '')]));
		for (const holding of holdings) {
			const price = holding.price ?? holding.costPrice;
			const value = price === null || price === undefined ? null : Math.round(holding.shares * price * 100) / 100;
			lines.push(
				`- ${accountName.get(holding.account) ?? holding.account} · ${holding.code}${holding.name ? ' ' + holding.name : ''}：`
				+ `${holding.shares} 股，成本 ${holding.costPrice === null ? '—' : holding.costPrice}，`
				+ `现价 ${holding.price === null || holding.price === undefined ? '—' : holding.price}`
				+ (value === null ? '' : `，市值 ${fmtMoney(value)}`),
			);
		}
	}
	for (const [currency, bucket] of Object.entries(totals.totals ?? {})) {
		lines.push(`\n**合计（${currency}）**：现金 ${fmtMoney(bucket.bank + bucket.pay)} + 股票账户 ${fmtMoney(bucket.stock)} + 持仓市值 ${fmtMoney(bucket.holdings)} = **${fmtMoney(bucket.grand)}**`);
	}
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 个人上下文摘要（personal_context）：一次调用给全对话所需的背景
// ---------------------------------------------------------------------------

/** 把完整档案压成对话可用的上下文摘要（身份 / 在职 / 身边的人 / 最新感悟 / 资产合计）。 */
function contextDigest(profile) {
	const view = profileView(profile);
	const career = view.career || [];
	const current = career.find((x) => x.current) || null;
	const relations = view.relations || [];
	const reflections = view.reflections || []; // profileView 已按日期倒序
	const latest = reflections[0] || null;
	const assets = view.assets || { accounts: [], holdings: [], totals: { totals: {} } };
	const totals = (assets.totals && assets.totals.totals) || {};
	const accountName = new Map(assets.accounts.map((x) => [x.id, x.name]));
	return {
		identity: view.identity,
		currentJob: current === null ? null : {
			company: current.company,
			title: current.title,
			since: current.startDate,
			location: current.location || '',
			salary: current.salary || null,
		},
		careerCount: career.length,
		relations: relations.slice(0, 8).map((x) => ({ name: x.name, relation: x.relation, group: x.group || '' })),
		relationCount: relations.length,
		latestReflection: latest === null ? null : {
			date: latest.date,
			title: latest.title || '',
			excerpt: String(latest.content || '').replace(/\s+/g, ' ').slice(0, 160),
		},
		reflectionCount: reflections.length,
		assets: {
			totals,
			accountCount: (assets.totals && assets.totals.accountCount) || assets.accounts.length,
			holdingCount: (assets.totals && assets.totals.holdingCount) || assets.holdings.length,
			topHoldings: (assets.holdings || []).slice(0, 5).map((x) => ({
				account: accountName.get(x.account) ?? x.account,
				code: x.code,
				name: x.name || '',
				shares: x.shares,
				marketValue: x.price === null || x.price === undefined ? null : Math.round(x.shares * x.price * 100) / 100,
			})),
		},
		meta: view.meta,
	};
}

/** 摘要的可读渲染：一段紧凑的 Markdown，适合直接进入对话上下文。 */
function renderContext(digest) {
	const lines = ['### 个人上下文'];
	const id = digest.identity || {};
	const who = [id.name, id.gender, id.age !== null && id.age !== undefined ? `${id.age} 岁` : '', id.residence].filter(Boolean).join(' · ');
	lines.push(who || '（身份信息未填写，用 personal_identity 的 patch 录入）');
	if (id.birthplace || id.origin) lines.push(`出生地 ${id.birthplace || '—'} · 归属地 ${id.origin || '—'}`);
	if (digest.currentJob) {
		const j = digest.currentJob;
		const salary = j.salary && j.salary.amount
			? `，${j.salary.period === 'monthly' ? '月薪' : j.salary.period === 'annual' ? '年薪' : '薪资'} ${fmtMoney(j.salary.amount, j.salary.currency || 'CNY')}`
			: '';
		lines.push(`\n**在职**：${j.title} · ${j.company}（${j.since} 起${j.location ? '，' + j.location : ''}${salary}）｜共 ${digest.careerCount} 段经历`);
	} else {
		lines.push(`\n**在职**：无记录｜共 ${digest.careerCount} 段经历`);
	}
	if (digest.relationCount === 0) {
		lines.push('**身边的人**：暂无记录');
	} else {
		const names = digest.relations.map((r) => `${r.name}（${r.relation}${r.group ? '·' + r.group : ''}）`).join('、');
		lines.push(`**身边的人**：${names}${digest.relationCount > 8 ? ` 等 ${digest.relationCount} 人` : ''}`);
	}
	if (digest.latestReflection) {
		const r = digest.latestReflection;
		lines.push(`**最新感悟**（${r.date}）：${r.title ? r.title + ' —— ' : ''}${r.excerpt}`);
	} else {
		lines.push('**最新感悟**：暂无记录');
	}
	const buckets = Object.entries(digest.assets.totals || {});
	if (buckets.length === 0 && digest.assets.accountCount === 0) {
		lines.push('**资产**：暂无记录');
	} else {
		for (const [currency, bucket] of buckets) {
			lines.push(
				`**资产（${currency}）**：现金 ${fmtMoney(bucket.bank + bucket.pay, currency)} + 股票账户 ${fmtMoney(bucket.stock, currency)}`
				+ ` + 持仓市值 ${fmtMoney(bucket.holdings, currency)} = **${fmtMoney(bucket.grand, currency)}**`
				+ `（${digest.assets.accountCount} 账户 / ${digest.assets.holdingCount} 持仓）`,
			);
		}
		if (digest.assets.topHoldings.length > 0) {
			lines.push(`主要持仓：${digest.assets.topHoldings.map((x) => `${x.name || x.code}(${x.code}) ×${x.shares}${x.marketValue === null ? '' : '，市值 ' + fmtMoney(x.marketValue)}`).join('；')}`);
		}
	}
	lines.push('\n（各类完整明细可用 personal_identity / personal_career / personal_relations / personal_reflections / personal_assets 查询与更新。）');
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 通用 add/update/delete 逻辑
// ---------------------------------------------------------------------------

/**
 * 把规范化后的条目写进档案列表：id 非空则整体替换该条，否则追加新条。
 * listFn(profile) 取目标数组；kind 决定 id 前缀。
 */
function upsertInto(listFn, kind, value, id, label) {
	return mutate((profile) => {
		const list = listFn(profile);
		if (id !== '') {
			if (!validId(id)) throw new StoreError(`${label} id 非法`);
			const index = list.findIndex((x) => x.id === id);
			if (index < 0) throw new StoreError(`${label} id=${id} 不存在`);
			list[index] = { id, ...value, updatedAt: new Date().toISOString() };
			return { id, action: 'update' };
		}
		const next = { id: nextIdIn(list, kind, profile.meta), ...value, updatedAt: new Date().toISOString() };
		list.push(next);
		return { id: next.id, action: 'add' };
	});
}

// 取 profile 上的目标列表（避免每个调用点重复样板）
function careerList(profile) { return profile.career; }
function relationList(profile) { return profile.relations; }
function reflectionList(profile) { return profile.reflections; }
function accountList(profile) { return profile.assets.accounts; }
function holdingList(profile) { return profile.assets.holdings; }

function removeFrom(listFn, id, label) {
	return mutate((profile) => {
		if (!validId(id)) throw new StoreError(`${label} id 非法`);
		const list = listFn(profile);
		const index = list.findIndex((x) => x.id === id);
		if (index < 0) throw new StoreError(`${label} id=${id} 不存在`);
		list.splice(index, 1);
		return { id, action: 'delete' };
	});
}

const ENTRY_SCHEMA = (description) => ({
	type: 'object',
	additionalProperties: true,
	description,
});

function idField(label) {
	return { type: 'string', description: `${label} id（list 结果里的 id；update/delete 必填，add 留空）` };
}

// ---------------------------------------------------------------------------
// 工具定义
// ---------------------------------------------------------------------------

export function buildTools() {
	return [
		{
			name: 'personal_identity',
			description:
				'读取或更新用户基本信息（姓名/性别/出生日期/出生地/归属地/现居地/电话/邮箱/备注）。' +
				'get 返回当前信息（含按出生日期计算的年龄）；patch 传入要修改的字段（未传字段保持不变），' +
				'birthDate 格式 YYYY-MM-DD。用户聊到自己的基本情况时用本工具记录或查询。',
			parameters: {
				type: 'object',
				properties: {
					action: { type: 'string', enum: ['get', 'patch'], description: 'get 读取；patch 部分更新' },
					patch: {
						type: 'object',
						additionalProperties: true,
						description: '要更新的字段（仅接受字符串值）：name/gender/birthDate/birthplace/origin/residence/phone/email/notes',
					},
				},
				required: ['action'],
				additionalProperties: false,
			},
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(renderIdentity(v && v.profile !== undefined ? v.profile : v)) },
			async execute(rawArgs) {
				const args = rawArgs || {};
				const action = str(args, 'action');
				if (action === 'get') return profileView(loadProfile());
				if (action === 'patch') {
					const patch = identityPatch(args.patch ?? {});
					if (Object.keys(patch).length === 0) throw new StoreError('patch 里没有可识别的字段');
					mutate((profile) => {
						Object.assign(profile.identity, patch);
					});
					return profileView(loadProfile());
				}
				throw new StoreError('action 需是 get 或 patch');
			},
		},
		{
			name: 'personal_career',
			description:
				'管理工作经历：list 列出（按开始时间倒序，标记在职）；add 新增；update 按 id 修改（entry 整体替换，未填字段清空）；delete 按 id 删除。' +
				'entry 字段：company/title 必填，startDate 必填（YYYY / YYYY-MM / YYYY-MM-DD），endDate 留空表示在职，' +
				'location 工作地点，content 工作内容（markdown），salary:{amount 数字, currency 默认 CNY, period monthly|annual|hourly|total|other, notes}。' +
				'用户提到入职、离职、跳槽、薪资变化时更新本档案。',
			parameters: {
				type: 'object',
				properties: {
					action: { type: 'string', enum: ['list', 'add', 'update', 'delete'], description: '操作类型' },
					id: idField('工作经历'),
					entry: ENTRY_SCHEMA('完整的工作经历条目（add/update 必填）'),
				},
				required: ['action'],
				additionalProperties: false,
			},
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(renderCareer(v && v.profile !== undefined ? v.profile : v)) },
			async execute(rawArgs) {
				const args = rawArgs || {};
				const action = str(args, 'action');
				if (action === 'list') return profileView(loadProfile());
				if (action === 'update' && (typeof args.id !== 'string' || args.id.trim() === '')) {
					throw new StoreError('update 需要提供 id（先 list 查询）');
				}
				if (action === 'add' || action === 'update') {
					const value = careerEntry(args.entry);
					const { result } = upsertInto(careerList, 'career', value, action === 'update' ? str(args, 'id') : '', '工作经历');
					return { ...result, profile: profileView(loadProfile()) };
				}
				if (action === 'delete') {
					const { result } = removeFrom(careerList, str(args, 'id'), '工作经历');
					return { ...result, profile: profileView(loadProfile()) };
				}
				throw new StoreError('action 需是 list / add / update / delete');
			},
		},
		{
			name: 'personal_relations',
			description:
				'管理「周围的人」：list 列出；add 新增；update 按 id 修改；delete 按 id 删除。' +
				'entry 字段：name/relation 必填（relation 是与用户的关系，如 母亲/大学室友/前同事/导师），' +
				'group 分组（家人/朋友/同事/同学/其他，默认 其他），contact 联系方式，notes 备注，tags 标签数组。' +
				'用户提到家人朋友同事时记录，便于后续回忆人物关系。',
			parameters: {
				type: 'object',
				properties: {
					action: { type: 'string', enum: ['list', 'add', 'update', 'delete'], description: '操作类型' },
					id: idField('人际关系'),
					entry: ENTRY_SCHEMA('完整的人际关系条目（add/update 必填）'),
				},
				required: ['action'],
				additionalProperties: false,
			},
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(renderRelations(v && v.profile !== undefined ? v.profile : v)) },
			async execute(rawArgs) {
				const args = rawArgs || {};
				const action = str(args, 'action');
				if (action === 'list') return profileView(loadProfile());
				if (action === 'update' && (typeof args.id !== 'string' || args.id.trim() === '')) {
					throw new StoreError('update 需要提供 id（先 list 查询）');
				}
				if (action === 'add' || action === 'update') {
					const value = relationEntry(args.entry);
					const { result } = upsertInto(relationList, 'relation', value, action === 'update' ? str(args, 'id') : '', '人际关系');
					return { ...result, profile: profileView(loadProfile()) };
				}
				if (action === 'delete') {
					const { result } = removeFrom(relationList, str(args, 'id'), '人际关系');
					return { ...result, profile: profileView(loadProfile()) };
				}
				throw new StoreError('action 需是 list / add / update / delete');
			},
		},
		{
			name: 'personal_reflections',
			description:
				'管理人生感悟（按时间归档）：list 按日期倒序列出；add 新增；update 按 id 修改；delete 按 id 删除。' +
				'entry 字段：date 必填（YYYY-MM-DD），content 必填（markdown 正文），title 可选标题，tags 标签数组。' +
				'用户表达对人生的感悟、复盘、阶段总结时，按当时的日期记录下来。',
			parameters: {
				type: 'object',
				properties: {
					action: { type: 'string', enum: ['list', 'add', 'update', 'delete'], description: '操作类型' },
					id: idField('人生感悟'),
					entry: ENTRY_JSON_SAFE(),
				},
				required: ['action'],
				additionalProperties: false,
			},
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(renderReflections(v && v.profile !== undefined ? v.profile : v)) },
			async execute(rawArgs) {
				const args = rawArgs || {};
				const action = str(args, 'action');
				if (action === 'list') return profileView(loadProfile());
				if (action === 'update' && (typeof args.id !== 'string' || args.id.trim() === '')) {
					throw new StoreError('update 需要提供 id（先 list 查询）');
				}
				if (action === 'add' || action === 'update') {
					const value = reflectionEntry(args.entry);
					const { result } = upsertInto(reflectionList, 'reflection', value, action === 'update' ? str(args, 'id') : '', '人生感悟');
					return { ...result, profile: profileView(loadProfile()) };
				}
				if (action === 'delete') {
					const { result } = removeFrom(reflectionList, str(args, 'id'), '人生感悟');
					return { ...result, profile: profileView(loadProfile()) };
				}
				throw new StoreError('action 需是 list / add / update / delete');
			},
		},
		{
			name: 'personal_assets',
			description:
				'管理个人资产台账：get 查看全部（各账户余额、持仓明细、按币种合计）。' +
				'save-account 新增/更新账户（id 留空新增，传 id 更新）：kind=bank 银行卡 / pay 支付宝、微信等 / stock 股票账户；' +
				'name 必填，mask 卡号尾号等标识，balance 数字余额，currency 默认 CNY，notes 备注。' +
				'save-holding 新增/更新持仓（同花顺等账户的股票）：account 归属账户（账户 id 或名称），code 证券代码，name 名称，' +
				'market 市场，shares 股数，costPrice 成本价，price 最新价，notes。delete-account / delete-holding 按 id 删除。' +
				'用户报余额、查资产、说持仓变动时调用；也可在账户卡片定期更新余额。',
			parameters: {
				type: 'object',
				properties: {
					action: {
						type: 'string',
						enum: ['get', 'save-account', 'delete-account', 'save-holding', 'delete-holding'],
						description: '操作类型',
					},
					id: { type: 'string', description: 'save-*/delete-* 时目标条目 id（save 留空表示新增）' },
					account: ENTRY_SCHEMA('账户条目（save-account 必填）'),
					holding: ENTRY_SCHEMA('持仓条目（save-holding 必填）'),
				},
				required: ['action'],
				additionalProperties: false,
			},
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(renderAssets(v && v.profile !== undefined ? v.profile : v)) },
			async execute(rawArgs) {
				const args = rawArgs || {};
				const action = str(args, 'action');
				if (action === 'get') return profileView(loadProfile());
				if (action === 'save-account') {
					const value = accountEntry(args.account);
					const { result } = upsertInto(accountList, 'account', value, str(args, 'id'), '资产账户');
					return { ...result, profile: profileView(loadProfile()) };
				}
				if (action === 'delete-account') {
					const { result } = removeFrom(accountList, str(args, 'id'), '资产账户');
					return { ...result, profile: profileView(loadProfile()) };
				}
				if (action === 'save-holding') {
					const value = holdingEntry(args.holding);
					const { result } = upsertInto(holdingList, 'holding', value, str(args, 'id'), '持仓');
					return { ...result, profile: profileView(loadProfile()) };
				}
				if (action === 'delete-holding') {
					const { result } = removeFrom(holdingList, str(args, 'id'), '持仓');
					return { ...result, profile: profileView(loadProfile()) };
				}
				throw new StoreError('action 需是 get / save-account / delete-account / save-holding / delete-holding');
			},
		},
		{
			name: 'personal_context',
			description:
				'获取用户个人上下文摘要（一次调用拿全）：身份（姓名/性别/年龄/城市）、当前在职、身边的人、最新感悟、资产合计与主要持仓。' +
				'在对话中需要结合用户个人背景回答（职业/财务/生活建议、提醒、个性化写作）或开场建立上下文时调用；' +
				'需要某类完整明细时再用 personal_identity / personal_career / personal_relations / personal_reflections / personal_assets。',
			parameters: { type: 'object', properties: {}, additionalProperties: false },
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(renderContext(v)) },
			async execute() {
				return contextDigest(loadProfile());
			},
		},
	];
}

function ENTRY_JSON_SAFE() {
	return {
		type: 'object',
		additionalProperties: true,
		description: '完整的感悟条目（add/update 必填）：date(YYYY-MM-DD)、content、title?、tags?',
	};
}
