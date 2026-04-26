import type { Plugin } from "vite";
import { simple as acornWalk } from "acorn-walk"

type ViteStripDepsOpts = {
    ignoreList: string[]
}

export const viteStripDeps = ({ ignoreList = [] }: ViteStripDepsOpts): Plugin => {
    let isProd = false;
    return {
        name: 'vite-strip-deps',
        configResolved(config) {
            isProd = config.isProduction
        },
        transform(code, id, options) {
            if (!isProd) return;
            if (ignoreList.findIndex((v) => id.endsWith(v)) < 0) return;

            const ast = this.parse(code)
            const exportedNames: string[] = [];

            acornWalk(ast, {
                ExportNamedDeclaration(node) {
                    let ids: string[];

                    switch (node.declaration?.type) {
                        case 'ClassDeclaration':
                        case 'FunctionDeclaration':
                            ids = [node.declaration.id.name];
                            break;
                        case 'VariableDeclaration':
                            ids = node.declaration.declarations
                                .map((v) => v.id.type == 'Identifier' ? v.id.name : undefined)
                                .filter((v) => v) as string[];
                            break;
                        default:
                            ids = [];
                            break;
                    }

                    exportedNames.push(...ids)
                }
            })

            const replacedCode = exportedNames.map((v) => `export const ${v} = {}`).join(';\n');

            return {
                code: replacedCode
            }
        },
    };
}
