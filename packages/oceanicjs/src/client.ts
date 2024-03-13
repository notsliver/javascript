import { CoreClient } from '@discolytics/core';
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
			clientType: 1,
			auth: data.bot.options.auth,
		});
		this.bot = data.bot;

		this.bot.on('packet', async (data) => {
			await this.core.sendEvent(data.t);
		});
	}

	async postCommand(name: string, userId: string, metadata?: unknown) {
		return await this.core.postCommand(name, userId, metadata);
	}
}
