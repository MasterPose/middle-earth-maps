import { UserConfig } from "vite";
import { createHtmlPlugin } from 'vite-plugin-html';
import viteDetectDuplicatedDeps from 'unplugin-detect-duplicated-deps/vite';
import viteSingleFileCompression from 'vite-plugin-singlefile-compression'
import { viteStripDeps } from "./viteStripDeps";

export default {
    root: "./src",
    publicDir: '../public',
    build: {
        // assetsInlineLimit: 0,
        modulePreload: false,
        outDir: '../dist',
        emptyOutDir: true,
        // minify: false,
        minify: 'terser',
        terserOptions: {
            compress: {
                arguments: true,
                booleans_as_integers: true,
                hoist_funs: true,
                hoist_vars: true,
                keep_fargs: false,
                passes: 5,
                unsafe_arrows: true,
                unsafe_comps: true,
                unused: true,
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
        // viteDetectDuplicatedDeps(),
        viteStripDeps({
            ignoreList: [
                "node_modules/leaflet/src/layer/VideoOverlay.js",
                "node_modules/leaflet/src/layer/Tooltip.js",
                "node_modules/leaflet/src/layer/Popup.js",
                "node_modules/leaflet/src/layer/tile/TileLayer.js",
                "node_modules/leaflet/src/layer/tile/TileLayer.WMS.js",
                "node_modules/leaflet/src/control/Control.Scale.js",
                "node_modules/leaflet/src/control/Control.Layers.js",
                // "node_modules/leaflet/src/geo/crs/CRS.Earth.js", // Neccesary for LatLng calculations
                "node_modules/leaflet/src/geo/crs/CRS.EPSG3395.js",
                "node_modules/leaflet/src/geo/crs/CRS.EPSG3857.js",
                "node_modules/leaflet/src/geo/crs/CRS.EPSG4326.js",
                "node_modules/leaflet/src/geo/projection/Projection.Mercator.js",
                "node_modules/leaflet/src/geo/projection/Projection.SphericalMercator.js",
                "node_modules/leaflet/src/map/handler/Map.BoxZoom.js",
                "node_modules/leaflet/src/map/handler/Map.Keyboard.js",
            ]
        }),
        viteSingleFileCompression({
            // tryInlineHtmlPublicIcon: false,
            // tryInlineHtmlAssets: true,
        }),
    ],
} satisfies UserConfig

