import fetch from 'node-fetch';
import {
	API_URL,
	ClientType,
	DATA_API_URL,
	DISCORD_API_URL,
	type LOG_LEVEL,
} from './constants';
import type { Application, User } from './types/discord';
import pidusage from 'pidusage';

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

export class Discolytics {
	private botId: string;
	private apiKey: string;
	private clientType: ClientType;
	private dataApiUrl: string;
	private apiUrl: string;
	private auth: string;
	private primary: boolean;
	logLevels: Record<LOG_LEVEL, boolean>;

	constructor(data: {
		botId: string;
		apiKey: string;
		clientType?: ClientType;
		dataApiUrl?: string;
		apiUrl?: string;
		auth: string;
		primary?: boolean;
	}) {
		this.botId = data.botId;
		this.apiKey = data.apiKey;
		this.clientType = data.clientType ?? ClientType.UNKNOWN;
		this.dataApiUrl = data.dataApiUrl ?? DATA_API_URL;
		this.apiUrl = data.apiUrl ?? API_URL;
		this.auth = data.auth;
		this.primary = data.primary ?? true;
		this.logLevels = {
			debug: false,
			error: true,
			info: true,
		};

		if (this.primary) {
			this.patchBot({}); // update client type
			this.getBot();

			setInterval(() => {
				pidusage(process.pid, (err, stats) => {
					if (err) return console.error(err);

					this.postCpuUsage(stats.cpu);
					this.postMemUsage(stats.memory);
				});
			}, 1000 * 10);

			setInterval(() => {
				this.sendHeartbeat();
			}, 1000 * 30);

			setInterval(
				() => {
					this.postGuildCount();
				},
				1000 * 60 * 30
			);
		}

		this.log('info', 'Client ready');
	}

	log(level: LOG_LEVEL, ...args: any[]) {
		if (this.logLevels[level]) {
			switch (level) {
				case 'debug':
					console.debug(new Date(), ' | Discolytics | ', ...args);
					break;
				case 'error':
					console.error(new Date(), ' | Discolytics | ', ...args);
					break;
				case 'info':
					console.log(new Date(), ' | Discolytics | ', ...args);
					break;
			}
		}
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
		if (!res) {
			this.log('error', 'No response on get bot');
			return { success: false, data: null };
		}

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
				if (success) this.log('info', 'Updated bot profile');
				else this.log('error', 'Failed to update bot profile');
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
			body: JSON.stringify({ ...data, clientType: this.clientType }),
			method: 'PATCH',
		}).catch(() => null);

		// no response
		if (!res) {
			this.log('error', 'Failed to patch bot');
			return { success: false };
		}

		return { success: res.status >= 200 && res.status < 300 };
	}

	async sendEvent(
		name: string,
		guildId?: string
	): Promise<{ success: boolean }> {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/events`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				name,
				guildId,
			}),
		}).catch(() => null);

		if (!res) {
			// no response
			this.log('error', 'Failed to send event : ' + name);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	async postInteraction(type: number, guildId?: string) {
		const res = await fetch(
			`${this.dataApiUrl}/bots/${this.botId}/interactions`,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: this.apiKey,
				},
				method: 'POST',
				body: JSON.stringify({
					type,
					guildId,
				}),
			}
		).catch(() => null);

		if (!res) {
			// no response
			this.log('error', 'Failed to post interaction type : ' + type);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	async postCpuUsage(value: number) {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/cpuUsage`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				value,
				clientType: this.clientType,
			}),
		}).catch(() => null);

		if (!res) {
			// no response
			this.log('error', 'Failed to post CPU usage : ' + value);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	async postMemUsage(value: number) {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/memUsage`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				value,
				clientType: this.clientType,
			}),
		}).catch(() => null);

		if (!res) {
			// no response
			this.log('error', 'Failed to post memory usage : ' + value);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	startCommand(name: string, userId: string) {
		const start = Date.now();
		return {
			end: async (metadata?: unknown) => {
				const end = Date.now();
				const duration = end - start;
				return await this.postCommand(name, userId, duration, metadata);
			},
		};
	}

	async postCommand(
		name: string,
		userId: string,
		duration: number,
		metadata?: unknown
	) {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/command`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				name,
				userId,
				metadata,
				duration,
			}),
		}).catch(() => null);

		if (!res) {
			// no response
			this.log('error', 'Failed to post command : ' + name);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	private async getBotUser() {
		const res = await fetch(`${DISCORD_API_URL}/users/@me`, {
			headers: {
				Authorization: this.auth,
			},
		}).catch(() => null);

		if (!res) {
			this.log('error', 'Failed to get bot user');
			return;
		}

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

	private async sendHeartbeat() {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/heartbeat`, {
			headers: {
				Authorization: this.apiKey,
			},
			method: 'POST',
		}).catch(() => null);

		if (!res) {
			this.log('error', 'Failed to send heartbeat');
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}

	private async getApplication() {
		const res = await fetch(`${DISCORD_API_URL}/applications/@me`, {
			headers: {
				Authorization: this.auth,
			},
		}).catch(() => null);

		if (!res) {
			this.log('error', 'Failed to get Discord application');
			return;
		}

		const data = (await res.json()) as Application;

		return data;
	}

	private async getGuildCount() {
		const application = await this.getApplication();
		return application?.approximate_guild_count;
	}

	private async postGuildCount() {
		const count = await this.getGuildCount();
		if (count == null) return { success: false };

		const res = await fetch(
			`${this.dataApiUrl}/bots/${this.botId}/guildCount`,
			{
				headers: {
					Authorization: this.apiKey,
					'Content-Type': 'application/json',
				},
				method: 'POST',
				body: JSON.stringify({
					count,
				}),
			}
		).catch(() => null);

		if (!res) {
			this.log('error', 'Failed to post guild count : ' + count);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}
}
