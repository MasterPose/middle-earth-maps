import type { Feature, GeometryObject, Point } from 'geojson';
import * as L from 'leaflet';
import './style.css'
import MiniSearch from 'minisearch';

const $app = document.querySelector<HTMLDivElement>('#app')!;
const $sidebar = document.querySelector<HTMLDivElement>('#sidebar')!;
const $sidebarName = $sidebar.querySelector<HTMLHeadingElement>('header>.title>h2')!;
const $sidebarRegion = $sidebar.querySelector<HTMLHeadingElement>('header>.title>p')!;

// const $sidebarMainPicture = $sidebar.querySelector<HTMLDivElement>('.picture')!;
const $sidebarMainPictureImage = $sidebar.querySelector<HTMLImageElement>('.picture>img')!;

// const $sidebarData = $sidebar.querySelector<HTMLDivElement>('#basic-data')!;
const $sidebarDataDescription = $sidebar.querySelector<HTMLParagraphElement>('#basic-data>p')!;
const $sidebarDataLearnMore = $sidebar.querySelector<HTMLAnchorElement>('#basic-data>a')!;

const $sidebarMedia = $sidebar.querySelector<HTMLDivElement>('#media')!;
const $sidebarMediaGallery = $sidebar.querySelector<HTMLDivElement>('#media>.gallery')!;

const $sidebarKnownAs = $sidebar.querySelector<HTMLDivElement>('#also-known')!;
const $sidebarKnownAsList = $sidebar.querySelector<HTMLUListElement>('#also-known>ul')!;

const $seachbar = document.querySelector<HTMLDivElement>('#searchbar')!;
const $seachbarForm = $seachbar.querySelector<HTMLFormElement>('form')!;
const $seachbarFormInput = $seachbarForm.querySelector<HTMLInputElement>('input')!;
const $seachbarList = $seachbar.querySelector<HTMLUListElement>('ul')!;

$sidebar.style.display = '';

const ZOOM_MAX = 22;
const ZOOM_MIN = 15.58;

const map = L.map($app, {
    center: [0, 0],
    maxZoom: ZOOM_MAX,
    minZoom: ZOOM_MIN,
    zoomSnap: 0,
    zoomDelta: 0.25,
    zoomControl: false,
});
map.attributionControl.setPrefix('Made using Leaflet. Map data by Arda Maps. Middle-Earth Maps is not affiliated with the aforementioned, Middle-Earth Enterprises, the Tolkien State nor Google Maps.');

let miniSearch: MiniSearch;
let lastSearchTerm: string;

function saveSearch(term: string) {
    if (term) {
        url.searchParams.set('s', term);
    } else {
        url.searchParams.delete('s')
    }

    window.history.pushState({ path: url.href }, '', url.href);
}

function saveSelected(id: string = '') {
    if (id) {
        url.searchParams.set('p', id);
    } else {
        url.searchParams.delete('p')
    }

    window.history.pushState({ path: url.href }, '', url.href);
}

function search(term: string) {
    lastSearchTerm = term = term.trim();
    saveSearch(term);

    if (!term) {
        $seachbar.classList.remove('has-items');
        return;
    }

    const result = miniSearch.search(term, {
        fuzzy: 0.5,
        boost: {
            'name': 2,
        },
    }).slice(0, 10).filter((v) => allPlaceMarkers.has(v.id));

    if (result.length) {
        $seachbar.classList.add('has-items');

        $seachbarList.innerHTML = result.map((v) => `<li data-id="${v.id}">${v.name}</li>`).join('');
    } else {
        $seachbar.classList.remove('has-items');
    }
}

function focusOnMarker(id?: string) {
    if (!id) return;

    const marker = allPlaceMarkers.get(id);
    if (!marker) return;

    // @ts-expect-error
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), marker.options.minZoom));
    showSidebar(id);
}

fetch('search.json').then((v) => v.text()).then((searchIndex) => {
    $seachbar.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;

        if (!target) return;
        if (!target.parentElement) return;
        if (target.parentElement !== $seachbarList) return;

        focusOnMarker(target.dataset.id);;
    });
    miniSearch = MiniSearch.loadJSON(searchIndex, {
        fields: ['name', 'searchAltname', 'searchRegion'],
        storeFields: ['name', 'region']
    });


    $seachbarForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        search($seachbarFormInput.value);
    })
    $seachbarFormInput.addEventListener('focus', () => search($seachbarFormInput.value));
    $seachbarFormInput.addEventListener('input', () => search($seachbarFormInput.value));
}).catch((e) => {
    console.error(e);
    $seachbar.classList.add('hidden');
});

L.control.zoom({
    position: 'bottomright'
}).addTo(map);

function changeTitle(title?: string) {
    document.title = title ? `${title} - Middle-Earth Maps` : `Middle-Earth Maps`;
}

function getPlaceInfo(id: string, type?: PLACE_TYPE) {
    const entry = placeDatabase[id];
    const placeConfig = type ? PLACE_CONFIG[type] : undefined;

    const name: string = entry.name;
    const zoom: number = entry.zoom;

    const color = placeConfig?.color;
    const icon = placeConfig?.icon;

    return {
        name,
        color,
        icon,
        zoom
    }
}

let sidebarSelectedID: string | undefined;
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
        }
        if (curMarker) {
            const curMarkerEl = (curMarker.getElement() ?? curMarker.addTo(map).getElement())?.firstElementChild;
            curMarkerEl?.classList.add('active');
            curMarker.setZIndexOffset(9999);
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

    const region: string[] = info.region;
    const mainPicture: string = info.mainPicture;
    const link: string = info.link;
    const images: string[] = info.images;
    const knownAs: string[] = info.altname;

    const name = info.name;

    $sidebar.classList.remove('hidden');
    $sidebarName.innerText = name;
    $seachbarFormInput.value = name;

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

    if (description) {
        $sidebarDataDescription.classList.remove('hidden');
        $sidebarDataDescription.innerText = description;
    } else {
        $sidebarDataDescription.classList.add('hidden');
    }

    $sidebarDataLearnMore.href = link;

    if (images?.length) {
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

    if (knownAs?.length) {
        $sidebarKnownAs.classList.remove('hidden');
        $sidebarKnownAsList.innerHTML = knownAs.map((v) => `<li>${v}</li>`).join('');
    } else {
        $sidebarKnownAs.classList.add('hidden');
    }

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

const PlaceMarker = L.Marker.extend({
    initialize: function (
        feature: Feature<Point, any>,
        coords: L.LatLng,
        opts: L.MarkerOptions = {},
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
            'point_city'
        ].includes(type)

        const size = withoutIcon ? Math.max(featureProps.size, 1) : featureProps.size || 1;
        const minZoom: number = Math.min(ZOOM_MIN - 1 + zoom - (size / 2), 19);

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


        opts.icon = L.divIcon({
            html,
            iconSize: [32, 32]
        });

        // @ts-expect-error
        L.Marker.prototype.initialize.call(this, coords, {
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

        this.setZIndexOffset(zIndex);
        allPlaceMarkers.set(id, this);
    }
}) as unknown as new (feature: Feature<Point, any>, coords: L.LatLng, opts?: L.MarkerOptions) => L.Marker;

function refreshPlaceMarkers() {
    const zoom = map.getZoom();
    allPlaceMarkers.forEach((marker, id) => {
        // @ts-expect-error
        if (zoom >= marker.options.minZoom) {
            marker.addTo(map)
        } else {
            if (id === sidebarSelectedID) return;
            marker.remove();
        }
    });
}

window.addEventListener('click', (e) => {
    if (!lastSearchTerm) return;

    const target = e.target as HTMLElement | null;

    if (!target) return;

    const parentElement = target.parentElement;
    if (!parentElement) return;

    if (
        parentElement === $seachbar ||
        parentElement === $seachbarForm ||
        parentElement === $seachbarList
    ) {
        return;
    }

    search('');
})
map.addEventListener('zoom', () => refreshPlaceMarkers());
map.addEventListener('click', () => {
    if (lastSearchTerm) return search('');

    if (sidebarSelectedID) {
        showSidebar(undefined);
    }

});

const STYLE_WATER: L.PathOptions = {
    weight: 1,
    fillOpacity: 1,
    color: '#8ad8ec',
};
const STYLE_VEGETATION: L.PathOptions = {
    stroke: false,
    fillOpacity: 0.5,
    color: '#9ce9bc',
}
const STYLE_TRANSPARENT: L.PathOptions = {
    stroke: false,
    fill: false,
}
const STYLE_BG: L.PathOptions = {
    fillColor: '#8ad8ec',
    fillOpacity: 1,
    color: '#8ad8ec',
}

let placeDatabase: Record<string, any> = {};
let placeDatabaseDescriptions: Record<string, any> = {};

function pointToLayer(geoJsonPoint: Feature<Point, any>, latlng: L.LatLng): L.Layer {
    return new PlaceMarker(geoJsonPoint, latlng);
}

const layersOpts: Record<string, L.GeoJSONOptions | undefined> = {
    poly_ekkaia: {
        style: STYLE_TRANSPARENT
    },
    poly_bg: {
        style: STYLE_BG
    },
    poly_outline: {
        style: {
            stroke: false,
            fillColor: '#d3f8e2',
            fillOpacity: 1,
        }
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
    poly_moor: {
        style: STYLE_VEGETATION
    },
    poly_forest: {
        style: STYLE_VEGETATION
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
}

const layersPromises = Object.keys(layersOpts).map(async (layerName) => {
    const retrieveFiles = async () => {
        return await fetch(`data/${layerName}.geojson`).then((v) => v.text()).then((v) => JSON.parse(v));
    }
    return [layerName, await retrieveFiles()] as const;
})

const url = new URL(window.location.href);

Promise.all(layersPromises).then((data) => Object.fromEntries(data)).then(async (data) => {
    const alreadyAddedIds = new Set<string>();

    placeDatabase = await fetch('db.json').then((v) => v.json());
    placeDatabaseDescriptions = await fetch('db-descriptions.json').then((v) => v.json());


    const layers: Record<string, L.GeoJSON<any, GeometryObject>> = {};
    for (const key in data) {
        const geojson = data[key];

        geojson.features.forEach((v: any) => {
            v.properties = v.properties || {};
            v.properties.layer = key;
        });

        geojson.features = geojson.features.filter((v: any) => {
            const id = v.properties.eventname;

            if (!id) return true;

            if (!alreadyAddedIds.has(id)) {
                alreadyAddedIds.add(id);
                return true;
            }

            return false;
        });

        const layer = L.geoJSON(geojson, layersOpts[key]).addTo(map);
        layers[key] = layer;
    }

    const bounds = layers.poly_ekkaia.getBounds();
    map.setMaxBounds(bounds);
    map.fitBounds(bounds);
    map.setZoom(15.58);
    refreshPlaceMarkers();

    const searchQuery = url.searchParams.get('s');
    const placeQuery = url.searchParams.get('p');

    if (searchQuery) {
        $seachbarFormInput.value = searchQuery.trim();
        search(searchQuery);
    }

    if (placeQuery) {
        focusOnMarker(placeQuery);
    }
})
