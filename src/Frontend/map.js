import { VIETNAM_BOUNDS, appState } from './config.js';
import { updateInfoPanel } from './ui.js';

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
    const polyline = L.polyline(road.coordinates, {
        color: road.color || '#666',
        weight: road.width || 3,
        opacity: 0.8
    }).addTo(appState.map);

    polyline.data = road;
    polyline.on('click', () => selectObject(road, 'road'));
}

function renderIntersection(intersection) {
    if (!intersection.coordinates) return;
    const circle = L.circleMarker(intersection.coordinates, {
        radius: 8,
        fillColor: intersection.color || '#ff7f50',
        color: '#ff4500',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.8
    }).addTo(appState.map);

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