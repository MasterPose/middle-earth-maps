export async function inflate(blob: Blob) {
    const ds = new DecompressionStream("deflate-raw");
    const decompressedStream = blob.stream().pipeThrough(ds);
    return await new Response(decompressedStream).blob().then((v) => v.text());
}

export async function fetchAsText(path: string) {
    return await inflate(await (await fetch('data/' + path + '.bin', {
        mode: 'no-cors'
    })).blob());
}
export async function fetchAsJson(path: string) {
    return JSON.parse(await fetchAsText(path));
}
