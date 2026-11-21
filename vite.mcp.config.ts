import { defineConfig } from 'vite';

/*
 * Builds the MCP server, which is a Node process rather than a browser
 * bundle and so cannot share the app's Vite config.
 *
 * Bundled rather than compiled with tsc, for one practical reason: the app's
 * modules are written for bundler resolution and import each other without
 * file extensions. tsc would emit those specifiers unchanged and Node's ESM
 * loader would reject every one of them. Bundling resolves them at build
 * time, which also means the container ships two self-contained files and no
 * node_modules at all.
 */
export default defineConfig({
  build: {
    ssr: true,
    outDir: 'dist-mcp',
    target: 'node20',
    emptyOutDir: true,
    // Left readable: this runs on a NAS, and a stack trace that points at a
    // real line is worth more here than a few hundred kilobytes.
    minify: false,
    rollupOptions: {
      input: {
        stdio: 'mcp-server/bin/stdio.ts',
        http: 'mcp-server/bin/http.ts',
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es',
      },
    },
  },
  ssr: {
    // Dependencies included in the bundle so the runtime image needs only a
    // Node binary and these files.
    noExternal: true,
  },
});
