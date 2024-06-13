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
	clientType?: ClientType;
	clientVersion?: string;
}

interface Event {
	name: string;
	guildId?: string;
}

interface Interaction {
	type: number;
	guildId?: string;
}

interface Command {
	name: string;
	userId: string;
	duration: number;
	metadata?: unknown;
}

const parseAuth = (s: string) => {
	if (s.startsWith('Bot')) return s;
	return `Bot ${s}`;
};

export class Discolytics {
	private botId: string;
	private apiKey: string;
	private clientType: ClientType;
	private clientVersion?: string;
	private dataApiUrl: string;
	private apiUrl: string;
	private auth: string;
	private primary: boolean;
	logLevels: Record<LOG_LEVEL, boolean>;
	private pendingEvents: Event[];
	private pendingInteractions: Interaction[];
	private pendingCommands: Command[];

	constructor(data: {
		botId: string;
		apiKey: string;
		clientType?: ClientType;
		clientVersion?: string;
		dataApiUrl?: string;
		apiUrl?: string;
		auth: string;
		primary?: boolean;
	}) {
		this.botId = data.botId;
		this.apiKey = data.apiKey;
		this.clientType = data.clientType ?? ClientType.UNKNOWN;
		this.clientVersion = data.clientVersion;
		this.dataApiUrl = data.dataApiUrl ?? DATA_API_URL;
		this.apiUrl = data.apiUrl ?? API_URL;
		this.auth = parseAuth(data.auth);
		this.primary = data.primary ?? true;
		this.logLevels = {
			debug: false,
			error: true,
			info: true,
		};
		this.pendingEvents = [];
		this.pendingInteractions = [];
		this.pendingCommands = [];

		setInterval(() => {
			this.postEvents();
			this.postInteractions();
			this.postCommands();
		}, 1000 * 15);

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

			this.sendHeartbeat();
			setInterval(() => {
				this.sendHeartbeat();
			}, 1000 * 30);

			this.postGuildCount();
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
			body: JSON.stringify({
				...data,
				clientType: this.clientType,
				clientVersion: this.clientVersion,
			}),
			method: 'PATCH',
		}).catch(() => null);

		// no response
		if (!res) {
			this.log('error', 'Failed to patch bot');
			return { success: false };
		}

		return { success: res.status >= 200 && res.status < 300 };
	}

	private async postEvents(): Promise<{ success: boolean }> {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/events`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				events: this.pendingEvents,
			}),
		}).catch(() => null);

		const len = this.pendingEvents.length;
		this.pendingEvents = [];

		if (!res) {
			// no response
			this.log('error', `Failed to post ${len} events`);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		if (!success)
			this.log(
				'error',
				`Post events (${len}) returned status code : ` + res.status
			);
		else this.log('debug', `Posted ${len} events`);
		return { success };
	}

	/**
	 * Adds an event to the queue. The queue is posted to Discolytics every 15 seconds.
	 */
	sendEvent(name: string, guildId?: string) {
		this.pendingEvents.push({ name, guildId });
		this.log('debug', `Added event to queue : ${name} (Guild ID: ${guildId})`);
	}

	private async postInteractions(): Promise<{ success: boolean }> {
		const res = await fetch(
			`${this.dataApiUrl}/bots/${this.botId}/interactions`,
			{
				headers: {
					'Content-Type': 'application/json',
					Authorization: this.apiKey,
				},
				method: 'POST',
				body: JSON.stringify({
					interactions: this.pendingInteractions,
				}),
			}
		).catch(() => null);

		const len = this.pendingInteractions.length;
		this.pendingInteractions = [];

		if (!res) {
			// no response
			this.log('error', `Failed to post ${len} interactions`);
			return { success: false };
		}
		const success = res.status >= 200 && res.status < 300;
		if (!success)
			this.log(
				'error',
				`Post interactions (${len}) returned status code : ${res.status}`
			);
		else this.log('debug', `Posted ${len} interactions`);
		return { success };
	}

	/**
	 * Adds an interaction to the queue. The queue is posted to Discolytics every 15 seconds.
	 */
	postInteraction(type: number, guildId?: string) {
		this.pendingInteractions.push({ type, guildId });
		this.log(
			'debug',
			`Added interaction to queue : ${type} (Guild ID: ${guildId})`
		);
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
		if (!success)
			this.log('error', 'Post CPU usage returned status : ' + res.status);
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
		if (!success)
			this.log('error', 'Post memory usage returned status : ' + res.status);
		return { success };
	}

	startCommand(name: string, userId: string) {
		const start = Date.now();
		return {
			end: (metadata?: unknown) => {
				const end = Date.now();
				const duration = end - start;
				return this.postCommand(name, userId, duration, metadata);
			},
		};
	}

	async postCommands(): Promise<{ success: boolean }> {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/commands`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				commands: this.pendingCommands,
			}),
		}).catch(() => null);

		const len = this.pendingCommands.length;
		this.pendingCommands = [];

		if (!res) {
			// no response
			this.log('error', `Failed to post ${len} commands`);
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		if (!success)
			this.log(
				'error',
				`Post commands (${len}) returned status code : ${res.status}`
			);
		else this.log('debug', `Posted ${len} commands`);
		return { success };
	}

	postCommand(
		name: string,
		userId: string,
		duration: number,
		metadata?: unknown
	) {
		this.pendingCommands.push({ name, userId, duration, metadata });
		this.log('debug', `Added command to queue : ${name} (User ID: ${userId})`);
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
		if (!success)
			this.log('error', 'Sent heartbeat returned status : ' + res.status);
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
		if (!success)
			this.log('error', 'Post guild count returned status : ' + res.status);
		return { success };
	}
}
