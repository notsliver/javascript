class CommandInstance {
	name: string;
	userId: string;
	start: number;
	dataApiUrl: string;
    apiKey: string;
    botId: string;

	constructor(data: {
		name: string;
		userId: string;
		start: number;
		dataApiUrl: string;
        apiKey: string;
        botId: string;
	}) {
		this.name = data.name;
		this.userId = data.userId;
		this.start = data.start;
		this.dataApiUrl = data.dataApiUrl;
        this.apiKey = data.apiKey;
        this.botId= data.botId;
	}

	async end(metadata?: unknown) {
        return await this.postCommand(Date.now(), metadata)
    }

    async postCommand(
		end: number,
		metadata?: unknown
	) {
		const res = await fetch(`${this.dataApiUrl}/bots/${this.botId}/command`, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: this.apiKey,
			},
			method: 'POST',
			body: JSON.stringify({
				name: this.name,
				userId: this.userId,
				metadata,
				duration: end - this.start,
			}),
		}).catch(() => null);

		if (!res) {
			// no response
			return { success: false };
		}

		const success = res.status >= 200 && res.status < 300;
		return { success };
	}
}

export default CommandInstance;
