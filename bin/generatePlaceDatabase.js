#!/usr/bin/env node

import Papa from 'papaparse';

import { PUBLIC_PATH, DATA_PATH, RESOURCES_PATH, compressJSON, GEOJSON_PATH, ROOT_PATH } from './common.js';

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { addAll, createIndex } from 'slimsearch';
import { readdir, readFile, writeFile } from 'fs/promises';


const CSV_PATH = join(RESOURCES_PATH, 'Location.csv');
const DESCRIPTIONS_PATH = join(RESOURCES_PATH, 'descriptions.json');

const descriptions = JSON.parse(readFileSync(DESCRIPTIONS_PATH, 'utf-8'));

const IMAGE_DIR = 'images/places';
const IMAGE_DIR_ABS = join(PUBLIC_PATH, IMAGE_DIR);

const DATABASE_PATH = join(DATA_PATH, 'db.bin');
const SEARCH_INDEX_PATH = join(DATA_PATH, 'search.bin');
const ID_LIST_PATH = join(DATA_PATH, 'ids.txt');

const locationCsvDB = Papa.parse(readFileSync(CSV_PATH, 'utf-8'), {
    encoding: 'utf-8',
    delimiter: ';',
    header: true
}).data;

const database = {};
[
    'line_text.geojson',
    'poly_region.geojson',
    'point_city.geojson'
].map((v) => join(GEOJSON_PATH, v))
    .map((v) => readFileSync(v, 'utf-8'))
    .map((v) => JSON.parse(v))
    .forEach((v) => v.features.forEach((v) => database[v.properties.eventname] = {
        id: v.properties.eventname,
        zoom: v.properties.zoom,
    }));

const parseArray = (v = '') => v.trim().split(',').map((v) => v.trim()).filter((v) => v !== '');

locationCsvDB.forEach(({ uniquename, name, searchname, significance, altname, gatewaylink, area }) => {
    const id = uniquename;
    const dataFromGeoJSON = database[id];

    if (!dataFromGeoJSON) return;

    const imagesPath = join(IMAGE_DIR_ABS, id);
    let images = [];
    let mainPicture = undefined;

    if (existsSync(imagesPath)) {
        images = readdirSync(imagesPath)
            .map((v) => join(IMAGE_DIR, id, v).replace(/\\/g, '/'));
        mainPicture = images[0];
    }

    const parsedAltnames = parseArray(altname).filter((v) => v !== dataFromGeoJSON.name);
    const parsedRegions = parseArray(area).filter((v) => v !== 'Middle-earth');

    database[id] = {
        id: dataFromGeoJSON.id,
        name: name,
        searchname,
        zoom: dataFromGeoJSON.zoom || Math.max((8 - significance) / 2, 2),
        altname: parsedAltnames,
        region: parsedRegions,
        mainPicture,
        images,
        link: gatewaylink,
        searchAltname: parsedAltnames.join(' '),
        searchRegion: parsedRegions.join(' '),
    }
})

const searchIndex = createIndex({
    fields: ['name', 'searchAltname', 'searchRegion'],
    storeFields: ['searchname', 'region']
});
addAll(searchIndex, Object.values(database));

const IDs = Object.keys(database);

// compressJSON(DATABASE_PATH, database);
compressJSON(SEARCH_INDEX_PATH, searchIndex);
writeFile(ID_LIST_PATH, IDs.join('\n'));

const GEOJSONS_TO_LOAD = [
    'poly_ekkaia',
    'poly_bg',
    'poly_outline',
    'poly_moor',
    'poly_highland',
    'poly_forest',
    'poly_mountainlow',
    'poly_mountainhigh',
    'poly_lake',
    'line_river',
    'line_road',
    'point_bridge',
    'point_place',
    'point_mount',
    'point_ford',
    'point_castletower',
    'point_city',
    'point_waterfall',
    'poly_region',
]

const serializedGeoJsonFiles = (await Promise.all(
    GEOJSONS_TO_LOAD.map(async (name) => {
        const fileName = name + '.geojson';
        const path = join(GEOJSON_PATH, fileName);

        /** @type {GeoJSON.GeoJSON} */
        const geoJson = JSON.parse(await readFile(path, 'utf-8'));

        if (geoJson.type !== 'FeatureCollection') return console.warn('GeoJSON is not a feature collection ', fileName, geoJson.type);

        const alreadyAddedIds = new Set();
        const serializedFeatures = geoJson.features.map((feature, i) => {
            if (feature.type !== 'Feature') return console.warn('Not a feature in collection ', i, feature.type, fileName)

            const serialized = [];

            let place = database[feature.properties?.eventname]
            let zoom = feature.properties.zoom || 1;

            if (!feature.geometry) {
                return console.warn('Feature without geometry ', i, feature, fileName)
            } else {
                switch (feature.geometry.type) {
                    case 'Polygon':
                        serialized.push(1);
                        break;
                    case 'MultiPolygon':
                        serialized.push(2);
                        break;
                    case 'Point':
                        serialized.push(3);
                        break;
                    case 'MultiPoint':
                        serialized.push(4);
                        break;
                    case 'LineString':
                        serialized.push(5);
                        break;
                    case 'MultiLineString':
                        serialized.push(6);
                        break;
                    default:
                        throw new Error("Unknown type " + feature.geometry.type);
                }

                if (feature.geometry.coordinates) {
                    serialized.push(feature.geometry.coordinates)
                } else {
                    serialized.push(0);
                }
            }

            if (place) {
                place = { ...place };
                const id = place.id;

                if (alreadyAddedIds.has(id)) return console.warn('Duplicated place ID ', id)

                alreadyAddedIds.add(id);

                delete place.searchAltname;
                delete place.searchRegion;

                zoom = place.zoom

                const placeData = Object.values(place).map((v) => Array.isArray(v) ? (v.length ? v : 0) : v || 0);



                const description = descriptions[place.id];

                if (description) {
                    placeData.push(description);
                } else {
                    placeData.push(0);
                }

                serialized.push(placeData)
            } else {
                serialized.push(0)
            }

            serialized.push(feature.properties.size || 0)
            serialized.push(zoom)

            return serialized;
        }).filter((v) => v);

        return [...serializedFeatures, name];
    })
)).filter((v) => v);

compressJSON(DATABASE_PATH, serializedGeoJsonFiles);
