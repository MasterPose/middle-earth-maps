import {
    closeExploreMenu,
    closeStreetView,
    hideSearchbarList,
    isExploreMenuOpen,
    showingSearchbarList,
    showingStreetView,
    sidebarSelectedID,
    hideSidebar
} from './app';


if (import.meta.env.VITE_CAPACITOR) {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', () => {
        if (showingSearchbarList()) hideSearchbarList();
        else if (isExploreMenuOpen()) closeExploreMenu();
        else if (showingStreetView) closeStreetView();
        else if (sidebarSelectedID) hideSidebar();
    });
}
