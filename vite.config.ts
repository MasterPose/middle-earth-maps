import { UserConfig } from "vite";
import { createHtmlPlugin } from 'vite-plugin-html';
import viteDetectDuplicatedDeps from 'unplugin-detect-duplicated-deps/vite';
import viteSingleFileCompression from 'vite-plugin-singlefile-compression'

export default {
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
                passes: 5,
            },
            format: {
                comments: false,
            }
        },
        rolldownOptions: {
            checks: {
                pluginTimings: false
            },
            treeshake: true,
        }
    },
    plugins: [
        createHtmlPlugin({ minify: true }),
        viteDetectDuplicatedDeps(),
        viteSingleFileCompression(),
    ],
} satisfies UserConfig

