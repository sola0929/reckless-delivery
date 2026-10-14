import { defineConfig, type Plugin } from 'vite';

/**
 * Tells the page where the game's own script is and how big it is, so that the loading screen can show it
 * coming in byte by byte: `__GAME_CHUNK__` in the page's script is replaced with { file, bytes } once the
 * build knows them. Run from the dev server there is no one script to measure, and it is null.
 */
function gameChunk(): Plugin {
  return {
    name: 'game-chunk',
    apply: 'build',
    generateBundle(_options, bundle) {
      const game = Object.values(bundle).find((c) => c.type === 'chunk' && c.facadeModuleId?.split('\\').join('/').endsWith('/src/game.ts'));
      if (!game || game.type !== 'chunk') return;
      const info = JSON.stringify({ file: game.fileName, bytes: Buffer.byteLength(game.code) });
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk' && chunk.code.includes('__GAME_CHUNK__')) chunk.code = chunk.code.replaceAll('__GAME_CHUNK__', info);
      }
    },
  };
}

// Built to be served from any folder, not only from the root of a site: every address in
// the page is relative to the page. That is what lets it live at <user>.github.io/<repo>/.
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [gameChunk()],
  define: command === 'serve' ? { __GAME_CHUNK__: 'null' } : {},
}));
