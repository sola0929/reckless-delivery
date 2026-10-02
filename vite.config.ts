import { defineConfig } from 'vite';

// Built to be served from any folder, not only from the root of a site: every address in
// the page is relative to the page. That is what lets it live at <user>.github.io/<repo>/.
export default defineConfig({ base: './' });
