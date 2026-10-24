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
function localeServiceOf(ctx) {
	try {
		if (typeof ctx.get === "function") return ctx.get("locale");
		if (ctx.locale) return ctx.locale;
	} catch (e) { /* 无 locale 服务则维持默认 */ }
	return undefined;
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
	"stat.bank": "银行卡", "stat.pay": "支付软件", "stat.stock": "股票账户余额", "stat.holdings": "持仓市值", "stat.grand": "总资产",
	"holdings.of": "持仓明细",
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
	"stat.bank": "Bank", "stat.pay": "Payments", "stat.stock": "Stock balance", "stat.holdings": "Holdings value", "stat.grand": "Net total",
	"holdings.of": "Holdings",
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
// 样式（dmi-*）
// ---------------------------------------------------------------------------

const STYLE_CSS = ""
+ ".dmi-root{display:flex;flex-direction:column;gap:14px;font-size:13px}"
+ ".dmi-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}"
+ ".dmi-head h3{margin:0;font-size:16px}"
+ ".dmi-sub{opacity:.65}"
+ ".dmi-updated{margin-left:auto;opacity:.5;font-size:12px}"
+ ".dmi-tabs{display:flex;gap:6px;flex-wrap:wrap}"
+ ".dmi-tab{padding:5px 14px;border-radius:999px;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;cursor:pointer;font-size:13px}"
+ ".dmi-tab:hover{background:rgba(127,127,127,.12)}"
+ ".dmi-tab.is-active{background:#3b82f6;border-color:#3b82f6;color:#fff}"
+ ".dmi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}"
+ ".dmi-card{border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}"
+ ".dmi-card-head{display:flex;align-items:center;gap:8px}"
+ ".dmi-card-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
+ ".dmi-kv{display:flex;flex-wrap:wrap;gap:6px 12px;opacity:.85}"
+ ".dmi-muted{opacity:.55}"
+ ".dmi-chip{display:inline-flex;align-items:center;padding:1px 10px;border-radius:999px;border:1px solid rgba(127,127,127,.3);font-size:12px;white-space:nowrap}"
+ ".dmi-chip--ok{border-color:rgba(34,197,94,.6);color:#16a34a;background:rgba(34,197,94,.08)}"
+ ".dmi-chip--money{border-color:rgba(59,130,246,.45);color:#2563eb;background:rgba(59,130,246,.07);font-variant-numeric:tabular-nums}"
+ ".dmi-chip--warn{border-color:rgba(234,179,8,.5);background:rgba(234,179,8,.08)}"
+ ".dmi-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:5px 14px;font-size:13px;border-radius:999px;cursor:pointer;border:1px solid rgba(127,127,127,.35);background:transparent;color:inherit;transition:background .15s,border-color .15s;white-space:nowrap}"
+ ".dmi-btn:hover:not(:disabled){background:rgba(127,127,127,.12)}"
+ ".dmi-btn:disabled{opacity:.45;cursor:not-allowed}"
+ ".dmi-btn--sm{padding:2px 11px;font-size:12px}"
+ ".dmi-btn--primary{background:#3b82f6;border-color:#3b82f6;color:#fff}"
+ ".dmi-btn--primary:hover:not(:disabled){background:#2563eb;border-color:#2563eb}"
+ ".dmi-btn--danger{color:#dc2626;border-color:rgba(220,38,38,.4)}"
+ ".dmi-btn--danger:hover:not(:disabled){background:rgba(239,68,68,.12)}"
+ ".dmi-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}"
+ ".dmi-form{border:1px dashed rgba(127,127,127,.4);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px}"
+ ".dmi-fieldrow{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}"
+ ".dmi-field{display:flex;flex-direction:column;gap:4px;min-width:0}"
+ ".dmi-field>span{font-size:12px;opacity:.65}"
+ ".dmi-field-wide{grid-column:1 / -1}"
+ ".dmi-input,.dmi-select,.dmi-textarea{padding:6px 10px;border-radius:8px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;font-size:13px;font-family:inherit;width:100%;box-sizing:border-box}"
+ ".dmi-input:focus,.dmi-select:focus,.dmi-textarea:focus{outline:2px solid rgba(59,130,246,.5);outline-offset:0}"
+ ".dmi-textarea{min-height:72px;resize:vertical}"
+ ".dmi-empty{opacity:.55;padding:14px 4px}"
+ ".dmi-error{border:1px solid rgba(220,38,38,.45);background:rgba(239,68,68,.08);color:#dc2626;border-radius:10px;padding:8px 12px;white-space:pre-wrap}"
+ ".dmi-timeline-year{font-weight:700;margin:10px 0 4px}"
+ ".dmi-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}"
+ ".dmi-stat{border:1px solid rgba(127,127,127,.25);border-radius:10px;padding:8px 12px;display:flex;flex-direction:column;gap:2px}"
+ ".dmi-stat b{font-size:15px;font-variant-numeric:tabular-nums}"
+ ".dmi-stat span{font-size:12px;opacity:.6}"
+ ".dmi-table{width:100%;border-collapse:collapse}"
+ ".dmi-table th,.dmi-table td{text-align:left;padding:5px 8px;border-bottom:1px solid rgba(127,127,127,.18);font-variant-numeric:tabular-nums}"
+ ".dmi-table th{font-size:12px;opacity:.6;font-weight:500}"
+ ".dmi-section-title{font-weight:600;margin:6px 0 2px}";

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
	return h("span", { className: "dmi-chip dmi-chip--" + (props.tone || ""), title: props.title || "" }, props.children);
}

function Field(props) {
	return h("div", { className: "dmi-field" + (props.wide ? " dmi-field-wide" : "") },
		h("span", null, props.label),
		props.children);
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

function Select(props) {
	return h("select", {
		className: "dmi-select",
		value: props.value === undefined || props.value === null ? "" : props.value,
		onChange: (e) => props.onChange(e.target.value),
	}, props.children);
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
				salary: { amount: f.salaryAmount === "" ? null : Number(f.salaryAmount), period: f.salaryPeriod, notes: f.salaryNotes },
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
	const todayStr = new Date().toISOString().slice(0, 10);

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
				Field({ label: t("f.notes"), wide: true }, TextArea({ value: f.content, onChange: setF("content") }))),
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

	const totals = (assets.totals && assets.totals.totals) || {};
	return h("div", { className: "dmi-root" },
		h("div", { className: "dmi-stats" },
			Object.entries(totals).map(([currency, bucket]) => h("div", { key: currency, style: { display: "contents" } },
				h("div", { className: "dmi-stat" }, h("span", null, t("stat.bank") + " · " + currency), h("b", null, fmtMoney(bucket.bank))),
				h("div", { className: "dmi-stat" }, h("span", null, t("stat.pay") + " · " + currency), h("b", null, fmtMoney(bucket.pay))),
				h("div", { className: "dmi-stat" }, h("span", null, t("stat.stock") + " · " + currency), h("b", null, fmtMoney(bucket.stock))),
				h("div", { className: "dmi-stat" }, h("span", null, t("stat.holdings") + " · " + currency), h("b", null, fmtMoney(bucket.holdings))),
				h("div", { className: "dmi-stat", style: { borderColor: "rgba(59,130,246,.5)" } }, h("span", null, t("stat.grand") + " · " + currency), h("b", null, fmtMoney(bucket.grand)))))),

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
						h(Btn, { size: "sm", variant: "danger", onClick: () => { if (window.confirm(t("confirm.delete"))) post("account-delete", { id: entry.id }); } }, t("action.delete")))))),
				kind === "stock" && holdings.length > 0 ? h("div", null,
					h("div", { className: "dmi-section-title" }, t("holdings.of")),
					h("table", { className: "dmi-table" },
						h("thead", null, h("tr", null, ["f.account", "f.code", "f.name", "f.shares", "f.costPrice", "f.price", ""].map((k) => h("th", { key: k }, k === "" ? "" : t(k))))),
						h("tbody", null, holdings.map((entry) => h("tr", { key: entry.id },
							h("td", null, entry.account),
							h("td", null, entry.code),
							h("td", null, entry.name || t("misc.none")),
							h("td", null, entry.shares),
							h("td", null, entry.costPrice === null || entry.costPrice === undefined ? t("misc.none") : entry.costPrice),
							h("td", null, entry.price === null || entry.price === undefined ? t("misc.none") : entry.price),
							h("td", { style: { whiteSpace: "nowrap" } },
								h(Btn, { size: "sm", onClick: () => setHoldForm({ id: entry.id, form: holdingFormOf(entry) }) }, t("action.edit")),
								" ",
								h(Btn, { size: "sm", variant: "danger", onClick: () => { if (window.confirm(t("confirm.delete"))) post("holding-delete", { id: entry.id }); } }, t("action.delete")))))))) : null);
		}),

		h("div", { className: "dmi-actions" },
			h(Btn, { onClick: () => setAcctForm({ id: null, form: accountFormOf(null) }) }, t("action.addAccount")),
			h(Btn, { onClick: () => setHoldForm({ id: null, form: holdingFormOf(null, stockAccounts.length > 0 ? stockAccounts[0].id : "") }) }, t("action.addHolding"))));
}

// ---------------------------------------------------------------------------
// 区块根组件
// ---------------------------------------------------------------------------

const TAB_KEYS = ["identity", "career", "relations", "reflections", "assets"];

function MyInfoSection(props, ctx) {
	const [, setLangTick] = useState(0);
	const [view, setView] = useState(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [tab, setTab] = useState("identity");
	const alive = useRef(true);

	useEffect(() => () => { alive.current = false; }, []);
	useEffect(() => {
		relocalize = () => setLangTick((v) => v + 1);
		return () => { relocalize = null; };
	}, []);

	const load = useCallback(async () => {
		try {
			const value = await api(undefined);
			if (!alive.current) return;
			setView(value);
			setError("");
		} catch (err) {
			if (alive.current) setError(t("error.load") + String(err && err.message ? err.message : err));
		}
	}, []);

	useEffect(() => { load(); }, [load]);

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

	const tabProps = { view, post, busy };
	return h("div", { className: "dmi-root" },
		h("style", null, STYLE_CSS),
		h("div", { className: "dmi-head" },
			h("h3", null, t("title")),
			view && view.meta ? h("span", { className: "dmi-updated" }, t("hint.updatedAt") + "：" + String(view.meta.updatedAt || "").replace("T", " ").slice(0, 19)) : null,
			h(Btn, { size: "sm", onClick: load }, t("action.refresh"))),
		h("div", { className: "dmi-sub" }, t("subtitle")),
		error ? h("div", { className: "dmi-error" }, error) : null,
		h("div", { className: "dmi-tabs" }, TAB_KEYS.map((key) =>
			h("button", {
				key, className: "dmi-tab" + (tab === key ? " is-active" : ""), onClick: () => setTab(key),
			}, t("tab." + key)))),
		view === null && error === "" ? h("div", { className: "dmi-empty" }, "…") :
		view === null ? null :
		tab === "identity" ? h(IdentityTab, tabProps) :
		tab === "career" ? h(CareerTab, tabProps) :
		tab === "relations" ? h(RelationsTab, tabProps) :
		tab === "reflections" ? h(ReflectionsTab, tabProps) :
		h(AssetsTab, tabProps));
}

function apply(ctx) {
	ctx.effect(() => subscribeLocale(ctx));
	ctx.slots.inject("settings.section", () => ctx.slots.register({
		name: "settings.section",
		id: "dsh-myinfo",
		order: 47,
		label: () => t("nav.title"),
		inject: () => ({}),
	}, (props) => MyInfoSection(props, ctx)));
}

const inject = ["slots", "locale"];

exports.apply = apply;
exports.inject = inject;

return module.exports;
}});
