import { CoreClient, ClientType } from '@discolytics/core';
import type { Client as Bot } from 'oceanic.js';

export class Client {
	private core: CoreClient;
	private bot: Bot;

	constructor(data: {
		botId: string;
		apiKey: string;
		dataApiUrl?: string;
		apiUrl?: string;
		bot: Bot;
	}) {
		if (!data.bot.options.auth)
			throw new Error('Auth not passed to OceanicJS client');
		this.core = new CoreClient({
			...data,
			clientType: ClientType.OCEANIC_JS,
			auth: data.bot.options.auth,
		});
		this.bot = data.bot;

		this.bot.on('packet', async (data) => {
			await this.core.sendEvent(data.t, (data.d as any)?.guild_id);
		});
	}

	startCommand(name: string, userId: string) {
		return this.core.startCommand(name, userId);
	}
}
