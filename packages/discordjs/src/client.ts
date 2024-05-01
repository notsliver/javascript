import { Discolytics as CoreClient, ClientType } from '@discolytics/core';
import type { Client as Bot } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { parseToken } from './utils';

export class Discolytics {
	core: CoreClient;
	private bot: Bot;
	private token: string;

	constructor(data: {
		botId: string;
		apiKey: string;
		dataApiUrl?: string;
		apiUrl?: string;
		bot: Bot;
		token?: string;
	}) {
		this.token = data.token ?? data.bot.token ?? '';
		if (!this.token) throw new Error('Auth not passed to DiscordJS client');
		this.token = parseToken(this.token);
		this.core = new CoreClient({
			...data,
			clientType: ClientType.DISCORD_JS,
			auth: this.token,
			clientVersion: this.getClientVersion(),
		});
		this.bot = data.bot;

		this.bot.on('raw', async (data) => {
			const d = data.d as any;
			this.core.sendEvent(data.t, d?.guild_id);
			if (data.t === 'INTERACTION_CREATE' && d?.type) {
				this.core.postInteraction(d.type, d.guild_id);
			}
		});
	}

	startCommand(name: string, userId: string) {
		return this.core.startCommand(name, userId);
	}

	getClientVersion(): string | undefined {
		try {
			const json = JSON.parse(
				fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
			);
			return json?.version ?? undefined;
		} catch {
			return undefined;
		}
	}
}
