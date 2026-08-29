import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		proxy: {
			// Dev: the game server runs separately on :8787.
			'/ws': { target: 'ws://localhost:8787', ws: true }
		}
	}
});
