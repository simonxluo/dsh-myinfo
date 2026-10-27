// dsh-myinfo — Client half:「个人信息」settings section.
// 数据源是 Host 面板路由（GET 读 / POST 写），与 agent 工具共用同一套校验。
window.__ModuleLoader__.load({ id: "dsh-myinfo", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";

const React = require("react");
const { useState, useEffect, useCallback, useRef } = React;
const h = React.createElement;

const ROUTE = "_dsh/dsh-myinfo/panel";

// ---------------------------------------------------------------------------
// i18n（跟随 harness 界面语言）
// ---------------------------------------------------------------------------

var UI_LANG = "zh";
function localeToLang(active) {
	const tag = String(active === undefined || active === null ? "" : active).toLowerCase();
	for (const lang of ["zh", "en"]) if (tag.indexOf(lang) === 0) return lang;
	return "zh";
}
var relocalize = null;
/**
 * 读取「可选」服务：只走 ctx.get(name)。
 * cordis 的属性访问会强制要求该服务写进 inject 列表，否则抛
 * `cannot get property "..." without inject`；但可选服务不能写进 inject
 * （写进去就成了必需，缺失时整个 client 入口会 pending），所以一律不读属性。
 */
function serviceOf(ctx, name) {
	try {
		return typeof ctx.get === "function" ? ctx.get(name) : undefined;
	} catch (e) { /* 服务不可用则按缺失处理 */ }
	return undefined;
}
function localeServiceOf(ctx) {
	return serviceOf(ctx, "locale");
}
function subscribeLocale(ctx) {
	const service = localeServiceOf(ctx);
	if (!service || typeof service.getSnapshot !== "function") return () => {};
	const apply2 = () => { UI_LANG = localeToLang(service.getSnapshot().active); if (relocalize) relocalize(); };
	apply2();
	if (typeof service.subscribe === "function") return service.subscribe(apply2);
	return () => {};
}

const UI = {
zh: {
	"nav.title": "个人信息",
	"title": "个人信息档案",
	"subtitle": "基本资料、工作经历、人际关系、人生感悟与资产台账；与 agent 工具共用同一份数据。",
	"tab.identity": "基本信息",
	"tab.career": "工作经历",
	"tab.relations": "人际关系",
	"tab.reflections": "人生感悟",
	"tab.assets": "资产",
	"action.save": "保存",
	"action.cancel": "取消",
	"action.edit": "编辑",
	"action.delete": "删除",
	"action.add": "新增",
	"action.refresh": "刷新",
	"action.addCareer": "添加工作经历",
	"action.addRelation": "添加联系人",
	"action.addReflection": "记一条感悟",
	"action.addAccount": "添加账户",
	"action.addHolding": "添加持仓",
	"empty.career": "还没有工作经历。",
	"empty.relations": "还没有记录周围的人。",
	"empty.reflections": "还没有人生感悟。",
	"empty.assets": "还没有资产记录。",
	"empty.holdings": "该账户暂无持仓记录。",
	"error.load": "加载失败：",
	"error.save": "保存失败：",
	"hint.updatedAt": "最后更新",
	"f.name": "姓名", "f.gender": "性别", "f.birthDate": "出生日期", "f.birthplace": "出生地",
	"f.origin": "归属地", "f.residence": "现居地", "f.phone": "电话", "f.email": "邮箱", "f.notes": "备注",
	"f.age": "年龄",
	"f.company": "公司", "f.title": "职位", "f.location": "地点", "f.startDate": "开始", "f.endDate": "结束（空=在职）",
	"f.content": "工作内容", "f.salary": "薪资", "f.salaryAmount": "金额", "f.salaryPeriod": "周期",
	"period.monthly": "月薪", "period.annual": "年薪", "period.hourly": "时薪", "period.total": "总计", "period.other": "其他",
	"badge.current": "在职",
	"f.relation": "与我的关系", "f.group": "分组", "f.contact": "联系方式", "f.tags": "标签（逗号分隔）",
	"f.date": "日期", "f.reflectionTitle": "标题",
	"f.kind": "类型", "kind.bank": "银行卡", "kind.pay": "支付软件", "kind.stock": "股票账户",
	"f.mask": "尾号/标识", "f.balance": "余额", "f.currency": "币种",
	"f.account": "归属账户", "f.code": "代码", "f.market": "市场", "f.shares": "股数", "f.costPrice": "成本价", "f.price": "现价",
	"panel.title": "个人档案",
	"theme.auto": "外观：跟随应用", "theme.light": "外观：浅色", "theme.dark": "外观：深色", "theme.next": " · 点击切换到",
	"dock.title": "个人档案",
	"dock.dock": "在右侧停靠",
	"dock.identity": "基本资料",
	"card.empty": "暂无记录",
	"card.identity.hint": "姓名 / 年龄 / 现居",
	"card.career.count": "段工作经历",
	"card.career.current": "在职",
	"card.relations.count": "位联系人",
	"card.reflections.count": "条感悟",
	"card.accounts": "个账户",
	"card.holdings": "项持仓",
	"card.since": "起",
	"ov.title": "资产速览",
	"ov.open": "打开完整档案",
	"ov.empty": "暂无资产 · 点击录入",
	"ov.updated": "更新于",
	"stat.bank": "银行卡", "stat.pay": "支付软件", "stat.stock": "股票账户余额", "stat.holdings": "持仓市值", "stat.grand": "总资产",
	"holdings.of": "持仓明细",
	"q.live": "实时",
	"q.stale": "休市",
	"confirm.delete": "确认删除？",
	"misc.none": "—",
},
en: {
	"nav.title": "Personal Info",
	"title": "Personal Profile",
	"subtitle": "Identity, career, relationships, reflections and assets; shared with the agent tools.",
	"tab.identity": "Identity",
	"tab.career": "Career",
	"tab.relations": "Relationships",
	"tab.reflections": "Reflections",
	"tab.assets": "Assets",
	"action.save": "Save", "action.cancel": "Cancel", "action.edit": "Edit", "action.delete": "Delete",
	"action.add": "Add", "action.refresh": "Refresh",
	"action.addCareer": "Add position", "action.addRelation": "Add person", "action.addReflection": "Add reflection",
	"action.addAccount": "Add account", "action.addHolding": "Add holding",
	"empty.career": "No career entries yet.",
	"empty.relations": "No people recorded yet.",
	"empty.reflections": "No reflections yet.",
	"empty.assets": "No assets recorded yet.",
	"empty.holdings": "No holdings under this account.",
	"error.load": "Failed to load: ",
	"error.save": "Save failed: ",
	"hint.updatedAt": "Updated",
	"f.name": "Name", "f.gender": "Gender", "f.birthDate": "Birth date", "f.birthplace": "Birthplace",
	"f.origin": "Origin", "f.residence": "Residence", "f.phone": "Phone", "f.email": "Email", "f.notes": "Notes",
	"f.age": "Age",
	"f.company": "Company", "f.title": "Title", "f.location": "Location", "f.startDate": "Start", "f.endDate": "End (blank = current)",
	"f.content": "Work content", "f.salary": "Salary", "f.salaryAmount": "Amount", "f.salaryPeriod": "Period",
	"period.monthly": "Monthly", "period.annual": "Annual", "period.hourly": "Hourly", "period.total": "Total", "period.other": "Other",
	"badge.current": "Current",
	"f.relation": "Relation to me", "f.group": "Group", "f.contact": "Contact", "f.tags": "Tags (comma separated)",
	"f.date": "Date", "f.reflectionTitle": "Title",
	"f.kind": "Type", "kind.bank": "Bank card", "kind.pay": "Payments", "kind.stock": "Stock account",
	"f.mask": "Mask", "f.balance": "Balance", "f.currency": "Currency",
	"f.account": "Account", "f.code": "Code", "f.market": "Market", "f.shares": "Shares", "f.costPrice": "Cost", "f.price": "Price",
	"panel.title": "Profile",
	"theme.auto": "Appearance: follow app", "theme.light": "Appearance: light", "theme.dark": "Appearance: dark", "theme.next": " · click to switch to ",
	"dock.title": "Profile",
	"dock.dock": "Dock to right",
	"dock.identity": "Identity",
	"card.empty": "No records yet",
	"card.identity.hint": "name / age / residence",
	"card.career.count": "positions",
	"card.career.current": "current",
	"card.relations.count": "people",
	"card.reflections.count": "entries",
	"card.accounts": "accounts",
	"card.holdings": "holdings",
	"card.since": "since",
	"ov.title": "Assets",
	"ov.open": "Open full profile",
	"ov.empty": "No assets yet",
	"ov.updated": "Updated",
	"stat.bank": "Bank", "stat.pay": "Payments", "stat.stock": "Stock balance", "stat.holdings": "Holdings value", "stat.grand": "Net total",
	"holdings.of": "Holdings",
	"q.live": "Live",
	"q.stale": "Closed",
	"confirm.delete": "Delete this entry?",
	"misc.none": "—",
},
};
function t(key) {
	const table = UI[UI_LANG] || UI.zh;
	return table[key] !== undefined ? table[key] : (UI.zh[key] !== undefined ? UI.zh[key] : key);
}

// ---------------------------------------------------------------------------
// 面板 API
// ---------------------------------------------------------------------------

async function api(action, payload) {
	const init = action === undefined
		? { credentials: "same-origin" }
		: {
			credentials: "same-origin",
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(Object.assign({ action }, payload)),
		};
	const res = await fetch(ROUTE, init);
	const body = await res.json();
	if (!res.ok || !body.ok) {
		throw new Error((body && body.error && body.error.message) || ("request failed " + res.status));
	}
	return body.value;
}

// ---------------------------------------------------------------------------
// 实时行情（/_dsh/dsh-myinfo/quotes）：多订阅者共享一个轮询循环。
// 盘中 3s（免费快照源的实际极限），休市/页面隐藏时降到 15s；失败保留上次快照。
// ---------------------------------------------------------------------------

const QUOTES_ROUTE = "_dsh/dsh-myinfo/quotes";

const quoteHub = { state: { quotes: null, meta: null }, subs: new Set(), timer: 0, inFlight: false };

function quoteHubNotify() {
	for (const fn of quoteHub.subs) {
		try { fn(quoteHub.state); } catch (e) { /* 单个订阅者出错不影响其他 */ }
	}
}

function quoteHubSchedule(ms) {
	if (quoteHub.timer) return;
	quoteHub.timer = window.setTimeout(quoteHubTick, ms);
}

async function quoteHubTick() {
	quoteHub.timer = 0;
	if (quoteHub.subs.size === 0) return;
	if (typeof document !== "undefined" && document.visibilityState === "hidden") {
		quoteHubSchedule(15000);
		return;
	}
	if (!quoteHub.inFlight) {
		quoteHub.inFlight = true;
		try {
			const res = await fetch(QUOTES_ROUTE, { credentials: "same-origin" });
			const body = await res.json();
			if (res.ok && body.ok) {
				quoteHub.state = { quotes: (body.value && body.value.quotes) || {}, meta: body.value || null };
				quoteHubNotify();
			}
		} catch (e) { /* 保留上次快照，下一轮再试 */ } finally {
			quoteHub.inFlight = false;
		}
	}
	quoteHubSchedule(quoteHub.state.meta && quoteHub.state.meta.live ? 3000 : 15000);
}

/** 订阅实时行情；enabled=false 时不参与轮询并返回空。 */
function useLiveQuotes(enabled) {
	const [state, setState] = useState(quoteHub.state);
	useEffect(() => {
		if (!enabled) return undefined;
		const fn = (s) => setState(s);
		quoteHub.subs.add(fn);
		if (quoteHub.subs.size === 1) quoteHubSchedule(100);
		return () => { quoteHub.subs.delete(fn); };
	}, [enabled]);
	return enabled ? state : { quotes: null, meta: null };
}

/** 有任一持仓命中实时价时返回 { holdingsValue, grand }（CNY 口径），否则 null。 */
function liveAssets(assets, quotes) {
	if (!quotes) return null;
	const holdings = (assets && assets.holdings) || [];
	let sum = 0;
	let hit = false;
	for (const x of holdings) {
		const shares = x.shares === null || x.shares === undefined ? 0 : x.shares;
		const q = quotes[x.code];
		if (q && q.price) { sum += shares * q.price; hit = true; }
		else sum += shares * (x.price ?? x.costPrice ?? 0);
	}
	if (!hit) return null;
	const cny = assets && assets.totals && assets.totals.totals ? assets.totals.totals.CNY : null;
	if (!cny) return null;
	return { holdingsValue: Math.round(sum * 100) / 100, grand: Math.round((cny.grand - cny.holdings + sum) * 100) / 100 };
}

/** A 股惯例：涨红跌绿。 */
function pctColor(pct) {
	if (pct === null || pct === undefined || pct === 0) return "var(--dmi-text-2)";
	return pct > 0 ? "var(--dmi-red)" : "var(--dmi-green)";
}

function fmtPct(pct) {
	return pct === null || pct === undefined ? "" : (pct > 0 ? "+" : "") + pct + "%";
}

// ---------------------------------------------------------------------------
// 样式（dmi-*）
// ---------------------------------------------------------------------------

// Apple 设计语言：SF 字体栈、毛玻璃材质、hairline 分隔、大圆角、克制动效。
// 颜色 token 三层结构：
//   ① 自动（.dmi-scope / .dmi-scope.dmi-auto-dark）：宿主 --dsw-alias-* 变量优先、
//      Apple 字面量兜底——跟随宿主主题，深浅两版只是兜底字面量不同；
//   ② 手动覆盖（.dmi-scope.dmi-force-light / .dmi-force-dark）：纯字面量、不引用
//      dsw 变量——在真实宿主（body 上永远有 dsw 变量）里也能真正切换外观；
// 派生 token（--dmi-text-3/-fill/-fill-2）只在基类定义一次，自动跟随被覆盖的基色。
// 注意：每条声明必须以 ; 结尾——自定义属性的值几乎接受任意 token 流，缺分号会把
// 下一条声明整个吞进值里（v0.4.1 曾因此让所有卡片背景失效）。
const STYLE_CSS = ""
+ ".dmi-scope{--dmi-accent:var(--dsw-alias-brand-primary,#007AFF);--dmi-red:var(--dsw-alias-state-error-primary,#FF3B30);--dmi-green:var(--dsw-alias-state-success-primary,#34C759);--dmi-orange:var(--dsw-alias-state-warn-primary,#FF9500);"
+ "--dmi-text:var(--dsw-alias-label-primary,#1d1d1f);--dmi-text-2:var(--dsw-alias-label-secondary,rgba(60,60,67,.66));--dmi-text-3:color-mix(in srgb,var(--dmi-text-2) 62%,transparent);"
+ "--dmi-sep:var(--dsw-alias-border-l1,rgba(0,0,0,.08));--dmi-fill:color-mix(in srgb,var(--dmi-text) 8%,transparent);--dmi-fill-2:color-mix(in srgb,var(--dmi-text) 14%,transparent);"
+ "--dmi-bg:var(--dsw-alias-bg-overlay,rgba(255,255,255,.72));--dmi-bg-elev:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.88));"
+ "--dmi-shadow:0 10px 40px rgba(0,0,0,.14),0 2px 10px rgba(0,0,0,.06);--dmi-shadow-sm:0 2px 10px rgba(0,0,0,.08);"
+ "font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Helvetica Neue',sans-serif;"
+ "-webkit-font-smoothing:antialiased;color:var(--dmi-text)}"
// 自动深色：仍引用宿主 dsw 变量（跟随宿主），仅兜底字面量换深色。
+ ".dmi-scope.dmi-auto-dark{--dmi-accent:var(--dsw-alias-brand-primary,#0A84FF);--dmi-red:var(--dsw-alias-state-error-primary,#FF453A);--dmi-green:var(--dsw-alias-state-success-primary,#30D158);--dmi-orange:var(--dsw-alias-state-warn-primary,#FF9F0A);"
+ "--dmi-text:var(--dsw-alias-label-primary,#f5f5f7);--dmi-text-2:var(--dsw-alias-label-secondary,rgba(235,235,245,.64));"
+ "--dmi-sep:var(--dsw-alias-border-l1,rgba(255,255,255,.12));"
+ "--dmi-bg:var(--dsw-alias-bg-overlay,rgba(32,32,36,.66));--dmi-bg-elev:var(--dsw-alias-bg-layer-1,rgba(48,48,52,.82));"
+ "--dmi-shadow:0 12px 44px rgba(0,0,0,.5),0 2px 12px rgba(0,0,0,.3);--dmi-shadow-sm:0 2px 12px rgba(0,0,0,.35)}"
// 手动覆盖：字面量直出（不再 var(--dsw-...)），整页表面（dmi-page/dmi-dockpage/dmi-root）补底色。
+ ".dmi-scope.dmi-force-light{--dmi-accent:#007AFF;--dmi-red:#FF3B30;--dmi-green:#34C759;--dmi-orange:#FF9500;"
+ "--dmi-text:#1d1d1f;--dmi-text-2:rgba(60,60,67,.66);--dmi-sep:rgba(0,0,0,.08);"
+ "--dmi-bg:rgba(252,252,253,.94);--dmi-bg-elev:rgba(255,255,255,.96);"
+ "--dmi-shadow:0 10px 40px rgba(0,0,0,.14),0 2px 10px rgba(0,0,0,.06);--dmi-shadow-sm:0 2px 10px rgba(0,0,0,.08)}"
+ ".dmi-scope.dmi-force-dark{--dmi-accent:#0A84FF;--dmi-red:#FF453A;--dmi-green:#30D158;--dmi-orange:#FF9F0A;"
+ "--dmi-text:#f5f5f7;--dmi-text-2:rgba(235,235,245,.64);--dmi-sep:rgba(255,255,255,.12);"
+ "--dmi-bg:rgba(28,28,32,.94);--dmi-bg-elev:rgba(30,30,35,.97);"
+ "--dmi-shadow:0 12px 44px rgba(0,0,0,.5),0 2px 12px rgba(0,0,0,.3);--dmi-shadow-sm:0 2px 12px rgba(0,0,0,.35)}"
+ ".dmi-scope.dmi-force-light.dmi-page,.dmi-scope.dmi-force-dark.dmi-page,"
+ ".dmi-scope.dmi-force-light.dmi-dockpage,.dmi-scope.dmi-force-dark.dmi-dockpage{background:var(--dmi-bg-elev)}"
+ ".dmi-scope.dmi-force-light .dmi-root,.dmi-scope.dmi-force-dark .dmi-root{background:var(--dmi-bg-elev);border-radius:14px}"
+ ".dmi-scope *{box-sizing:border-box}"
// —— 通用控件：按钮（iOS fill / tinted / plain）、输入、分段控件 ——
+ ".dmi-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:6px 16px;font-size:13px;font-weight:500;border-radius:999px;cursor:pointer;border:none;background:var(--dmi-fill);color:var(--dmi-text);transition:background .18s,transform .12s,opacity .18s;white-space:nowrap;font-family:inherit}"
+ ".dmi-btn:hover:not(:disabled){background:var(--dmi-fill-2)}"
+ ".dmi-btn:active:not(:disabled){transform:scale(.96)}"
+ ".dmi-btn:disabled{opacity:.4;cursor:default}"
+ ".dmi-btn--sm{padding:3px 12px;font-size:12px}"
+ ".dmi-btn--primary{background:var(--dmi-accent);color:#fff}"
+ ".dmi-btn--primary:hover:not(:disabled){background:var(--dmi-accent);filter:brightness(1.08)}"
+ ".dmi-btn--danger{color:var(--dmi-red);background:transparent}"
+ ".dmi-btn--danger:hover:not(:disabled){background:rgba(255,59,48,.1)}"
+ ".dmi-seg{display:inline-flex;background:var(--dmi-fill);border-radius:10px;padding:2px;gap:2px}"
+ ".dmi-seg button{border:none;background:transparent;padding:5px 14px;border-radius:8px;font:inherit;font-size:13px;color:var(--dmi-text-2);cursor:pointer;transition:color .18s,background .18s,box-shadow .18s;white-space:nowrap}"
+ ".dmi-seg button:hover{color:var(--dmi-text)}"
+ ".dmi-seg button.is-active{background:var(--dmi-bg-elev);color:var(--dmi-text);font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.06)}"
+ ".dmi-input,.dmi-select,.dmi-textarea{padding:7px 12px;border-radius:10px;border:none;background:var(--dmi-fill);color:var(--dmi-text);font-size:13px;font-family:inherit;width:100%;transition:box-shadow .18s,background .18s;outline:none}"
+ ".dmi-input:focus,.dmi-select:focus,.dmi-textarea:focus{background:var(--dmi-bg-elev);box-shadow:0 0 0 3px color-mix(in srgb,var(--dmi-accent) 30%,transparent)}"
+ ".dmi-textarea{min-height:76px;resize:vertical;line-height:1.55}"
+ ".dmi-input::placeholder,.dmi-textarea::placeholder{color:var(--dmi-text-3)}"
// —— 布局骨架 ——
+ ".dmi-root{display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.5}"
+ ".dmi-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px}"
+ ".dmi-head h3{margin:0;font-size:20px;font-weight:700;letter-spacing:-.3px}"
+ ".dmi-sub{opacity:.65;font-size:12px}"
+ ".dmi-updated{margin-left:auto;color:var(--dmi-text-3);font-size:11px}"
+ ".dmi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px}"
+ ".dmi-card{border:1px solid var(--dmi-sep);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;background:var(--dmi-bg-elev);box-shadow:var(--dmi-shadow-sm);transition:transform .18s}"
+ ".dmi-card:hover{transform:translateY(-1px)}"
+ ".dmi-card-head{display:flex;align-items:center;gap:8px}"
+ ".dmi-card-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.2px}"
+ ".dmi-kv{display:flex;flex-wrap:wrap;gap:6px 12px;color:var(--dmi-text-2)}"
+ ".dmi-muted{color:var(--dmi-text-3)}"
+ ".dmi-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}"
+ ".dmi-form{border:1px solid var(--dmi-sep);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--dmi-bg-elev);box-shadow:var(--dmi-shadow-sm)}"
+ ".dmi-fieldrow{display:grid;grid-template-columns:repeat(auto-fill,minmax(214px,1fr));gap:12px}"
+ ".dmi-field{display:flex;flex-direction:column;gap:5px;min-width:0}"
+ ".dmi-field>span{font-size:12px;color:var(--dmi-text-2)}"
+ ".dmi-field-wide{grid-column:1 / -1}"
+ ".dmi-empty{color:var(--dmi-text-3);padding:20px 6px;text-align:center;font-size:13px}"
+ ".dmi-error{border:none;background:rgba(255,59,48,.1);color:var(--dmi-red);border-radius:12px;padding:9px 14px;white-space:pre-wrap;font-size:13px}"
+ ".dmi-timeline-year{font-weight:700;margin:14px 0 6px;font-size:15px;letter-spacing:-.2px}"
// —— 芯片与统计 ——
+ ".dmi-chip{display:inline-flex;align-items:center;padding:2px 11px;border-radius:999px;font-size:12px;white-space:nowrap;background:var(--dmi-fill);color:var(--dmi-text-2);border:none;font-weight:500}"
+ ".dmi-chip--ok{background:rgba(52,199,89,.12);color:var(--dmi-green)}"
+ ".dmi-chip--money{background:color-mix(in srgb,var(--dmi-accent) 12%,transparent);color:var(--dmi-accent);font-variant-numeric:tabular-nums}"
+ ".dmi-chip--warn{background:rgba(255,149,0,.12);color:var(--dmi-orange)}"
+ ".dmi-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(156px,1fr));gap:12px}"
+ ".dmi-stat{border:1px solid var(--dmi-sep);border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;background:var(--dmi-bg-elev);box-shadow:var(--dmi-shadow-sm)}"
+ ".dmi-stat b{font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:-.3px}"
+ ".dmi-stat span{font-size:11px;color:var(--dmi-text-3)}"
+ ".dmi-stat--hero{grid-column:1 / -1;background:linear-gradient(135deg,color-mix(in srgb,var(--dmi-accent) 10%,transparent),transparent);border-color:color-mix(in srgb,var(--dmi-accent) 24%,var(--dmi-sep))}"
+ ".dmi-stat--hero b{font-size:30px;font-weight:700;letter-spacing:-.6px}"
+ ".dmi-table{width:100%;border-collapse:collapse;font-size:13px}"
+ ".dmi-table th,.dmi-table td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--dmi-sep);font-variant-numeric:tabular-nums}"
+ ".dmi-table th{font-size:11px;color:var(--dmi-text-3);font-weight:500;text-transform:none}"
+ ".dmi-section-title{font-weight:650;margin:10px 0 4px;font-size:14px;letter-spacing:-.2px}"
// —— 主面板（main keyed slot）页面 ——
+ ".dmi-page{height:100%;display:flex;flex-direction:column;min-height:0;overflow:auto;padding:28px 32px 40px;scrollbar-width:thin}"
+ ".dmi-page-head{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;margin-bottom:18px}"
+ ".dmi-page-title{font-size:28px;font-weight:750;letter-spacing:-.6px;margin:0}"
+ ".dmi-page-sub{color:var(--dmi-text-2);font-size:13px;margin-top:4px}"
// —— 浮窗（shell.overlay，position:fixed 自绘） ——
+ ".dmi-ov{position:fixed;right:20px;bottom:20px;z-index:9990;pointer-events:auto;font-variant-numeric:tabular-nums}"
+ ".dmi-ov-pill{display:flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;background:var(--dmi-bg);border:1px solid var(--dmi-sep);box-shadow:var(--dmi-shadow);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);color:var(--dmi-text);cursor:pointer;font-size:13px;font-weight:600;letter-spacing:-.2px;transition:transform .18s,box-shadow .18s;user-select:none}"
+ ".dmi-ov-pill:hover{transform:translateY(-2px);box-shadow:0 14px 46px rgba(0,0,0,.2)}"
+ ".dmi-ov-pill b{font-size:15px;letter-spacing:-.3px}"
+ ".dmi-ov-dot{width:8px;height:8px;border-radius:50%;background:var(--dmi-green);box-shadow:0 0 6px var(--dmi-green)}"
+ ".dmi-ov-card{width:328px;border-radius:22px;background:var(--dmi-bg);border:1px solid var(--dmi-sep);box-shadow:var(--dmi-shadow);backdrop-filter:blur(32px) saturate(180%);-webkit-backdrop-filter:blur(32px) saturate(180%);overflow:hidden;color:var(--dmi-text);display:flex;flex-direction:column;animation:dmi-ov-in .28s cubic-bezier(.25,.1,.25,1)}"
+ "@keyframes dmi-ov-in{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}"
+ ".dmi-ov-head{display:flex;align-items:center;gap:8px;padding:14px 16px 6px}"
+ ".dmi-ov-title{font-weight:650;font-size:13px;flex:1;letter-spacing:-.2px}"
+ ".dmi-ov-x{border:none;background:var(--dmi-fill);color:var(--dmi-text-2);width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:11px;line-height:1;display:inline-flex;align-items:center;justify-content:center}"
+ ".dmi-ov-x:hover{background:var(--dmi-fill-2);color:var(--dmi-text)}"
+ ".dmi-ov-hero{padding:4px 18px 12px;display:flex;flex-direction:column;gap:2px}"
+ ".dmi-ov-hero b{font-size:30px;font-weight:750;letter-spacing:-.8px}"
+ ".dmi-ov-hero span{font-size:11px;color:var(--dmi-text-3)}"
+ ".dmi-ov-rows{padding:2px 10px 8px;display:flex;flex-direction:column}"
+ ".dmi-ov-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px}"
+ ".dmi-ov-row:hover{background:var(--dmi-fill)}"
+ ".dmi-ov-row-ico{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;background:var(--dmi-fill);flex:none}"
+ ".dmi-ov-row-label{flex:1;font-size:13px;font-weight:500}"
+ ".dmi-ov-row-val{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}"
+ ".dmi-ov-foot{display:flex;gap:8px;padding:10px 14px 14px;border-top:none}"
// —— 卡片式仪表盘（主面板：卡片外层摘要，点入域详情）——
+ ".dmi-page>*{max-width:960px;margin-left:auto;margin-right:auto}"
+ ".dmi-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,264px),1fr));gap:16px;margin:6px 0 12px;max-width:920px}"
+ ".dmi-cardnav{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:16px 42px 15px 16px;border:1px solid var(--dmi-sep);border-radius:18px;background:var(--dmi-bg-elev);box-shadow:var(--dmi-shadow-sm);cursor:pointer;text-align:left;font-family:inherit;color:var(--dmi-text);transition:transform .2s cubic-bezier(.25,.1,.25,1),box-shadow .2s;-webkit-tap-highlight-color:transparent}"
+ ".dmi-cardnav:hover{transform:translateY(-3px);box-shadow:var(--dmi-shadow)}"
+ ".dmi-cardnav:active{transform:scale(.98)}"
+ ".dmi-cardnav:focus-visible{outline:2px solid var(--dmi-accent);outline-offset:2px}"
+ ".dmi-cardnav-ico{width:38px;height:38px;border-radius:10px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:#fff;margin-bottom:8px}"
+ ".dmi-ico-identity{background:linear-gradient(160deg,#0A84FF,#0055D7)}"
+ ".dmi-ico-career{background:linear-gradient(160deg,#FF9F0A,#FF6A00)}"
+ ".dmi-ico-relations{background:linear-gradient(160deg,#FF375F,#D70015)}"
+ ".dmi-ico-reflections{background:linear-gradient(160deg,#BF5AF2,#8944AB)}"
+ ".dmi-ico-assets{background:linear-gradient(160deg,#30D158,#0E9F13)}"
+ ".dmi-cardnav-body{min-width:0;width:100%;display:flex;flex-direction:column;gap:3px}"
+ ".dmi-cardnav-title{font-size:12.5px;font-weight:600;color:var(--dmi-text-2);letter-spacing:-.05px}"
+ ".dmi-cardnav-stat{font-size:17px;font-weight:750;letter-spacing:-.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}"
+ ".dmi-cardnav-stat.is-empty{color:var(--dmi-text-3);font-weight:500;font-size:14px}"
+ ".dmi-cardnav-sub{font-size:12px;color:var(--dmi-text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}"
+ ".dmi-cardnav-chev{position:absolute;top:50%;right:15px;transform:translateY(-50%);color:var(--dmi-text-3);font-size:20px;line-height:1}"
+ ".dmi-detail-head{display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap;animation:dmi-detail-in .26s cubic-bezier(.25,.1,.25,1)}"
+ ".dmi-back{display:inline-flex;align-items:center;gap:3px;padding:6px 13px 6px 9px;border-radius:999px;border:none;background:var(--dmi-fill);color:var(--dmi-text);cursor:pointer;font:inherit;font-size:13px;font-weight:600;transition:background .18s,transform .12s}"
+ ".dmi-back:hover{background:var(--dmi-fill-2)}"
+ ".dmi-back:active{transform:scale(.96)}"
+ ".dmi-detail-title{font-size:27px;font-weight:750;letter-spacing:-.7px;flex:1;min-width:0;margin:0}"
+ ".dmi-detail-body{animation:dmi-detail-in .3s cubic-bezier(.25,.1,.25,1)}"
+ "@keyframes dmi-detail-in{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}";
// —— 右栏停靠：与主面板同款的域卡片网格（窄列单列堆叠）——
+ ".dmi-cards--dock{margin:0;max-width:none}";


/** 作用域主题类：手动覆盖 → force-*（字面量直出，真实宿主里也真实生效）；
 * 自动模式 → auto-dark（跟随宿主 dsw 令牌，仅兜底字面量分深浅）。 */
function scopeClassOf(ctx) {
	if (manualTheme === "dark") return " dmi-force-dark";
	if (manualTheme === "light") return " dmi-force-light";
	return autoDark(ctx) ? " dmi-auto-dark" : "";
}


/** 样式只注入一次：挂载/卸载往返不会在文档里叠加重复的 <style> 节点。 */
var styleInjected = false;
function ensureStyle() {
	if (styleInjected || typeof document === "undefined") return;
	if (document.getElementById("dsh-myinfo-style") !== null) {
		styleInjected = true;
		return;
	}
	const el = document.createElement("style");
	el.id = "dsh-myinfo-style";
	el.textContent = STYLE_CSS;
	document.head.appendChild(el);
	styleInjected = true;
}


// ---------------------------------------------------------------------------
// 外观：手动深浅切换（localStorage 持久化）；未手动选择时自动判定（dsw 亮度实算 > theme id 启发 > 系统偏好）
// ---------------------------------------------------------------------------

const THEME_KEY = "dsh-myinfo.theme"; // "light" | "dark" | 无（自动）
var manualTheme = null;
try { manualTheme = localStorage.getItem(THEME_KEY) || null; } catch (e) { /* 无 localStorage 则仅内存态 */ }
var themeListeners = new Set();
function setManualTheme(mode) {
	manualTheme = mode;
	try {
		if (mode) localStorage.setItem(THEME_KEY, mode);
		else localStorage.removeItem(THEME_KEY);
	} catch (e) { /* 忽略持久化失败 */ }
	for (const fn of themeListeners) { try { fn(); } catch (e2) {} }
}
function systemDark() {
	return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
}

/** 解析 CSS 颜色为相对亮度 L = 0.2126R+0.7152G+0.0722B（各通道归一到 0-1，忽略 alpha）。
 *  支持 #rgb/#rgba 简写、#rrggbb/#rrggbbaa、rgb()/rgba()（整数或百分比，逗号/空格分隔）。
 *  无法解析返回 null，调用方据此落到下一优先级。 */
function parseColorLuminance(css) {
	if (typeof css !== "string") return null;
	const s = css.trim().toLowerCase();
	let m;
	if ((m = s.match(/^#([0-9a-f]+)$/))) {
		const hex = m[1];
		const dbl = (x) => parseInt(x + x, 16) / 255;
		if (hex.length === 3 || hex.length === 4) {
			return 0.2126 * dbl(hex[0]) + 0.7152 * dbl(hex[1]) + 0.0722 * dbl(hex[2]);
		}
		if (hex.length === 6 || hex.length === 8) {
			return 0.2126 * (parseInt(hex.slice(0, 2), 16) / 255)
				+ 0.7152 * (parseInt(hex.slice(2, 4), 16) / 255)
				+ 0.0722 * (parseInt(hex.slice(4, 6), 16) / 255);
		}
		return null;
	}
	if ((m = s.match(/^rgba?\(([^)]+)\)$/))) {
		const parts = m[1].split(/[\s,\/]+/).filter(Boolean).slice(0, 3);
		if (parts.length < 3) return null;
		const chan = [];
		for (const part of parts) {
			const pm = part.match(/^([0-9.]+)(%)?$/);
			if (!pm) return null;
			const v = Number(pm[1]);
			if (!isFinite(v)) return null;
			const one = pm[2] ? v / 100 : v / 255; // 百分比 0-100 → 0-1；整数 0-255 → 0-1
			chan.push(Math.min(1, Math.max(0, one)));
		}
		return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
	}
	return null;
}

/** 自动明暗判定链：① 宿主 --dsw-alias-bg-base 实算亮度（L < 0.5 判深）
 *  ② theme 服务 id 启发（含 dark 判深；light/day/default 前缀才判浅，未识别 id 不强制浅色）
 *  ③ 系统 prefers-color-scheme。手动覆盖（force-*）在 scopeClassOf 中优先于本链。 */
function autoDark(ctx) {
	// ① dsw token 实算：宿主把 --dsw-alias-* 定义在 body（body{} 与 body[data-ds-dark-theme]{}，
	// ThemePresenter 也只写 body.style），自定义属性只向子孙继承，必须读 body 而非 documentElement。
	try {
		if (typeof document !== "undefined" && typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
			const host = document.body || document.documentElement;
			if (host) {
				const raw = window.getComputedStyle(host).getPropertyValue("--dsw-alias-bg-base");
				if (raw && raw.trim() !== "") {
					const lum = parseColorLuminance(raw);
					if (lum !== null) return lum < 0.5;
				}
			}
		}
	} catch (e) { /* 落到 theme 快照判定 */ }
	// ② theme 快照判定：active.colorScheme 优先，旧式 id 启发兜底（未识别 id 不再一律强制浅色）。
	try {
		const theme = (ctx && ctx.theme) || (typeof ctx.get === "function" ? ctx.get("theme") : undefined);
		if (theme && typeof theme.getTheme === "function") {
			const snap = theme.getTheme();
			// 宿主快照的权威判据是 active.colorScheme（'dark'/'light'），系统解析在上游完成；
			// 顶层 dark/id/themeId 字段在真实 ThemeSnapshot 中并不存在。
			if (snap && snap.active && snap.active.colorScheme === "dark") return true;
			if (snap && snap.active && snap.active.colorScheme === "light") return false;
			if (snap && snap.dark === true) return true;
			const id = String((snap && (snap.id || snap.themeId)) || "").toLowerCase();
			if (id !== "") {
				if (id.indexOf("dark") >= 0) return true;
				if (/^(light|day|default)/.test(id)) return false;
			}
		}
	} catch (e) { /* 回退系统偏好 */ }
	// ③ 系统偏好。
	return systemDark();
}
/** 主题变化时让当前组件重渲染：手动切换要改 scope 类（force-*），
 * 而 scope 类在 Section/Panel/Dock/Overlay 的根元素上——它们必须订阅主题。 */
function useThemeTick() {
	const [, tick] = useState(0);
	useEffect(() => {
		const fn = () => tick((v) => v + 1);
		themeListeners.add(fn);
		return () => { themeListeners.delete(fn); };
	}, []);
}

/** 外观切换（三态循环 自动→浅色→深色）：自动跟随宿主；手动用字面量覆盖真实生效。 */
function ThemeToggle(props) {
	const [, tick] = useState(0);
	useEffect(() => {
		const fn = () => tick((v) => v + 1);
		themeListeners.add(fn);
		return () => { themeListeners.delete(fn); };
	}, []);
	const mode = manualTheme; // null=自动 | "light" | "dark"
	const next = mode === null ? "light" : mode === "light" ? "dark" : null;
	const cur = mode === "dark" ? t("theme.dark") : mode === "light" ? t("theme.light") : t("theme.auto");
	const label = cur + t("theme.next") + (next === "dark" ? t("theme.dark") : next === "light" ? t("theme.light") : t("theme.auto"));
	return h("button", {
		className: "dmi-btn dmi-btn--sm",
		title: label,
		"aria-label": label,
		onClick: () => setManualTheme(next),
	}, mode === "dark" ? "🌙" : mode === "light" ? "☀️" : "🌗");
}

// ---------------------------------------------------------------------------
// 共享数据流：面板 API 的加载/提交（设置页、主面板、浮窗共用）
// ---------------------------------------------------------------------------

function useMyInfoData() {
	const [view, setView] = useState(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const alive = useRef(true);
	useEffect(() => () => { alive.current = false; }, []);
	const load = useCallback(async () => {
		setBusy(true);
		try {
			const value = await api(undefined);
			if (!alive.current) return;
			setView(value);
			setError("");
		} catch (err) {
			if (alive.current) setError(t("error.load") + String(err && err.message ? err.message : err));
		} finally {
			if (alive.current) setBusy(false);
		}
	}, []);
	const post = useCallback(async (action, payload) => {
		setBusy(true);
		try {
			await api(action, payload);
			await load();
		} catch (err) {
			if (alive.current) setError(t("error.save") + String(err && err.message ? err.message : err));
		} finally {
			if (alive.current) setBusy(false);
		}
	}, [load]);
	return { view, error, busy, load, post };
}

// ---------------------------------------------------------------------------
// 小组件
// ---------------------------------------------------------------------------

function Btn(props) {
	const busy = props.busy === true;
	const disabled = props.disabled === true || busy;
	let className = "dmi-btn" + (props.size === "sm" ? " dmi-btn--sm" : "") + (props.variant === "primary" ? " dmi-btn--primary" : "") + (props.variant === "danger" ? " dmi-btn--danger" : "");
	return h("button", { className, onClick: props.onClick, disabled, title: props.title || "" }, busy ? "…" : null, props.children);
}

function Chip(props) {
	// tone 为空时只输出基类，避免残留的 `dmi-chip--` 空修饰类。
	return h("span", { className: props.tone ? "dmi-chip dmi-chip--" + props.tone : "dmi-chip", title: props.title || "" }, props.children);
}

function Field(props, children) {
	// 直接调用模式 Field({…}, Input({…}))：children 是第二个位置参数。
	// 早期版本只读 props.children（永远 undefined）——表单只显示标签、没有输入框。
	return h("div", { className: "dmi-field" + (props.wide ? " dmi-field-wide" : "") },
		h("span", null, props.label),
		children);
}

function Input(props) {
	return h("input", {
		className: "dmi-input",
		type: props.type || "text",
		value: props.value === undefined || props.value === null ? "" : props.value,
		placeholder: props.placeholder || "",
		onChange: (e) => props.onChange(e.target.value),
	});
}

function TextArea(props) {
	return h("textarea", {
		className: "dmi-textarea",
		value: props.value === undefined || props.value === null ? "" : props.value,
		placeholder: props.placeholder || "",
		onChange: (e) => props.onChange(e.target.value),
	});
}

function Select(props, children) {
	// 同 Field：options 作为第二个位置参数传入（直接调用模式）。
	return h("select", {
		className: "dmi-select",
		value: props.value === undefined || props.value === null ? "" : props.value,
		onChange: (e) => props.onChange(e.target.value),
	}, children);
}

function fmtMoney(value, currency) {
	if (value === undefined || value === null) return t("misc.none");
	const symbol = (currency || "CNY") === "CNY" ? "¥" : (currency || "") + " ";
	return symbol + Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtWhen(value) {
	return value || "";
}

// ---------------------------------------------------------------------------
// 页签：基本信息
// ---------------------------------------------------------------------------

function IdentityTab(props) {
	const { view, post, busy } = props;
	const [form, setForm] = useState(null);
	const id = view.identity || {};
	const setF = (key) => (v) => setForm(Object.assign({}, form, { [key]: v }));

	if (form !== null) {
		return h("div", { className: "dmi-form" },
			h("div", { className: "dmi-fieldrow" },
				Field({ label: t("f.name") }, Input({ value: form.name, onChange: setF("name") })),
				Field({ label: t("f.gender") }, Input({ value: form.gender, onChange: setF("gender") })),
				Field({ label: t("f.birthDate") }, Input({ type: "date", value: form.birthDate, onChange: setF("birthDate") })),
				Field({ label: t("f.birthplace") }, Input({ value: form.birthplace, onChange: setF("birthplace") })),
				Field({ label: t("f.origin") }, Input({ value: form.origin, onChange: setF("origin") })),
				Field({ label: t("f.residence") }, Input({ value: form.residence, onChange: setF("residence") })),
				Field({ label: t("f.phone") }, Input({ value: form.phone, onChange: setF("phone") })),
				Field({ label: t("f.email") }, Input({ value: form.email, onChange: setF("email") })),
				Field({ label: t("f.notes"), wide: true }, TextArea({ value: form.notes, onChange: setF("notes") }))),
			h("div", { className: "dmi-actions" },
				h(Btn, { variant: "primary", busy, onClick: () => post("identity-patch", { patch: form }).then(() => setForm(null)) }, t("action.save")),
				h(Btn, { onClick: () => setForm(null) }, t("action.cancel"))));
	}
	const rows = [
		[t("f.name"), id.name], [t("f.gender"), id.gender], [t("f.birthDate"), id.birthDate],
		[t("f.age"), id.age === null || id.age === undefined ? "" : (UI_LANG === "zh" ? id.age + " 岁" : id.age + " yrs")],
		[t("f.birthplace"), id.birthplace], [t("f.origin"), id.origin], [t("f.residence"), id.residence],
		[t("f.phone"), id.phone], [t("f.email"), id.email],
	];
	return h("div", { className: "dmi-root" },
		h("div", { className: "dmi-grid" },
			rows.filter((r) => r[1]).map((r, i) => h("div", { key: i, className: "dmi-card" },
				h("div", { className: "dmi-card-head" }, h("span", { className: "dmi-card-title" }, String(r[1]))),
				h("div", { className: "dmi-muted" }, r[0]))),
			id.notes ? h("div", { className: "dmi-card", style: { gridColumn: "1 / -1" } },
				h("div", { className: "dmi-muted" }, t("f.notes")),
				h("div", { style: { whiteSpace: "pre-wrap" } }, id.notes)) : null),
		h("div", { className: "dmi-actions" },
			h(Btn, { onClick: () => setForm({ name: id.name || "", gender: id.gender || "", birthDate: id.birthDate || "", birthplace: id.birthplace || "", origin: id.origin || "", residence: id.residence || "", phone: id.phone || "", email: id.email || "", notes: id.notes || "" }) }, t("action.edit"))));
}

// ---------------------------------------------------------------------------
// 页签：工作经历
// ---------------------------------------------------------------------------

function careerFormOf(entry) {
	const salary = (entry && entry.salary) || {};
	return {
		company: (entry && entry.company) || "",
		title: (entry && entry.title) || "",
		location: (entry && entry.location) || "",
		startDate: (entry && entry.startDate) || "",
		endDate: (entry && entry.endDate) || "",
		content: (entry && entry.content) || "",
		salaryAmount: salary.amount === undefined || salary.amount === null ? "" : String(salary.amount),
		salaryPeriod: salary.period || "monthly",
		salaryCurrency: salary.currency || "CNY",
		salaryNotes: salary.notes || "",
	};
}

function CareerTab(props) {
	const { view, post, busy } = props;
	const [editing, setEditing] = useState(null); // null | {id: null|string, form: {...}}
	const career = view.career || [];

	if (editing !== null) {
		const f = editing.form;
		const setF = (key) => (v) => setEditing(Object.assign({}, editing, { form: Object.assign({}, f, { [key]: v }) }));
		const save = () => post("career-save", {
			id: editing.id || "",
			entry: {
				company: f.company, title: f.title, location: f.location,
				startDate: f.startDate, endDate: f.endDate, content: f.content,
				salary: { amount: f.salaryAmount === "" ? null : Number(f.salaryAmount), period: f.salaryPeriod, currency: f.salaryCurrency, notes: f.salaryNotes },
			},
		}).then(() => setEditing(null));
		return h("div", { className: "dmi-form" },
			h("div", { className: "dmi-fieldrow" },
				Field({ label: t("f.company") }, Input({ value: f.company, onChange: setF("company") })),
				Field({ label: t("f.title") }, Input({ value: f.title, onChange: setF("title") })),
				Field({ label: t("f.location") }, Input({ value: f.location, onChange: setF("location") })),
				Field({ label: t("f.startDate") }, Input({ value: f.startDate, placeholder: "YYYY-MM", onChange: setF("startDate") })),
				Field({ label: t("f.endDate") }, Input({ value: f.endDate, placeholder: "YYYY-MM", onChange: setF("endDate") })),
				Field({ label: t("f.salaryAmount") }, Input({ type: "number", value: f.salaryAmount, onChange: setF("salaryAmount") })),
				Field({ label: t("f.salaryPeriod") },
					Select({ value: f.salaryPeriod, onChange: setF("salaryPeriod") },
						["monthly", "annual", "hourly", "total", "other"].map((p) => h("option", { key: p, value: p }, t("period." + p))))),
				Field({ label: t("f.salaryCurrency") }, Input({ value: f.salaryCurrency, placeholder: "CNY", onChange: setF("salaryCurrency") })),
				Field({ label: t("f.content"), wide: true }, TextArea({ value: f.content, onChange: setF("content") }))),
			h("div", { className: "dmi-actions" },
				h(Btn, { variant: "primary", busy, onClick: save }, t("action.save")),
				h(Btn, { onClick: () => setEditing(null) }, t("action.cancel"))));
	}

	return h("div", { className: "dmi-root" },
		career.length === 0 ? h("div", { className: "dmi-empty" }, t("empty.career")) :
		h("div", { className: "dmi-grid" }, career.map((entry) => {
			const salary = entry.salary || {};
			return h("div", { key: entry.id, className: "dmi-card" },
				h("div", { className: "dmi-card-head" },
					h("span", { className: "dmi-card-title", title: entry.company }, entry.company + " · " + entry.title),
					entry.current ? h(Chip, { tone: "ok" }, t("badge.current")) : null),
				h("div", { className: "dmi-kv" },
					h("span", null, fmtWhen(entry.startDate) + " ~ " + (entry.endDate || t("badge.current"))),
					entry.location ? h("span", null, entry.location) : null),
				salary.amount !== null && salary.amount !== undefined
					? h("div", { className: "dmi-kv" }, h(Chip, { tone: "money" }, fmtMoney(salary.amount, salary.currency) + " /" + ({ monthly: "月", annual: "年", hourly: "时", total: "计", other: "" }[salary.period] || "")), salary.notes ? h("span", { className: "dmi-muted" }, salary.notes) : null)
					: null,
				entry.content ? h("div", { style: { whiteSpace: "pre-wrap", opacity: .85, maxHeight: "84px", overflow: "hidden" } }, entry.content) : null,
				h("div", { className: "dmi-actions" },
					h(Btn, { size: "sm", onClick: () => setEditing({ id: entry.id, form: careerFormOf(entry) }) }, t("action.edit")),
					h(Btn, { size: "sm", variant: "danger", onClick: () => { if (window.confirm(t("confirm.delete"))) post("career-delete", { id: entry.id }); } }, t("action.delete"))));
		})),
		h("div", { className: "dmi-actions" },
			h(Btn, { onClick: () => setEditing({ id: null, form: careerFormOf(null) }) }, t("action.addCareer"))));
}

// ---------------------------------------------------------------------------
// 页签：人际关系
// ---------------------------------------------------------------------------

function relationFormOf(entry) {
	return {
		name: (entry && entry.name) || "",
		relation: (entry && entry.relation) || "",
		group: (entry && entry.group) || "",
		contact: (entry && entry.contact) || "",
		notes: (entry && entry.notes) || "",
		tags: ((entry && entry.tags) || []).join(", "),
	};
}

function RelationsTab(props) {
	const { view, post, busy } = props;
	const [editing, setEditing] = useState(null);
	const relations = view.relations || [];

	if (editing !== null) {
		const f = editing.form;
		const setF = (key) => (v) => setEditing(Object.assign({}, editing, { form: Object.assign({}, f, { [key]: v }) }));
		const save = () => post("relation-save", {
			id: editing.id || "",
			entry: {
				name: f.name, relation: f.relation, group: f.group, contact: f.contact, notes: f.notes,
				tags: f.tags.split(/[,，]/).map((x) => x.trim()).filter(Boolean),
			},
		}).then(() => setEditing(null));
		return h("div", { className: "dmi-form" },
			h("div", { className: "dmi-fieldrow" },
				Field({ label: t("f.name") }, Input({ value: f.name, onChange: setF("name") })),
				Field({ label: t("f.relation") }, Input({ value: f.relation, onChange: setF("relation") })),
				Field({ label: t("f.group") }, Input({ value: f.group, placeholder: UI_LANG === "zh" ? "家人/朋友/同事/同学…" : "family/friend/colleague…", onChange: setF("group") })),
				Field({ label: t("f.contact") }, Input({ value: f.contact, onChange: setF("contact") })),
				Field({ label: t("f.tags") }, Input({ value: f.tags, onChange: setF("tags") })),
				Field({ label: t("f.notes"), wide: true }, TextArea({ value: f.notes, onChange: setF("notes") }))),
			h("div", { className: "dmi-actions" },
				h(Btn, { variant: "primary", busy, onClick: save }, t("action.save")),
				h(Btn, { onClick: () => setEditing(null) }, t("action.cancel"))));
	}

	return h("div", { className: "dmi-root" },
		relations.length === 0 ? h("div", { className: "dmi-empty" }, t("empty.relations")) :
		h("div", { className: "dmi-grid" }, relations.map((entry) => h("div", { key: entry.id, className: "dmi-card" },
			h("div", { className: "dmi-card-head" },
				h("span", { className: "dmi-card-title" }, entry.name),
				h(Chip, null, entry.relation)),
			h("div", { className: "dmi-kv" },
				entry.group ? h("span", { className: "dmi-muted" }, entry.group) : null,
				entry.contact ? h("span", null, entry.contact) : null),
			(entry.tags || []).length > 0 ? h("div", { className: "dmi-kv" }, entry.tags.map((tag) => h(Chip, { key: tag }, tag))) : null,
			entry.notes ? h("div", { style: { whiteSpace: "pre-wrap", opacity: .8, maxHeight: "70px", overflow: "hidden" } }, entry.notes) : null,
			h("div", { className: "dmi-actions" },
				h(Btn, { size: "sm", onClick: () => setEditing({ id: entry.id, form: relationFormOf(entry) }) }, t("action.edit")),
				h(Btn, { size: "sm", variant: "danger", onClick: () => { if (window.confirm(t("confirm.delete"))) post("relation-delete", { id: entry.id }); } }, t("action.delete")))))),
		h("div", { className: "dmi-actions" },
			h(Btn, { onClick: () => setEditing({ id: null, form: relationFormOf(null) }) }, t("action.addRelation"))));
}

// ---------------------------------------------------------------------------
// 页签：人生感悟
// ---------------------------------------------------------------------------

function reflectionFormOf(entry, todayStr) {
	return {
		date: (entry && entry.date) || todayStr,
		title: (entry && entry.title) || "",
		content: (entry && entry.content) || "",
		tags: ((entry && entry.tags) || []).join(", "),
	};
}

function ReflectionsTab(props) {
	const { view, post, busy } = props;
	const [editing, setEditing] = useState(null);
	const reflections = view.reflections || [];
	const now = new Date();
	const todayStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");

	if (editing !== null) {
		const f = editing.form;
		const setF = (key) => (v) => setEditing(Object.assign({}, editing, { form: Object.assign({}, f, { [key]: v }) }));
		const save = () => post("reflection-save", {
			id: editing.id || "",
			entry: { date: f.date, title: f.title, content: f.content, tags: f.tags.split(/[,，]/).map((x) => x.trim()).filter(Boolean) },
		}).then(() => setEditing(null));
		return h("div", { className: "dmi-form" },
			h("div", { className: "dmi-fieldrow" },
				Field({ label: t("f.date") }, Input({ type: "date", value: f.date, onChange: setF("date") })),
				Field({ label: t("f.reflectionTitle") }, Input({ value: f.title, onChange: setF("title") })),
				Field({ label: t("f.tags") }, Input({ value: f.tags, onChange: setF("tags") })),
				Field({ label: t("f.reflectionContent"), wide: true }, TextArea({ value: f.content, onChange: setF("content") }))),
			h("div", { className: "dmi-actions" },
				h(Btn, { variant: "primary", busy, onClick: save }, t("action.save")),
				h(Btn, { onClick: () => setEditing(null) }, t("action.cancel"))));
	}

	let lastYear = "";
	return h("div", { className: "dmi-root" },
		reflections.length === 0 ? h("div", { className: "dmi-empty" }, t("empty.reflections")) :
		h("div", null, reflections.map((entry) => {
			const year = entry.date.slice(0, 4);
			const header = year !== lastYear ? h("div", { key: "y" + year, className: "dmi-timeline-year" }, year) : null;
			lastYear = year;
			return h("div", { key: entry.id },
				header,
				h("div", { className: "dmi-card", style: { marginBottom: "8px" } },
					h("div", { className: "dmi-card-head" },
						h("span", { className: "dmi-card-title" }, entry.date + (entry.title ? " 《" + entry.title + "》" : "")),
						(entry.tags || []).length > 0 ? h("span", { className: "dmi-kv" }, entry.tags.map((tag) => h(Chip, { key: tag }, tag))) : null),
					h("div", { style: { whiteSpace: "pre-wrap", opacity: .85 } }, entry.content),
					h("div", { className: "dmi-actions" },
						h(Btn, { size: "sm", onClick: () => setEditing({ id: entry.id, form: reflectionFormOf(entry, todayStr) }) }, t("action.edit")),
						h(Btn, { size: "sm", variant: "danger", onClick: () => { if (window.confirm(t("confirm.delete"))) post("reflection-delete", { id: entry.id }); } }, t("action.delete")))));
		})),
		h("div", { className: "dmi-actions" },
			h(Btn, { onClick: () => setEditing({ id: null, form: reflectionFormOf(null, todayStr) }) }, t("action.addReflection"))));
}

// ---------------------------------------------------------------------------
// 页签：资产
// ---------------------------------------------------------------------------

function accountFormOf(entry) {
	return {
		kind: (entry && entry.kind) || "bank",
		name: (entry && entry.name) || "",
		mask: (entry && entry.mask) || "",
		balance: entry && entry.balance !== undefined && entry.balance !== null ? String(entry.balance) : "",
		currency: (entry && entry.currency) || "CNY",
		notes: (entry && entry.notes) || "",
	};
}

function holdingFormOf(entry, account) {
	return {
		account: (entry && entry.account) || account || "",
		code: (entry && entry.code) || "",
		name: (entry && entry.name) || "",
		market: (entry && entry.market) || "",
		shares: entry && entry.shares !== undefined && entry.shares !== null ? String(entry.shares) : "",
		costPrice: entry && entry.costPrice !== undefined && entry.costPrice !== null ? String(entry.costPrice) : "",
		price: entry && entry.price !== undefined && entry.price !== null ? String(entry.price) : "",
		notes: (entry && entry.notes) || "",
	};
}

function AssetsTab(props) {
	const { view, post, busy } = props;
	const [acctForm, setAcctForm] = useState(null);   // null | {id, form}
	const [holdForm, setHoldForm] = useState(null);   // null | {id, form}
	const assets = view.assets || { accounts: [], holdings: [], totals: { totals: {} } };
	const accounts = assets.accounts || [];
	const holdings = assets.holdings || [];
	const stockAccounts = accounts.filter((x) => x.kind === "stock");
	const kindLabel = (kind) => t("kind." + kind);
	// 持仓归属账户：id 优先解析为账户名，名称/未知引用原样显示（孤儿持仓可见）。
	const accountLabel = (ref) => {
		const hit = accounts.find((x) => x.id === ref) || accounts.find((x) => x.name === ref);
		return hit ? hit.name + (hit.mask ? "（" + hit.mask + "）" : "") : ref;
	};

	if (acctForm !== null) {
		const f = acctForm.form;
		const setF = (key) => (v) => setAcctForm(Object.assign({}, acctForm, { form: Object.assign({}, f, { [key]: v }) }));
		const save = () => post("account-save", {
			id: acctForm.id || "",
			entry: { kind: f.kind, name: f.name, mask: f.mask, balance: f.balance === "" ? null : Number(f.balance), currency: f.currency, notes: f.notes },
		}).then(() => setAcctForm(null));
		return h("div", { className: "dmi-form" },
			h("div", { className: "dmi-fieldrow" },
				Field({ label: t("f.kind") }, Select({ value: f.kind, onChange: setF("kind") },
					["bank", "pay", "stock"].map((k) => h("option", { key: k, value: k }, kindLabel(k))))),
				Field({ label: t("f.name") }, Input({ value: f.name, onChange: setF("name") })),
				Field({ label: t("f.mask") }, Input({ value: f.mask, placeholder: "尾号 8888", onChange: setF("mask") })),
				Field({ label: t("f.balance") }, Input({ type: "number", value: f.balance, onChange: setF("balance") })),
				Field({ label: t("f.currency") }, Input({ value: f.currency, onChange: setF("currency") })),
				Field({ label: t("f.notes"), wide: true }, Input({ value: f.notes, onChange: setF("notes") }))),
			h("div", { className: "dmi-actions" },
				h(Btn, { variant: "primary", busy, onClick: save }, t("action.save")),
				h(Btn, { onClick: () => setAcctForm(null) }, t("action.cancel"))));
	}

	if (holdForm !== null) {
		const f = holdForm.form;
		const setF = (key) => (v) => setHoldForm(Object.assign({}, holdForm, { form: Object.assign({}, f, { [key]: v }) }));
		const save = () => post("holding-save", {
			id: holdForm.id || "",
			entry: {
				account: f.account, code: f.code, name: f.name, market: f.market,
				shares: f.shares === "" ? null : Number(f.shares),
				costPrice: f.costPrice === "" ? null : Number(f.costPrice),
				price: f.price === "" ? null : Number(f.price),
				notes: f.notes,
			},
		}).then(() => setHoldForm(null));
		return h("div", { className: "dmi-form" },
			h("div", { className: "dmi-fieldrow" },
				Field({ label: t("f.account") }, stockAccounts.length > 0
					? Select({ value: f.account, onChange: setF("account") },
						stockAccounts.map((x) => h("option", { key: x.id, value: x.id }, x.name + (x.mask ? "（" + x.mask + "）" : "") + " · " + x.id)))
					: Input({ value: f.account, placeholder: "同花顺", onChange: setF("account") })),
				Field({ label: t("f.code") }, Input({ value: f.code, placeholder: "600519", onChange: setF("code") })),
				Field({ label: t("f.name") }, Input({ value: f.name, onChange: setF("name") })),
				Field({ label: t("f.market") }, Input({ value: f.market, placeholder: "SH/SZ/HK/US", onChange: setF("market") })),
				Field({ label: t("f.shares") }, Input({ type: "number", value: f.shares, onChange: setF("shares") })),
				Field({ label: t("f.costPrice") }, Input({ type: "number", value: f.costPrice, onChange: setF("costPrice") })),
				Field({ label: t("f.price") }, Input({ type: "number", value: f.price, onChange: setF("price") })),
				Field({ label: t("f.notes"), wide: true }, Input({ value: f.notes, onChange: setF("notes") }))),
			h("div", { className: "dmi-actions" },
				h(Btn, { variant: "primary", busy, onClick: save }, t("action.save")),
				h(Btn, { onClick: () => setHoldForm(null) }, t("action.cancel"))));
	}

	const { quotes, meta } = useLiveQuotes(holdings.length > 0);
	const live = liveAssets(assets, quotes);
	const totals = (assets.totals && assets.totals.totals) || {};
	return h("div", { className: "dmi-root" },
		h("div", { className: "dmi-stats" },
			Object.entries(totals).map(([currency, bucket]) => {
				const l = currency === "CNY" ? live : null;
				const liveTag = l ? " · " + (meta && meta.live ? t("q.live") : t("q.stale")) : "";
				return h("div", { key: currency, style: { display: "contents" } },
					h("div", { className: "dmi-stat" }, h("span", null, t("stat.bank") + " · " + currency), h("b", null, fmtMoney(bucket.bank))),
					h("div", { className: "dmi-stat" }, h("span", null, t("stat.pay") + " · " + currency), h("b", null, fmtMoney(bucket.pay))),
					h("div", { className: "dmi-stat" }, h("span", null, t("stat.stock") + " · " + currency), h("b", null, fmtMoney(bucket.stock))),
					h("div", { className: "dmi-stat" }, h("span", null, t("stat.holdings") + " · " + currency + liveTag), h("b", { style: l ? { fontVariantNumeric: "tabular-nums" } : undefined }, fmtMoney(l ? l.holdingsValue : bucket.holdings))),
					h("div", { className: "dmi-stat", style: { borderColor: "color-mix(in srgb, var(--dmi-accent) 45%, transparent)" } }, h("span", null, t("stat.grand") + " · " + currency + liveTag), h("b", { style: l ? { fontVariantNumeric: "tabular-nums" } : undefined }, fmtMoney(l ? l.grand : bucket.grand))));
			})),

		accounts.length === 0 && holdings.length === 0 ? h("div", { className: "dmi-empty" }, t("empty.assets")) : null,
		...["bank", "pay", "stock"].map((kind) => {
			const list = accounts.filter((x) => x.kind === kind);
			if (list.length === 0) return null;
			return h("div", { key: kind },
				h("div", { className: "dmi-section-title" }, kindLabel(kind)),
				h("div", { className: "dmi-grid" }, list.map((entry) => h("div", { key: entry.id, className: "dmi-card" },
					h("div", { className: "dmi-card-head" },
						h("span", { className: "dmi-card-title" }, entry.name + (entry.mask ? "（" + entry.mask + "）" : "")),
						h(Chip, { tone: "money" }, fmtMoney(entry.balance, entry.currency))),
					entry.notes ? h("div", { className: "dmi-muted" }, entry.notes) : null,
					h("div", { className: "dmi-actions" },
						h(Btn, { size: "sm", onClick: () => setAcctForm({ id: entry.id, form: accountFormOf(entry) }) }, t("action.edit")),
						h(Btn, { size: "sm", variant: "danger", onClick: () => { if (window.confirm(t("confirm.delete"))) post("account-delete", { id: entry.id }); } }, t("action.delete")))))));
		}),
		holdings.length > 0 ? h("div", null,
			h("div", { className: "dmi-section-title" },
				t("holdings.of"),
				meta && meta.quotesAt ? h("span", { className: "dmi-muted", style: { marginLeft: "10px", fontSize: 11 } },
					(meta.live ? t("q.live") : t("q.stale")) + " · " + String(meta.quotesAt).replace("T", " ").slice(11, 19)) : null),
			h("table", { className: "dmi-table" },
				h("thead", null, h("tr", null, ["f.account", "f.code", "f.name", "f.shares", "f.costPrice", "f.price", ""].map((k) => h("th", { key: k }, k === "" ? "" : t(k))))),
				h("tbody", null, holdings.map((entry) => h("tr", { key: entry.id },
					h("td", null, accountLabel(entry.account)),
							h("td", null, entry.code),
							h("td", null, entry.name || t("misc.none")),
							h("td", null, entry.shares),
							h("td", null, entry.costPrice === null || entry.costPrice === undefined ? t("misc.none") : entry.costPrice),
							h("td", null, (() => {
								const q = quotes && quotes[entry.code];
								if (!q || !q.price) return entry.price === null || entry.price === undefined ? t("misc.none") : entry.price;
								return h("span", { style: { color: pctColor(q.changePct), fontWeight: 600, fontVariantNumeric: "tabular-nums" } },
									q.price,
									h("span", { style: { fontSize: 11, marginLeft: 5, fontWeight: 500 } }, fmtPct(q.changePct)));
							})()),
							h("td", { style: { whiteSpace: "nowrap" } },
								h(Btn, { size: "sm", onClick: () => setHoldForm({ id: entry.id, form: holdingFormOf(entry) }) }, t("action.edit")),
								" ",
							h(Btn, { size: "sm", variant: "danger", onClick: () => { if (window.confirm(t("confirm.delete"))) post("holding-delete", { id: entry.id }); } }, t("action.delete")))))))) : null,

		h("div", { className: "dmi-actions" },
			h(Btn, { onClick: () => setAcctForm({ id: null, form: accountFormOf(null) }) }, t("action.addAccount")),
			h(Btn, { onClick: () => setHoldForm({ id: null, form: holdingFormOf(null, stockAccounts.length > 0 ? stockAccounts[0].id : "") }) }, t("action.addHolding"))));
}

// ---------------------------------------------------------------------------
// 根组件们：设置页区块 / 中央主面板 / 侧栏图标 / 资产速览浮窗
// ---------------------------------------------------------------------------

const TAB_KEYS = ["identity", "career", "relations", "reflections", "assets"];

/** 按 tab 键渲染对应的内容组件。 */
function TabBody(tab, tabProps) {
	if (tab === "identity") return h(IdentityTab, tabProps);
	if (tab === "career") return h(CareerTab, tabProps);
	if (tab === "relations") return h(RelationsTab, tabProps);
	if (tab === "reflections") return h(ReflectionsTab, tabProps);
	return h(AssetsTab, tabProps);
}

/** 设置页里的「个人信息」区块（settings.section）。 */
function MyInfoSection(props, ctx) {
	const [, setLangTick] = useState(0);
	useThemeTick();
	const [tab, setTab] = useState("identity");
	const { view, error, busy, load, post } = useMyInfoData();
	useEffect(() => {
		relocalize = () => setLangTick((v) => v + 1);
		return () => { relocalize = null; };
	}, []);
	useEffect(() => { load(); }, [load]);
	const tabProps = { view, post, busy };
	ensureStyle();
	return h("div", { className: "dmi-scope" + scopeClassOf(ctx) },
		h("div", { className: "dmi-root" },
			h("div", { className: "dmi-head" },
				h("h3", null, t("title")),
				view && view.meta ? h("span", { className: "dmi-updated" }, t("hint.updatedAt") + "：" + String(view.meta.updatedAt || "").replace("T", " ").slice(0, 19)) : null,
				h(Btn, { size: "sm", busy, onClick: load }, t("action.refresh")),
				h(ThemeToggle, { ctx })),
			h("div", { className: "dmi-sub" }, t("subtitle")),
			error ? h("div", { className: "dmi-error" }, error) : null,
			h("div", { className: "dmi-seg" }, TAB_KEYS.map((key) =>
				h("button", { key, className: tab === key ? "is-active" : "", onClick: () => setTab(key) }, t("tab." + key)))),
			view === null && error === "" ? h("div", { className: "dmi-empty" }, "…") :
			view === null ? null : TabBody(tab, tabProps)));
}

/** 侧栏面板图标（sidebar.panellist）：SF Symbols 风格人像。 */
function MyInfoIcon(props) {
	const size = (props && props.size) || 20;
	return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
		h("circle", { cx: 12, cy: 8, r: 3.6, fill: "currentColor" }),
		h("path", { d: "M5 19.4c1-3.6 3.8-5.4 7-5.4s6 1.8 7 5.4", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" }));
}

/** iOS 设置风格的域图形（白色 SF Symbols 风，画在渐变圆角方块里）。 */
const CARD_ICONS = {
	identity: (size) => h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
		h("circle", { cx: 12, cy: 8, r: 3.5, fill: "currentColor" }),
		h("path", { d: "M5.2 19.6c1.1-3.7 3.9-5.5 6.8-5.5s5.7 1.8 6.8 5.5", stroke: "currentColor", strokeWidth: 2.3, strokeLinecap: "round" })),
	career: (size) => h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
		h("rect", { x: 3.2, y: 7.3, width: 17.6, height: 12.2, rx: 3.2, stroke: "currentColor", strokeWidth: 1.9 }),
		h("path", { d: "M9 7.3V6.1A2.1 2.1 0 0 1 11.1 4h1.8A2.1 2.1 0 0 1 15 6.1v1.2", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" }),
		h("path", { d: "M3.2 12.7h17.6", stroke: "currentColor", strokeWidth: 1.6 })),
	relations: (size) => h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
		h("circle", { cx: 9, cy: 8.2, r: 3.4, fill: "currentColor" }),
		h("path", { d: "M3 19.5c1-3.5 3.4-5.2 6-5.2s5 1.7 6 5.2", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" }),
		h("circle", { cx: 16.8, cy: 9, r: 2.5, fill: "currentColor", opacity: 0.55 }),
		h("path", { d: "M15.8 14.6c2.6.2 4.6 1.9 5.4 4.9", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", opacity: 0.55 })),
	reflections: (size) => h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
		h("path", { d: "M12 4.5a5.3 5.3 0 0 0-3.2 9.6c.6.5 1 1.2 1.1 2l.1.9h4l.1-.9c.1-.8.5-1.5 1.1-2A5.3 5.3 0 0 0 12 4.5Z", fill: "currentColor" }),
		h("path", { d: "M10.2 19.4h3.6", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" })),
	assets: (size) => h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true },
		h("path", { d: "M6.5 5.5 12 12l5.5-6.5", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" }),
		h("path", { d: "M12 12v6.5", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" }),
		h("path", { d: "M8.3 12h7.4M8.3 15.2h7.4", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" })),
};

/** 渐变圆角方块图标（iOS 应用心智）。 */
function CardIcon(props) {
	const domain = props.domain || "identity";
	const size = props.size || 22;
	const icon = CARD_ICONS[domain] || CARD_ICONS.identity;
	return h("span", { className: "dmi-cardnav-ico dmi-ico-" + domain, "aria-hidden": true },
		icon(size)); // 直接调用工厂拿元素；经 h() 传函数会被当组件、props 对象会变成 width
}

/** 卡片摘要：每个域一行主摘要（stat）+ 一行次要说明（sub）。 */
function domainSummary(domain, view) {
	const id = view.identity || {};
	const career = view.career || [];
	const relations = view.relations || [];
	const reflections = view.reflections || [];
	const assets = view.assets || { accounts: [], holdings: [], totals: { totals: {} } };
	const totals = (assets.totals && assets.totals.totals) || {};
	const primary = totals.CNY || Object.values(totals)[0] || null;
	if (domain === "identity") {
		const stat = [id.name, id.age !== null && id.age !== undefined ? id.age + " 岁" : ""].filter(Boolean).join(" · ");
		return { stat: stat || t("card.empty"), sub: id.residence || t("card.identity.hint"), empty: stat === "" };
	}
	if (domain === "career") {
		const cur = career.find((x) => x.current);
		const count = career.length + " " + t("card.career.count");
		if (cur) return { stat: cur.title + " · " + cur.company, sub: cur.startDate + " " + t("card.since") + " · " + t("card.career.current") + " · " + count, empty: false };
		return {
			stat: career.length > 0 ? career[0].title + " · " + career[0].company : t("card.empty"),
			sub: count, empty: career.length === 0,
		};
	}
	if (domain === "relations") {
		const names = relations.slice(0, 2).map((x) => x.name).join(" · ");
		return { stat: names || t("card.empty"), sub: relations.length + " " + t("card.relations.count"), empty: relations.length === 0 };
	}
	if (domain === "reflections") {
		const latest = reflections[0];
		const count = reflections.length + " " + t("card.reflections.count");
		return {
			stat: latest ? (latest.title || String(latest.content || "").replace(/\s+/g, " ").slice(0, 18)) : t("card.empty"),
			sub: latest ? latest.date + " · " + count : count,
			empty: !latest,
		};
	}
	if (domain === "assets") {
		return {
			stat: primary ? fmtMoney(primary.grand) : t("card.empty"),
			sub: (assets.accounts || []).length + " " + t("card.accounts") + " · " + (assets.holdings || []).length + " " + t("card.holdings"),
			empty: !primary && (assets.accounts || []).length === 0,
		};
	}
	return { stat: "", sub: "", empty: true };
}

/** 卡片网格里的域卡片：图标 + 摘要 + ›，点击进域详情。资产卡片在交易时段显示实时总资产。 */
function DomainCard(props) {
	const sum = domainSummary(props.domain, props.view);
	const assets = props.view && props.view.assets;
	const enabled = props.domain === "assets" && ((assets && assets.holdings) || []).length > 0;
	const { quotes, meta } = useLiveQuotes(enabled);
	const live = enabled ? liveAssets(assets, quotes) : null;
	const statNode = live
		? h("span", { style: { fontVariantNumeric: "tabular-nums" } },
			fmtMoney(live.grand),
			h("span", { style: { color: meta && meta.live ? "var(--dmi-green)" : "var(--dmi-text-3)", fontSize: 10, marginLeft: 5 }, title: meta && meta.live ? t("q.live") : t("q.stale") }, "●"))
		: sum.stat;
	return h("button", { type: "button", className: "dmi-cardnav", onClick: props.onOpen,
			"aria-label": t("tab." + props.domain) },
		h(CardIcon, { domain: props.domain }),
		h("span", { className: "dmi-cardnav-body" },
			h("span", { className: "dmi-cardnav-title" }, t("tab." + props.domain)),
			h("span", { className: "dmi-cardnav-stat" + (sum.empty && !live ? " is-empty" : "") }, statNode),
			h("span", { className: "dmi-cardnav-sub" }, sum.sub)),
		h("span", { className: "dmi-cardnav-chev", "aria-hidden": true }, "›"));
}

/** 中央主面板（main keyed slot，id=myinfo）：卡片式仪表盘，点卡片进域详情。 */
function MyInfoPanel(props, ctx) {
	const [, setLangTick] = useState(0);
	useThemeTick();
	const [page, setPage] = useState(null); // null = 卡片网格；TAB_KEYS 内的值 = 域详情页
	const { view, error, busy, load, post } = useMyInfoData();
	useEffect(() => {
		relocalize = () => setLangTick((v) => v + 1);
		return () => { relocalize = null; };
	}, []);
	useEffect(() => { load(); }, [load]);
	const id = (view && view.identity) || {};
	const totals = view && view.assets && view.assets.totals ? view.assets.totals.totals || {} : {};
	const grand = totals.CNY ? totals.CNY.grand : null;
	const { quotes: panelQuotes, meta: panelQuoteMeta } = useLiveQuotes(((view && view.assets && view.assets.holdings) || []).length > 0);
	const liveGrand = liveAssets(view && view.assets, panelQuotes);
	const who = [id.name, id.age !== null && id.age !== undefined ? id.age + " 岁" : "", id.residence].filter(Boolean).join(" · ");
	const inDetail = page !== null && TAB_KEYS.indexOf(page) >= 0;
	ensureStyle();
	return h("div", { className: "dmi-scope dmi-page" + scopeClassOf(ctx) },
		inDetail
			? h("div", { className: "dmi-detail-head" },
				h("button", { type: "button", className: "dmi-back", onClick: () => setPage(null), "aria-label": t("panel.title") },
					h("span", { style: { fontSize: 15, lineHeight: 1, marginRight: 2 }, "aria-hidden": true }, "‹"), t("panel.title")),
				h("h2", { className: "dmi-detail-title" }, t("tab." + page)),
				h(Btn, { size: "sm", busy, onClick: load }, t("action.refresh")),
				h(ThemeToggle, { ctx }))
			: h("div", { className: "dmi-page-head" },
				h("div", { style: { flex: 1, minWidth: 220 } },
					h("h2", { className: "dmi-page-title" }, t("panel.title")),
					h("div", { className: "dmi-page-sub" }, who || t("subtitle"))),
				h(Btn, { size: "sm", onClick: () => {
					try {
						const r = serviceOf(ctx, "sidebarRight");
						if (r && typeof r.openTab === "function") r.openTab(DOCK_KIND, { params: {} });
					} catch (e) { /* 右栏服务不可用则忽略 */ }
				} }, t("dock.dock")),
				h(Btn, { size: "sm", busy, onClick: load }, t("action.refresh")),
				h(ThemeToggle, { ctx }),
				grand !== null ? h(Chip, { tone: "money", title: t("stat.grand") + (panelQuoteMeta && panelQuoteMeta.live ? " · " + t("q.live") : "") }, fmtMoney(liveGrand ? liveGrand.grand : grand)) : null),
		error ? h("div", { className: "dmi-error" }, error) : null,
		view === null && error === "" ? h("div", { className: "dmi-empty" }, "…") :
		view === null ? null :
		inDetail
			? h("div", { className: "dmi-detail-body" }, TabBody(page, { view, post, busy }))
			: h("div", { className: "dmi-cards" }, TAB_KEYS.map((key) =>
				h(DomainCard, { key, domain: key, view, onOpen: () => setPage(key) }))));
}

/** 资产速览浮窗（shell.overlay）：右下角胶囊 ↔ 毛玻璃速览卡。 */
function AssetOverlay(props, ctx) {
	const { view, busy, load } = useMyInfoData();
	useThemeTick();
	const [expanded, setExpanded] = useState(false);
	// 右栏停靠面板打开时浮窗整体隐藏：胶囊/速览卡是 viewport 级 fixed 定位，
	// 会压在右栏内容上，右栏里的点击会落到「打开完整档案」上、误跳主面板。
	// 宿主在 dock 根节点维护 [data-sidebar-right-open] 状态属性，轮询它是最稳判据。
	const [dockOpen, setDockOpen] = useState(false);
	useEffect(() => {
		const check = () => setDockOpen(document.querySelector('[data-sidebar-right-open]') !== null);
		check();
		const timer = window.setInterval(check, 400);
		return () => { window.clearInterval(timer); };
	}, []);
	useEffect(() => { load(); }, [load]);
	// 每分钟静默刷新一次（浮窗常驻，最新余额很重要）
	useEffect(() => {
		const timer = window.setInterval(() => { load(); }, 60000);
		return () => window.clearInterval(timer);
	}, [load]);
	ensureStyle();
	const assets = (view && view.assets) || { accounts: [], holdings: [], totals: { totals: {} } };
	const totals = (assets.totals && assets.totals.totals) || {};
	const cny = totals.CNY || null;
	const hasData = cny !== null || (assets.accounts || []).length > 0;
	const { quotes: ovQuotes } = useLiveQuotes(((assets.holdings) || []).length > 0);
	const liveOv = liveAssets(assets, ovQuotes);
	const themeClass = scopeClassOf(ctx);
	const openPanel = () => {
		try {
			const layout = serviceOf(ctx, "layout");
			if (layout && typeof layout.selectPanel === "function") layout.selectPanel("myinfo");
		} catch (e) { /* 布局服务不可用则忽略 */ }
	};
	if (dockOpen) return null;
	if (!expanded) {
		return h("div", { className: "dmi-scope dmi-ov" + themeClass },
			h("div", {
				className: "dmi-ov-pill", title: t("ov.title"),
				onClick: () => { if (hasData) setExpanded(true); else openPanel(); },
			},
				h("span", { className: "dmi-ov-dot" }),
				hasData && cny ? h("b", { style: liveOv ? { fontVariantNumeric: "tabular-nums" } : undefined }, fmtMoney(liveOv ? liveOv.grand : cny.grand)) : h("span", null, t("ov.empty"))));
	}
	const rows = cny ? [
		["🏦", t("stat.bank"), cny.bank],
		["💚", t("stat.pay"), cny.pay],
		["📈", t("stat.stock"), cny.stock],
		["💎", t("stat.holdings"), liveOv ? liveOv.holdingsValue : cny.holdings],
	] : [];
	return h("div", { className: "dmi-scope dmi-ov" + themeClass },
		h("div", { className: "dmi-ov-card" },
			h("div", { className: "dmi-ov-head" },
				h("span", { className: "dmi-ov-title" }, t("ov.title")),
				h("span", { style: { display: "inline-flex" } }, h(ThemeToggle, { ctx })),
				h("button", { className: "dmi-ov-x", title: t("action.cancel"), onClick: () => setExpanded(false) }, "✕")),
			h("div", { className: "dmi-ov-hero" },
				h("b", { style: liveOv ? { fontVariantNumeric: "tabular-nums" } : undefined }, cny ? fmtMoney(liveOv ? liveOv.grand : cny.grand) : t("misc.none")),
				h("span", null, t("stat.grand") + (liveOv ? " · " + t("q.live") : "") + (view && view.meta && view.meta.updatedAt ? " · " + t("ov.updated") + " " + String(view.meta.updatedAt).replace("T", " ").slice(11, 19) : ""))),
			h("div", { className: "dmi-ov-rows" }, rows.map(([ico, label, val]) =>
				h("div", { key: label, className: "dmi-ov-row" },
					h("span", { className: "dmi-ov-row-ico" }, ico),
					h("span", { className: "dmi-ov-row-label" }, label),
					h("span", { className: "dmi-ov-row-val" }, fmtMoney(val))))),
			h("div", { className: "dmi-ov-foot" },
				h(Btn, { size: "sm", variant: "primary", onClick: openPanel }, t("ov.open")),
				h(Btn, { size: "sm", busy, onClick: load }, t("action.refresh")))));
}


// ---------------------------------------------------------------------------
// 右侧停靠面板（sidebar.right.pane.tab，窄列摘要视图）
// ---------------------------------------------------------------------------

const DOCK_ID = "dsh-myinfo-dock";   // definition.id = body/title 注册 key
const DOCK_KIND = "myinfo.profile";  // openTab 的 kind

/** 窄列档案：摘要可点击、栏内直接展开域详情（不跳主面板）；「打开完整档案」仍可一键跳转。 */
function MyInfoDock(props, ctx) {
	const { view, error, busy, load, post } = useMyInfoData();
	const [, tick] = useState(0);
	const [page, setPage] = useState(null); // null = 摘要；TAB_KEYS 值 = 栏内展开的域详情
	useThemeTick();
	useEffect(() => {
		relocalize = () => tick((v) => v + 1);
		return () => { relocalize = null; };
	}, []);
	useEffect(() => { load(); }, [load]);
	const inDetail = page !== null && TAB_KEYS.indexOf(page) >= 0;
	const openFull = () => { try { const l = serviceOf(ctx, "layout"); if (l && l.selectPanel) l.selectPanel("myinfo"); } catch (e) {} };
	ensureStyle();
	return h("div", { className: "dmi-scope dmi-dockpage" + scopeClassOf(ctx), style: { padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12, minHeight: "100%" } },
		h("div", { className: "dmi-head" },
			inDetail
				? h("button", { type: "button", className: "dmi-back", onClick: () => setPage(null), "aria-label": t("panel.title") },
					h("span", { style: { fontSize: 15, lineHeight: 1, marginRight: 2 }, "aria-hidden": true }, "‹"), t("panel.title"))
				: h("h3", { style: { margin: 0, fontSize: 16 } }, t("dock.title")),
			h("div", { style: { marginLeft: "auto", display: "flex", gap: 6 } },
				h(ThemeToggle, { ctx }),
				h(Btn, { size: "sm", busy, onClick: load }, t("action.refresh")))),
		error ? h("div", { className: "dmi-error" }, error) : null,
		view === null && error === "" ? h("div", { className: "dmi-empty" }, "…") :
		view === null ? null :
		inDetail ? h("div", { className: "dmi-detail-body", style: { display: "flex", flexDirection: "column", gap: 12 } },
			h("div", { style: { fontSize: 19, fontWeight: 750, letterSpacing: "-.5px" } }, t("tab." + page)),
			TabBody(page, { view, post, busy }),
			h("div", { className: "dmi-actions" },
				h(Btn, { size: "sm", variant: "primary", onClick: openFull }, t("ov.open"))))
		: h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
			// 与主面板同款的域卡片（窄列单列堆叠）：有标题、有摘要，点开即栏内详情页。
			h("div", { className: "dmi-cards dmi-cards--dock" }, TAB_KEYS.map((key) =>
				h(DomainCard, { key, domain: key, view, onOpen: () => setPage(key) }))),
			h("div", { className: "dmi-actions" },
				h(Btn, { size: "sm", variant: "primary", onClick: openFull }, t("ov.open")))));
}

// ---------------------------------------------------------------------------
// 插件装配：设置页区块 + 中央面板 + 侧栏图标 + 资产速览浮窗
// ---------------------------------------------------------------------------

function apply(ctx) {
	ctx.effect(() => subscribeLocale(ctx));
	// 注册日语/西班牙语界面语言（Settings → General 语言选择器会出现「日本語 / Español」，
	// 回落链 en；插件清单标题/描述按 locale/ja.json、locale/es.json 解析）。
	// locale 是可选服务：缺失时跳过；已被其他插件注册（duplicate）时静默忽略。
	ctx.effect(() => {
		const service = localeServiceOf(ctx);
		if (!service || typeof service.addLanguage !== "function") return;
		const disposers = [];
		for (const language of [
			{ id: "ja", label: "日本語", fallback: "en" },
			{ id: "es", label: "Español", fallback: "en" },
		]) {
			try {
				const dispose = service.addLanguage(language);
				if (typeof dispose === "function") disposers.push(dispose);
			} catch (e) { /* 已注册则跳过 */ }
		}
		return () => { for (const dispose of disposers) { try { dispose(); } catch (e) {} } };
	});
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "dsh-myinfo",
		order: 47,
		label: () => t("nav.title"),
		inject: () => ({}),
	}, (props) => MyInfoSection(props, ctx)));
	// 中央主面板：main keyed slot 与 sidebar.panellist 共用 id「myinfo」。
	ctx.slots.inject("main", () => ctx.slots.register({
		name: "main",
		key: "myinfo",
	}, (props) => MyInfoPanel(props, ctx)));
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
		name: "sidebar.panellist",
		id: "myinfo",
		order: 20,
		label: () => t("panel.title"),
	}, MyInfoIcon));
	// 右下角资产速览浮窗。
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({
		name: "shell.overlay",
		id: "dsh-myinfo-overlay",
	}, (props) => AssetOverlay(props, ctx)));
	// 右侧停靠面板：sidebarRightTabs 是「可选」服务（headless 等组合里没有）。
	// 必须用 ctx.inject 等它出现，不能读 ctx.sidebarRightTabs：cordis 的属性访问
	// 要求服务写进 inject 列表，否则抛 `cannot get property "sidebarRightTabs"
	// without inject`，整个 client 入口直接变 failed（web boot 启动失败）。
	ctx.inject(["sidebarRightTabs"], (dock) => {
		const tabsService = serviceOf(dock, "sidebarRightTabs");
		if (tabsService === undefined || typeof tabsService.register !== "function") return;
		dock.effect(() => tabsService.register({
			id: DOCK_ID,
			kind: DOCK_KIND,
			priority: "extension",
			title: () => t("dock.title"),
			guide: [{
				id: "myinfo-guide",
				order: 10,
				title: () => t("dock.title"),
				description: () => t("subtitle"),
			}],
		}), "dsh-myinfo: dock tab type");
		dock.slots.inject("sidebar.right.pane.tab", () => dock.slots.register({
			name: "sidebar.right.pane.tab",
			key: DOCK_ID,
		}, (props) => MyInfoDock(props, ctx)));
		dock.slots.inject("sidebar.right.pane.tab.title", () => dock.slots.register({
			name: "sidebar.right.pane.tab.title",
			key: DOCK_ID,
		}, () => h("span", null, t("dock.title"))));
	});
}

const inject = ["slots", "locale"];

exports.apply = apply;
exports.inject = inject;

return module.exports;
}});
