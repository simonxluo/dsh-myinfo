/**
 * dsh-myinfo — 实时行情轮询器（宿主侧）。
 *
 * 免费行情（腾讯 qt.gtimg.cn）是快照接口，A 股 Level-1 本身约 1~3 秒才变化一次，
 * 所以 3 秒轮询已是免费源的实际极限；非交易时段完全不发请求，只回缓存快照。
 *
 * 纯函数 marketOpenAt / shanghaiMinute 可单测；createQuotePoller 返回
 * { start, stop, tick, snapshot }：tick 可注入 fetchImpl/now 供测试。
 * 报价只进内存，绝不写 data.json（刷新落盘仍由 refresh-prices 手动完成）。
 */
import { loadProfile } from './store.js';
import { fetchQuotes, inferPrefixByCode, quotePrefixOf } from './tools.js';

/** 取上海时区的 {weekday, minute}（与宿主进程时区无关）。 */
export function shanghaiMinute(date) {
	const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Shanghai', hour12: false, weekday: 'short', hour: '2-digit', minute: '2-digit',
	}).formatToParts(date).map((p) => [p.type, p.value]));
	const hour = Number(parts.hour === '24' ? '0' : parts.hour); // 部分环境把 0 点格式化成 24
	return { weekday: parts.weekday, minute: hour * 60 + Number(parts.minute) };
}

const WEEKEND = new Set(['Sat', 'Sun']);

/** 该代码前缀对应市场此刻（上海时间）是否交易中。sh/sz/bj→A股, hk→港股, us→美股粗窗。 */
export function marketOpenAt(prefix, date) {
	const { weekday, minute } = shanghaiMinute(date);
	if (WEEKEND.has(weekday)) return false;
	if (prefix === 'hk') return (minute >= 570 && minute <= 720) || (minute >= 780 && minute <= 960); // 9:30-12:00 / 13:00-16:00
	if (prefix === 'us') return minute >= 1260 || minute <= 240; // 21:00-次日04:00（含夏冬令时容差）
	return (minute >= 570 && minute <= 690) || (minute >= 780 && minute <= 900); // A股 9:30-11:30 / 13:00-15:00
}

/** 持仓 → 腾讯 symbol 目标（与 refresh-prices 同一套前缀规则）。 */
function targetsOf(holdings) {
	const targets = [];
	for (const holding of holdings) {
		const prefix = quotePrefixOf(holding.market) || inferPrefixByCode(holding.code);
		if (prefix === '') continue;
		const body = prefix === 'hk' ? String(holding.code).replace(/\D/g, '').padStart(5, '0') : String(holding.code).trim();
		targets.push({ code: String(holding.code).trim(), symbol: (prefix + body).toLowerCase(), prefix });
	}
	return targets;
}

/**
 * 创建轮询器。options：{ intervalMs=3000, now, logger, loadHoldings, fetchImpl }。
 * snapshot() → { live, sessionOpen, quotesAt, quotes: { [code]: { price, changePct, name } } }。
 */
export function createQuotePoller(options = {}) {
	const intervalMs = options.intervalMs ?? 3000;
	const now = options.now ?? (() => new Date());
	const logger = options.logger;
	const loadHoldings = options.loadHoldings ?? (() => loadProfile().assets.holdings);
	const fetchImpl = options.fetchImpl;

	let timer = null;
	let inflight = false;
	let failures = 0;
	let cacheAt = 0;
	let cachedTargets = [];
	const last = { live: false, sessionOpen: false, quotesAt: null, quotes: {} };

	async function tick() {
		const nowMs = now().getTime();
		if (nowMs - cacheAt > 30_000) {
			try {
				cachedTargets = targetsOf(loadHoldings());
			} catch {
				cachedTargets = [];
			}
			cacheAt = nowMs;
		}
		if (cachedTargets.length === 0) {
			last.sessionOpen = false;
			last.live = false;
			return;
		}
		const date = now();
		const sessionOpen = cachedTargets.some((x) => marketOpenAt(x.prefix, date));
		last.sessionOpen = sessionOpen;
		if (!sessionOpen) {
			last.live = false; // 休市：保留最后快照（quotesAt 标记其时点）
			return;
		}
		if (inflight) return;
		inflight = true;
		try {
			const quotes = await fetchQuotes(cachedTargets.map((x) => x.symbol), fetchImpl);
			for (const target of cachedTargets) {
				const quote = quotes.get(target.symbol);
				if (quote === undefined) continue;
				last.quotes[target.code] = {
					price: Math.round(quote.price * 100) / 100,
					changePct: quote.prevClose
						? Math.round(((quote.price - quote.prevClose) / quote.prevClose) * 10000) / 100
						: null,
					name: quote.name,
				};
			}
			last.quotesAt = date.toISOString();
			last.live = true;
			failures = 0;
		} catch (error) {
			failures += 1;
			last.live = false;
			if (logger?.warn && failures % 10 === 1) logger.warn(`dsh-myinfo quote poll failed (${failures}): ${error?.message ?? error}`);
		} finally {
			inflight = false;
		}
	}

	return {
		tick,
		start() {
			if (timer !== null) return;
			timer = setInterval(tick, intervalMs);
			if (typeof timer.unref === 'function') timer.unref();
		},
		stop() {
			if (timer !== null) clearInterval(timer);
			timer = null;
		},
		snapshot() {
			return { live: last.live, sessionOpen: last.sessionOpen, quotesAt: last.quotesAt, quotes: { ...last.quotes } };
		},
	};
}
