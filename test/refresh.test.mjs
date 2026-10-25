/**
 * dsh-myinfo refresh-prices 行情刷新自测（node test/refresh.test.mjs）
 * 独立于 host.test.mjs：mock 掉 globalThis.fetch，不打真实网络、不碰真实档案。
 * 覆盖：A 股/美股报价回写、港股 5 位补零、市场中文别名、代码推断、
 * 不可识别市场进 failures、停牌（接口不返回）进 failures、渲染输出。
 */
import { equal } from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'dsh-myinfo-quote-'));
process.env.DSH_HOME = dir;

const tools = await import('../tools.js');
const byName = new Map(tools.buildTools().map((t) => [t.name, t]));
const assets = byName.get('personal_assets');

// 测试档案：一个股票账户 + 三条持仓（A股 / 美股中文市场 / 港股短代码）
const account = await assets.execute({ action: 'save-account', account: { kind: 'stock', name: '同花顺', balance: 1000 } });
await assets.execute({ action: 'save-holding', holding: { account: account.id, code: '600519', market: 'SH', shares: 10, costPrice: 1500, price: 1490 } });
await assets.execute({ action: 'save-holding', holding: { account: account.id, code: 'AAPL', market: '美股', shares: 5, costPrice: 300 } });
await assets.execute({ action: 'save-holding', holding: { account: account.id, code: '700', market: 'HK', shares: 100, costPrice: 380 } });

// --- mock 行情：用 iconv 产出真实 GBK 字节（接口本身就是 GBK，顺带验证解码路径） ---
const realFetch = globalThis.fetch;
const gbkBuffer = (text) => {
	const { stdout, error } = spawnSync('iconv', ['-f', 'UTF-8', '-t', 'GBK'], { input: text, maxBuffer: 1 << 20 });
	if (error || stdout.length === 0) throw new Error('iconv 不可用，无法生成 GBK mock');
	return stdout;
};
const respond = (payload) => async () => ({ ok: true, status: 200, arrayBuffer: async () => gbkBuffer(payload) });
let requestedUrl = '';
globalThis.fetch = async (url) => {
	requestedUrl = String(url);
	return respond('v_sz000001="51~平安银行~000001~11.20~11.30~x"\n'
		+ 'v_sh600519="1~贵州茅台~600519~1335.00~1318.49~x"\n'
		+ 'v_usaapl="200~苹果~AAPL~347.73~348.22~x"\n')();
};

const rp = await assets.execute({ action: 'refresh-prices' });
equal(rp.action, 'refresh-prices');
equal(rp.updated, 2, 'A股 + 美股两条更新');
equal(rp.failures.length, 1, '港股本次 mock 不返回 → failure');
equal(rp.failures[0].code, '700');
if (!requestedUrl.includes('qt.gtimg.cn/q=sh600519')) throw new Error('A股代码应带 sh 前缀');
if (!requestedUrl.includes('usaapl')) throw new Error('美股代码应转小写 us 前缀');
const moutai = rp.updates.find((u) => u.code === '600519');
equal(moutai.oldPrice, 1490);
equal(moutai.newPrice, 1335);
equal(moutai.changePct, 1.25, '涨跌幅 = (1335-1318.49)/1318.49');
const aapl = rp.updates.find((u) => u.code === 'AAPL');
equal(aapl.newPrice, 347.73);

// 回写与名称回填
const view = await assets.execute({ action: 'get' });
equal(view.assets.holdings.find((h) => h.code === '600519').price, 1335, '现价已回写档案');
equal(view.assets.holdings.find((h) => h.code === 'AAPL').name, '苹果', '空名称用行情名称回填');
equal(view.assets.holdings.find((h) => h.code === 'AAPL').price, 347.73);

// --- 港股 5 位补零：700 → hk00700 ---
globalThis.fetch = async (url) => {
	if (!String(url).includes('hk00700')) throw new Error(`应请求 hk00700，实际 ${url}`);
	return respond('v_hk00700="100~腾讯控股~00700~386.0~382.4~x"')();
};
const rp2 = await assets.execute({ action: 'refresh-prices' });
equal(rp2.updated >= 1, true);
equal(rp2.updates.find((u) => u.code === '700').newPrice, 386);

// --- market 留空按代码推断 + 不可识别代码进 failures ---
await assets.execute({ action: 'save-holding', holding: { account: account.id, code: '000001', shares: 100, costPrice: 10 } }); // 推断 sz
await assets.execute({ action: 'save-holding', holding: { account: account.id, code: 'ZZ123', shares: 1 } }); // 无法推断
globalThis.fetch = respond('v_sz000001="51~平安银行~000001~11.20~11.30~x"');
const rp3 = await assets.execute({ action: 'refresh-prices' });
equal(rp3.updates.some((u) => u.code === '000001' && u.newPrice === 11.2), true, '无 market 也能按代码推断刷新');
equal(rp3.failures.some((f) => f.code === 'ZZ123'), true, '不可识别市场进 failures 而不是整单报错');

// --- 网络整体失败 → StoreError ---
globalThis.fetch = async () => { throw new Error('network down'); };
try {
	await assets.execute({ action: 'refresh-prices' });
	throw new Error('network failure should throw StoreError');
} catch (err) {
	if (!/行情接口不可达/.test(err.message)) throw new Error(`意外错误：${err.message}`);
}

// --- 渲染输出 ---
globalThis.fetch = respond('v_sh600519="1~贵州茅台~600519~1335.00~1318.49~x"\nv_sz000001="51~平安银行~000001~11.20~11.30~x"\nv_hk00700="100~腾讯控股~00700~386.0~382.4~x"');
const rp4 = await assets.execute({ action: 'refresh-prices' });
const text = (await assets.output.render)({}, rp4)[0].text;
if (!text.includes('行情刷新') || !text.includes('贵州茅台') || !text.includes('资产台账')) {
	throw new Error('render 应包含刷新明细与资产台账');
}

globalThis.fetch = realFetch;
rmSync(dir, { recursive: true, force: true });
console.log('REFRESH-PRICES TESTS PASSED');
