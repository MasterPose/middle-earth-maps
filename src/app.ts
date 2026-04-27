import './style.css'

import { $, $create, body } from './utils/dom.js';
import { clampYaw, max, min, round } from './utils/math.js';
import { raf } from './utils/timing.js';

import {
    search as slimSearch,
    loadJSONIndexAsync,
    type SearchIndex,
} from 'slimsearch'

import './libs/pannellum.js';
import { toBlob } from './libs/dom-to-image-more.js';
import {
    Control,
    DomUtil,
    LatLng,
    Map as LeafletMap,
    Circle,
    Marker,
    DivIcon,
    LatLngBounds,
    GeoJSON,
    Canvas,
    CRS,
    Browser
} from './libs/leaflet.js';
import { interact } from './libs/interact.js';
import { fetchAsJson, fetchAsText } from './utils/data.js';

import type { GeoJSONOptions, LatLngExpression, Layer, MarkerOptions, PathOptions, Polygon } from 'leaflet';
import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';

const EMPTY_ARR: never[] = [];

const $app = $<HTMLDivElement>('#app');
const $sidebar = $<HTMLDivElement>('#sidebar');
const $sidebarName = $<HTMLHeadingElement>('header>.title>h2', $sidebar);
const $sidebarRegion = $<HTMLHeadingElement>('header>.title>p', $sidebar);

// const $sidebarMainPicture = $<HTMLDivElement>('.picture'), $sidebar!;
const $sidebarMainPictureImage = $<HTMLImageElement>('.picture>img', $sidebar);

// const $sidebarData = $<HTMLDivElement>('#basic-data', $sidebar);
const $sidebarDataTitle = $<HTMLParagraphElement>('#basic-data-title', $sidebar);
const $sidebarDataDescription = $<HTMLParagraphElement>('#basic-data>p', $sidebar);
const $sidebarDataLearnMore = $<HTMLAnchorElement>('#basic-data>a', $sidebar);

const $sidebarMedia = $<HTMLDivElement>('#media', $sidebar);
const $sidebarMediaGallery = $<HTMLDivElement>('#media>.gallery', $sidebar);

const $sidebarKnownAs = $<HTMLDivElement>('#also-known', $sidebar);
const $sidebarKnownAsList = $<HTMLUListElement>('#also-known>ul', $sidebar);

const $searchbar = $<HTMLDivElement>('#searchbar');
const $searchbarForm = $<HTMLFormElement>('form', $searchbar);
const $searchbarList = $<HTMLUListElement>('ul', $searchbar);
const $searchbarFormInput = $<HTMLInputElement>('input', $searchbarForm);

const $footer = $<HTMLDivElement>('#footer');

const $streetview = $<HTMLDivElement>('#streetview');
const $streetviewPanellum = $<HTMLDivElement>('div', $streetview);

const $streetviewControl = $<HTMLDivElement>('#streetview-control');
const $streetviewMinimap = $<HTMLDivElement>('#streetview-minimap');
const $streetviewMinimapImage = $<HTMLImageElement>('#streetview-minimap-image', $streetviewMinimap);
const $streetviewMinimapCompass = $<HTMLImageElement>('#streetview-minimap-compass', $streetviewMinimap);

const $streetviewDummy = $<HTMLButtonElement>('#streetview-dummy', $streetviewControl);
const $streetviewDummyImage = $<HTMLImageElement>('img', $streetviewDummy);

const $streetviewExploreButton = $<HTMLButtonElement>('#streetview-explore-button', $streetviewControl);
const $streetviewExplore = $<HTMLDivElement>('#streetview-explore', $streetviewControl);
const $streetviewExploreList = $<HTMLDivElement>('ul', $streetviewExplore);

function hotspot(
    yaw = 0,
    pitch = 0,
    id = '',
    degrees = 0,
    scale = 1,
) {
    yaw = clampYaw(yaw);

    const popupContainer = $create('div');
    const arrowContainer = $create('div');
    return {
        text: {
            [Symbol.toPrimitive]() {
                return placeDatabase[id][1];
            },
        },
        pitch,
        yaw,
        cssClass: "streetview-hotspot",
        clickHandlerFunc: () => id && autoShowStreetViewBackground(id),
        popupContainer,
        arrowContainer,
        createTooltipFunc: (root: HTMLDivElement) => {
            const name = placeDatabase[id][1];
            popupContainer.classList.add('streetview-hotspot-popup')
            popupContainer.innerHTML = `
            ${name}
            `
            root.appendChild(popupContainer);

            arrowContainer.style.transform = `rotateX(60deg) rotateZ(${degrees}deg)`;
            arrowContainer.innerHTML = `
            <svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 14"
                width="${round(80 * scale)}"
                height="${round(140 * scale)}"
                fill="currentColor">
                <path  d="m1.7 0.3l6 6q0.1 0.1 0.2 0.3 0.1 0.2 0.1 0.4 0 0.2-0.1 0.4-0.1 0.2-0.2 0.3l-6 6q-0.3 0.3-0.7 0.3-0.4 0-0.7-0.3-0.3-0.3-0.3-0.7 0-0.4 0.3-0.7l5.3-5.3-5.3-5.3q-0.3-0.3-0.3-0.7 0-0.4 0.3-0.7 0.3-0.3 0.7-0.3 0.4 0 0.7 0.3z"/>
            </svg>
            `
            root.appendChild(arrowContainer);
        },
    }
}

const STREETVIEW_SCENES = new Map<string, Record<string, any>>([
    ['BagEnd', {
        dummy: -90,
        hotSpots: [
            hotspot(69, -10, 'Hobbiton', -90)
        ]
    }],
    ['Hobbiton', {
        dummy: -100,
        hotSpots: [
            hotspot(5, -5, 'BagEnd', -35, 0.5),
            hotspot(103, -12, 'Bywater', -35, 0.8),
        ]
    }],
    ['Bywater', {
        dummy: 90,
        hotSpots: [
            hotspot(45, -10, 'Hobbiton', -90),
            hotspot(-110, -10, 'Frogmorton', -90),
        ]
    }],
    ['Frogmorton', {
        dummy: -90,
        hotSpots: [
            hotspot(170, -8, 'Bywater', -80, 0.8),
            hotspot(100, 3, 'Stock', 200, 0.5),
        ]
    }],
    ['Stock', {
        dummy: -70,
        hotSpots: [
            hotspot(0, -15, 'BrandywineBridge', -90),
            hotspot(225, -8, 'Frogmorton', -68, 0.8),
        ]
    }],
    ['BrandywineBridge', {
        dummy: -40,
        hotSpots: [
            hotspot(170, -20, 'Stock', -90, 0.8),
            hotspot(10, -10, 'Bucklebury', -90, 0.8),
        ]
    }],
    ['Bucklebury', {
        hotSpots: [
            hotspot(-10, -20, 'BrandywineBridge', -90, 0.8),
            hotspot(135, -20, 'BrandyHall', -90, 0.8),
        ]
    }],
    ['BrandyHall', {
        dummy: -80,
        hotSpots: [
            hotspot(180, -20, 'Bucklebury', -90, 1),
        ]
    }],
    ['TomBombadil', {
        dummy: -45,

    }],
]);
const streetviewLastFOV = new Map<string, [number, number]>();

const getPanoramaUrl = (id: string) => `./images/panoramas/${id}.webp`;
const panellum = (window as any).pannellum.viewer($streetviewPanellum, {
    autoLoad: true,
    showControls: false,
    hfov: Browser.mobile ? 60 : 120,
    scenes: [...STREETVIEW_SCENES].reduce((obj: any, [id, opts]) => {
        obj[id] = {
            ...opts,
            panorama: getPanoramaUrl(id),
            type: "equirectangular",
        };

        return obj;
    }, {})
});
const $panellumDragFix = $<HTMLDivElement>('.pnlm-dragfix');
const $panellumAboutMsg = $<HTMLDivElement>('.pnlm-about-msg');

$panellumDragFix?.addEventListener('contextmenu', () => {
    if (!$panellumAboutMsg) return;
    $panellumAboutMsg.style.display = 'none';
});

let draggingPanellum = false;

function startDraggingPanellum() {
    if (draggingPanellum) return;

    draggingPanellum = true;
    const tick = () => {
        if (!draggingPanellum) return;
        updateDraggingPanellum();
        raf(tick);
    }
    raf(tick);
}

function updateDraggingPanellum() {
    const yaw = panellum.getYaw();
    const pitch = panellum.getPitch();

    const hotspots: Array<{ pitch: number, yaw: number, popupContainer: HTMLDivElement | undefined }> = STREETVIEW_SCENES.get(panellum.getScene())?.hotSpots ?? EMPTY_ARR;
    hotspots.forEach((hotsPot) => {
        if (hotsPot.popupContainer) {
            const dist = Math.sqrt((hotsPot.yaw - yaw) ** 2 + (hotsPot.pitch - pitch) ** 2);
            const hasFocus = hotsPot.popupContainer.classList.contains('temp-focus');

            if (dist < 20 && !hasFocus) {
                hotsPot.popupContainer.classList.add('temp-focus');
            } else if (dist > 100 && hasFocus) {
                hotsPot.popupContainer.classList.remove('temp-focus');
            }
        }
    })

    if (showingStreetView) {
        streetviewLastFOV.set(showingStreetView, [yaw, pitch]);
    }

    $streetviewMinimapCompass.style.setProperty('--rotation', `${streetviewDummyOffset + yaw}deg`);
}

function stopDraggingPanellum() {
    draggingPanellum = false;
}

panellum.on('mousedown', () => startDraggingPanellum());
panellum.on('touchstart', () => startDraggingPanellum());

panellum.on('mouseup', () => stopDraggingPanellum());
panellum.on('touchend', () => stopDraggingPanellum());

panellum.on('animatefinished', () => updateDraggingPanellum());
panellum.on('load', () => {
    if (showingStreetView && streetviewLastFOV.has(showingStreetView)) {
        const [yaw, pitch] = streetviewLastFOV.get(showingStreetView)!;

        panellum.setYaw(yaw, false);
        panellum.setPitch(pitch, false);
    }
})

export let showingStreetView: string | undefined;
let streetviewDummyOffset = 0;
function showStreetView(id: string) {
    closeExploreMenu();

    if (id === showingStreetView) return;

    const opts = STREETVIEW_SCENES.get(id);

    if (!opts) return;

    streetviewDummyOffset = opts.dummy || 0;
    $streetviewMinimap.style.display = '';
    $streetviewMinimap.style.marginBottom = '';
    $streetview.style.display = '';
    $streetviewDummy.style.display = 'none';
    panellum.loadScene(id);
    setTimeout(() => body.classList.add('streetview-opened'), 0);
    showingStreetView = id;
    saveStreetView(id);
}

export function closeStreetView() {
    closeExploreMenu();

    try {
        if ($streetviewMinimapImage.src) URL.revokeObjectURL($streetviewMinimapImage.src);
    } catch (error) {
        console.error(error);
    }

    $streetviewExplore.style.paddingLeft = '';
    $streetviewMinimap.style.display = 'none';
    $streetview.style.display = 'none';
    $streetviewDummy.style.display = '';
    showingStreetView = undefined;
    streetviewLastFOV.clear();
    body.classList.remove('streetview-opened');
    saveStreetView('');
}

$streetviewMinimap.addEventListener('click', () => {
    closeStreetView();
    $streetviewMinimap.blur();
});

$streetviewExploreList.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement | undefined)?.dataset.streetviewId;

    if (!id) return;

    autoShowStreetView(id);
})

function autoShowStreetView(id: string) {
    const marker = allPlaceMarkers.get(id);

    if (!marker) return;

    focusOnMarker(id, false);

    map.once('moveend', () => {
        const coords = map.latLngToContainerPoint(marker?.getLatLng());
        showStreetView(id);
        setStreetViewMinimap(coords.x, coords.y);
    });
}

function autoShowStreetViewBackground(id: string) {
    const marker = allPlaceMarkers.get(id);

    if (!marker) return;

    focusOnMarker(id, false);
    showStreetView(id);

    map.once('moveend', () => {
        const coords = map.latLngToContainerPoint(marker?.getLatLng());
        setStreetViewMinimap(coords.x, coords.y);
    });
}

export function closeExploreMenu() {
    $streetviewMinimap.style.marginBottom = '';
    $streetviewControl.classList.remove('explore');
}

export function isExploreMenuOpen() {
    return $streetviewControl.classList.contains('explore');
}

function toggleExploreMenu() {
    if (isExploreMenuOpen()) {
        closeExploreMenu();
    } else {
        let html = '';

        $streetviewMinimap.style.marginBottom = '132px';

        allPlaceMarkers.forEach((marker, id) => {
            if (!STREETVIEW_SCENES.has(id)) return;
            if (!map.getBounds().contains(marker.getLatLng())) return;

            const props = placeDatabase[id];

            html += '<li>';
            html += `<button type="button" data-streetview-id="${id}">`;
            html += `<img src="${props[6] || 'images/places/notfound.png'}" alt="" srcset="">`;
            html += `<p>${props[1]}</p>`;
            html += '</button>';
            html += '</li>';
        })

        $streetviewExploreList.innerHTML = html;

        $streetviewControl.classList.add('explore');
    }
}

$streetviewExploreButton.addEventListener('click', () => {
    toggleExploreMenu();
    $streetviewExploreButton.blur();
    map.dragging.enable(); // Mobile fix
});

const ZOOM_MAX = 22;
const ZOOM_MIN = 15.58;

// let mapIsLoaded = false;
const map = new LeafletMap($app, {
    maxZoom: ZOOM_MAX,
    minZoom: ZOOM_MIN,
    zoomSnap: 0,
    zoomDelta: 0.25,
    zoomControl: false,
    boxZoom: false,
    keyboard: false,
    preferCanvas: true,
    crs: CRS,
    renderer: new Canvas(),
});

map.once('load', () => {
    // mapIsLoaded = true;

    $sidebar.style.display = '';
    // $streetview.style.display = '';
    $streetviewControl.style.display = '';
    // $streetviewMinimap.style.display = '';
    $searchbar.style.display = '';
    $footer.style.display = '';
})

map.attributionControl.setPrefix('Middle-Earth Maps is not affiliated with Middle-Earth Enterprises, the Tolkien State or Google Maps.');

const StreetviewMinimapControl = Control.extend({
    onAdd: function () {
        $streetviewMinimap.style.display = 'none';
        return $streetviewMinimap;
    },
    onRemove: function () { }
});

const SocialControl = Control.extend({
    onAdd: function () {
        const div = DomUtil.create('div');
        div.classList.add('leaflet-control-social');
        div.appendChild($footer)
        return div;
    },
    onRemove: function () { }
});

function layerContainsPoint(layer: any, latLng: LatLngExpression) {
    return (layer.contains && layer.contains(latLng))
        || layer.getBounds().contains(latLng);
}

function setStreetViewMinimap(containerX: number, containerY: number) {
    $streetviewMinimapImage.src = '';

    toBlob(map.getContainer(), {
        quality: 0.7,
        skipFonts: true,
        width: 200,
        height: 100,
        adjustClonedNode(node: HTMLElement, clone: HTMLElement, after: boolean) {
            if (after) return clone;
            if (node.parentElement !== $app) return clone;

            const originalTransform = clone.style.transform.replace(/^translate3d\(|\)$/g, '').split(',').map((v) => parseFloat(v.replace(/px$/, '')));
            clone.style.transform = `translate3d(${-containerX + 100 + originalTransform[0]}px, ${-containerY + 50 + originalTransform[1]}px, 0px)`;

            return clone;
        },
        filter(domNode: HTMLElement) {
            return !domNode.classList?.contains('leaflet-control-container')
        },
    }).then((v: Blob) => {
        if (!v) return;

        const url = URL.createObjectURL(v)
        $streetviewMinimapImage.src = url;
    }).catch(console.error);
}

let draggingStreetview = false;
const precacheStreetviewImages = new Set<string>();
const StreetviewControl = Control.extend({
    onAdd: function () {
        const div = DomUtil.create('div');
        div.classList.add('leaflet-control-streetview');
        interact($streetviewDummy).draggable({
            // inertia: false,
            // modifiers: [
            //     // interact.modifiers.restrictRect({
            //     //     restriction: 'parent',
            //     //     endOnly: true,
            //     // }),
            // ],
            listeners: {
                start: () => {
                    draggingStreetview = true;
                    map.dragging.disable();
                    allPlaceMarkers.forEach((marker, id) => {
                        const props = marker.feature?.properties;

                        if (!props) return;

                        if (!map.getBounds().contains(marker.getLatLng())) return;

                        if (!STREETVIEW_SCENES.has(id)) return;

                        if (!precacheStreetviewImages.has(id)) {
                            setTimeout(() => precacheStreetviewImages.add(new Image().src = getPanoramaUrl(id)), 0)
                        }

                        (props.regionLayer as Polygon | undefined)?.setStyle(STYLE_REGION_STREETVIEW);
                    })
                },
                move: (event: Event & { dx: number, dy: number }) => {
                    const x = (parseFloat($streetviewDummyImage.dataset.x ?? '') || 0) + event.dx
                    const y = (parseFloat($streetviewDummyImage.dataset.y ?? '') || 0) + event.dy

                    $streetviewDummyImage.style.position = 'absolute';
                    $streetviewDummyImage.style.transform = 'translate(' + x + 'px, ' + y + 'px)'

                    $streetviewDummyImage.dataset.x = x + '';
                    $streetviewDummyImage.dataset.y = y + '';
                    $streetviewDummyImage.src = 'icons/streetview-active.svg';
                },
                end: (event: Event & { client: { x: number, y: number } }) => {
                    setTimeout(() => draggingStreetview = false, 0)
                    map.dragging.enable();

                    $streetviewDummyImage.style.position = '';
                    $streetviewDummyImage.style.transform = ''

                    $streetviewDummyImage.dataset.x = '0';
                    $streetviewDummyImage.dataset.y = '0';
                    $streetviewDummyImage.src = 'icons/streetview.svg';

                    const mouseX = event.client.x;
                    const mouseY = event.client.y;

                    const mouseLatLng = map.containerPointToLatLng([mouseX, mouseY]);
                    const mouseLat = mouseLatLng.lat.toFixed(4);
                    const mouseLng = mouseLatLng.lng.toFixed(4);

                    const foundIds: Array<[number, string]> = [];

                    for (const [id, marker] of allPlaceMarkers) {
                        const markerLatLng = marker.getLatLng();
                        const props = marker.feature?.properties;

                        if (!props) continue;

                        if (!STREETVIEW_SCENES.has(id)) continue;

                        const isNear = markerLatLng.lat.toFixed(4) === mouseLat && markerLatLng.lng.toFixed(4) === mouseLng;

                        const regionLayer = props.regionLayer as Polygon | Circle | undefined;
                        regionLayer?.setStyle(STYLE_TRANSPARENT);

                        if (isNear) {
                            const distance = markerLatLng.distanceTo(mouseLatLng);

                            foundIds.push([distance, id]);
                        } else if (regionLayer) {
                            const bounds = regionLayer.getBounds();
                            const width = bounds.getEast() - bounds.getWest();
                            const height = bounds.getNorth() - bounds.getSouth();

                            if (layerContainsPoint(regionLayer, mouseLatLng)) {
                                foundIds.push([max(width, height), id])
                            }
                        }
                    }

                    if (!foundIds.length) {
                        showSidebar(sidebarSelectedID);
                        return;
                    }

                    const foundId = foundIds.sort((a, b) => a[0] - b[0])[0][1];

                    $searchbarFormInput.value = placeDatabase[foundId][2] || '';

                    setStreetViewMinimap(mouseX, mouseY);
                    showStreetView(foundId);
                }
            }
        });

        div.addEventListener('mouseover', () => map.dragging.disable());

        // Re-enable dragging when user's cursor leaves the element
        div.addEventListener('mouseout', () => map.dragging.enable());
        div.addEventListener('blur', () => map.dragging.enable());

        div.addEventListener('click', (e) => e.stopPropagation())

        div.appendChild($streetviewControl)
        return div;
    },
    onRemove: function () { }
});

(new StreetviewMinimapControl({ position: 'bottomleft' })).addTo(map);
(new SocialControl({ position: 'bottomleft' })).addTo(map);
(new StreetviewControl({ position: 'bottomright' })).addTo(map);

let searchIndex: SearchIndex<string, any, {
    searchname: string,
    region: string,
}>;
let lastSearchTerm: string;

class QueryBuilder {
    private static url: URL;
    private static params: URLSearchParams;
    private static timeoutId: number | undefined;

    static refresh() {
        this.url = new URL(location.href);
        this.params = this.url.searchParams;
    }

    static set(key: string, value: string | null) {
        if (value === null) {
            this.delete(key);
            return;
        }

        const oldValue = this.get(key);
        if (oldValue === value) return;

        this.params.set(key, value);
        this.onUpdated();
    }

    static has(key: string) {
        return this.params.has(key)
    }

    static get(key: string) {
        return this.params.get(key)
    }

    static delete(key: string) {
        const oldValue = this.get(key);
        if (oldValue === null) return;

        this.params.delete(key);
        this.onUpdated();
    }

    private static onUpdated() {
        if (this.timeoutId) return;

        this.timeoutId = setTimeout(() => {
            this.timeoutId = undefined;
            history.pushState({ path: this.url.href }, '', this.url.href);
        }, 0);
    }
}

function saveSearch(term: string) {
    QueryBuilder.set('s', term ? term : null);
}

function saveStreetView(id: string) {
    QueryBuilder.set('v', id ? id : null);
}

function saveSelected(id: string = '') {
    QueryBuilder.set('p', id ? id : null);
}

export function showingSearchbarList() {
    return $searchbar.classList.contains('has-items');
}

export function hideSearchbarList() {
    $searchbar.classList.remove('has-items');
}

function search(term: string) {
    lastSearchTerm = term = term.trim();
    saveSearch(term);

    if (!term) return hideSearchbarList();

    const result = slimSearch(searchIndex, term, {
        fuzzy: 0.5,
        boost: {
            'name': 2,
        },
    }).slice(0, 10).filter((v) => allPlaceMarkers.has(v.id));

    if (result.length) {
        $searchbar.classList.add('has-items');

        $searchbarList.innerHTML = result.map((v) => `<li data-id="${v.id}">${v.searchname}</li>`).join('');
    } else {
        hideSearchbarList();
    }
}

function focusOnMarker(id?: string, sidebar: boolean = true) {
    if (!id) return;

    const marker = allPlaceMarkers.get(id);
    if (!marker) return;

    // @ts-expect-error
    map.setView(marker.getLatLng(), max(map.getZoom(), marker.options.minZoom));
    if (sidebar) showSidebar(id);
}

fetchAsText('search').then(async (data) => {
    searchIndex = await loadJSONIndexAsync(data, {
        fields: ['name', 'searchAltname', 'searchRegion'],
        storeFields: ['name', 'region']
    });

    $searchbar.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;

        if (!target) return;
        if (!target.parentElement) return;
        if (target.parentElement !== $searchbarList) return;

        focusOnMarker(target.dataset.id);;
    });

    $searchbarForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        search($searchbarFormInput.value);
    })
    $searchbarFormInput.addEventListener('focus', () => search($searchbarFormInput.value));
    $searchbarFormInput.addEventListener('input', () => search($searchbarFormInput.value));
    $searchbar.classList.remove('hidden');
}).catch((e) => {
    console.error(e);
});


new Control.Zoom({
    position: 'bottomright'
}).addTo(map);

function changeTitle(title?: string) {
    document.title = title ? `${title} - Middle-Earth Maps` : `Middle-Earth Maps`;
}

function getPlaceInfo(id: string, type?: PLACE_TYPE) {
    const entry = placeDatabase[id];
    const placeConfig = type ? PLACE_CONFIG[type] : undefined;

    const name: string = entry[1];
    const zoom: number = entry[3];

    const color = placeConfig?.color;
    const icon = placeConfig?.icon;

    return {
        name,
        color,
        icon,
        zoom
    }
}

export let sidebarSelectedID: string | undefined;
function showSidebar(id?: string) {
    const prevSelectedID = sidebarSelectedID;
    const prevMarker = prevSelectedID ? allPlaceMarkers.get(prevSelectedID) : undefined;
    const curMarker = id ? allPlaceMarkers.get(id) : undefined;

    sidebarSelectedID = id;

    saveSelected(id);
    saveSearch('');

    if (prevMarker !== curMarker) {
        const prevMarkerEl = prevMarker?.getElement()?.firstElementChild;

        if (prevMarkerEl) {
            prevMarkerEl.classList.remove('active');
            // @ts-expect-error
            prevMarker.setZIndexOffset(prevMarker.options.originalZIndex)

            const regionLayer = prevMarker.feature?.properties.regionLayer as Polygon | undefined;
            if (regionLayer) regionLayer.setStyle(STYLE_TRANSPARENT);
        }
        if (curMarker) {
            const curMarkerEl = (curMarker.getElement() ?? curMarker.addTo(map).getElement())?.firstElementChild;
            curMarkerEl?.classList.add('active');
            curMarker.setZIndexOffset(9999);

            const regionLayer = curMarker.feature?.properties.regionLayer as Polygon | undefined;
            if (regionLayer) {
                regionLayer.setStyle(STYLE_REGION);
            }
        }

        refreshPlaceMarkers();
    }

    if (!id) {
        changeTitle(undefined);
        $sidebar.classList.add('hidden');
        return;
    }


    const info = placeDatabase[id];
    const description: string = placeDatabaseDescriptions[id];

    const region: string[] | 0 = info[5];
    const mainPicture: string | 0 = info[6];
    const link: string | 0 = info[8];
    const images: string[] | 0 = info[7];
    const knownAs: string[] | 0 = info[4];

    const name = info[1];

    $sidebar.classList.remove('hidden');
    $sidebarName.innerText = name;
    $searchbarFormInput.value = info[2];

    changeTitle(name);

    if (region) {
        $sidebarRegion.classList.remove('hidden');
        $sidebarRegion.innerText = region.join(' / ');
    } else {
        $sidebarRegion.classList.add('hidden');
    }

    if (mainPicture) {
        $sidebarMainPictureImage.src = mainPicture;
    } else {
        $sidebarMainPictureImage.src = 'images/places/notfound.png';
    }

    $sidebarDataTitle.innerText = 'Basic Data';

    if (description) {
        $sidebarDataDescription.classList.remove('hidden');
        $sidebarDataDescription.innerText = description;
    } else {
        $sidebarDataDescription.classList.add('hidden');
    }

    $sidebarDataLearnMore.href = link || '';

    if (images) {
        $sidebarMedia.classList.remove('hidden');
        $sidebarMediaGallery.innerHTML = images.map((v) => `
        <a class="item" href="${v}" target="_blank">
            <h4 class="title">${v.split('/').pop()!.replace(/^\d+/, '').replace(/\.\w+$/, '').replace(/_/g, ' ')}</h4>
            <img src="${v}" alt="">
        </a>
        `).join('');
    } else {
        $sidebarMedia.classList.add('hidden');
    }

    if (knownAs) {
        $sidebarKnownAs.classList.remove('hidden');
        $sidebarKnownAsList.innerHTML = knownAs.map((v) => `<li>${v}</li>`).join('');
    } else {
        $sidebarKnownAs.classList.add('hidden');
    }

}
export function hideSidebar() {
    showSidebar()
}

const allPlaceMarkers = new Map<string, InstanceType<typeof PlaceMarker>>();
const PLACE_CONFIG = {
    point_waterfall: {
        icon: 'waterfall',
        color: '#b56aff',
    },
    point_mount: {
        icon: 'peaks',
        color: '#17a773'
    },
    point_bridge: {
        icon: 'stone-bridge',
        color: '#78909c',
    },
    point_place: {
        icon: 'position-marker',
        color: '#78909c',
    },
    point_ford: {
        icon: 'black-bridge',
        color: '#b56aff',
    },
    point_city: {
        icon: 'village',
        color: '#0597ff'
    },
    point_castletower: {
        icon: 'castle',
        color: '#e54953'
    },
}
type PLACE_TYPE = keyof typeof PLACE_CONFIG;

const PlaceMarker = Marker.extend({
    initialize: function (
        feature: Feature<Geometry, any>,
        coords: LatLng,
        opts: MarkerOptions = {},
    ) {
        const featureProps = feature.properties;

        const id = featureProps.eventname;
        const type = featureProps.layer;
        const {
            color,
            icon,
            name,
            zoom,
        } = getPlaceInfo(id, type);
        const withoutIcon = [
            'point_city',
            'poly_region'
        ].includes(type)

        const size = withoutIcon
            ? max(featureProps.size ?? 2, 2)
            : (featureProps.size ?? 0);

        const minZoom: number = min(ZOOM_MIN + zoom - min(size, 2), 19);

        this.feature = feature;

        let regionLayer: Circle | undefined = featureProps.regionLayer;
        if (!regionLayer) {
            let radius: number | undefined;

            if (type === 'point_city') {
                radius = max(feature.properties.size * 5, 2);
            } else if (STREETVIEW_SCENES.has(id)) {
                radius = 2
            }

            if (radius) {
                regionLayer = featureProps.regionLayer = new Circle(coords, {
                    ...STYLE_TRANSPARENT,
                    radius: radius / 100000
                });
                this.once('add', () => regionLayer!.addTo(map));
            }
        }

        let html: string
        let zIndex: number = withoutIcon ? 998 - (3 - size) : 0;

        const fontSize = [
            14,
            14,
            16,
            18,
        ][size];

        html = `<div class="place-icon ${withoutIcon ? 'without-icon' : ''}" style="--place-color: ${withoutIcon ? '#2f3034' : color}; --place-size: ${withoutIcon ? fontSize : 14}px">`;
        if (!withoutIcon) html += `<div><img class="icon" src="icons/${icon}.svg"><img class="selected-icon" src="icons/ring.svg"></div>`;
        html += `<p>${name}</p>`;
        html += `</div>`;

        opts.icon = new DivIcon({
            html,
            iconSize: [26, 26]
        });

        // @ts-expect-error
        Marker.prototype.initialize.call(this, coords, {
            ...opts,
            minZoom,
            originalZIndex: zIndex,
        });

        this.addEventListener('mouseover', () => {
            this.setZIndexOffset(9999);
        });
        this.addEventListener('mouseout', () => {
            if (sidebarSelectedID === id) return;
            this.setZIndexOffset(zIndex);
        });
        this.addEventListener('click', () => {
            showSidebar(id);
        });
        this.addEventListener('dblclick', () => {
            showSidebar(id);

            map.fitBounds(
                regionLayer ? regionLayer.getBounds() : new LatLngBounds([this.getLatLng()]), {
                padding: [50, 50],
                maxZoom: 20
            });
        })

        this.setZIndexOffset(zIndex);
        allPlaceMarkers.set(id, this);
    }
}) as unknown as new (feature: Feature<Geometry, any>, coords: LatLng, opts?: MarkerOptions) => Marker;

function refreshPlaceMarkers() {
    const zoom = map.getZoom();
    const width = innerWidth || body.clientWidth;
    const deviceZoomExtra = width < 800 ? 0.25 : 0;

    allPlaceMarkers.forEach((marker, id) => {
        // @ts-expect-error
        if (zoom >= marker.options.minZoom - deviceZoomExtra) {
            marker.addTo(map)
        } else {
            if (id === sidebarSelectedID) return;
            marker.remove();
        }
    });
}

function checkQuery() {
    QueryBuilder.refresh();

    if (QueryBuilder.has('s')) {
        search($searchbarFormInput.value = QueryBuilder.get('s')!.trim());
    } else {
        search('');
    }

    if (QueryBuilder.has('p')) {
        focusOnMarker(QueryBuilder.get('p')!);
    } else if (sidebarSelectedID) {
        hideSidebar();
    }

    if (QueryBuilder.has('v')) {
        autoShowStreetView(QueryBuilder.get('v')!)
    } else if (showingStreetView) {
        closeStreetView();
    }
}

addEventListener('popstate', () => setTimeout(() => checkQuery(), 10));

addEventListener('click', (e) => {
    if (!lastSearchTerm) return;

    const target = e.target as HTMLElement | null;

    if (!target) return;

    const parentElement = target.parentElement;
    if (!parentElement) return;

    if (
        parentElement === $searchbar ||
        parentElement === $searchbarForm ||
        parentElement === $searchbarList
    ) {
        return;
    }

    search('');
})

map.addEventListener('zoom', () => refreshPlaceMarkers());
map.addEventListener('click', () => {
    if (lastSearchTerm) return search('');
    if (draggingStreetview) return;

    if (sidebarSelectedID) hideSidebar()
});

const STYLE_WATER: PathOptions = {
    weight: 1,
    fillOpacity: 1,
    color: '#8ad8ec',
};
const STYLE_VEGETATION: PathOptions = {
    stroke: false,
    fillOpacity: 0.5,
    color: '#9ce9bc',
}

const STYLE_REGION: PathOptions = {
    stroke: true,
    fill: false,
    weight: 2,
    dashArray: [4],
    color: '#ed5f53'
}
const STYLE_REGION_STREETVIEW = {
    stroke: true,
    fill: false,
    weight: 1,
    dashArray: [],
    color: '#129eaf'
}
const STYLE_TRANSPARENT: PathOptions = {
    stroke: false,
    fill: false,
}
const STYLE_BG: PathOptions = {
    fillColor: '#8ad8ec',
    fillOpacity: 1,
    color: '#8ad8ec',
}

let placeDatabase: Record<string, SerializedPlace> = {};
let placeDatabaseDescriptions: Record<string, any> = {};

function pointToLayer(geoJsonPoint: Feature<Point, any>, latlng: LatLng): Layer {
    return new PlaceMarker(geoJsonPoint, latlng);
}

const layersOpts: Record<string, GeoJSONOptions | undefined> = {
    poly_ekkaia: {
        style: STYLE_TRANSPARENT
    },
    poly_bg: {
        style: STYLE_BG
    },
    poly_outline: {
        style: {
            stroke: false,
            fillColor: '#d0f6e0',
            fillOpacity: 1,
        }
    },
    poly_moor: {
        style: STYLE_VEGETATION
    },
    poly_highland: {
        style: {
            stroke: false,
            fillColor: '#f5f0e5',
            fillOpacity: 1,
        }
    },
    poly_forest: {
        style: STYLE_VEGETATION
    },
    poly_mountainlow: {
        style: {
            fillColor: '#000',
            stroke: false,
            fillOpacity: 0.03,
        }
    },
    poly_mountainhigh: {
        style: {
            fillColor: '#000',
            stroke: false,
            fillOpacity: 0.06,
        }
    },
    poly_lake: {
        style: STYLE_WATER
    },
    line_river: {
        style: STYLE_WATER
    },
    line_road: {
        style: {
            weight: 1,
            color: '#abbcd6',
        }
    },
    point_bridge: {
        pointToLayer
    },
    point_place: {
        pointToLayer
    },
    point_mount: {
        pointToLayer
    },
    point_ford: {
        pointToLayer
    },
    point_castletower: {
        pointToLayer
    },
    point_city: {
        pointToLayer
    },
    point_waterfall: {
        pointToLayer
    },
    poly_region: {
        style: STYLE_TRANSPARENT,
        onEachFeature(feature, layer) {
            feature.properties.size = 3;
            feature.properties.regionLayer = layer;

            layer.once('add', () => {
                new PlaceMarker(feature, (layer as Polygon).getCenter())
            })
        },
    },
}

fetchAsJson('db').then((db: SerializedGeoJSON[]) => {
    const featureTypes = [
        'Polygon',
        'MultiPolygon',
        'Point',
        'MultiPoint',
        'LineString',
        'MultiLineString',
    ] as const;
    const layers = db.reduce((acc, serializedFeatures) => {
        const layer = serializedFeatures.pop() as string;
        const features: Array<Feature> = (serializedFeatures as SerializedGeoJSONFeatures[]).map((feature) => {
            const [type, coordinates, placeData, size, zoom] = feature;
            const eventname = placeData ? placeData[0] : undefined;
            let geometry!: Geometry;
            let properties = {
                eventname,
                size,
                zoom,
                layer
            }

            if (eventname) {
                placeDatabase[eventname] = placeData as SerializedPlace;
            }

            if (layer === 'poly_lake' && eventname) {
                properties.eventname = `Lake_${eventname}`
            }

            if (featureTypes) {
                geometry = {
                    type: featureTypes[type - 1],
                    coordinates
                }
            }

            return {
                type: 'Feature',
                properties,
                geometry
            }
        });

        const geojson: FeatureCollection = {
            type: 'FeatureCollection',
            features
        }

        acc[layer] = new GeoJSON(geojson, layersOpts[layer]).addTo(map);

        return acc;
    }, {} as Record<string, GeoJSON>)

    const bounds = layers.poly_ekkaia.getBounds();
    map.setMaxBounds(bounds);
    map.fitBounds(bounds);
    map.setZoom(15.58);
    map.panTo(
        Browser.mobile ? [-0.010442351444596806, 0.03182722561510542] : [-0.01411707922568659, 0.0318476407694448], {
        animate: false
    })
    refreshPlaceMarkers();
    changeTitle('');
    checkQuery();
})
