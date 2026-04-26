declare module 'leaflet/src/Leaflet.js' {
    export * from 'leaflet';
}

declare module 'leaflet/src/geo/crs/CRS.Simple.js' {
    import { CRS } from 'leaflet';
    export var Simple: CRS.Simple;
}
