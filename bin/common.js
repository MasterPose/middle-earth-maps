import { join } from 'path';
import { deflateRawSync } from 'zlib';
import { writeFile } from 'fs/promises';

export const ROOT_PATH = join(import.meta.dirname, '../');
export const PUBLIC_PATH = join(ROOT_PATH, 'public');
export const DATA_PATH = join(PUBLIC_PATH, 'data');
export const RESOURCES_PATH = join(ROOT_PATH, 'resources');
export const GEOJSON_PATH = join(ROOT_PATH, 'resources/geojson');

/**
 * @param {string} path
 * @param {any} data
 */
export async function compressJSON(path, data) {
    const deflated = deflateRawSync(Buffer.from(typeof data == 'string' ? data : JSON.stringify(data)), {
        level: 9,
    });
    return writeFile(path, deflated)
}
