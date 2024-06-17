export const DATA_API_URL = 'https://data.discolytics.com/api';
export const API_URL = 'https://api.discolytics.com/api';
export const DISCORD_API_URL = 'https://discord.com/api/v10';

export enum ClientType {
	UNKNOWN,
	DISCORD_JS,
	ERIS,
	OCEANIC_JS,
	PYCORE,
	DISCORDJS_WS,
}

export enum InteractionTypes {
    PING = 1,
    APPLICATION_COMMAND = 2,
    MESSAGE_COMPONENT = 3,
    APPLICATION_COMMAND_AUTOCOMPLETE = 4,
    MODAL_SUBMIT = 5,
}

export type LOG_LEVEL = 'info' | 'error' | 'debug'

