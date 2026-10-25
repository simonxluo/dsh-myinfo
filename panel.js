/**
 * dsh-myinfo — 设置页面板 API（Host webServer 路由）。
 *
 * GET  返回完整档案视图（profileView：含派生的年龄、在职标记、资产合计）。
 * POST {action, ...} 与 agent 工具共用 store 校验：
 *   identity-patch / career-save / career-delete / relation-save /
 *   relation-delete / reflection-save / reflection-delete /
 *   account-save / account-delete / holding-save / holding-delete
 *
 * 访问控制沿用 dsh-ssh-manager 的面板语义：仅本机回环、Host 必须是
 * localhost 名（防 DNS rebinding）、POST 必须是 JSON 且 Origin/Sec-Fetch-Site
 * 合法（防跨站写入）。
 */
import {
	StoreError, accountEntry, careerEntry, holdingEntry, identityPatch,
	loadProfile, mutate, profileView, reflectionEntry, relationEntry, validId,
} from './store.js';
import { nextIdIn } from './ids.js';

export const PANEL_ROUTE = '/_dsh/dsh-myinfo/panel';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function firstLine(text) {
	const line = String(text ?? '').split('\n', 1)[0].trim();
	return line.length > 160 ? line.slice(0, 160) + '…' : line;
}

/** Host 头判定：undefined 放行，否则是拒绝原因（防 rebinding 域名读面板）。 */
function hostVerdict(host) {
	if (typeof host !== 'string' || host.trim() === '') return undefined;
	const text = host.trim().toLowerCase();
	const name = text.startsWith('[') ? text.slice(0, text.indexOf(']') + 1) : text.split(':')[0];
	return LOCAL_HOSTNAMES.has(name) ? undefined : `host "${host}" is not a localhost name`;
}

/** 跨站写入门判定：undefined 放行，否则 {status, message}。 */
function postVerdict(headers) {
	const contentType = String(headers['content-type'] ?? '');
	if (!contentType.toLowerCase().includes('application/json')) {
		return { status: 415, message: 'dsh-myinfo panel accepts application/json only' };
	}
	const origin = headers.origin;
	if (typeof origin === 'string' && origin.trim() !== '') {
		let url;
		try { url = new URL(origin); } catch { url = undefined; }
		if (url !== undefined && (url.protocol === 'http:' || url.protocol === 'https:')
			&& !LOCAL_HOSTNAMES.has(url.hostname.toLowerCase())) {
			return { status: 403, message: `origin "${origin}" is not allowed to write dsh-myinfo data` };
		}
	}
	const site = headers['sec-fetch-site'];
	if (typeof site === 'string' && site !== '' && site !== 'same-origin' && site !== 'none') {
		return { status: 403, message: `a ${site} request may not write dsh-myinfo data` };
	}
	return undefined;
}

function sendPanelJson(response, status, value) {
	const payload = JSON.stringify(value);
	response.writeHead(status, {
		'content-type': 'application/json',
		'cache-control': 'no-store',
		'content-length': Buffer.byteLength(payload),
	});
	response.end(payload);
}

function readJsonBody(request, response) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		const fail = (kind, message) => {
			const error = new Error(message);
			error.kind = kind;
			return error;
		};
		request.on('data', (chunk) => {
			size += chunk.length;
			if (size > 256 * 1024) {
				if (!response.writableEnded && !response.destroyed) {
					sendPanelJson(response, 413, { ok: false, error: { code: 'too-large', message: 'request body exceeds 256 KiB' } });
					// 等响应真正发完再断开请求，避免 413 响应体被截断。
					response.once('finish', () => request.destroy());
					response.once('close', () => request.destroy());
				} else {
					request.destroy();
				}
				reject(fail('too-large', 'body too large'));
				return;
			}
			chunks.push(chunk);
		});
		request.on('end', () => {
			try {
				resolve(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8')));
			} catch (error) {
				reject(fail('bad-json', `invalid JSON body: ${firstLine(error.message)}`));
			}
		});
		request.on('error', reject);
	});
}

// ---------------------------------------------------------------------------
// POST 动作
// ---------------------------------------------------------------------------

function upsert(listFn, kind, value, id, label) {
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

function remove(listFn, id, label) {
	return mutate((profile) => {
		if (!validId(id)) throw new StoreError(`${label} id 非法`);
		const list = listFn(profile);
		const index = list.findIndex((x) => x.id === id);
		if (index < 0) throw new StoreError(`${label} id=${id} 不存在`);
		list.splice(index, 1);
		return { id, action: 'delete' };
	});
}

/** POST 动作表：成功返回 {status, value}，未知动作返回 {status, error}。 */
function applyAction(body) {
	const action = String(body?.action ?? '');
	const id = String(body?.id ?? '').trim();
	const done = (result) => ({ status: 200, value: result });
	switch (action) {
		case 'identity-patch': {
			const patch = identityPatch(body?.patch ?? {});
			if (Object.keys(patch).length === 0) throw new StoreError('patch 里没有可识别的字段');
			mutate((profile) => { Object.assign(profile.identity, patch); });
			return done({ updated: true, fields: Object.keys(patch) });
		}
		case 'career-save':
			return done(upsert((p) => p.career, 'career', careerEntry(body?.entry), id, '工作经历').result);
		case 'career-delete':
			return done(remove((p) => p.career, id, '工作经历').result);
		case 'relation-save':
			return done(upsert((p) => p.relations, 'relation', relationEntry(body?.entry), id, '人际关系').result);
		case 'relation-delete':
			return done(remove((p) => p.relations, id, '人际关系').result);
		case 'reflection-save':
			return done(upsert((p) => p.reflections, 'reflection', reflectionEntry(body?.entry), id, '人生感悟').result);
		case 'reflection-delete':
			return done(remove((p) => p.reflections, id, '人生感悟').result);
		case 'account-save':
			return done(upsert((p) => p.assets.accounts, 'account', accountEntry(body?.entry), id, '资产账户').result);
		case 'account-delete':
			return done(remove((p) => p.assets.accounts, id, '资产账户').result);
		case 'holding-save':
			return done(upsert((p) => p.assets.holdings, 'holding', holdingEntry(body?.entry), id, '持仓').result);
		case 'holding-delete':
			return done(remove((p) => p.assets.holdings, id, '持仓').result);
		default:
			return { status: 400, error: { code: 'bad-action', message: `unknown action "${action}"` } };
	}
}

/** 挂载面板路由；由 index.js 在 webServer 可用时调用。 */
export function installPanelWeb(ctx) {
	ctx.inject(['webServer'], (webCtx) => {
		webCtx.effect(() => webCtx.webServer.register({
			kind: 'exact',
			path: PANEL_ROUTE,
			handler: async (request, response) => {
				try {
					const remote = String(request.socket?.remoteAddress ?? '');
					if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
						sendPanelJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'dsh-myinfo panel is localhost-only' } });
						return;
					}
					const host = hostVerdict(request.headers.host);
					if (host !== undefined) {
						sendPanelJson(response, 403, { ok: false, error: { code: 'forbidden', message: host } });
						return;
					}
					if (request.method === 'GET') {
						sendPanelJson(response, 200, { ok: true, value: profileView(loadProfile()) });
						return;
					}
					if (request.method !== 'POST') {
						response.writeHead(405, { allow: 'GET, POST' });
						response.end();
						return;
					}
					const post = postVerdict(request.headers);
					if (post !== undefined) {
						sendPanelJson(response, post.status, { ok: false, error: { code: 'untrusted', message: post.message } });
						return;
					}
					const body = await readJsonBody(request, response);
					const outcome = applyAction(body);
					if (outcome.error !== undefined) {
						sendPanelJson(response, outcome.status, { ok: false, error: outcome.error });
					} else {
						sendPanelJson(response, outcome.status, { ok: true, value: outcome.value });
					}
				} catch (error) {
					// readJsonBody 的 kind 分流在前：畸形请求体是客户端问题（400），不是服务端 500，
					// 且不回传解析器细节；其余按业务错 400 / 内部错 500。
					let status = error instanceof StoreError ? 400 : 500;
					let code = 'error';
					let message = firstLine(error?.message ?? String(error));
					if (error?.kind === 'bad-json') {
						status = 400; code = 'bad-json'; message = 'invalid JSON body';
					} else if (error?.kind === 'too-large') {
						status = 413; code = 'too-large'; message = 'request body too large';
					}
					if (!response.headersSent) {
						sendPanelJson(response, status, { ok: false, error: { code, message } });
					} else {
						response.end();
					}
				}
			},
		}));
	});
}
