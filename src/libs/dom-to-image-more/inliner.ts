import { getAndEncode } from "./options";
import { isDataUrl, resolve, resolveUrl } from "./utils";

const URL_REGEX = /url\(\s*(["']?)((?:\\.|[^\\)])+)\1\s*\)/gm;

function shouldProcess(string: any) {
    return string.search(URL_REGEX) !== -1;
}

function readUrls(string: any) {
    const result = [];
    let match;
    while ((match = URL_REGEX.exec(string)) !== null) {
        result.push(match[2]);
    }
    return result.filter(function (url) {
        return !isDataUrl(url);
    });
}

function urlAsRegex(urlValue: any) {
    return new RegExp(`url\\((["']?)(${escape(urlValue)})\\1\\)`, 'gm');
}

function inline(string: any, url: any, baseUrl?: any, get?: any) {
    return resolve(url)
        .then(function (urlValue) {
            return baseUrl ? resolveUrl(urlValue, baseUrl) : urlValue;
        })
        .then(get || getAndEncode)
        .then(function (dataUrl) {
            const pattern = urlAsRegex(url);
            return string.replace(pattern, `url($1${dataUrl}$1)`);
        });
}

function inlinerInlineAll(string: any, baseUrl: any, get?: any) {
    if (nothingToInline()) {
        return resolve(string);
    }

    return resolve(string)
        .then(readUrls)
        .then(function (urls) {
            let done = resolve(string);
            urls.forEach(function (url) {
                done = done.then(function (prefix) {
                    return inline(prefix, url, baseUrl, get);
                });
            });
            return done;
        });

    function nothingToInline() {
        return !shouldProcess(string);
    }
}

export {
    inlinerInlineAll,
    shouldProcess,
    readUrls,
    inline,
    urlAsRegex,
}
