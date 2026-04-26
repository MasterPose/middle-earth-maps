#!/usr/bin/env node

import Papa from 'papaparse';

import { PUBLIC_PATH, DATA_PATH, RESOURCES_PATH, compressJSON, GEOJSON_PATH } from './common.js';

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { addAll, createIndex } from 'slimsearch';
import { readdir, readFile, writeFile } from 'fs/promises';


const CSV_PATH = join(DATA_PATH, 'Location.csv');

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

compressJSON(DATABASE_PATH, database);
compressJSON(SEARCH_INDEX_PATH, searchIndex);
writeFile(ID_LIST_PATH, Object.keys(database).join('\n'));


readdir(GEOJSON_PATH).then((v) => v.forEach(async (fileName) => {
    const path = join(GEOJSON_PATH, fileName);
    const data = await readFile(path, 'utf-8');

    compressJSON(join(DATA_PATH, 'geo/', fileName.replace('.geojson', '.bin')), data);
}))
