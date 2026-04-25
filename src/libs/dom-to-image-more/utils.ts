import { raf } from "../../utils/timing";
import { $createNS, body, dom } from "../../utils/dom";
import { opts } from "./options";

let uid_index = 0;

export const ELEMENT_NODE = 1;
export const dataFromBase64 = atob;
export const resolve = (v?: any) => Promise.resolve(v);
export const getStyle = getComputedStyle;

export function getWindow(node: Node) {
    const ownerDocument = node ? node.ownerDocument : undefined;
    return (ownerDocument ? ownerDocument.defaultView : undefined) || window;
}

export function isElementHostForOpenShadowRoot(value: any) {
    return isElement(value) && value.shadowRoot !== null;
}

export function isShadowRoot(value: any) {
    return value instanceof getWindow(value).ShadowRoot;
}

export function isInShadowRoot(value: any) {
    // not calling the method, getting the method
    if (value === null || value === undefined || value.getRootNode === undefined)
        return false;
    return isShadowRoot(value.getRootNode());
}

export function isElement(value: any) {
    return value instanceof getWindow(value).Element;
}

export function isHTMLCanvasElement(value: any) {
    return value instanceof getWindow(value).HTMLCanvasElement;
}

export function isHTMLElement(value: any) {
    return value instanceof getWindow(value).HTMLElement;
}

export function isHTMLImageElement(value: any) {
    return value instanceof getWindow(value).HTMLImageElement;
}

export function isHTMLInputElement(value: any) {
    return value instanceof getWindow(value).HTMLInputElement;
}

export function isHTMLLinkElement(value: any) {
    return value instanceof getWindow(value).HTMLLinkElement;
}

export function isHTMLScriptElement(value: any) {
    return value instanceof getWindow(value).HTMLScriptElement;
}

export function isHTMLStyleElement(value: any) {
    return value instanceof getWindow(value).HTMLStyleElement;
}

export function isHTMLTextAreaElement(value: any) {
    return value instanceof getWindow(value).HTMLTextAreaElement;
}

export function isShadowSlotElement(value: any) {
    return (
        isInShadowRoot(value) && value instanceof getWindow(value).HTMLSlotElement
    );
}

export function isSVGElement(value: any) {
    return value instanceof getWindow(value).SVGElement;
}

export function isSVGRectElement(value: any) {
    return value instanceof getWindow(value).SVGRectElement;
}

export function isDataUrl(url: any) {
    return url.search(/^(data:)/) !== -1;
}

export function isDimensionMissing(value: any) {
    return isNaN(value) || value <= 0;
}

export function asBlob(canvas: any) {
    return new Promise(function (resolve) {
        const binaryString = dataFromBase64(canvas.toDataURL().split(',')[1]);
        const length = binaryString.length;
        const binaryArray = new Uint8Array(length);

        for (let i = 0; i < length; i++) {
            binaryArray[i] = binaryString.charCodeAt(i);
        }

        resolve(
            new Blob([binaryArray], {
                type: 'image/png',
            })
        );
    });
}

export function canvasToBlob(canvas: any) {
    if (canvas.toBlob) {
        return new Promise(function (resolve) {
            canvas.toBlob(resolve);
        });
    }

    return asBlob(canvas);
}

export function resolveUrl(url: any, baseUrl: any) {
    const doc = dom.implementation.createHTMLDocument();
    const base = doc.createElement('base');
    doc.head.appendChild(base);
    const a = doc.createElement('a');
    doc.body.appendChild(a);
    base.href = baseUrl;
    a.href = url;
    return a.href;
}

export function uid() {
    return `u${fourRandomChars()}${uid_index++}`;

    function fourRandomChars() {
        /* see https://stackoverflow.com/a/6248722/2519373 */
        return `0000${((Math.random() * Math.pow(36, 4)) << 0).toString(
            36
        )}`.slice(-4);
    }
}

export function makeImage(uri: any) {
    if (uri === 'data:,') {
        return resolve();
    }

    return new Promise(function (resolve, reject) {
        // Create an SVG element to house the image
        const svg = $createNS('http://www.w3.org/2000/svg', 'svg');

        // and create the Image element to insert into that wrapper
        const image = new Image();

        if (opts.useCredentials) {
            image.crossOrigin = 'use-credentials';
        }

        image.onload = function () {
            // Cleanup: remove theimage from the document
            body.removeChild(svg);

            raf(function () {
                resolve(image);
            });
        };

        image.onerror = (error) => {
            // Cleanup: remove the image from the document
            body.removeChild(svg);

            reject(error);
        };

        svg.appendChild(image);
        image.src = uri;

        // Add the SVG to the document body (invisible)
        body.appendChild(svg);
    });
}

export function escape(string: any) {
    return string.replace(/([.*+?^${}()|[\]/\\])/g, '\\$1');
}

export function asArray(arrayLike: any) {
    const array = [];
    const length = arrayLike.length;
    for (let i = 0; i < length; i++) {
        array.push(arrayLike[i]);
    }

    return array;
}

export function escapeXhtml(string: any) {
    return string.replace(/%/g, '%25').replace(/#/g, '%23').replace(/\n/g, '%0A');
}

export function widthOfNode(node: any) {
    const width = px(node, 'width');

    if (!isNaN(width)) return width;

    const leftBorder = px(node, 'border-left-width');
    const rightBorder = px(node, 'border-right-width');
    return node.scrollWidth + leftBorder + rightBorder;
}

export function heightOfNode(node: any) {
    const height = px(node, 'height');

    if (!isNaN(height)) return height;

    const topBorder = px(node, 'border-top-width');
    const bottomBorder = px(node, 'border-bottom-width');
    return node.scrollHeight + topBorder + bottomBorder;
}

export function px(node: any, styleProperty: any) {
    if (node.nodeType === ELEMENT_NODE) {
        let value = getStyle(node).getPropertyValue(styleProperty);
        if (value.slice(-2) === 'px') {
            value = value.slice(0, -2);
            return parseFloat(value);
        }
    }

    return NaN;
}
