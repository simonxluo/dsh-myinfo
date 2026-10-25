/**
 * dsh-myinfo — 数据层：个人档案的加载、校验、原子落盘与汇总视图。
 *
 * 数据文件：$DSH_HOME/integrations/dsh-myinfo/data.json（0600，
 * 与 dsh-ssh-manager 的凭据存储同一本地明文约定）。所有写入都走
 * mutate()：加载 → 变更 → 原子替换保存 → 通知订阅者。
 *
 * 顶层结构：
 *   identity    名称/性别/生日/出生地/归属地/现居地/联系方式
 *   career[]    工作经历（公司、职位、时间、内容、薪资）
 *   relations[] 周围的人（姓名、与我的关系、分组、联系方式、备注）
 *   reflections[] 人生感悟（按日期归档，标题/正文/标签）
 *   assets      accounts[]（银行卡/支付宝/微信/股票账户余额）
 *               holdings[]（股票持仓：同花顺等账户的代码/股数/成本/现价）
 */
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/** 面向调用方的业务错误（工具与面板 API 都以 message 呈现）。 */
export class StoreError extends Error {
	constructor(message) {
		super(message);
		this.name = 'StoreError';
	}
}

export function dataFile() {
	const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
	return join(home, 'integrations', 'dsh-myinfo', 'data.json');
}

// ---------------------------------------------------------------------------
// 基础形状与加载/保存
// ---------------------------------------------------------------------------

export function emptyIdentity() {
	return {
		name: '', gender: '', birthDate: '', birthplace: '', origin: '', residence: '',
		phone: '', email: '', notes: '',
	};
}

export function emptyProfile() {
	return {
		version: 1,
		identity: emptyIdentity(),
		career: [],
		relations: [],
		reflections: [],
		assets: { accounts: [], holdings: [] },
		meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), idSeq: {} },
	};
}

/** 合并磁盘文档与默认形状：缺字段补默认值，多余字段丢弃，类型兜底。 */
function normalizeProfile(doc) {
	const profile = emptyProfile();
	if (doc === null || typeof doc !== 'object') return profile;
	const identity = (doc.identity !== null && typeof doc.identity === 'object') ? doc.identity : {};
	for (const key of Object.keys(emptyIdentity())) {
		if (typeof identity[key] === 'string') profile.identity[key] = identity[key];
	}
	// 读路径兜底：手工编辑/半截写入可能混入数组或字符串数字；对象之外的元素直接丢弃，
	// 数字字段尽力 Number() 收敛（失败置 null，汇总按 0 计），避免 "[object Object]" 或字符串拼接污染。
	const isEntry = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
	const num = (v) => {
		if (typeof v === 'number') return Number.isFinite(v) ? v : null;
		if (typeof v === 'string' && v.trim() !== '') {
			const n = Number(v.replace(/[,，\s]/g, ''));
			return Number.isFinite(n) ? n : null;
		}
		return null;
	};
	for (const key of ['career', 'relations', 'reflections']) {
		if (Array.isArray(doc[key])) profile[key] = doc[key].filter(isEntry);
	}
	const assets = (doc.assets !== null && typeof doc.assets === 'object') ? doc.assets : {};
	if (Array.isArray(assets.accounts)) {
		profile.assets.accounts = assets.accounts.filter(isEntry).map((x) => ({ ...x, balance: num(x.balance) }));
	}
	if (Array.isArray(assets.holdings)) {
		profile.assets.holdings = assets.holdings.filter(isEntry).map((x) => ({
			...x, shares: num(x.shares), costPrice: num(x.costPrice), price: num(x.price),
		}));
	}
	if (doc.meta !== null && typeof doc.meta === 'object') {
		if (doc.meta.idSeq !== null && typeof doc.meta.idSeq === 'object' && !Array.isArray(doc.meta.idSeq)) {
			profile.meta.idSeq = doc.meta.idSeq;
		}
		if (typeof doc.meta.createdAt === 'string') profile.meta.createdAt = doc.meta.createdAt;
		if (typeof doc.meta.updatedAt === 'string') profile.meta.updatedAt = doc.meta.updatedAt;
	}
	return profile;
}

/** 读取档案；文件缺失或损坏时返回空白档案（损坏会写一行 stderr 提示）。 */
export function loadProfile() {
	const file = dataFile();
	try {
		return normalizeProfile(JSON.parse(readFileSync(file, 'utf8')));
	} catch {
		if (existsSync(file)) {
			process.stderr.write('dsh-myinfo: data.json unreadable, starting empty\n');
		}
		return emptyProfile();
	}
}

function writeFileMode(file, content, mode) {
	writeFileSync(file, content, mode === undefined ? undefined : { mode });
	if (mode !== undefined) chmodSync(file, mode);
}

/** 原子替换保存：临时文件 + rename，崩溃不会留下半截 JSON。 */
export function saveProfile(profile) {
	const file = dataFile();
	mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
	const tmp = join(dirname(file), '.data.json.tmp');
	writeFileMode(tmp, JSON.stringify(profile, null, '\t') + '\n', 0o600);
	// fsync 数据文件后再 rename：掉电时 rename 不会跑在数据落盘之前。
	const fd = openSync(tmp, 'r+');
	try { fsyncSync(fd); } finally { closeSync(fd); }
	renameSync(tmp, file);
}

/**
 * 在一次加载-保存事务里变更档案。fn(profile) 的返回值作为结果透传；
 * fn 抛错则不落盘。每一次成功变更都会刷新 meta.updatedAt 并通知订阅者。
 */
export function mutate(fn) {
	const profile = loadProfile();
	const result = fn(profile);
	profile.meta.updatedAt = new Date().toISOString();
	saveProfile(profile);
	return { result, profile };
}

// ---------------------------------------------------------------------------
// 校验与规范化
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** 单行文本：去首尾空白、去掉控制字符、限长。 */
function line(value, { max = 200, required = false, label = 'value' } = {}) {
	if (value !== undefined && value !== null && typeof value !== 'string') {
		throw new StoreError(`${label} 需是字符串`);
	}
	const text = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
	if (required && text.length === 0) throw new StoreError(`${label} 不能为空`);
	if (text.length > max) throw new StoreError(`${label} 超过 ${max} 字符`);
	return text;
}

/** 多行文本：去控制字符（保留换行）、限长。 */
function text(value, { max = 20000, required = false, label = 'value' } = {}) {
	const out = String(value ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
	if (required && out.length === 0) throw new StoreError(`${label} 不能为空`);
	if (out.length > max) throw new StoreError(`${label} 超过 ${max} 字符`);
	return out;
}

/** YYYY-MM-DD（或空）。 */
function ymd(value, { required = false, label = 'date' } = {}) {
	const s = line(value, { max: 10, label });
	if (s === '') {
		if (required) throw new StoreError(`${label} 不能为空（格式 YYYY-MM-DD）`);
		return '';
	}
	if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) throw new StoreError(`${label} 需为 YYYY-MM-DD`);
	return s;
}

/** 时间点：YYYY / YYYY-MM / YYYY-MM-DD 皆可，统一存原串便于排序。 */
function when(value, { required = false, label = 'date' } = {}) {
	const s = line(value, { max: 10, label });
	if (s === '') {
		if (required) throw new StoreError(`${label} 不能为空（YYYY / YYYY-MM / YYYY-MM-DD）`);
		return '';
	}
	const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(s);
	if (m === null) throw new StoreError(`${label} 需为 YYYY / YYYY-MM / YYYY-MM-DD`);
	if (m[2] !== undefined) {
		const month = Number(m[2]);
		if (month < 1 || month > 12) throw new StoreError(`${label} 月份需在 01-12`);
		if (m[3] !== undefined) {
			const day = Number(m[3]);
			if (day < 1 || day > 31) throw new StoreError(`${label} 日期需在 01-31`);
		}
	}
	return s;
}

/** 金额：有限数字，四舍五入到分；空串视为未填（null）。 */
function money(value, { label = 'amount' } = {}) {
	if (value === undefined || value === null || value === '') return null;
	const n = typeof value === 'number' ? value : Number(String(value).replace(/[,，\s]/g, ''));
	if (!Number.isFinite(n)) throw new StoreError(`${label} 需是数字`);
	if (Math.abs(n) >= 1e13) throw new StoreError(`${label} 超出可记录范围（|值| < 1e13）`);
	return Math.round(n * 100) / 100;
}

/** 股数：正数，最多 4 位小数。 */
function shares(value, { label = 'shares' } = {}) {
	const n = typeof value === 'number' ? value : Number(String(value).replace(/[,，\s]/g, ''));
	if (!Number.isFinite(n) || n <= 0) throw new StoreError(`${label} 需是正数`);
	return Math.round(n * 10000) / 10000;
}

function tags(value) {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value)) throw new StoreError('tags 需是字符串数组');
	return value.map((x) => line(x, { max: 40, label: 'tag' })).filter((x) => x !== '');
}

export function validId(id) {
	return typeof id === 'string' && ID_RE.test(id);
}

const IDENTITY_KEYS = Object.keys(emptyIdentity());

/** 基本信息补丁：只接受已知字段，birthDate 校验格式。 */
export function identityPatch(patch) {
	if (patch === null || typeof patch !== 'object') throw new StoreError('patch 需是对象');
	const out = {};
	for (const [key, value] of Object.entries(patch)) {
		if (!IDENTITY_KEYS.includes(key)) continue;
		if (key === 'birthDate') out[key] = ymd(value, { label: 'birthDate' });
		else out[key] = line(value, { max: key === 'notes' ? 2000 : 120, label: key });
	}
	return out;
}

/** 工作经历条目：公司/职位/开始时间必填；在职 = 未填结束时间。 */
export function careerEntry(input) {
	if (input === null || typeof input !== 'object') throw new StoreError('career 需是对象');
	const salaryIn = (input.salary !== null && typeof input.salary === 'object') ? input.salary : {};
	const period = ['monthly', 'annual', 'hourly', 'total', 'other'].includes(salaryIn.period) ? salaryIn.period : 'monthly';
	const startDate = when(input.startDate, { required: true, label: 'startDate' });
	const endDate = when(input.endDate, { label: 'endDate' });
	// 同族格式下字典序即时间序（YYYY < YYYY-MM < YYYY-MM-DD），跨字段先后可直接比较。
	if (endDate !== '' && endDate < startDate) throw new StoreError('endDate 不能早于 startDate');
	return {
		company: line(input.company, { max: 120, required: true, label: 'company' }),
		title: line(input.title, { max: 120, required: true, label: 'title' }),
		location: line(input.location, { max: 120, label: 'location' }),
		startDate,
		endDate,
		content: text(input.content, { max: 20000, label: 'content' }),
		salary: {
			amount: money(salaryIn.amount, { label: 'salary.amount' }),
			currency: line(salaryIn.currency, { max: 8, label: 'salary.currency' }) || 'CNY',
			period,
			notes: line(salaryIn.notes, { max: 500, label: 'salary.notes' }),
		},
	};
}

/** 人际关系条目：姓名与关系必填。 */
export function relationEntry(input) {
	if (input === null || typeof input !== 'object') throw new StoreError('relation 需是对象');
	return {
		name: line(input.name, { max: 120, required: true, label: 'name' }),
		relation: line(input.relation, { max: 120, required: true, label: 'relation' }),
		group: line(input.group, { max: 40, label: 'group' }) || '其他',
		contact: line(input.contact, { max: 200, label: 'contact' }),
		notes: text(input.notes, { max: 4000, label: 'notes' }),
		tags: tags(input.tags),
	};
}

/** 人生感悟条目：日期与正文必填，按时间归档。 */
export function reflectionEntry(input) {
	if (input === null || typeof input !== 'object') throw new StoreError('reflection 需是对象');
	return {
		date: ymd(input.date, { required: true, label: 'date' }),
		title: line(input.title, { max: 200, label: 'title' }),
		content: text(input.content, { max: 20000, required: true, label: 'content' }),
		tags: tags(input.tags),
	};
}

export const ACCOUNT_KINDS = ['bank', 'pay', 'stock'];

/** 资产账户条目：银行卡(bank)/支付软件(pay)/股票账户(stock)的余额。 */
export function accountEntry(input) {
	if (input === null || typeof input !== 'object') throw new StoreError('account 需是对象');
	const kind = ACCOUNT_KINDS.includes(input.kind) ? input.kind : null;
	if (kind === null) throw new StoreError(`kind 需是 ${ACCOUNT_KINDS.join(' / ')}`);
	const balance = money(input.balance, { label: 'balance' });
	if (balance === null) throw new StoreError('balance 不能为空');
	return {
		kind,
		name: line(input.name, { max: 120, required: true, label: 'name' }),
		mask: line(input.mask, { max: 32, label: 'mask' }),
		balance,
		currency: line(input.currency, { max: 8, label: 'currency' }) || 'CNY',
		notes: line(input.notes, { max: 500, label: 'notes' }),
	};
}

/** 持仓条目：归属账户（账户 id 或名称）+ 证券代码 + 股数；成本/现价可选。 */
export function holdingEntry(input) {
	if (input === null || typeof input !== 'object') throw new StoreError('holding 需是对象');
	return {
		account: line(input.account, { max: 120, required: true, label: 'account' }),
		code: line(input.code, { max: 24, required: true, label: 'code' }),
		name: line(input.name, { max: 60, label: 'name' }),
		market: line(input.market, { max: 16, label: 'market' }),
		shares: shares(input.shares, { label: 'shares' }),
		costPrice: money(input.costPrice, { label: 'costPrice' }),
		price: money(input.price, { label: 'price' }),
		notes: line(input.notes, { max: 300, label: 'notes' }),
	};
}

// ---------------------------------------------------------------------------
// 汇总视图（面板 GET 与部分工具输出共用）
// ---------------------------------------------------------------------------

/** 由生日计算周岁；未知返回 null。 */
export function ageOf(birthDate) {
	if (typeof birthDate !== 'string' || !DATE_RE.test(birthDate)) return null;
	const parts = birthDate.split('-').map(Number);
	// 用本地时区构造与比较：生日是本地历法概念，避免 UTC 日界在东八区凌晨少算一岁。
	const birth = new Date(parts[0], parts[1] - 1, parts[2]);
	if (Number.isNaN(birth.getTime())) return null;
	const now = new Date();
	let age = now.getFullYear() - birth.getFullYear();
	const beforeBirthday = now.getMonth() < birth.getMonth()
		|| (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
	if (beforeBirthday) age -= 1;
	return age >= 0 && age < 150 ? age : null;
}

function holdingValue(holding) {
	const price = (holding.price === null || holding.price === undefined) ? holding.costPrice : holding.price;
	if (price === null || price === undefined) return 0;
	return Math.round((Number(holding.shares) || 0) * Number(price) * 100) / 100;
}

/**
 * 资产汇总：按币种聚合银行/支付/股票账户余额与持仓市值。
 * grand = 三类账户余额 + 持仓市值（各分量同时返回，UI 可分开呈现）。
 */
export function assetsView(assets) {
	const accounts = Array.isArray(assets?.accounts) ? assets.accounts : [];
	const holdings = Array.isArray(assets?.holdings) ? assets.holdings : [];
	const totals = {};
	const ensure = (currency) => {
		if (totals[currency] === undefined) {
			totals[currency] = { bank: 0, pay: 0, stock: 0, holdings: 0, grand: 0 };
		}
		return totals[currency];
	};
	for (const account of accounts) {
		const bucket = ensure(account.currency || 'CNY');
		if (account.kind === 'bank') bucket.bank += account.balance ?? 0;
		else if (account.kind === 'pay') bucket.pay += account.balance ?? 0;
		else if (account.kind === 'stock') bucket.stock += account.balance ?? 0;
	}
	for (const holding of holdings) {
		// 持仓市值默认记 CNY；非 A 股账户请在账户余额里体现币种。
		ensure('CNY').holdings += holdingValue(holding);
	}
	for (const bucket of Object.values(totals)) {
		bucket.bank = Math.round(bucket.bank * 100) / 100;
		bucket.pay = Math.round(bucket.pay * 100) / 100;
		bucket.stock = Math.round(bucket.stock * 100) / 100;
		bucket.holdings = Math.round(bucket.holdings * 100) / 100;
		bucket.grand = Math.round((bucket.bank + bucket.pay + bucket.stock + bucket.holdings) * 100) / 100;
	}
	return { totals, accountCount: accounts.length, holdingCount: holdings.length };
}

/** 全档案视图：面板 GET 返回这个（含派生字段，不含内部约定）。 */
export function profileView(profile) {
	const career = [...profile.career].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
	const reflections = [...profile.reflections].sort((a, b) => String(b.date).localeCompare(String(a.date)));
	return {
		identity: { ...profile.identity, age: ageOf(profile.identity.birthDate) },
		career: career.map((entry) => ({ ...entry, current: !entry.endDate })),
		relations: [...profile.relations],
		reflections,
		assets: {
			...profile.assets,
			totals: assetsView(profile.assets),
		},
		meta: { ...profile.meta },
	};
}
