import { Discolytics as CoreClient, ClientType } from '@discolytics/core';
import { Client as Bot } from 'eris';

export class Discolytics {
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
			const d = data.d as any;
			this.core.sendEvent(data.t, d?.guild_id);
			if (data.t === 'INTERACTION_CREATE' && d?.type) {
				this.core.postInteraction(d.type, d.guild_id)
			}
		});
	}

	startCommand(name: string, userId: string) {
		return this.core.startCommand(name, userId);
	}
}
