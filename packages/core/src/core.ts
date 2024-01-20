import fetch from 'node-fetch';
import { ClientType, EVENTS_API_URL } from './constants';

class Client {
	private botId: string;
	private apiKey: string;
	private clientType: ClientType;
	private eventsApiUrl: string;

	constructor(data: {
		botId: string;
		apiKey: string;
		clientType?: ClientType;
		eventsApiUrl?: string;
	}) {
		this.botId = data.botId;
		this.apiKey = data.apiKey;
		this.clientType = data.clientType ?? ClientType.UNKNOWN;
		this.eventsApiUrl = data.eventsApiUrl ?? EVENTS_API_URL;
	}

	async sendEvent(name: string, data: unknown): Promise<{ success: boolean }> {
		console.log(
			`${this.eventsApiUrl}/bots/${this.botId}/events with key`,
			this.apiKey
		);
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
		console.log('res', res);

		if (!res) {
			// no response
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}
}

export default Client;
