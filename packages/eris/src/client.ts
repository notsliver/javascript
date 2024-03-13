import { CoreClient, ClientType } from '@discolytics/core';
import { Client as Bot } from 'eris';

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
		const token = (data.bot as any)._token;
		if (!token) throw new Error('Auth not passed to Eris client');
		this.core = new CoreClient({
			...data,
			clientType: ClientType.ERIS,
			auth: token,
		});
		this.bot = data.bot;

		this.bot.on('rawWS', async (data) => {
			if (!data.t) return;
			await this.core.sendEvent(data.t, (data.d as any)?.guild_id);
		});
	}

	async postCommand(name: string, userId: string, metadata?: unknown) {
		return await this.core.postCommand(name, userId, metadata);
	}
}
