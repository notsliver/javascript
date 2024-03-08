// event emitter implementation taken from https://stackoverflow.com/a/61609010

import fetch from 'node-fetch';
import { API_URL, ClientType, EVENTS_API_URL } from './constants';
import { EventEmitter } from 'events';
import type { User } from './types/discord';
import pidusage from 'pidusage';

interface CoreClientEvents {
	captureEventsUpdate: () => void;
}

export declare interface CoreClient {
	on<U extends keyof CoreClientEvents>(
		event: U,
		listener: CoreClientEvents[U]
	): this;

	emit<U extends keyof CoreClientEvents>(
		event: U,
		...args: Parameters<CoreClientEvents[U]>
	): boolean;
}

interface GetBotData {
	captureEvents: string[];
	botUserId: string | null;
	botUserName: string | null;
	botUserAvatar: string | null;
	profileLastUpdated: number | null;
}

interface PatchBotData {
	botUserId?: string;
	botUserName?: string;
	botUserAvatar?: string;
}

export class CoreClient extends EventEmitter {
	private botId: string;
	private apiKey: string;
	private clientType: ClientType;
	private eventsApiUrl: string;
	private apiUrl: string;
	captureEvents: string[];
	private auth: string;

	constructor(data: {
		botId: string;
		apiKey: string;
		clientType?: ClientType;
		eventsApiUrl?: string;
		apiUrl?: string;
		auth: string;
	}) {
		super();
		this.botId = data.botId;
		this.apiKey = data.apiKey;
		this.clientType = data.clientType ?? ClientType.UNKNOWN;
		this.eventsApiUrl = data.eventsApiUrl ?? EVENTS_API_URL;
		this.apiUrl = data.apiUrl ?? API_URL;
		this.captureEvents = [];
		this.auth = data.auth;

		this.getCaptureEvents();
		setInterval(() => {
			this.getCaptureEvents();
		}, 1000 * 60);

		setInterval(() => {
			pidusage(process.pid, (err, stats) => {
				if (err) return console.error(err);

				this.postCpuUsage(stats.cpu);
				this.postMemUsage(stats.memory);
			});
		}, 1000 * 10);
	}

	async getBot(): Promise<
		{ success: false; data: null } | { success: true; data: GetBotData }
	> {
		const res = await fetch(`${this.apiUrl}/bots/${this.botId}`, {
			headers: {
				Authorization: this.apiKey,
			},
		}).catch(() => null);

		// no response
		if (!res) return { success: false, data: null };

		const data = (await res.json()) as GetBotData;

		const updateProfile =
			!data.profileLastUpdated ||
			Date.now() - data.profileLastUpdated > 1000 * 60 * 60 * 24; // update profile every 24h

		if (updateProfile) {
			const user = await this.getBotUser();
			if (user) {
				const { success } = await this.patchBot({
					botUserId: user.id,
					botUserName: user.username,
					botUserAvatar: this.getAvatarUrl(user),
				});
				if (success) console.log('Updated bot profile');
			}
		}

		return { success: true, data };
	}

	async patchBot(data: PatchBotData): Promise<{ success: boolean }> {
		const res = await fetch(`${this.apiUrl}/bots/${this.botId}`, {
			headers: {
				Authorization: this.apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
			method: 'PATCH',
		}).catch(() => null);

		// no response
		if (!res) return { success: false };

		return { success: res.status >= 200 && res.status < 300 };
	}

	private async getCaptureEvents(): Promise<{
		success: boolean;
		eventNames: string[];
	}> {
		const { data } = await this.getBot();

		if (!data) return { success: false, eventNames: [] };

		this.captureEvents = data.captureEvents;
		this.emit('captureEventsUpdate');
		return { success: true, eventNames: data.captureEvents };
	}

	async sendEvent(name: string, data: unknown): Promise<{ success: boolean }> {
		const res = await fetch(`${this.eventsApiUrl}/bots/${this.botId}/events`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				name,
				clientType: this.clientType,
				data,
			}),
		}).catch(() => null);

		if (!res) {
			// no response
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	async postCpuUsage(value: number) {
		const res = await fetch(
			`${this.eventsApiUrl}/bots/${this.botId}/cpuUsage`,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: this.apiKey,
				},
				method: 'POST',
				body: JSON.stringify({
					value,
					clientType: this.clientType,
				}),
			}
		).catch(() => null);

		if (!res) {
			// no response
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	async postMemUsage(value: number) {
		const res = await fetch(
			`${this.eventsApiUrl}/bots/${this.botId}/memUsage`,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: this.apiKey,
				},
				method: 'POST',
				body: JSON.stringify({
					value,
					clientType: this.clientType,
				}),
			}
		).catch(() => null);

		if (!res) {
			// no response
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	private async getBotUser() {
		const res = await fetch(`https://discord.com/api/v10/users/@me`, {
			headers: {
				Authorization: this.auth,
			},
		}).catch(() => null);

		if (!res) return;

		const data = (await res.json()) as User;

		return data;
	}

	private getAvatarUrl(user: User) {
		if (!user.avatar) {
			const index =
				user.discriminator === '0'
					? Number(BigInt(user.id) >> BigInt(22)) % 6
					: Number(user.discriminator) % 5;
			return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
		}

		return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
	}
}
