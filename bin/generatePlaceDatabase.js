#!/usr/bin/env node

import Papa from 'papaparse';

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import MiniSearch from 'minisearch';

const CSV_PATH = join(import.meta.dirname, 'data/Location.csv');

const IMAGE_DIR = 'images/places';
const IMAGE_DIR_ABS = join(import.meta.dirname, '../public/', IMAGE_DIR);

const LINE_TEXT_PATH = join(import.meta.dirname, '../public/data/line_text.geojson');
const DATABASE_PATH = join(import.meta.dirname, '../public/db.json');
const SEARCH_INDEX_PATH = join(import.meta.dirname, '../public/search.json');
const ID_LIST_PATH = join(import.meta.dirname, '../public/ids.txt');

const lineTextDB = JSON.parse(readFileSync(LINE_TEXT_PATH, 'utf-8'));
const locationCsvDB = Papa.parse(readFileSync(CSV_PATH, 'utf-8'), {
    encoding: 'utf-8',
    delimiter: ';',
    header: true
}).data;

const database = {};
lineTextDB.features.forEach((v) => {
    const props = v.properties;
    const id = props.eventname;

    database[id] = {
        id,
        zoom: props.zoom,
    };
});

const parseArray = (v = '') => v.trim().split(',').map((v) => v.trim()).filter((v) => v !== '');

locationCsvDB.forEach(({ uniquename, name, altname, gatewaylink, area }) => {
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
        zoom: dataFromGeoJSON.zoom,
        altname: parsedAltnames,
        region: parsedRegions,
        mainPicture,
        images,
        link: gatewaylink,
        searchAltname: parsedAltnames.join(' '),
        searchRegion: parsedRegions.join(' '),
    }
})

const miniSearch = new MiniSearch({
    fields: ['name', 'searchAltname', 'searchRegion'],
    storeFields: ['name', 'region']
});
miniSearch.addAll(Object.values(database));
const searchIndex = miniSearch.toJSON();


writeFileSync(DATABASE_PATH, JSON.stringify(database));
writeFileSync(ID_LIST_PATH, Object.keys(database).join('\n'));
writeFileSync(SEARCH_INDEX_PATH, JSON.stringify(searchIndex));
