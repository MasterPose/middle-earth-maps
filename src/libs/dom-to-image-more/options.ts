// Default impl options
const defaultOptions = {
    // Default is to copy default styles of elements
    copyDefaultStyles: true,
    // Default is to fail on error, no placeholder
    imagePlaceholder: undefined,
    // Default cache bust is false, it will use the cache
    cacheBust: false,
    // Use (existing) authentication credentials for external URIs (CORS requests)
    useCredentials: false,
    // Use (existing) authentication credentials for external URIs (CORS requests) on some filtered requests only
    useCredentialsFilters: [],
    // Default resolve timeout
    httpTimeout: 30000,
    // Style computation cache tag rules (options are strict, relaxed)
    styleCaching: 'strict',
    // Default cors config is to request the image address directly
    corsImg: undefined,
    // Callback for adjustClonedNode eventing (to allow adjusting clone's properties)
    adjustClonedNode: undefined,
    // Callback to filter style properties to be included in the output
    filterStyles: undefined,
};

export const opts = {} as typeof defaultOptions;

export function copyOptions(options: any) {
    // Copy options to impl options for use in impl
    if (options.copyDefaultStyles === undefined) {
        opts.copyDefaultStyles = defaultOptions.copyDefaultStyles;
    } else {
        opts.copyDefaultStyles = options.copyDefaultStyles;
    }

    if (options.imagePlaceholder === undefined) {
        opts.imagePlaceholder = defaultOptions.imagePlaceholder;
    } else {
        opts.imagePlaceholder = options.imagePlaceholder;
    }

    if (options.cacheBust === undefined) {
        opts.cacheBust = defaultOptions.cacheBust;
    } else {
        opts.cacheBust = options.cacheBust;
    }

    if (options.corsImg === undefined) {
        opts.corsImg = defaultOptions.corsImg;
    } else {
        opts.corsImg = options.corsImg;
    }

    if (options.useCredentials === undefined) {
        opts.useCredentials = defaultOptions.useCredentials;
    } else {
        opts.useCredentials = options.useCredentials;
    }

    if (options.useCredentialsFilters === undefined) {
        opts.useCredentialsFilters =
            defaultOptions.useCredentialsFilters;
    } else {
        opts.useCredentialsFilters = options.useCredentialsFilters;
    }

    if (options.httpTimeout === undefined) {
        opts.httpTimeout = defaultOptions.httpTimeout;
    } else {
        opts.httpTimeout = options.httpTimeout;
    }

    if (options.styleCaching === undefined) {
        opts.styleCaching = defaultOptions.styleCaching;
    } else {
        opts.styleCaching = options.styleCaching;
    }
}

export const urlCache: never[] = [];


export function getAndEncode(url: any) {
    let cacheEntry = urlCache.find(function (el) {
        // @ts-expect-error TS(2339): Property 'url' does not exist on type 'never'.
        return el.url === url;
    });

    if (!cacheEntry) {
        // @ts-expect-error TS(2322): Type '{ url: any; promise: null; }' is not assigna... Remove this comment to see the full error message
        cacheEntry = {
            url: url,
            promise: null,
        };
        // @ts-expect-error TS(2345): Argument of type 'undefined' is not assignable to ... Remove this comment to see the full error message
        urlCache.push(cacheEntry);
    }

    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    if (cacheEntry.promise === null) {
        if (opts.cacheBust) {
            // Cache bypass so we don't have CORS issues with cached images
            // Source: https://developer.mozilla.org/en/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest#Bypassing_the_cache
            url += (/\?/.test(url) ? '&' : '?') + new Date().getTime();
        }

        // @ts-expect-error TS(2532): Object is possibly 'undefined'.
        cacheEntry.promise = new Promise(function (resolve) {
            const xhr = new XMLHttpRequest();
            xhr.timeout = opts.httpTimeout;
            xhr.onerror = placehold;
            xhr.ontimeout = placehold;
            xhr.onloadend = function () {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    const status = xhr.status;
                    // In local files, status is 0 upon success in Mozilla Firefox
                    if (
                        (status === 0 && url.toLowerCase().startsWith('file://')) ||
                        (status >= 200 && status <= 300 && xhr.response !== null)
                    ) {
                        const response = xhr.response;
                        if (!(response instanceof Blob)) {
                            fail(
                                'Expected response to be a Blob, but got: ' +
                                typeof response
                            );
                        }
                        const reader = new FileReader();
                        reader.onloadend = function () {
                            const result = reader.result;
                            resolve(result);
                        };
                        try {
                            reader.readAsDataURL(response);
                        } catch (ex) {
                            fail(
                                'Failed to read the response as Data URL: ' +
                                // @ts-expect-error TS(2571): Object is of type 'unknown'.
                                ex.toString()
                            );
                        }
                    } else {
                        placehold();
                    }
                }
            };

            function fail(message: any) {
                console.error(message);
                resolve('');
            }

            function placehold() {
                const placeholder = opts.imagePlaceholder;

                if (placeholder) {
                    resolve(placeholder);
                } else {
                    fail('Status:' + xhr.status + ' while fetching resource: ' + url);
                }
            }

            function handleJson(data: any) {
                try {
                    return JSON.parse(JSON.stringify(data));
                } catch (e) {
                    // @ts-expect-error TS(2571): Object is of type 'unknown'.
                    fail('corsImg.data is missing or invalid:' + e.toString());
                }
            }

            if (opts.useCredentialsFilters.length > 0) {
                opts.useCredentials =
                    opts.useCredentialsFilters.filter(
                        (credentialsFilter: any) => url.search(credentialsFilter) >= 0
                    ).length > 0;
            }

            if (opts.useCredentials) {
                xhr.withCredentials = true;
            }

            if (
                opts.corsImg &&
                url.indexOf('http') === 0 &&
                url.indexOf(window.location.origin) === -1
            ) {
                const method =
                    (
                        // @ts-expect-error TS(2339): Property 'corsImg' does not exist on type '{}'.
                        opts.corsImg.method || 'GET'
                    ).toUpperCase() === 'POST'
                        ? 'POST'
                        : 'GET';
                xhr.open(
                    method,
                    // @ts-expect-error TS(2339): Property 'corsImg' does not exist on type '{}'.
                    (opts.corsImg.url || '').replace(
                        '#{cors}',
                        url
                    ),
                    true
                );

                let isJson = false;
                // @ts-expect-error TS(2339): Property 'corsImg' does not exist on type '{}'.
                const headers = opts.corsImg.headers || {};
                Object.keys(headers).forEach(function (key) {
                    if (headers[key].indexOf('application/json') !== -1) {
                        isJson = true;
                    }
                    xhr.setRequestHeader(key, headers[key]);
                });

                const corsData = handleJson(
                    // @ts-expect-error TS(2339): Property 'corsImg' does not exist on type '{}'.
                    opts.corsImg.data || ''
                );

                Object.keys(corsData).forEach(function (key) {
                    if (typeof corsData[key] === 'string') {
                        corsData[key] = corsData[key].replace('#{cors}', url);
                    }
                });

                xhr.responseType = 'blob';
                xhr.send(isJson ? JSON.stringify(corsData) : corsData);
            } else {
                xhr.open('GET', url, true);
                xhr.responseType = 'blob';
                xhr.send();
            }
        });
    }
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    return cacheEntry.promise;
}
