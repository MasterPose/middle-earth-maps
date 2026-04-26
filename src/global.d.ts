declare module 'leaflet/src/Leaflet.js' {
    export * from 'leaflet';
}

declare module 'leaflet/src/geo/crs/CRS.Simple.js' {
    import { CRS } from 'leaflet';
    export var Simple: CRS.Simple;
}

declare type SerializedPlace = [
    id: string,
    name: string,
    searchname: string,
    zoom: number,
    altname: string[] | 0,
    region: string[] | 0,
    mainPicture: string | 0,
    images: string[] | 0,
    link: string | 0,
    description: string,
]

declare type SerializedGeoJSON = [
    ...SerializedGeoJSONFeatures[],
    layer: string
]

declare enum SerializedGeometryType {
    Polygon = 1,
    MultiPolygon = 2,
    Point = 3,
    MultiPoint = 4,
    LineString = 5,
    MultiLineString = 6,
}

declare type SerializedGeoJSONFeatures = [
    geometryType: SerializedGeometryType | 0,
    geometryCoordinates: any[],
    place: SerializedPlace | 0,
    size: number | 0,
    zoom: number,
]
