import {
    Polyline,
    LatLng,
    Control,
    DomUtil,
    Map,
    Marker,
    Circle,
    DivIcon,
    LatLngBounds,
    GeoJSON
} from 'leaflet/src/Leaflet.js';
import { Leaflet_PointInPolygon } from './leaflet_pointinpolygon.js';

import type * as Leaflet from 'leaflet';

Leaflet_PointInPolygon({ Polyline, LatLng } as typeof Leaflet);


export {
    Polyline,
    LatLng,
    Control,
    DomUtil,
    Map,
    Marker,
    Circle,
    DivIcon,
    LatLngBounds,
    GeoJSON
};
