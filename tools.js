/**
 * dsh-myinfo — agent 工具：personal_identity / personal_career /
 * personal_relations / personal_reflections / personal_assets，外加一次性
 * 摘要工具 personal_context（对话中实时拉取用户个人上下文）与跨档案模糊
 * 搜索 personal_search（一个关键词查六类数据）。
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
// 跨档案模糊搜索（personal_search）：一个关键词查全部分类
// ---------------------------------------------------------------------------

const CATEGORY_LABELS = {
	identity: '基本信息', career: '工作经历', relations: '周围的人',
	reflections: '人生感悟', accounts: '资产账户', holdings: '持仓',
};

const ACCOUNT_KIND_LABELS = { bank: '银行卡', pay: '支付软件', stock: '股票账户' };

const IDENTITY_FIELDS = [
	['name', '姓名'], ['gender', '性别'], ['birthDate', '出生日期'], ['birthplace', '出生地'],
	['origin', '归属地'], ['residence', '现居地'], ['phone', '电话'], ['email', '邮箱'], ['notes', '备注'],
];

/** 把档案视图摊平成可搜索单元：每条含类别、标题、副标题与可命中字段（键 / 中文标签 / 文本值）。 */
function searchableRecords(view) {
	const keep = (fields) => fields.filter(([, , value]) => String(value ?? '') !== '');
	const records = [];
	const identity = view.identity ?? {};
	const idFields = keep(IDENTITY_FIELDS.map(([key, label]) => [key, label, identity[key]]));
	if (idFields.length > 0) {
		records.push({ category: 'identity', id: '', title: '基本信息', subtitle: '', fields: idFields, entry: null });
	}
	for (const entry of view.career ?? []) {
		records.push({
			category: 'career',
			id: entry.id,
			title: [entry.company, entry.title].filter(Boolean).join(' · '),
			subtitle: entry.current ? '在职' : periodOf(entry),
			fields: keep([
				['company', '公司', entry.company], ['title', '职位', entry.title], ['location', '地点', entry.location],
				['startDate', '开始时间', entry.startDate], ['endDate', '结束时间', entry.endDate],
				['content', '工作内容', entry.content], ['salaryNotes', '薪资备注', entry.salary?.notes],
			]),
			entry,
		});
	}
	for (const entry of view.relations ?? []) {
		records.push({
			category: 'relations',
			id: entry.id,
			title: entry.name,
			subtitle: entry.relation,
			fields: keep([
				['name', '姓名', entry.name], ['relation', '关系', entry.relation], ['group', '分组', entry.group],
				['contact', '联系方式', entry.contact], ['notes', '备注', entry.notes],
				['tags', '标签', (entry.tags ?? []).join(' ')],
			]),
			entry,
		});
	}
	for (const entry of view.reflections ?? []) {
		records.push({
			category: 'reflections',
			id: entry.id,
			title: entry.title || entry.date,
			subtitle: entry.date,
			fields: keep([
				['date', '日期', entry.date], ['title', '标题', entry.title],
				['content', '正文', entry.content], ['tags', '标签', (entry.tags ?? []).join(' ')],
			]),
			entry,
		});
	}
	const accountName = new Map((view.assets?.accounts ?? []).map((x) => [x.id, x.name]));
	for (const entry of view.assets?.accounts ?? []) {
		records.push({
			category: 'accounts',
			id: entry.id,
			title: entry.name,
			subtitle: ACCOUNT_KIND_LABELS[entry.kind] ?? entry.kind,
			fields: keep([
				['name', '名称', entry.name], ['kind', '类型', ACCOUNT_KIND_LABELS[entry.kind] ?? entry.kind],
				['mask', '标识', entry.mask], ['currency', '币种', entry.currency], ['notes', '备注', entry.notes],
			]),
			entry,
		});
	}
	for (const entry of view.assets?.holdings ?? []) {
		const owner = accountName.get(entry.account) ?? entry.account;
		records.push({
			category: 'holdings',
			id: entry.id,
			title: `${entry.code}${entry.name ? ' ' + entry.name : ''}`,
			subtitle: owner,
			fields: keep([
				['account', '归属账户', owner], ['code', '代码', entry.code], ['name', '名称', entry.name],
				['market', '市场', entry.market], ['notes', '备注', entry.notes],
			]),
			entry,
		});
	}
	return records;
}

/** 多关键词 AND 匹配：全部关键词都命中（大小写不敏感包含）才算该条命中，返回命中字段的中文标签。 */
function matchRecord(record, terms) {
	const matched = new Map();
	for (const term of terms) {
		let hit = false;
		for (const [key, label, value] of record.fields) {
			if (String(value).toLowerCase().includes(term)) {
				matched.set(key, label);
				hit = true;
			}
		}
		if (!hit) return null;
	}
	return [...matched.values()];
}

/** 长文本里截取首个命中附近的窗口做摘要；未命中返回 null。 */
function snippetAround(text, term, radius = 40) {
	const s = String(text);
	const index = s.toLowerCase().indexOf(term);
	if (index < 0) return null;
	const start = Math.max(0, index - radius);
	const end = Math.min(s.length, index + term.length + radius);
	return (start > 0 ? '…' : '') + s.slice(start, end).replace(/\s+/g, ' ') + (end < s.length ? '…' : '');
}

/** 搜索结果里的条目副本：超长正文字段换成命中窗口摘要，避免一次搜索输出整篇感悟。 */
function excerptEntry(entry, terms) {
	if (entry === null || entry === undefined) return null;
	const out = { ...entry };
	for (const key of ['content', 'notes']) {
		const value = out[key];
		if (typeof value !== 'string' || value.length <= 400) continue;
		const parts = [];
		for (const term of terms) {
			const s = snippetAround(value, term, 60);
			if (s !== null && !parts.includes(s)) parts.push(s);
		}
		if (parts.length > 0) out[key] = parts.join(' …… ') + `（原文 ${value.length} 字，完整内容用对应 list 工具查看）`;
	}
	return out;
}

/** 搜索主逻辑：query 空格分词（AND），categories 可限定类别；返回按类别分组的命中与计数。 */
function searchProfile(profile, query, categories) {
	const terms = [...new Set(String(query ?? '').toLowerCase().split(/\s+/).filter((x) => x !== ''))];
	if (terms.length === 0) throw new StoreError('query 不能为空');
	let wanted = null;
	if (categories !== null && categories !== undefined) {
		wanted = new Set(categories.filter((x) => CATEGORY_LABELS[x] !== undefined));
		if (wanted.size === 0) throw new StoreError(`categories 需是 ${Object.keys(CATEGORY_LABELS).join(' / ')} 的子集`);
	}
	const view = profileView(profile);
	const results = [];
	for (const record of searchableRecords(view)) {
		if (wanted !== null && !wanted.has(record.category)) continue;
		const matchedFields = matchRecord(record, terms);
		if (matchedFields === null) continue;
		let snippet = null;
		for (const [key, , value] of record.fields) {
			if (key !== 'content' && key !== 'notes') continue;
			for (const term of terms) {
				snippet = snippetAround(value, term);
				if (snippet !== null) break;
			}
			if (snippet !== null) break;
		}
		results.push({
			category: record.category,
			categoryLabel: CATEGORY_LABELS[record.category],
			id: record.id,
			title: record.title,
			subtitle: record.subtitle,
			matchedFields,
			snippet,
			entry: excerptEntry(record.entry, terms),
		});
	}
	const counts = {};
	for (const key of Object.keys(CATEGORY_LABELS)) counts[key] = 0;
	for (const r of results) counts[r.category] += 1;
	return { query: String(query), terms, total: results.length, counts, results };
}

function renderSearch(output) {
	const lines = [`### 个人档案搜索：“${output.query}”`];
	if (output.total === 0) {
		lines.push('没有命中。可换关键词重试；总览用 personal_context，分类明细用 personal_identity / personal_career / personal_relations / personal_reflections / personal_assets。');
		return lines.join('\n');
	}
	const parts = Object.entries(output.counts).filter(([, n]) => n > 0).map(([k, n]) => `${CATEGORY_LABELS[k]} ${n}`).join(' · ');
	lines.push(`命中 **${output.total}** 条（${parts}）`);
	let category = '';
	for (const r of output.results) {
		if (r.category !== category) {
			category = r.category;
			lines.push(`\n**${r.categoryLabel}**`);
		}
		const idPart = r.id ? `（id: ${r.id}）` : '';
		const sub = r.subtitle ? ` — ${r.subtitle}` : '';
		lines.push(`- **${r.title}**${sub}${idPart} ← 命中 [${r.matchedFields.join('、')}]`);
		if (r.snippet !== null) lines.push(`  ${r.snippet}`);
	}
	return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 行情刷新（personal_assets refresh-prices）：腾讯免费行情接口，免依赖零配置
// 只发送证券代码（公开市场数据），绝不发送任何账户信息。
// ---------------------------------------------------------------------------

const QUOTE_API = 'https://qt.gtimg.cn/q=';

/** market 字段 → 腾讯代码前缀；兼容常见中英文写法（sh/沪、sz/深、bj/北、hk/港、us/美）。 */
const QUOTE_PREFIX_BY_MARKET = [
	[/^(sh|sse|sha)$/i, 'sh'], [/沪|上海/, 'sh'],
	[/^(sz|szse)$/i, 'sz'], [/深/, 'sz'],
	[/^(bj|bse|neeq)$/i, 'bj'], [/北/, 'bj'],
	[/^(hk|hkex)$/i, 'hk'], [/港/, 'hk'],
	[/^(us|usa)$/i, 'us'], [/美/, 'us'],
];

function quotePrefixOf(market) {
	const m = String(market ?? '').trim();
	if (m === '') return '';
	for (const [re, prefix] of QUOTE_PREFIX_BY_MARKET) {
		if (re.test(m)) return prefix;
	}
	return '';
}

/** market 留空时按代码推断：6 位数字按首位分流 A 股三市，5 位数字视为港股，含字母视为美股。 */
function inferPrefixByCode(code) {
	const c = String(code ?? '').trim();
	if (/^\d{5}$/.test(c)) return 'hk';
	if (/^\d{6}$/.test(c)) {
		if (c.startsWith('92')) return 'bj';
		if (/^[69]/.test(c)) return 'sh';
		if (/^[023]/.test(c)) return 'sz';
		if (/^[48]/.test(c)) return 'bj';
		return '';
	}
	if (/^[A-Za-z][A-Za-z0-9.]{0,10}$/.test(c)) return 'us';
	return '';
}

/**
 * 批量拉取腾讯行情：一次请求多个代码，GBK 解码，解析出 名称/现价/昨收。
 * 返回 Map<小写symbol, {name, code, price, prevClose}>；接口没返回的代码不在 Map 里。
 */
async function fetchQuotes(symbols, fetchImpl) {
	const fetchFn = fetchImpl ?? globalThis.fetch;
	if (typeof fetchFn !== 'function') throw new StoreError('当前运行时没有可用的 fetch');
	if (symbols.length === 0) return new Map();
	let response;
	try {
		response = await fetchFn(QUOTE_API + symbols.join(','), {
			headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
			signal: AbortSignal.timeout(10_000),
		});
	} catch (err) {
		throw new StoreError(`行情接口不可达（${err?.message ?? err}）`);
	}
	if (!response.ok) throw new StoreError(`行情接口 HTTP ${response.status}`);
	const buffer = await response.arrayBuffer();
	let text;
	try {
		text = new TextDecoder('gbk').decode(buffer);
	} catch {
		text = new TextDecoder('utf-8').decode(buffer); // 名字可能乱码，数字字段仍可解析
	}
	const quotes = new Map();
	for (const match of text.matchAll(/v_([A-Za-z0-9.]+)="([^"]*)"/g)) {
		const parts = match[2].split('~');
		const price = Number(parts[3]);
		if (parts.length > 4 && Number.isFinite(price) && price > 0) {
			quotes.set(match[1].toLowerCase(), {
				name: parts[1], code: parts[2], price,
				prevClose: Number(parts[4]) || null,
			});
		}
	}
	return quotes;
}

/** refresh-prices 主逻辑：解析全部持仓 → 一次批量行情 → 回写现价（顺带补空名称）。 */
async function refreshPrices() {
	const profile = loadProfile();
	if (profile.assets.holdings.length === 0) {
		throw new StoreError('没有持仓可刷新，先用 save-holding 录入');
	}
	const failures = [];
	const targets = [];
	for (const holding of profile.assets.holdings) {
		const prefix = quotePrefixOf(holding.market) || inferPrefixByCode(holding.code);
		if (prefix === '') {
			failures.push({ id: holding.id, code: holding.code, reason: '无法识别市场（market 留空且代码无法推断），请补 market：SH/SZ/BJ/HK/US' });
			continue;
		}
		const body = prefix === 'hk' ? String(holding.code).replace(/\D/g, '').padStart(5, '0') : String(holding.code).trim();
		targets.push({ id: holding.id, code: holding.code, symbol: (prefix + body).toLowerCase() });
	}
	if (targets.length === 0) {
		return { action: 'refresh-prices', updated: 0, updates: [], failures, profile: profileView(loadProfile()) };
	}
	const quotes = await fetchQuotes(targets.map((x) => x.symbol));
	if (quotes.size === 0) throw new StoreError('行情接口没有返回任何报价（代码可能全部无效）');
	const byId = new Map(profile.assets.holdings.map((x) => [x.id, x]));
	const updates = [];
	for (const target of targets) {
		const holding = byId.get(target.id);
		const quote = quotes.get(target.symbol);
		if (holding === undefined) continue;
		if (quote === undefined) {
			failures.push({ id: target.id, code: target.code, reason: `行情接口未返回 ${target.symbol}（停牌或代码有误）` });
			continue;
		}
		updates.push({
			id: target.id,
			code: holding.code,
			name: holding.name || quote.name,
			oldPrice: holding.price ?? null,
			newPrice: Math.round(quote.price * 100) / 100,
			changePct: quote.prevClose ? Math.round(((quote.price - quote.prevClose) / quote.prevClose) * 10000) / 100 : null,
		});
	}
	if (updates.length > 0) {
		mutate((current) => {
			const map = new Map(current.assets.holdings.map((x) => [x.id, x]));
			for (const u of updates) {
				const holding = map.get(u.id);
				if (holding === undefined) continue;
				holding.price = u.newPrice;
				if (!holding.name && u.name) holding.name = u.name;
			}
		});
	}
	return {
		action: 'refresh-prices',
		updated: updates.length,
		updates,
		failures,
		quotesAt: new Date().toISOString(),
		profile: profileView(loadProfile()),
	};
}

function renderRefresh(output) {
	const lines = ['### 行情刷新'];
	if (output.updates.length > 0) {
		lines.push(`更新 ${output.updates.length} 条现价：`);
		for (const u of output.updates) {
			const pct = u.changePct === null ? '' : `（今日 ${u.changePct >= 0 ? '+' : ''}${u.changePct}%）`;
			lines.push(`- ${u.name || u.code}：${u.oldPrice ?? '—'} → **${u.newPrice}**${pct}`);
		}
	} else {
		lines.push('没有可更新的报价。');
	}
	if (output.failures.length > 0) {
		lines.push(`\n**未更新 ${output.failures.length} 条**：`);
		for (const f of output.failures) lines.push(`- ${f.code || f.id}：${f.reason}`);
	}
	lines.push('\n' + renderAssets(output.profile));
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
				'market 市场（SH/SZ/BJ/HK/US，或 沪/深/北/港/美），shares 股数，costPrice 成本价，price 最新价，notes。' +
				'delete-account / delete-holding 按 id 删除。refresh-prices 一键拉取腾讯免费行情（A股/港股/美股）批量刷新所有持仓的' +
				'最新价并回填缺失名称，市值与合计随之更新——只发送证券代码，不发送任何账户信息。' +
				'用户报余额、查资产、说持仓变动时调用；看盘后想更新市值就跑 refresh-prices。',
			parameters: {
				type: 'object',
				properties: {
					action: {
						type: 'string',
						enum: ['get', 'refresh-prices', 'save-account', 'delete-account', 'save-holding', 'delete-holding'],
						description: '操作类型（refresh-prices = 批量刷新全部持仓现价）',
					},
					id: { type: 'string', description: 'save-*/delete-* 时目标条目 id（save 留空表示新增）' },
					account: ENTRY_SCHEMA('账户条目（save-account 必填）'),
					holding: ENTRY_SCHEMA('持仓条目（save-holding 必填）'),
				},
				required: ['action'],
				additionalProperties: false,
			},
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(v && v.action === 'refresh-prices' ? renderRefresh(v) : renderAssets(v && v.profile !== undefined ? v.profile : v)) },
			async execute(rawArgs) {
				const args = rawArgs || {};
				const action = str(args, 'action');
				if (action === 'get') return profileView(loadProfile());
				if (action === 'refresh-prices') return refreshPrices();
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
				throw new StoreError('action 需是 get / refresh-prices / save-account / delete-account / save-holding / delete-holding');
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
		{
			name: 'personal_search',
			description:
				'跨个人档案模糊搜索：一个关键词同时查六类数据——基本信息/工作经历/周围的人/人生感悟/资产账户/持仓' +
				'（大小写不敏感的包含匹配；多个关键词用空格分隔，需全部命中）。返回命中条目的 id、标题、命中字段与摘要。' +
				'按人名、公司、股票代码、标签、感悟内容等任何线索回忆信息时用本工具；' +
				'总览用 personal_context，查看某类完整数据用 personal_identity / personal_career / personal_relations / personal_reflections / personal_assets。',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: '关键词，如 "杨锴"、"腾讯"、"600519"、"炒股"；多个关键词空格分隔（AND 语义）' },
					categories: {
						type: 'array',
						items: { type: 'string', enum: Object.keys(CATEGORY_LABELS) },
						description: '限定搜索类别（可选，缺省查全部）：identity/career/relations/reflections/accounts/holdings',
					},
				},
				required: ['query'],
				additionalProperties: false,
			},
			output: { schema: OBJ_SCHEMA, render: (_a, v) => block(renderSearch(v)) },
			async execute(rawArgs) {
				const args = rawArgs || {};
				return searchProfile(loadProfile(), str(args, 'query'), Array.isArray(args.categories) ? args.categories : null);
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
