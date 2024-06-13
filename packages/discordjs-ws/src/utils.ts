export const parseToken = (s: string) => {
	if (s.startsWith('Bot')) return s;
	return `Bot ${s}`;
};
