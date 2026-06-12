import { VIETNAM_BOUNDS, appState } from './config.js';
import { updateInfoPanel } from './ui.js';

const regionColors = [
    "#3388ff", // Default 
    "#e6194B", // Region 1 
    "#3cb44b", // Region 2 
    "#ffe119", // Region 3 
    "#4363d8", // Region 4 
    "#f58231", // Region 5 
    "#911eb4", // Region 6 
    "#42d4f4", // Region 7 
    "#f032e6", // Region 8 
    "#bfef45"  // Region 9 
];

function getRegionColor(regionId) {
    if (!regionId || regionId < 1) return regionColors[0];
    return regionColors[regionId % regionColors.length];
}

export function initMap() {
    appState.map = L.map('map').setView([15.8700, 106.6837], 6);
    appState.map.setMaxBounds(VIETNAM_BOUNDS);

    appState.map.on('drag', () => {
        if (!appState.mapLocked) appState.map.panInsideBounds(VIETNAM_BOUNDS, { animate: false });
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 20 }).addTo(appState.map);
}

export function lockMap() {
    appState.mapLocked = true;
    appState.map.options.maxBoundsViscosity = 1.0;
    appState.map.setMaxBounds(appState.map.getBounds().pad(0.02));
    appState.map.setMinZoom(appState.map.getZoom());
}

export function unlockMap() {
    appState.mapLocked = false;
    appState.map.options.maxBoundsViscosity = 0.0;
    appState.map.setMaxBounds(VIETNAM_BOUNDS);
    appState.map.setMinZoom(4);
}

export function renderMapElements() {
    clearMapElements();
    if (!appState.mapData) return;

    if (appState.mapData.roads) appState.mapData.roads.forEach(renderRoad);
    if (appState.mapData.intersections) appState.mapData.intersections.forEach(renderIntersection);
    if (appState.mapData.vehicles) appState.mapData.vehicles.forEach(renderVehicle);
}

function renderRoad(road) {
    if (!road.coordinates || road.coordinates.length < 2) return;
    const regionColor = getRegionColor(road.region);
    const polyline = L.polyline(road.coordinates, {
        color: regionColor,
        weight: road.width || 4,
        opacity: 0.8
    }).addTo(appState.map)
        .bindPopup(`<b>Road:</b> ${road.name || 'Unnamed'}<br><b>Region:</b> ${road.region || 'Unknown'}`);

    polyline.data = road;
    polyline.on('click', () => selectObject(road, 'road'));
}

function renderIntersection(intersection) {
    if (!intersection.coordinates) return;
    const regionColor = getRegionColor(intersection.region);
    const circle = L.circleMarker([intersection.coordinates[0], intersection.coordinates[1]], {
        color: "#ffffff",
        weight: 1.5,
        fillColor: regionColor,
        fillOpacity: 0.9,
        radius: 6
    }).addTo(appState.map)
        .bindPopup(`<b>Intersection ID:</b> ${intersection.id}<br><b>Region:</b> ${intersection.region || 'Unknown'}`);

    circle.data = intersection;
    circle.on('click', () => selectObject(intersection, 'intersection'));
}

function renderVehicle(vehicle) {
    if (!vehicle.coordinates) return;
    const marker = L.marker(vehicle.coordinates, {
        icon: L.icon({
            iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%234a90e2" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(appState.map);

    marker.data = vehicle;
    marker.on('click', () => selectObject(vehicle, 'vehicle'));
}

export function clearMapElements() {
    appState.map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) appState.map.removeLayer(layer);
        else if (layer instanceof L.CircleMarker) appState.map.removeLayer(layer);
        else if (layer instanceof L.Marker && layer.getIcon().options.iconUrl) appState.map.removeLayer(layer);
    });
}

function selectObject(obj, type) {
    appState.selectedObject = { data: obj, type: type };
    updateInfoPanel();
}