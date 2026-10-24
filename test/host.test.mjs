/**
 * dsh-myinfo Host 端快速自测（node test/host.test.mjs）
 * 用临时 DSH_HOME，不触碰真实档案；直接断言 store 与工具的核心行为。
 */
import { equal, rejects } from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
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

rmSync(dir, { recursive: true, force: true });
console.log('ALL HOST TESTS PASSED');
