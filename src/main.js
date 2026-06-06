// Global variables
let map;
let mapLocked = false;
let selectedObject = null;
let mapData = null;
const VIETNAM_BOUNDS = [
    [8.5, 102.0],    // Southwest
    [23.5, 109.5]    // Northeast
];
const VIETNAM_CENTER = [15.8700, 106.6837]; // Hanoi
const BACKEND_URL = 'http://127.0.0.1:8080';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    loadMapData();
});

// Initialize Leaflet map
function initMap() {
    map = L.map('map').setView(VIETNAM_CENTER, 6);

    // Restrict map bounds to Vietnam initially
    map.setMaxBounds(VIETNAM_BOUNDS);
    
    // CRITICAL FIX: Only restrict to Vietnam bounds if the map is NOT locked
    map.on('drag', function () {
        if (!mapLocked) {
            map.panInsideBounds(VIETNAM_BOUNDS, { animate: false });
        }
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        minZoom: 4,
        maxZoom: 18
    }).addTo(map);

    // Make map draggable initially
    map.dragging.enable();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('confirmMapBtn').addEventListener('click', confirmMapSelection);
    document.getElementById('pauseBtn').addEventListener('click', togglePauseMenu);
    document.getElementById('resumeBtn').addEventListener('click', resumeSimulation);
    document.getElementById('selectNewMapBtn').addEventListener('click', selectNewMap);
    document.getElementById('addRoadBtn').addEventListener('click', () => addElement('road'));
    document.getElementById('addVehicleBtn').addEventListener('click', () => addElement('vehicle'));
    document.getElementById('addIntersectionBtn').addEventListener('click', () => addElement('intersection'));

    // Map click event for selecting elements
    map.on('click', onMapClick);

    map.on('zoomend', checkZoomState);
    map.on('moveend', checkZoomState);
    checkZoomState();
}

// Confirm map selection, lock boundaries, and fetch real-world data
async function confirmMapSelection() {
    // LOCK MAP BOUNDARIES IMMEDIATELY
    lockMap();
    
    // Update UI status to processing
    const confirmBtn = document.getElementById('confirmMapBtn');
    confirmBtn.textContent = 'Processing Data...';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.7';

    const bounds = map.getBounds();
    const mapBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
    };

    try {
        console.log('1. Fetching real-world map data from Overpass API...');
        const overpassQuery = `
            [out:json][timeout:25];
            (way["highway"](${mapBounds.south}, ${mapBounds.west}, ${mapBounds.north}, ${mapBounds.east}););
            out body; >; out skel qt;
        `;
        
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
        const overpassResponse = await fetch(overpassUrl);
        if (!overpassResponse.ok) throw new Error('Failed to fetch data from Overpass API');
        const overpassData = await overpassResponse.json();

        console.log('2. Processing coordinates to extract roads and intersections...');
        const nodes = {};
        const nodeCount = {}; 
        const roads = [];
        const intersections = [];

        overpassData.elements.forEach(el => {
            if (el.type === 'node') nodes[el.id] = [el.lat, el.lon];
        });

        overpassData.elements.forEach(el => {
            if (el.type === 'way' && el.nodes) {
                const roadCoords = [];
                el.nodes.forEach(nodeId => {
                    if (nodes[nodeId]) {
                        roadCoords.push(nodes[nodeId]);
                        nodeCount[nodeId] = (nodeCount[nodeId] || 0) + 1;
                    }
                });
                if (roadCoords.length > 1) {
                    roads.push({
                        id: el.id,
                        name: el.tags?.name || (el.tags?.highway ? `Highway ${el.tags.highway}` : "Unnamed Road"),
                        type: el.tags?.highway || "road",
                        width: 4, 
                        color: "#667eea",
                        coordinates: roadCoords
                    });
                }
            }
        });

        for (const [nodeId, count] of Object.entries(nodeCount)) {
            if (count > 1 && nodes[nodeId]) {
                intersections.push({
                    id: parseInt(nodeId),
                    name: "Intersection " + nodeId,
                    type: "intersection",
                    color: "#ff4500",
                    coordinates: nodes[nodeId]
                });
            }
        }

        const realMapData = {
            bounds: mapBounds, roads: roads, intersections: intersections, vehicles: []
        };

        console.log('3. Sending processed data to C++ Backend...');
        const response = await fetch(`${BACKEND_URL}/api/confirm-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(realMapData)
        });

        if (!response.ok) throw new Error(`Backend server error: ${await response.text()}`);
        
        console.log('4. Triggering map.json download...');
        const responseData = await response.text();
        const blob = new Blob([responseData], { type: "application/json" });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'map.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        // Switch UI to Simulation Mode
        document.getElementById('initialControls').classList.add('hidden');
        document.getElementById('simulationControls').classList.remove('hidden');
        document.getElementById('mapStatus').textContent = 'Map Locked';
        document.getElementById('mapStatus').classList.remove('unlocked');
        document.getElementById('mapStatus').classList.add('locked');

        await loadMapData();

    } catch (error) {
        console.error('Operation failed:', error);
        alert(`An error occurred:\n${error.message}`);
        unlockMap();
    } finally {
        confirmBtn.textContent = 'Confirm Map Selection';
    }
}

// Lock the camera strictly to the current view (Hard Lockcam)
function lockMap() {
    mapLocked = true;
    
    const currentBounds = map.getBounds();
    const currentZoom = map.getZoom();
    
    console.log(`[System] Camera hard locked at zoom level ${currentZoom}`);
    
    // Set absolute solid invisible wall (viscosity 1.0 means no elasticity)
    map.options.maxBoundsViscosity = 1.0;
    map.setMaxBounds(currentBounds);
    
    // Prevent zooming out past the camera's original lock state
    map.setMinZoom(currentZoom);
    
    // Clear dynamic UI warning messages if any
    const warningMsg = document.getElementById('zoomWarning');
    if (warningMsg) warningMsg.textContent = '';
}

// Unlock the camera and restore free roam capability
function unlockMap() {
    mapLocked = false;
    
    console.log('[System] Camera unlocked back to free roam');
    
    // Disable the solid boundary effect
    map.options.maxBoundsViscosity = 0.0;
    
    // Restore default configuration values
    map.setMaxBounds(VIETNAM_BOUNDS);
    map.setMinZoom(4); // Match the original minZoom from initMap setup
    
    // Re-evaluate the dynamic UI controls immediately
    checkZoomState();
}

// Toggle pause menu
function togglePauseMenu() {
    const pauseMenu = document.getElementById('pauseMenu');
    pauseMenu.classList.toggle('hidden');
}

// Resume simulation
function resumeSimulation() {
    document.getElementById('pauseMenu').classList.add('hidden');
}

// Select new map
function selectNewMap() {
    unlockMap();
    mapData = null;
    selectedObject = null;

    document.getElementById('initialControls').classList.remove('hidden');
    document.getElementById('simulationControls').classList.add('hidden');
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('mapStatus').textContent = 'Map Unlocked';
    document.getElementById('mapStatus').classList.add('unlocked');
    document.getElementById('mapStatus').classList.remove('locked');

    clearMapElements();
}

// Add element (road, vehicle, intersection)
function addElement(type) {
    alert(`Add ${type} mode activated. Click on the map to place a new ${type}.`);
    // This would be implemented based on specific requirements
}

// Load map data from backend
async function loadMapData() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/map-data`); // Chuyển thành GET và đúng endpoint
        if (!response.ok) throw new Error('Failed to load map data');

        mapData = await response.json();
        renderMapElements();
    } catch (error) {
        console.error('Error loading map data:', error);
        // Fallback to local map.json if backend unavailable
        loadLocalMapData();
    }
}

// Load local map.json as fallback
async function loadLocalMapData() {
    try {
        const response = await fetch('../data/map.json');
        if (!response.ok) throw new Error('Failed to load local map data');

        mapData = await response.json();
        renderMapElements();
    } catch (error) {
        console.error('Error loading local map data:', error);
        mapData = { roads: [], intersections: [], vehicles: [] };
    }
}

// Render map elements
function renderMapElements() {
    clearMapElements();

    if (!mapData) return;

    // Render roads
    if (mapData.roads) {
        mapData.roads.forEach(road => {
            renderRoad(road);
        });
    }

    // Render intersections
    if (mapData.intersections) {
        mapData.intersections.forEach(intersection => {
            renderIntersection(intersection);
        });
    }

    // Render vehicles
    if (mapData.vehicles) {
        mapData.vehicles.forEach(vehicle => {
            renderVehicle(vehicle);
        });
    }
}

// Render a road
function renderRoad(road) {
    if (!road.coordinates || road.coordinates.length < 2) return;

    const polyline = L.polyline(road.coordinates, {
        color: road.color || '#666',
        weight: road.width || 3,
        opacity: 0.8
    }).addTo(map);

    polyline.data = road;
    polyline.on('click', () => selectObject(road, 'road'));
}

// Render an intersection
function renderIntersection(intersection) {
    if (!intersection.coordinates) return;

    const circle = L.circleMarker(intersection.coordinates, {
        radius: 8,
        fillColor: intersection.color || '#ff7f50',
        color: '#ff4500',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.8
    }).addTo(map);

    circle.data = intersection;
    circle.on('click', () => selectObject(intersection, 'intersection'));
}

// Render a vehicle
function renderVehicle(vehicle) {
    if (!vehicle.coordinates) return;

    const marker = L.marker(vehicle.coordinates, {
        icon: L.icon({
            iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="%234a90e2" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm11 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(map);

    marker.data = vehicle;
    marker.on('click', () => selectObject(vehicle, 'vehicle'));
}

// Handle map click
function onMapClick(event) {
    // Click on empty map area will deselect
    if (event.originalEvent.target === map._container) {
        selectedObject = null;
        updateInfoPanel();
    }
}

// Select an object
function selectObject(obj, type) {
    selectedObject = { data: obj, type: type };
    updateInfoPanel();
}

// Update information panel
function updateInfoPanel() {
    const infoContent = document.getElementById('infoContent');

    if (!selectedObject) {
        infoContent.innerHTML = '<p style="color: #999; font-size: 12px;">Click on a road, intersection, or vehicle to view details.</p>';
        return;
    }

    const { data, type } = selectedObject;
    let html = `<div class="info-item">
        <div class="info-label">Type</div>
        <div class="info-value">${type.toUpperCase()}</div>
    </div>`;

    for (const [key, value] of Object.entries(data)) {
        if (key !== 'coordinates' && key !== 'color' && key !== 'width') {
            html += `<div class="info-item">
                <div class="info-label">${key}</div>
                <div class="info-value">${JSON.stringify(value)}</div>
            </div>`;
        }
    }

    if (data.coordinates) {
        html += `<div class="info-item">
            <div class="info-label">Coordinates</div>
            <div class="info-value">${JSON.stringify(data.coordinates)}</div>
        </div>`;
    }

    infoContent.innerHTML = html;
}

// Clear all map elements
function clearMapElements() {
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
            map.removeLayer(layer);
        } else if (layer instanceof L.CircleMarker) {
            map.removeLayer(layer);
        } else if (layer instanceof L.Marker && layer.getIcon().options.iconUrl) {
            map.removeLayer(layer);
        }
    });
}

// Check current zoom level and update UI dynamically
function checkZoomState() {
    if (mapLocked) return; // Do nothing if the map is already locked

    const currentZoom = map.getZoom();
    const confirmBtn = document.getElementById('confirmMapBtn');
    let warningMsg = document.getElementById('zoomWarning');

    // Create the warning message element dynamically if it doesn't exist
    if (!warningMsg) {
        warningMsg = document.createElement('div');
        warningMsg.id = 'zoomWarning';
        warningMsg.style.color = '#e74c3c'; // Red error color
        warningMsg.style.fontSize = '12px';
        warningMsg.style.marginTop = '10px';
        warningMsg.style.fontWeight = '600';
        // Insert it right below the confirm button
        confirmBtn.parentNode.insertBefore(warningMsg, confirmBtn.nextSibling);
    }

    if (currentZoom < 16) {
        // Disable button, fade it out, and show warning text
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
        warningMsg.textContent = `Current zoom: ${currentZoom}. Please zoom in to level 15+ to confirm.`;
    } else {
        // Enable button, restore full color, and hide warning
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
        warningMsg.textContent = ''; 
    }
}