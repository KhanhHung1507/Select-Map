// ==========================================
// BASIC CONFIGURATION & GLOBAL VARIABLES
// ==========================================
let map, mapData = null, mapLocked = false;
const VIETNAM_BOUNDS = [[8.5, 102.0], [23.5, 109.5]];
const BACKEND_URL = 'http://127.0.0.1:8080';

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
});

// Initialize Leaflet map
function initMap() {
    map = L.map('map').setView([15.8700, 106.6837], 6); // Center of Vietnam
    map.setMaxBounds(VIETNAM_BOUNDS);
    
    // Restrict to Vietnam bounds only if the map is not locked
    map.on('drag', () => { 
        if (!mapLocked) map.panInsideBounds(VIETNAM_BOUNDS, { animate: false }); 
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 20 }).addTo(map);
}

// ==========================================
// DATA PROCESSING & BACKEND COMMUNICATION
// ==========================================
async function confirmMapSelection() {
    if (map.getZoom() < 15) {
        return alert("Please zoom in closer (level 15+) to avoid server overload!");
    }

    //Notification Waiting to get Data
    const confirmBtn = document.getElementById('confirmMapBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = "⏳ Getting Data & Processing Algorithm...";
    confirmBtn.style.cursor = "wait";

    lockMap(); // Lock the camera immediately
    const b = map.getBounds();
    const mapBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };

    try {
        console.log('[Frontend] 1. Fetching data from Overpass API...');
        // 1. Fetch data from Overpass API (Using JS to avoid complex SSL libs in C++)
        const query = `[out:json][timeout:25];(way["highway"](${mapBounds.south}, ${mapBounds.west}, ${mapBounds.north}, ${mapBounds.east}););out body;>;out skel qt;`;
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const { elements } = await res.json();

        console.log('[Frontend] 2. Processing and cleaning data with Layer Check...');
        // 2. Data Pre-processing: Simplify using Object and Array methods
        const nodes = elements.filter(e => e.type === 'node').reduce((acc, n) => { 
            acc[n.id] = [n.lat, n.lon]; 
            return acc; 
        }, {});
        
        // We use nodeUsage to store the frequence of each Layer
        const nodeUsage = {}; 
        const roads = [];

        // Browsing all ways
        elements.filter(e => e.type === 'way' && e.nodes).forEach(way => {
            // Get layer of Road (if don't have tag, the default tag will 0)
            const layer = way.tags?.layer ? parseInt(way.tags.layer) : 0;

            const coords = way.nodes.map(id => {
                if (nodes[id]) {
                    if (!nodeUsage[id]) nodeUsage[id] = {};
                    // Count the times appearance of this node was used on the same layer
                    nodeUsage[id][layer] = (nodeUsage[id][layer] || 0) + 1; 
                }
                return nodes[id];
            }).filter(Boolean);

            if (coords.length > 1) {
                roads.push({
                    id: way.id,
                    name: way.tags?.name || `Road ${way.tags?.highway || ''}`,
                    type: "road", 
                    layer: layer, // Store layer to convert C++
                    width: 1,
                    coordinates: coords
                });
            }
        });

        // Filter Intersection: Only take intersection points on the SAME LAYER
        const intersections = [];
        Object.entries(nodeUsage).forEach(([id, layers]) => {
            Object.entries(layers).forEach(([layer, count]) => {
                if (count > 1 && nodes[id]) {
                    intersections.push({ 
                        id: Number(id), 
                        type: "intersection", 
                        layer: parseInt(layer),
                        coordinates: nodes[id] 
                    });
                }
            });
        });

        console.log('[Frontend] 3. Sending processed data to C++ Backend...');
        // 3. Send "clean" data to C++ Backend for storage
        const finalData = { bounds: mapBounds, roads, intersections, vehicles: [] };
        const cppRes = await fetch(`${BACKEND_URL}/api/confirm-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalData)
        });

        if (!cppRes.ok) throw new Error("Backend C++ refused to save the file!");

        console.log('[Frontend] 4. Setup successful. Switching UI mode.');
        // 4. Switch UI to Simulation mode
        document.getElementById('initialControls').classList.add('hidden');
        document.getElementById('simulationControls').classList.remove('hidden');
        
        mapData = finalData;
        renderMapElements(); // Render lines and markers on the map

    } catch (error) {
        console.error('[Frontend] Error:', error);
        alert(error.message);
        unlockMap(); // Unlock map if an error occurs
    } finally {
        // --- Return the original status ---
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Map Selection";
        confirmBtn.style.cursor = "pointer";
    }
}

// ==========================================
// UI HELPER FUNCTIONS
// ==========================================
function lockMap() {
    mapLocked = true;
    map.options.maxBoundsViscosity = 1.0;
    map.setMaxBounds(map.getBounds().pad(0.02)); // Pad 2% to prevent Leaflet bouncing glitches
    map.setMinZoom(map.getZoom());
}

function unlockMap() {
    mapLocked = false;
    map.options.maxBoundsViscosity = 0.0;
    map.setMaxBounds(VIETNAM_BOUNDS);
    map.setMinZoom(4);
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
        // Fallback to local traffic_network.json if backend unavailable
        loadLocalMapData();
    }
}

// Load local traffic_network.json as fallback
async function loadLocalMapData() {
    try {
        const response = await fetch('../data/traffic_network.json');
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