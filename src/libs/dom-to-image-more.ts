import { $create, body, dom } from "../utils/dom";
import { resolveAll } from "./dom-to-image-more/fonts.js";
import { imagesInlineAll } from "./dom-to-image-more/images.js";
import { copyOptions, opts, urlCache } from "./dom-to-image-more/options.js";
import {
    ELEMENT_NODE,
    asArray,
    canvasToBlob,
    escapeXhtml,
    getStyle,
    getWindow,
    heightOfNode,
    isDimensionMissing,
    isElement,
    isElementHostForOpenShadowRoot,
    isHTMLCanvasElement,
    isHTMLImageElement,
    isHTMLInputElement,
    isHTMLLinkElement,
    isHTMLScriptElement,
    isHTMLStyleElement,
    isHTMLTextAreaElement,
    isSVGElement,
    isSVGRectElement,
    isShadowRoot,
    isShadowSlotElement,
    makeImage,
    resolve,
    uid,
    widthOfNode
} from './dom-to-image-more/utils.js';


/**
 * @param {Node} node - The DOM Node object to render
 * @param {Object} options - Rendering options
 * @param {Function} options.filter - Should return true if passed node should be included in the output
 *          (excluding node means excluding it's children as well). Not called on the root node.
 * @param {Function} options.onclone - Callback function which is called when the Document has been cloned for
 *         rendering, can be used to modify the contents that will be rendered without affecting the original
 *         source document.
 * @param {String} options.bgcolor - color for the background, any valid CSS color value.
 * @param {Number} options.width - width to be applied to node before rendering.
 * @param {Number} options.height - height to be applied to node before rendering.
 * @param {Object} options.style - an object whose properties to be copied to node's style before rendering.
 * @param {Number} options.quality - a Number between 0 and 1 indicating image quality (applicable to JPEG only),
            defaults to 1.0.
 * @param {Number} options.scale - a Number multiplier to scale up the canvas before rendering to reduce fuzzy images, defaults to 1.0.
 * @param {String} options.imagePlaceholder - dataURL to use as a placeholder for failed images, default behaviour is to fail fast on images we can't fetch
 * @param {Boolean} options.cacheBust - set to true to cache bust by appending the time to the request url
 * @param {String} options.styleCaching - set to 'strict', 'relaxed' to select style caching rules
 * @param {Boolean} options.copyDefaultStyles - set to false to disable use of default styles of elements
 * @param {Boolean} options.disableEmbedFonts - set to true to disable font embedding into the SVG output.
 * @param {Boolean} options.disableInlineImages - set to true to disable inlining images into the SVG output.
 * @param {Object} options.corsImg - When the image is restricted by the server from cross-domain requests, the proxy address is passed in to get the image
 *         - @param {String} url - eg: https://cors-anywhere.herokuapp.com/
 *         - @param {Enumerator} method - get, post
 *         - @param {Object} headers - eg: { "Content-Type", "application/json;charset=UTF-8" }
 *         - @param {Object} data - post payload
 * @param {Function} options.adjustClonedNode - callback for adjustClonedNode eventing (to allow adjusting clone's properties)
 * @param {Function} options.filterStyles - Should return true if passed propertyName should be included in the output
 * @return {Promise} - A promise that is fulfilled with a SVG image data URL
 * */
function toSvg(node: Node, options: { filter: Function; onclone: Function; bgcolor: string; width: number; height: number; style: any; quality: number; scale: number; imagePlaceholder: string; cacheBust: boolean; styleCaching: string; copyDefaultStyles: boolean; disableEmbedFonts: boolean; disableInlineImages: boolean; corsImg: any; }): Promise<any> {
    const ownerWindow = getWindow(node);
    options = options || {};
    copyOptions(options);
    const restorations: any = [];

    return resolve(node)
        .then(ensureElement)
        .then(function (clonee) {
            return cloneNode(clonee, options, null, ownerWindow);
        })
        // @ts-expect-error TS(2345): Argument of type 'Promise<Node> | ((node: any) => ... Remove this comment to see the full error message
        .then(options.disableEmbedFonts ? resolve(node) : embedFonts)
        // @ts-expect-error TS(2345): Argument of type 'Promise<Node> | ((node: any) => ... Remove this comment to see the full error message
        .then(options.disableInlineImages ? resolve(node) : inlineImages)
        .then(applyOptions)
        .then(makeSvgDataUri)
        .then(restoreWrappers)
        .then(clearCache);

    function ensureElement(node: any) {
        if (node.nodeType === ELEMENT_NODE) return node;

        const originalChild = node;
        const wrappingSpan = $create('span');
        originalChild.replaceWith(wrappingSpan);
        wrappingSpan.append(node);
        restorations.push({
            child: originalChild,
            wrapper: wrappingSpan,
        });
        return wrappingSpan;
    }

    function restoreWrappers(result: any) {
        // put the original children back where the wrappers were inserted
        while (restorations.length > 0) {
            const restoration = restorations.pop();
            restoration.wrapper.replaceWith(restoration.child);
        }

        return result;
    }

    function clearCache(result: any) {
        urlCache.length = 0;
        removeSandbox();
        return result;
    }

    function applyOptions(clone: any) {
        if (options.bgcolor) {
            clone.style.backgroundColor = options.bgcolor;
        }
        if (options.width) {
            clone.style.width = `${options.width}px`;
        }
        if (options.height) {
            clone.style.height = `${options.height}px`;
        }
        if (options.style) {
            Object.keys(options.style).forEach(function (property) {
                clone.style[property] = options.style[property];
            });
        }

        let onCloneResult = null;

        if (typeof options.onclone === 'function') {
            onCloneResult = options.onclone(clone);
        }

        return resolve(onCloneResult).then(function () {
            return clone;
        });
    }

    function makeSvgDataUri(clone: any) {
        const width = options.width || widthOfNode(node);
        const height = options.height || heightOfNode(node);

        return resolve(clone)
            .then(function (svg) {
                svg.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                return new XMLSerializer().serializeToString(svg);
            })
            .then(escapeXhtml)
            .then(function (xhtml) {
                const foreignObjectSizing =
                    (isDimensionMissing(width)
                        ? ' width="100%"'
                        : ` width="${width}"`) +
                    (isDimensionMissing(height)
                        ? ' height="100%"'
                        : ` height="${height}"`);
                const svgSizing =
                    (isDimensionMissing(width) ? '' : ` width="${width}"`) +
                    (isDimensionMissing(height) ? '' : ` height="${height}"`);
                return `<svg xmlns="http://www.w3.org/2000/svg"${svgSizing}><foreignObject${foreignObjectSizing}>${xhtml}</foreignObject></svg>`;
            })
            .then(function (svg) {
                return `data:image/svg+xml;charset=utf-8,${svg}`;
            });
    }
}

/**
 * @param {Node} node - The DOM Node object to render
 * @param {Object} options - Rendering options, @see {@link toSvg}
 * @return {Promise} - A promise that is fulfilled with a Uint8Array containing RGBA pixel data.
 * */
function toPixelData(node: Node, options: any): Promise<any> {
    return draw(node, options).then(function (canvas) {
        return canvas
            .getContext('2d')!
            .getImageData(0, 0, widthOfNode(node), heightOfNode(node)).data;
    });
}

/**
 * @param {Node} node - The DOM Node object to render
 * @param {Object} options - Rendering options, @see {@link toSvg}
 * @return {Promise} - A promise that is fulfilled with a PNG image data URL
 * */
function toPng(node: Node, options: any): Promise<any> {
    return draw(node, options).then(function (canvas) {
        return canvas.toDataURL();
    });
}

/**
 * @param {Node} node - The DOM Node object to render
 * @param {Object} options - Rendering options, @see {@link toSvg}
 * @return {Promise} - A promise that is fulfilled with a JPEG image data URL
 * */
function toJpeg(node: Node, options: any): Promise<any> {
    return draw(node, options).then(function (canvas) {
        return canvas.toDataURL(
            'image/jpeg',
            (options ? options.quality : undefined) || 1.0
        );
    });
}

/**
 * @param {Node} node - The DOM Node object to render
 * @param {Object} options - Rendering options, @see {@link toSvg}
 * @return {Promise} - A promise that is fulfilled with a PNG image blob
 * */
function toBlob(node: Node, options: any): Promise<any> {
    return draw(node, options).then(canvasToBlob);
}

/**
 * @param {Node} node - The DOM Node object to render
 * @param {Object} options - Rendering options, @see {@link toSvg}
 * @return {Promise} - A promise that is fulfilled with a canvas object
 * */
function toCanvas(node: Node, options: any): Promise<any> {
    return draw(node, options);
}



function draw(domNode: any, options: any) {
    options = options || {};
    return toSvg(domNode, options)
        .then(makeImage)
        .then(function (image) {
            const scale = typeof options.scale !== 'number' ? 1 : options.scale;
            const canvas = newCanvas(domNode, scale);
            const ctx = canvas.getContext('2d')!;
            // @ts-expect-error
            ctx.msImageSmoothingEnabled = false;
            ctx.imageSmoothingEnabled = false;
            if (image) {
                ctx.scale(scale, scale);
                ctx.drawImage(image as CanvasImageSource, 0, 0);
            }
            return canvas;
        });

    function newCanvas(node: any, scale: any) {
        let width = options.width || widthOfNode(node);
        let height = options.height || heightOfNode(node);

        // per https://www.w3.org/TR/CSS2/visudet.html#inline-replaced-width the default width should be 300px if height
        // not set, otherwise should be 2:1 aspect ratio for whatever height is specified
        if (isDimensionMissing(width)) {
            width = isDimensionMissing(height) ? 300 : height * 2.0;
        }

        if (isDimensionMissing(height)) {
            height = width / 2.0;
        }

        const canvas = $create('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;

        if (options.bgcolor) {
            const ctx = canvas.getContext('2d');
            // @ts-expect-error TS(2531): Object is possibly 'null'.
            ctx.fillStyle = options.bgcolor;
            // @ts-expect-error TS(2531): Object is possibly 'null'.
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        return canvas;
    }
}

let sandbox: HTMLIFrameElement | null = null;

function cloneNode(node: any, options: any, parentComputedStyles: any, ownerWindow: any) {
    const filter = options.filter;
    if (
        node === sandbox ||
        isHTMLScriptElement(node) ||
        isHTMLStyleElement(node) ||
        isHTMLLinkElement(node) ||
        (parentComputedStyles !== null && filter && !filter(node))
    ) {
        return resolve();
    }

    return resolve(node)
        .then(makeNodeCopy)
        .then(adjustCloneBefore)
        .then(function (clone) {
            return cloneChildren(clone, getParentOfChildren(node));
        })
        .then(adjustCloneAfter)
        .then(function (clone) {
            return processClone(clone, node);
        });

    function makeNodeCopy(original: any) {
        if (isHTMLCanvasElement(original)) {
            return makeImage(original.toDataURL());
        }
        return original.cloneNode(false);
    }

    function adjustCloneBefore(clone: any) {
        if (options.adjustClonedNode) {
            options.adjustClonedNode(node, clone, false);
        }
        return resolve(clone);
    }

    function adjustCloneAfter(clone: any) {
        if (options.adjustClonedNode) {
            options.adjustClonedNode(node, clone, true);
        }
        return resolve(clone);
    }

    function getParentOfChildren(original: any) {
        if (isElementHostForOpenShadowRoot(original)) {
            return original.shadowRoot; // jump "down" to #shadow-root
        }
        return original;
    }

    function cloneChildren(clone: any, original: any) {
        const originalChildren = getRenderedChildren(original);
        let done = resolve();

        if (originalChildren.length !== 0) {
            const originalComputedStyles = getStyle(
                getRenderedParent(original)
            );

            asArray(originalChildren).forEach(function (originalChild) {
                done = done.then(function () {
                    return cloneNode(
                        originalChild,
                        options,
                        originalComputedStyles,
                        ownerWindow
                    ).then(function (clonedChild) {
                        if (clonedChild) {
                            clone.appendChild(clonedChild);
                        }
                    });
                });
            });
        }

        return done.then(function () {
            return clone;
        });

        function getRenderedParent(original: any) {
            if (isShadowRoot(original)) {
                return original.host; // jump up from #shadow-root to its parent <element>
            }
            return original;
        }

        function getRenderedChildren(original: any) {
            if (isShadowSlotElement(original)) {
                const assignedNodes = original.assignedNodes();

                if (assignedNodes && assignedNodes.length > 0) return assignedNodes; // shadow DOM <slot> has "assigned nodes" as rendered children
            }
            return original.childNodes;
        }
    }

    function processClone(clone: any, original: any) {
        if (!isElement(clone) || isShadowSlotElement(original)) {
            return resolve(clone);
        }

        return resolve()
            .then(cloneStyle)
            .then(clonePseudoElements)
            .then(copyUserInput)
            .then(fixSvg)
            .then(fixResponsiveImages)
            .then(function () {
                return clone;
            });

        function fixResponsiveImages() {
            if (isHTMLImageElement(clone)) {
                // Remove lazy-loading and responsive attributes
                clone.removeAttribute('loading');

                // If the original had srcset or sizes, set src to the resolved image
                if (original.srcset || original.sizes) {
                    clone.removeAttribute('srcset');
                    clone.removeAttribute('sizes');

                    // Use currentSrc if available, otherwise fallback to src
                    clone.src = original.currentSrc || original.src;
                }
            }
        }

        function cloneStyle() {
            copyStyle(original, clone);

            function copyFont(source: any, target: any) {
                target.font = source.font;
                target.fontFamily = source.fontFamily;
                target.fontFeatureSettings = source.fontFeatureSettings;
                target.fontKerning = source.fontKerning;
                target.fontSize = source.fontSize;
                target.fontStretch = source.fontStretch;
                target.fontStyle = source.fontStyle;
                target.fontVariant = source.fontVariant;
                target.fontVariantCaps = source.fontVariantCaps;
                target.fontVariantEastAsian = source.fontVariantEastAsian;
                target.fontVariantLigatures = source.fontVariantLigatures;
                target.fontVariantNumeric = source.fontVariantNumeric;
                target.fontVariationSettings = source.fontVariationSettings;
                target.fontWeight = source.fontWeight;
            }

            function copyStyle(sourceElement: any, targetElement: any) {
                const sourceComputedStyles = getStyle(sourceElement);
                if (sourceComputedStyles.cssText) {
                    targetElement.style.cssText = sourceComputedStyles.cssText;
                    copyFont(sourceComputedStyles, targetElement.style); // here we re-assign the font props.
                } else {
                    copyUserComputedStyleFast(
                        options,
                        sourceElement,
                        sourceComputedStyles,
                        parentComputedStyles,
                        targetElement
                    );

                    // Remove positioning of initial element, which stops them from being captured correctly
                    if (parentComputedStyles === null) {
                        [
                            'inset-block',
                            'inset-block-start',
                            'inset-block-end',
                        ].forEach((prop) => targetElement.style.removeProperty(prop));
                        ['left', 'right', 'top', 'bottom'].forEach((prop) => {
                            if (targetElement.style.getPropertyValue(prop)) {
                                targetElement.style.setProperty(prop, '0px');
                            }
                        });
                    }
                }
            }
        }

        function clonePseudoElements() {
            const cloneClassName = uid();

            [':before', ':after'].forEach(function (element) {
                clonePseudoElement(element);
            });

            function clonePseudoElement(element: any) {
                const style = getStyle(original, element);
                const content = style.getPropertyValue('content');

                if (content === '' || content === 'none') {
                    return;
                }

                const currentClass = clone.getAttribute('class') || '';
                clone.setAttribute('class', `${currentClass} ${cloneClassName}`);

                const styleElement = $create('style');
                styleElement.appendChild(formatPseudoElementStyle());
                clone.appendChild(styleElement);

                function formatPseudoElementStyle() {
                    const selector = `.${cloneClassName}:${element}`;
                    const cssText = style.cssText
                        ? formatCssText()
                        : formatCssProperties();

                    return dom.createTextNode(`${selector}{${cssText}}`);

                    function formatCssText() {
                        return `${style.cssText} content: ${content};`;
                    }

                    function formatCssProperties() {
                        const styleText = asArray(style)
                            .map(formatProperty)
                            .join('; ');
                        return `${styleText};`;

                        function formatProperty(name: any) {
                            const propertyValue = style.getPropertyValue(name);
                            const propertyPriority = style.getPropertyPriority(name)
                                ? ' !important'
                                : '';
                            return `${name}: ${propertyValue}${propertyPriority}`;
                        }
                    }
                }
            }
        }

        function copyUserInput() {
            if (isHTMLTextAreaElement(original)) {
                clone.innerHTML = original.value;
            }
            if (isHTMLInputElement(original)) {
                clone.setAttribute('value', original.value);
            }
        }

        function fixSvg() {
            if (isSVGElement(clone)) {
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

                if (isSVGRectElement(clone)) {
                    ['width', 'height'].forEach(function (attribute) {
                        const value = clone.getAttribute(attribute);
                        if (value) {
                            clone.style.setProperty(attribute, value);
                        }
                    });
                }
            }
        }
    }
}

function embedFonts(node: any) {
    return resolveAll().then(function (cssText) {
        if (cssText !== '') {
            const styleNode = $create('style');
            node.appendChild(styleNode);
            styleNode.appendChild(document.createTextNode(cssText));
        }
        return node;
    });
}

function inlineImages(node: any) {
    return imagesInlineAll(node).then(function () {
        return node;
    });
}

function setStyleProperty(targetStyle: any, name: any, value: any, priority: any) {
    const needs_prefixing = ['background-clip'].indexOf(name) >= 0;
    if (priority) {
        targetStyle.setProperty(name, value, priority);
        if (needs_prefixing) {
            targetStyle.setProperty(`-webkit-${name}`, value, priority);
        }
    } else {
        targetStyle.setProperty(name, value);
        if (needs_prefixing) {
            targetStyle.setProperty(`-webkit-${name}`, value);
        }
    }
}

function copyUserComputedStyleFast(
    options: any,
    sourceElement: any,
    sourceComputedStyles: any,
    parentComputedStyles: any,
    targetElement: any
) {
    const defaultStyle = opts.copyDefaultStyles
        ? getDefaultStyle(options, sourceElement)
        : {};
    const targetStyle = targetElement.style;

    asArray(sourceComputedStyles).forEach(function (name) {
        if (options.filterStyles) {
            if (!options.filterStyles(sourceElement, name)) {
                return;
            }
        }

        const sourceValue = sourceComputedStyles.getPropertyValue(name);
        const defaultValue = defaultStyle[name];
        const parentValue = parentComputedStyles
            ? parentComputedStyles.getPropertyValue(name)
            : undefined;

        // Ignore setting style property on clone node, if already it has a style (through adjustCloneNode)
        const targetValue = targetStyle.getPropertyValue(name);
        if (targetValue) return;

        // If the style does not match the default, or it does not match the parent's, set it. We don't know which
        // styles are inherited from the parent and which aren't, so we have to always check both.
        if (
            sourceValue !== defaultValue ||
            (parentComputedStyles && sourceValue !== parentValue)
        ) {
            const priority = sourceComputedStyles.getPropertyPriority(name);
            setStyleProperty(targetStyle, name, sourceValue, priority);
        }
    });
}

let removeDefaultStylesTimeoutId: any = null;
let tagNameDefaultStyles = {};

const ascentStoppers = [
    // these come from https://developer.mozilla.org/en-US/docs/Web/HTML/Block-level_elements
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'DETAILS',
    'DIALOG',
    'DD',
    'DIV',
    'DL',
    'DT',
    'FIELDSET',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'FORM',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'HGROUP',
    'HR',
    'LI',
    'MAIN',
    'NAV',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'SVG',
    'TABLE',
    'UL',
    // this is some non-standard ones
    'math', // intentionally lowercase, thanks Safari
    'svg', // in case we have an svg embedded element
    // these are ultimate stoppers in case something drastic changes in how the DOM works
    'BODY',
    'HEAD',
    'HTML',
];

function getDefaultStyle(options: any, sourceElement: any) {
    const tagHierarchy = computeTagHierarchy(sourceElement);
    const tagKey = computeTagKey(tagHierarchy);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (tagNameDefaultStyles[tagKey]) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        return tagNameDefaultStyles[tagKey];
    }

    // We haven't cached the answer for that hierachy yet, build a
    // sandbox (if not yet created), fill it with the hierarchy that
    // matters, and grab the default styles associated
    const sandboxWindow = ensureSandboxWindow();
    const defaultElement = constructElementHierachy(
        sandboxWindow.document,
        tagHierarchy
    );
    const defaultStyle = computeStyleForDefaults(sandboxWindow, defaultElement);
    destroyElementHierarchy(defaultElement);

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    tagNameDefaultStyles[tagKey] = defaultStyle;
    return defaultStyle;

    function computeTagHierarchy(sourceNode: any) {
        const tagNames = [];

        do {
            if (sourceNode.nodeType === ELEMENT_NODE) {
                const tagName = sourceNode.tagName;
                tagNames.push(tagName);

                if (ascentStoppers.includes(tagName)) {
                    break;
                }
            }

            sourceNode = sourceNode.parentNode;
        } while (sourceNode);

        return tagNames;
    }

    function computeTagKey(tagHierarchy: any) {
        if (options.styleCaching === 'relaxed') {
            // pick up only the ascent-stopping element tag and the element tag itself
            /* jshint unused:true */
            return tagHierarchy
                .filter((_: any, i: any, a: any) => i === 0 || i === a.length - 1)
                .join('>');
        }
        // for all other cases, fall back the the entire path
        return tagHierarchy.join('>'); // it's like CSS
    }

    function constructElementHierachy(sandboxDocument: any, tagHierarchy: any) {
        let element = sandboxDocument.body;
        do {
            const childTagName = tagHierarchy.pop();
            const childElement = sandboxDocument.createElement(childTagName);
            element.appendChild(childElement);
            element = childElement;
        } while (tagHierarchy.length > 0);

        // Ensure that there is some content, so that properties like margin are applied.
        // we use zero-width space to handle FireFox adding a pixel
        element.textContent = '\u200b';
        return element;
    }

    function computeStyleForDefaults(sandboxWindow: any, defaultElement: any) {
        const defaultStyle = {};
        const defaultComputedStyle = sandboxWindow.getComputedStyle(defaultElement);

        // Copy styles to an object, making sure that 'width' and 'height' are given the default value of 'auto', since
        // their initial value is always 'auto' despite that the default computed value is sometimes an absolute length.
        asArray(defaultComputedStyle).forEach(function (name) {
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            defaultStyle[name] =
                name === 'width' || name === 'height'
                    ? 'auto'
                    : defaultComputedStyle.getPropertyValue(name);
        });
        return defaultStyle;
    }

    function destroyElementHierarchy(element: any) {
        do {
            const parentElement = element.parentElement;
            if (parentElement !== null) {
                parentElement.removeChild(element);
            }
            element = parentElement;
        } while (element && element.tagName !== 'BODY');
    }
}

function ensureSandboxWindow() {
    if (sandbox) {
        return sandbox.contentWindow;
    }

    // figure out how this document is defined (doctype and charset)
    const charsetToUse = dom.characterSet || 'UTF-8';
    const docType = dom.doctype;
    const docTypeDeclaration = docType
        ? `<!DOCTYPE ${escapeHTML(docType.name)} ${escapeHTML(
            docType.publicId
        )} ${escapeHTML(docType.systemId)}`.trim() + '>'
        : '';

    // Create a hidden sandbox <iframe> element within we can create default HTML elements and query their
    // computed styles. Elements must be rendered in order to query their computed styles. The <iframe> won't
    // render at all with `display: none`, so we have to use `visibility: hidden` with `position: fixed`.
    sandbox = $create('iframe');
    sandbox.id = 'domtoimage-sandbox-' + uid();
    sandbox.style.top = '-9999px';
    sandbox.style.visibility = 'hidden';
    sandbox.style.position = 'fixed';
    body.appendChild(sandbox);

    return tryTechniques(
        sandbox,
        docTypeDeclaration,
        charsetToUse,
        'domtoimage-sandbox'
    );

    function escapeHTML(unsafeText: any) {
        if (unsafeText) {
            const div = $create('div');
            div.innerText = unsafeText;
            return div.innerHTML;
        } else {
            return '';
        }
    }

    function tryTechniques(sandbox: any, doctype: any, charset: any, title: any) {
        // try the good old-fashioned document write with all the correct attributes set
        try {
            sandbox.contentWindow.document.write(
                `${doctype}<html><head><meta charset='${charset}'><title>${title}</title></head><body></body></html>`
            );
            return sandbox.contentWindow;
        } catch (_) {
            // swallow exception and fall through to next technique
        }

        const metaCharset = $create('meta');
        metaCharset.setAttribute('charset', charset);

        // let's attempt it using srcdoc, so we can still set the doctype and charset
        try {
            const sandboxDocument = dom.implementation.createHTMLDocument(title);
            sandboxDocument.head.appendChild(metaCharset);
            const sandboxHTML = doctype + sandboxDocument.documentElement.outerHTML;
            sandbox.setAttribute('srcdoc', sandboxHTML);
            return sandbox.contentWindow;
        } catch (_) {
            // NOSONAR
            // swallow exception and fall through to the simplest path
        }

        // let's attempt it using contentDocument... here we're not able to set the doctype
        sandbox.contentDocument.head.appendChild(metaCharset);
        sandbox.contentDocument.title = title;
        return sandbox.contentWindow;
    }
}

function removeSandbox() {
    if (sandbox) {
        body.removeChild(sandbox);
        sandbox = null;
    }

    if (removeDefaultStylesTimeoutId) {
        clearTimeout(removeDefaultStylesTimeoutId);
    }

    removeDefaultStylesTimeoutId = setTimeout(() => {
        removeDefaultStylesTimeoutId = null;
        tagNameDefaultStyles = {};
    }, 20 * 1000);
}

export {
    toSvg,
    toPng,
    toJpeg,
    toBlob,
    toPixelData,
    toCanvas,
};
