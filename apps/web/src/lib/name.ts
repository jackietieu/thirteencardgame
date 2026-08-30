/** The player's display name — shared by local (vs bots) and online games. */
const NAME_KEY = 'thirteen.name';

export function getName(): string {
	return localStorage.getItem(NAME_KEY) ?? '';
}

export function setName(name: string) {
	if (name) localStorage.setItem(NAME_KEY, name);
	else localStorage.removeItem(NAME_KEY);
}
