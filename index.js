/**
 * dsh-myinfo — Cordis 插件入口。
 *
 * apply 做两件事：注册 6 个 agent 工具（personal_identity / personal_career /
 * personal_relations / personal_reflections / personal_assets + 一次性摘要
 * personal_context），并在
 * webServer 可用时挂载设置页面板路由（/_dsh/dsh-myinfo/panel）。
 * 数据落在 $DSH_HOME/integrations/dsh-myinfo/data.json（0600）。
 */
import { buildTools } from './tools.js';
import { installPanelWeb } from './panel.js';

export const inject = ['tools'];

export function apply(ctx) {
	for (const definition of buildTools()) {
		ctx.effect(() => ctx.tools.register(definition));
	}
	installPanelWeb(ctx);
}
