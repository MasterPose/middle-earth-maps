import { dom } from "../../utils/dom";
import { inlinerInlineAll, shouldProcess } from "./inliner";
import { asArray, resolve } from "./utils";

export function resolveAll() {
    return readAll()
        .then(function (webFonts) {
            return Promise.all(
                webFonts.map(function (webFont: any) {
                    return webFont.resolve();
                })
            );
        })
        .then(function (cssStrings) {
            return cssStrings.join('\n');
        });
}

export function readAll() {
    return resolve(asArray(dom.styleSheets))
        .then(getCssRules)
        .then(selectWebFontRules)
        .then(function (rules) {
            return rules.map(newWebFont);
        });

    function selectWebFontRules(cssRules: any) {
        return cssRules
            .filter(function (rule: any) {
                return rule.type === CSSRule.FONT_FACE_RULE;
            })
            .filter(function (rule: any) {
                return shouldProcess(rule.style.getPropertyValue('src'));
            });
    }

    function getCssRules(styleSheets: any) {
        const cssRules: any = [];
        styleSheets.forEach(function (sheet: any) {
            const sheetProto = Object.getPrototypeOf(sheet);
            // NOSONAR
            if (Object.prototype.hasOwnProperty.call(sheetProto, 'cssRules')) {
                try {
                    asArray(sheet.cssRules || []).forEach(
                        cssRules.push.bind(cssRules)
                    );
                } catch (e) {
                    console.error(
                        'domtoimage: Error while reading CSS rules from: ' +
                        sheet.href,
                        // @ts-expect-error TS(2571): Object is of type 'unknown'.
                        e.toString()
                    );
                }
            }
        });
        return cssRules;
    }

    function newWebFont(webFontRule: any) {
        return {
            resolve: function resolve() {
                // NOSONAR
                const baseUrl = (webFontRule.parentStyleSheet || {}).href;
                return inlinerInlineAll(webFontRule.cssText, baseUrl);
            },
            src: function () {
                return webFontRule.style.getPropertyValue('src');
            },
        };
    }
}
