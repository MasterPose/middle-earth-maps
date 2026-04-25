export const dom = document;
export const body = dom.body;

export const $ = <T extends HTMLElement>(selector: string, parent: HTMLElement = dom as unknown as HTMLElement): T => parent.querySelector(selector)!;
export const $create = <K extends keyof HTMLElementTagNameMap>(tag: K) => dom.createElement(tag);
export const $createNS = (namespaceURI: string, qualifiedName: string) => dom.createElementNS(namespaceURI, qualifiedName);
