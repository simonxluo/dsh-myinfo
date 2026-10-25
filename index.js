/**
 * dsh-myinfo — Cordis 插件入口。
 *
 * apply 做两件事：注册 7 个 agent 工具（personal_identity / personal_career /
 * personal_relations / personal_reflections / personal_assets + 一次性摘要
 * personal_context + 跨档案模糊搜索 personal_search），并在
 * webServer 可用时挂载设置页面板路由（/_dsh/dsh-myinfo/panel）。
 * 数据落在 $DSH_HOME/integrations/dsh-myinfo/data.json（0600）。
 */
import Schema from '@deepseek-ai/schemastery';
import { buildTools } from './tools.js';
import { installPanelWeb } from './panel.js';
import { migrateToConfiguredFile, setDataFile } from './store.js';

export const inject = ['tools'];

export const Config = Schema.object({
	dataFile: Schema.string().default('').description(
		'Absolute path of the dossier data file. Empty keeps the default '
		+ '$DSH_HOME/integrations/dsh-myinfo/data.json; point it at a synced directory '
		+ '(e.g. an agentfs/JuiceFS mount) so the raw data syncs to cloud storage.'
	).volatile(),
});

export function apply(ctx, rowConfig) {
	const cfg = rowConfig ?? {};
	setDataFile(cfg.dataFile ?? '');
	try { migrateToConfiguredFile(); } catch (e) { ctx.logger?.warn?.('dsh-myinfo data migration failed'); }
	for (const definition of buildTools()) {
		ctx.effect(() => ctx.tools.register(definition));
	}
	installPanelWeb(ctx);
}
