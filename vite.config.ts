import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function copyMediapipeWasm() {
  const srcDir = path.join(projectRoot, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
  const destDir = path.join(projectRoot, 'public', 'mediapipe');
  const files = [
    'vision_wasm_internal.js',
    'vision_wasm_internal.wasm',
    'vision_wasm_nosimd_internal.js',
    'vision_wasm_nosimd_internal.wasm',
  ];

  const copy = () => {
    try {
      fs.mkdirSync(destDir, { recursive: true });
    } catch {
      return;
    }

    for (const filename of files) {
      const from = path.join(srcDir, filename);
      const to = path.join(destDir, filename);
      try {
        if (!fs.existsSync(from)) continue;
        const shouldCopy =
          !fs.existsSync(to) || fs.statSync(from).mtimeMs > fs.statSync(to).mtimeMs;
        if (shouldCopy) fs.copyFileSync(from, to);
      } catch {
        // ignore
      }
    }
  };

  return {
    name: 'copy-mediapipe-wasm',
    configResolved() {
      copy();
    },
    buildStart() {
      copy();
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), copyMediapipeWasm()],
  server: {
    host: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
});
