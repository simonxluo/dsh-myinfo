/**
 * dsh-myinfo Host 端快速自测（node test/host.test.mjs）
 * 用临时 DSH_HOME，不触碰真实档案；直接断言 store 与工具的核心行为。
 */
import { equal, rejects } from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'dsh-myinfo-test-'));
process.env.DSH_HOME = dir;

const store = await import('../store.js');
const tools = await import('../tools.js');
const byName = new Map(tools.buildTools().map((t) => [t.name, t]));

// --- identity: patch + get ---
const identity = byName.get('personal_identity');
await identity.execute({ action: 'patch', patch: { name: '张三', gender: '男', birthDate: '1995-06-15', birthplace: '湖南长沙', origin: '湖南', residence: '上海浦东', junk: 'ignored' } });
const idView = await identity.execute({ action: 'get' });
equal(idView.identity.name, '张三');
equal(idView.identity.birthplace, '湖南长沙');
equal(typeof idView.identity.age, 'number', 'age derived from birthDate');
await rejects(() => identity.execute({ action: 'patch', patch: { birthDate: '1995/06/15' } }), /YYYY-MM-DD/);

// --- career: add / list / update / delete ---
const career = byName.get('personal_career');
const addCareer = await career.execute({ action: 'add', entry: { company: 'Acme', title: '后端工程师', startDate: '2023-07', content: '负责交易系统', salary: { amount: 25000, period: 'monthly' } } });
equal(addCareer.action, 'add');
const cid = addCareer.id;
const list1 = await career.execute({ action: 'list' });
equal(list1.career.length, 1);
equal(list1.career[0].current, true, 'no endDate => current');
const updCareer = await career.execute({ action: 'update', id: cid, entry: { company: 'Acme', title: '高级后端工程师', startDate: '2023-07', endDate: '2025-08', salary: { amount: 38000, period: 'monthly' } } });
equal(updCareer.action, 'update');
const list2 = await career.execute({ action: 'list' });
equal(list2.career[0].current, false);
equal(list2.career[0].title, '高级后端工程师');
await rejects(() => career.execute({ action: 'update', id: 'c99', entry: { company: 'X', title: 'Y', startDate: '2024' } }), /不存在/);
await career.execute({ action: 'add', entry: { company: 'Beta', title: '实习生', startDate: '2022-06', endDate: '2022-09' } });
const list3 = await career.execute({ action: 'list' });
equal(list3.career[0].company, 'Acme', 'sorted by startDate desc');

// --- relations ---
const relations = byName.get('personal_relations');
const rel = await relations.execute({ action: 'add', entry: { name: '李四', relation: '大学室友', group: '朋友', tags: ['校友', '上海'] } });
equal(rel.action, 'add');
const relView = await relations.execute({ action: 'list' });
equal(relView.relations.length, 1);
equal(relView.relations[0].group, '朋友');

// --- reflections: date-ordered ---
const reflections = byName.get('personal_reflections');
await reflections.execute({ action: 'add', entry: { date: '2024-05-01', title: '关于耐心', content: '慢就是快。', tags: ['心态'] } });
await reflections.execute({ action: 'add', entry: { date: '2025-01-10', content: '新年复盘：健康第一。' } });
const refView = await reflections.execute({ action: 'list' });
equal(refView.reflections[0].date, '2025-01-10', 'newest first');
await rejects(() => reflections.execute({ action: 'add', entry: { date: '2025-01-10', content: '' } }), /不能为空/);

// --- assets: accounts + holdings + totals ---
const assets = byName.get('personal_assets');
const bank = await assets.execute({ action: 'save-account', account: { kind: 'bank', name: '招商银行', mask: '尾号 8888', balance: 120000.456 } });
equal(bank.action, 'add');
await assets.execute({ action: 'save-account', account: { kind: 'pay', name: '支付宝', balance: 3000 } });
await assets.execute({ action: 'save-account', account: { kind: 'pay', name: '微信', balance: 1500.5 } });
const ths = await assets.execute({ action: 'save-account', account: { kind: 'stock', name: '同花顺', mask: 'A股账户', balance: 8000 } });
await assets.execute({ action: 'save-holding', holding: { account: ths.id, code: '600519', name: '贵州茅台', market: 'SH', shares: 10, costPrice: 1500, price: 1600 } });
await assets.execute({ action: 'save-holding', holding: { account: ths.id, code: '000001', name: '平安银行', market: 'SZ', shares: 1000, costPrice: 10.5, price: 11 } });
const aView = await assets.execute({ action: 'get' });
const totals = aView.assets.totals.totals.CNY;
equal(totals.bank, 120000.46, 'balance rounded to cents');
equal(totals.pay, 4500.5);
equal(totals.stock, 8000);
equal(totals.holdings, 16000 + 11000, 'holdings value = shares*price');
equal(totals.grand, 159500.96);

// --- update account balance via id (upsert) ---
await assets.execute({ action: 'save-account', id: bank.id, account: { kind: 'bank', name: '招商银行', mask: '尾号 8888', balance: 130000 } });
const aView2 = await assets.execute({ action: 'get' });
equal(aView2.assets.totals.totals.CNY.bank, 130000, 'balance updated in place');
equal(aView2.assets.accounts.filter((x) => x.kind === 'bank').length, 1, 'no duplicate');

// --- delete flows ---
const delHold = await assets.execute({ action: 'delete-holding', id: aView2.assets.holdings[0].id });
equal(delHold.action, 'delete');
await career.execute({ action: 'delete', id: cid });
equal((await career.execute({ action: 'list' })).career.length, 1);

// --- 持久化与文件权限 ---
const raw = JSON.parse(readFileSync(join(dir, 'integrations', 'dsh-myinfo', 'data.json'), 'utf8'));
equal(raw.identity.name, '张三');
const mode = statSync(join(dir, 'integrations', 'dsh-myinfo', 'data.json')).mode & 0o777;
equal(mode, 0o600, 'data file is 0600');

// --- 渲染输出含可读摘要 ---
const rendered = (await byName.get('personal_assets').output.render)({}, await assets.execute({ action: 'get' }));
equal(rendered[0].type, 'text');
if (!rendered[0].text.includes('招商银行')) throw new Error('render should mention bank account');


// --- workflow 评审修复回归 ---
// id 水位线：删除最大 id 后不复用
const wm1 = await career.execute({ action: 'add', entry: { company: 'W1', title: 'T', startDate: '2020' } });
const wm2 = await career.execute({ action: 'add', entry: { company: 'W2', title: 'T', startDate: '2021' } });
await career.execute({ action: 'delete', id: wm2.id });
const wm3 = await career.execute({ action: 'add', entry: { company: 'W3', title: 'T', startDate: '2022' } });
equal(wm3.id > wm2.id, true, `id watermark: expect > ${wm2.id}, got ${wm3.id}`);

// 不可能日期被拒绝
await rejects(() => career.execute({ action: 'add', entry: { company: 'X', title: 'Y', startDate: '2025-13-45' } }), /月份|日期|YYYY/);
// endDate 早于 startDate 被拒绝
await rejects(() => career.execute({ action: 'add', entry: { company: 'X', title: 'Y', startDate: '2024-05', endDate: '2020-01' } }), /endDate/);
// 非字符串字段被拒绝（不再变成 [object Object]）
await rejects(() => identity.execute({ action: 'patch', patch: { name: { evil: 1 } } }), /需是字符串/);
// update 缺 id 被拒绝（不再静默变 add）
await rejects(() => career.execute({ action: 'update', entry: { company: 'X', title: 'Y', startDate: '2024' } }), /update 需要提供 id/);
// 金额超范围被拒绝
await rejects(() => assets.execute({ action: 'save-account', account: { kind: 'bank', name: '巨款', balance: 1e13 } }), /范围/);

// 读路径兜底：数组元素与字符串数字被收敛
const dataPath = join(dir, 'integrations', 'dsh-myinfo', 'data.json');
const doc = JSON.parse(readFileSync(dataPath, 'utf8'));
doc.career.push(['not', 'an', 'object']);
doc.assets.accounts.push({ id: 'a99', kind: 'bank', name: '手改', balance: '12345.6' });
writeFileSync(dataPath, JSON.stringify(doc));
const dirty = await assets.execute({ action: 'get' });
equal(dirty.assets.accounts.some((x) => x.id === 'a99' && x.balance === 12345.6), true, 'string balance coerced');
equal(dirty.career.some((x) => Array.isArray(x)), false, 'array entries dropped');

// render 回归：add 动作返回 {id, action, profile} 包装，渲染入口必须能解包
const addRender = await career.execute({ action: 'add', entry: { company: 'R公司', title: 'T', startDate: '2023' } });
const renderedAdd = (await career.output.render)({}, addRender);
if (!renderedAdd[0].text.includes('R公司')) throw new Error('render should unwrap wrapper output');

// --- v0.6.0 personal_context：一次调用拿全对话上下文 ---
const contextTool = byName.get('personal_context');
const digest = await contextTool.execute({});
equal(digest.identity.name, '张三', 'digest carries identity');
equal(digest.currentJob.company, 'R公司', 'digest picks the current job');
equal(digest.careerCount, 4, 'digest counts career entries (incl. watermark-test leftover W3)');
equal(digest.relationCount, 1, 'digest counts relations');
equal(digest.latestReflection.date, '2025-01-10', 'digest latest reflection');
equal(typeof digest.assets.totals.CNY, 'object', 'digest asset totals');
const digestText = (await contextTool.output.render)({}, digest).map((x) => x.text).join('\n');
if (!digestText.includes('张三') || !digestText.includes('R公司') || !digestText.includes('个人上下文')) {
	throw new Error('personal_context render should mention identity, current job and the title');
}

// --- v0.4.x 主题修复回归：parseColorLuminance + autoDark 关键结构 ---
import { readFileSync as _rf } from 'node:fs';
const clientSrc = _rf(new URL('../client.js', import.meta.url), 'utf8');
const fnMatch = clientSrc.match(/function parseColorLuminance\([\s\S]*?\n}/);
if (fnMatch === null) throw new Error('parseColorLuminance not found in client.js');
const parseColorLuminance = (0, eval)(`(${fnMatch[0]})`); // 包裹成函数表达式求值
equal(parseColorLuminance('#1e1e22') < 0.5, true, 'dark hex → dark');
equal(parseColorLuminance('#ffffff') > 0.5, true, 'white → light');
equal(parseColorLuminance('rgb(30, 30, 34)') < 0.5, true, 'rgb() dark');
equal(parseColorLuminance('rgb(255, 255, 255)') > 0.5, true, 'rgb() light');
equal(parseColorLuminance('rgb(100%, 100%, 100%)') > 0.5, true, 'percent rgb');
equal(parseColorLuminance('oklch(0.2 0.02 260)'), null, 'oklch → null 回退');
equal(parseColorLuminance('hsl(0 0% 20%)'), null, 'hsl → null');
equal(parseColorLuminance('transparent'), null, 'transparent → null');
equal(parseColorLuminance(''), null, 'empty → null');
equal(parseColorLuminance('#1e1e22 garbage'), null, 'garbage suffix → null');
// autoDark 结构断言：真实宿主令牌在 body、快照判据是 active.colorScheme
if (!clientSrc.includes('getComputedStyle(host)') || !clientSrc.includes('document.body || document.documentElement')) {
	throw new Error('autoDark should read body-computed tokens first');
}
if (!clientSrc.includes('snap.active.colorScheme')) {
	throw new Error('autoDark should consult snap.active.colorScheme');
}
if (clientSrc.includes('--dmi-bg-opaque')) throw new Error('dead token --dmi-bg-opaque should be removed');

// --- v0.5.0 主题三态回归 ---
// ① 缺分号回归：自定义属性值会吞掉下一条声明（v0.4.1 曾让所有卡片背景失效）。
if (/\)\)--dmi-shadow/.test(clientSrc)) throw new Error('missing semicolon: declaration swallowed by previous custom property');
// ② 自动模式跟随宿主（dsw 链），手动覆盖用字面量（force 类不引用 dsw 变量）。
if (!clientSrc.includes('.dmi-scope.dmi-auto-dark{')) throw new Error('auto-dark scope class missing');
if (clientSrc.includes('.dmi-scope.dmi-dark{')) throw new Error('legacy dmi-dark class should be renamed');
const forceDarkBlock = clientSrc.slice(clientSrc.indexOf('.dmi-scope.dmi-force-dark{')).split('}')[0];
if (forceDarkBlock.includes('var(--dsw-alias')) throw new Error('force-dark must use literals (no dsw chain) to override the real host');
const autoDarkBlock = clientSrc.slice(clientSrc.indexOf('.dmi-scope.dmi-auto-dark{')).split('}')[0];
if (!autoDarkBlock.includes('var(--dsw-alias')) throw new Error('auto-dark must follow host dsw tokens');
// ③ scopeClassOf 三态：手动优先、自动跟随。
if (!clientSrc.includes('function scopeClassOf(ctx)')) throw new Error('scopeClassOf missing');
if (!clientSrc.includes('" dmi-force-dark"') || !clientSrc.includes('" dmi-force-light"') || !clientSrc.includes('" dmi-auto-dark"')) {
	throw new Error('scopeClassOf must map manual/auto modes to force/auto classes');
}
// ④ 三态循环 + 刷新 busy 反馈。
if (!clientSrc.includes('"theme.auto"') || !clientSrc.includes('"theme.next"')) throw new Error('three-state theme locale keys missing');
if (!clientSrc.includes('busy, onClick: load')) throw new Error('refresh buttons should reflect busy state');
// ⑤ 侧栏图标回归提示：occupant 不应再包按钮（宿主 PanelRow 已是按钮）。
if (/"dmi-scope dmi-dockpage" \+ scopeClassOf/.test(clientSrc) === false) throw new Error('dock scope should carry dmi-dockpage marker');

// --- v0.6.0 卡片式主面板回归 ---
if (!clientSrc.includes('function DomainCard(props)')) throw new Error('DomainCard missing');
if (!clientSrc.includes('"dmi-cards"')) throw new Error('card grid missing');
if (!clientSrc.includes('dmi-detail-head')) throw new Error('detail head missing');
if (!clientSrc.includes('const [page, setPage] = useState(null)')) throw new Error('panel page state missing');
if (!clientSrc.includes('onOpen: () => setPage(key)')) throw new Error('cards should navigate into the detail page');

rmSync(dir, { recursive: true, force: true });
console.log('ALL HOST TESTS PASSED (incl. audit regressions)');
