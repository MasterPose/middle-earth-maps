import type * as L from 'leaflet';

interface Plugin_Polyline extends L.Polyline {
    contains(p: L.LatLng): boolean
    getWindingNumber(p: L.LatLng): number
}

interface Plugin_LatLng extends L.LatLng {
    isLeft(p1: L.LatLng, p2: L.LatLng): number
}

type Plugin = typeof L & {
    Polyline: Plugin_Polyline & {
        prototype: Plugin_Polyline
    },
    LatLng: Plugin_LatLng & {
        prototype: Plugin_LatLng
    },
}

/******************************************************************************
 * Leaflet.PointInPolygon
 * @author Brian S Hayes (Hayeswise)
 * @license MIT License, Copyright (c) 2017 Brian Hayes ("Hayeswise")
 *
 * Converted to TS by Luan Himmlisch
 *
 * Thanks to:<br>
 * Dan Sunday's Winding Number and isLeft C++ implementation - http://geomalgorithms.com/.
 *   Copyright and License: http://geomalgorithms.com/a03-_inclusion.html
 * Leaflet.Geodesic by Kevin Brasier (a.k.a. Fragger)<br>
 */


/**
 * Hayeswise Point-in-polygon for Leaflet:  A plugin for Leaflet that provides
 * points-in-polygons functions based on Dan Sunday's C++ winding number implementation.
 * @module {function} wiseLeafletPip
 * @see {@link https://github.com/hayeswise/Leaflet.PointInPolygon|Leaflet.PointInPolygon}
 * @see {@link http://geomalgorithms.com/a03-_inclusion.html Inclusion of a Point in a Polygon} by Dan Sunday.
 */
export const Leaflet_PointInPolygon = function (Leaflet: typeof L) {
    const L = Leaflet as Plugin;

    /**
     * Checks if a single point is contained in a polyline or polygon (L.Polygon extends L.Polyline).
     * <p>
     * Note that L.Polygon, L.GeodesicPolygons, and L.GeodesicCircles are types of L.Polygon.
     * @see {@link https://github.com/Fragger/Leaflet.Geodesic Leaflet.Geodesc} for information about Leaflet.Geodesc by Fragger.
     */
    L.Polyline.prototype.contains = function (p) {
        var rectangularBounds = this.getBounds();  // It appears that this is O(1): the LatLngBounds is updated as points are added to the polygon when it is created.
        var wn;
        if (rectangularBounds.contains(p)) {
            wn = this.getWindingNumber(p);
            return (wn !== 0);
        } else {
            return false;
        }
    };

    /**
     * Tests if a point is left|on|right of an infinite line.
     * <br><br>
     * This is a JavaScript and Leaflet port of the `isLeft()` C++ function by Dan Sunday.
     * @member external:L.LatLng.isLeft
     * @see {@link http://geomalgorithms.com/a03-_inclusion.html Inclusion of a Point in a Polygon} by Dan Sunday.
     */
    L.LatLng.prototype.isLeft = function (p1, p2) {
        return ((p1.lng - this.lng) * (p2.lat - this.lat) -
            (p2.lng - this.lng) * (p1.lat - this.lat));
    };

    /**
     * Test for a point in a polygon or on the bounding lines of the polygon.  The
     * coordinates (L.LatLngs) for a GeodesicPolygon are set to follow the earth's
     * curvature when the GeodesicPolygon object is created.  Since L.Polygon
     * extends L.Polyline we can use the same method for both.  Although, for
     * L.Polyline, we only get points on the line even if a collection of lines
     * appear to make a polygon.
     * <br><br>
     * This is a JavaScript and Leaflet port of the `wn_PnPoly()` C++ function by Dan Sunday.
     * Unlike the C++ version, this implementation does include points on the line and vertices.
     *
     * @member external:L.Polyline.getWindingNumber
     * @see {@link http://geomalgorithms.com/a03-_inclusion.html Inclusion of a Point in a Polygon} by Dan Sunday.
     * @see {@link https://github.com/Fragger/Leaflet.Geodesic Leaflet.Geodesc} for information about Leaflet.Geodesc by Fragger.
     */
    L.Polyline.prototype.getWindingNumber = function (p) { // Note that L.Polygon extends L.Polyline
        var i,
            isLeftTest,
            n,
            vertices,
            wn; // the winding number counter
        function flatten(a: L.LatLng[] | L.LatLng[][] | L.LatLng[][][]): Plugin_LatLng[] {
            let flat;
            flat = ((Array.isArray ? Array.isArray(a) : L.Util.isArray(a)) ? a.reduce(function (accumulator: L.LatLng[], v) {
                return accumulator.concat(Array.isArray(v) ? flatten(v) : v);
            }, [])
                : a);
            return flat as Plugin_LatLng[];
        }

        vertices = this.getLatLngs();
        vertices = flatten(vertices); // Flatten array of LatLngs since multi-polylines return nested array.
        // Filter out duplicate vertices.
        vertices = vertices.filter(function (v, i, array) { // remove adjacent duplicates
            if (i > 0 && v.lat === array[i - 1].lat && v.lng === array[i - 1].lng) {
                return false;
            } else {
                return true;
            }
        });
        n = vertices.length;
        // Note that per the algorithm, the vertices (V) must be "a vertex points of a polygon V[n+1] with V[n]=V[0]"
        if (n > 0 && !(vertices[n - 1].lat === vertices[0].lat && vertices[n - 1].lng === vertices[0].lng)) {
            vertices.push(vertices[0]);
        }
        n = vertices.length - 1;
        wn = 0;
        for (i = 0; i < n; i++) {
            isLeftTest = vertices[i].isLeft(vertices[i + 1], p);
            if (isLeftTest === 0) { // If the point is on a line, we are done.
                wn = 1;
                break;
            } else {
                if (isLeftTest !== 0) { // If not a vertex or on line (the C++ version does not check for this)
                    if (vertices[i].lat <= p.lat) {
                        if (vertices[i + 1].lat > p.lat) { // An upward crossing
                            if (isLeftTest > 0) { // P left of edge
                                wn++; // have a valid up intersect
                            }
                        }
                    } else {
                        if (vertices[i + 1].lat <= p.lat) {// A downward crossing
                            if (isLeftTest < 0) { // P right of edge
                                wn--; // have a valid down intersect
                            }
                        }
                    }
                } else {
                    wn++;
                }
            }
        }
        return wn;
    };
}
