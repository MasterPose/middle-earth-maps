import { defineConfig } from "vite";
import viteSingleFileCompression from "vite-plugin-singlefile-compression";
import { createHtmlPlugin } from 'vite-plugin-html';
import viteDetectDuplicatedDeps from 'unplugin-detect-duplicated-deps/vite';

export default defineConfig({
    root: "./src",
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        minify: 'terser',
        terserOptions: {
            compress: {
                arguments: true,
                booleans_as_integers: true,
                hoist_funs: true,
                hoist_vars: true,
                keep_fargs: false,
                passes: 3,
            },
            format: {
                comments: false,
            }
        },
        rollupOptions: {
            treeshake: 'recommended',
        }
    },
    plugins: [
        createHtmlPlugin({ minify: true }),
        viteDetectDuplicatedDeps(),
        viteSingleFileCompression(),
    ],
});

