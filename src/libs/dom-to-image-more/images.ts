import { getAndEncode } from "./options";
import { asArray, isDataUrl, isElement, isHTMLImageElement, resolve } from "./utils";

function newImage(element: any) {
    return {
        inline: inline,
    };

    function inline(get: any) {
        if (isDataUrl(element.src)) {
            return resolve();
        }

        return resolve(element.src)
            .then(get || getAndEncode)
            .then(function (dataUrl) {
                return new Promise(function (resolve) {
                    element.onload = resolve;
                    // for any image with invalid src(such as <img src />), just ignore it
                    element.onerror = resolve;
                    element.src = dataUrl;
                });
            });
    }
}

function imagesInlineAll(node: any) {
    if (!isElement(node)) {
        return resolve(node);
    }

    return inlineCSSProperty(node).then(function (): unknown {
        if (isHTMLImageElement(node)) {
            // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
            return newImage(node).inline();
        } else {
            return Promise.all(
                asArray(node.childNodes).map(function (child) {
                    return imagesInlineAll(child);
                })
            );
        }
    });

    function inlineCSSProperty(node: any) {
        const properties = ['background', 'background-image'];

        const inliningTasks = properties.map(function (propertyName) {
            const value = node.style.getPropertyValue(propertyName);
            const priority = node.style.getPropertyPriority(propertyName);

            if (!value) {
                return resolve();
            }

            // @ts-expect-error TS(2554): Expected 3 arguments, but got 1.
            return inlinerInlineAll(value).then(function (inlinedValue) {
                node.style.setProperty(propertyName, inlinedValue, priority);
            });
        });

        return Promise.all(inliningTasks).then(function () {
            return node;
        });
    }
}

export {
    newImage,
    imagesInlineAll,
}
