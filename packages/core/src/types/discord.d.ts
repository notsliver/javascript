// THESE ARE PARTIAL TYPES - includes props that are used by Discoltyics client

export interface User {
	id: string;
	username: string;
	discriminator: string;
	avatar: string | null;
}

export interface Application {
	id: string;
	name: string;
	approximate_guild_count?: number;
}
