import { Discolytics as CoreClient, ClientType } from '@discolytics/core';
import { type WebSocketManager, WebSocketShardEvents } from '@discordjs/ws';
import fs from 'fs';
import path from 'path';
import { parseToken } from './utils';

export class Discolytics {
	core: CoreClient;
	private manager: WebSocketManager;
	private token: string;

	constructor(data: {
		botId: string;
		apiKey: string;
		dataApiUrl?: string;
		apiUrl?: string;
		manager: WebSocketManager;
		token?: string;
	}) {
		this.token = data.token ?? data.manager.options.token ?? '';
		if (!this.token) throw new Error('Auth not passed to DiscordJS WS Manager');
		this.token = parseToken(this.token);
		this.core = new CoreClient({
			...data,
			clientType: ClientType.DISCORDJS_WS,
			auth: this.token,
			clientVersion: this.getClientVersion(),
		});
		this.manager = data.manager;

		this.manager.on(WebSocketShardEvents.Dispatch, (event) => {
			const d = event.data.d as
				| { guild_id?: string; type?: number }
				| undefined;
			this.core.sendEvent(event.data.t, d?.guild_id);
			if (event.data.t === 'INTERACTION_CREATE' && d?.type) {
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
