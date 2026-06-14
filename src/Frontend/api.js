import { BACKEND_URL, appState } from './config.js';
import { lockMap, unlockMap, renderMapElements } from './map.js';

// Global variables to manage the timer and the abort functionality
let mapTimer = null;
let fetchController = null; 

// Triggered when the user clicks the "Stop" button
export function cancelMapSelection() {
    if (fetchController) {
        fetchController.abort(); // Send an abort signal to terminate the fetch requests
    }
}

export async function confirmMapSelection() {
    const confirmBtn = document.getElementById('confirmMapBtn');
    const stopBtn = document.getElementById('stopMapBtn'); 

    // Guard clause: Prevent spam clicking
    if (confirmBtn.disabled === true) {
        return; 
    }
    
    if (appState.map.getZoom() < 15) {
        return alert("Please zoom in closer (level 15+) to avoid server overload!");
    }

    // Clear existing timer to prevent ghost timers
    if (mapTimer) {
        clearInterval(mapTimer);
        mapTimer = null;
    }

    // Initialize AbortController for cancelable requests
    fetchController = new AbortController();
    const signal = fetchController.signal;

    // Update UI: Lock Confirm button, show Stop button
    confirmBtn.disabled = true;
    confirmBtn.style.pointerEvents = "none";
    confirmBtn.style.cursor = "wait";
    
    if (stopBtn) {
        stopBtn.classList.remove('hidden');
        stopBtn.style.display = "inline-block";
        stopBtn.onclick = cancelMapSelection; 
    }

    // Initialize UI Timer
    let secondsElapsed = 0;
    confirmBtn.textContent = `⏳ Getting Data... (0s)`;
    
    mapTimer = setInterval(() => {
        secondsElapsed++;
        confirmBtn.textContent = `⏳ Getting Data... (${secondsElapsed}s)`;
    }, 1000);

    lockMap();
    const b = appState.map.getBounds();
    const mapBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };

    try {
        console.log('[Frontend] 1. Fetching data from Overpass API...');
        
        const query = `[out:json][timeout:60];(way["highway"]["highway"!~"footway|path|steps|cycleway|pedestrian|service|track"](${mapBounds.south}, ${mapBounds.west}, ${mapBounds.north}, ${mapBounds.east}););out body;>;out skel qt;`;
        
        const OVERPASS_ENDPOINTS = [
            "https://overpass-api.de/api/interpreter", 
            "https://overpass.openstreetmap.fr/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter"
        ];

        let response = null;
        let successfulEndpoint = "";

        // Fallback mechanism: Try multiple servers if one fails
        for (const endpoint of OVERPASS_ENDPOINTS) {
            try {
                console.log(`Trying to connect: ${endpoint}`);
                // Inject 'signal' to allow network abortion
                response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, { signal });
                
                if (response.ok) {
                    successfulEndpoint = endpoint;
                    break; 
                }
            } catch (err) {
                // If the error is caused by the user aborting, break the loop immediately
                if (err.name === 'AbortError') throw err;
                console.warn(`Server ${endpoint} responding too slowly, switching...`);
            }
        }

        if (!response || !response.ok) {
            throw new Error(`The entire Overpass satellite system is overloaded (Error 504). Please circle the map or try again in a few minutes!`);
        }

        console.log(`[Frontend] Get data successfully!: ${successfulEndpoint}`);
        const { elements } = await response.json();

        console.log('[Frontend] 2. Processing and cleaning data with Layer Check...');
        const nodes = elements.filter(e => e.type === 'node').reduce((acc, n) => { 
            acc[n.id] = [n.lat, n.lon]; 
            return acc; 
        }, {});
        
        const nodeUsage = {}; 
        const roads = [];

        elements.filter(e => e.type === 'way' && e.nodes).forEach(way => {
            const layer = way.tags?.layer ? parseInt(way.tags.layer) : 0;
            const isOneWay = (way.tags?.oneway === 'yes' || way.tags?.oneway === 'true' || way.tags?.oneway === '1');
            const laneCount = way.tags?.lanes ? parseInt(way.tags.lanes) : (isOneWay ? 1 : 2);

            const coords = way.nodes.map(id => {
                if (nodes[id]) {
                    nodeUsage[id] = (nodeUsage[id] || 0) + 1; 
                }
                return nodes[id];
            }).filter(Boolean);

            if (coords.length > 1) {
                roads.push({
                    id: way.id,
                    name: way.tags?.name || `Road ${way.tags?.highway || ''}`,
                    type: "road", 
                    layer: layer,
                    oneway: isOneWay,
                    lanes: laneCount,
                    width: laneCount * 2, 
                    coordinates: coords
                });
            }
        });

        const intersections = [];
        Object.entries(nodeUsage).forEach(([id, count]) => {
            if (count > 1 && nodes[id]) {
                intersections.push({ 
                    id: Number(id), 
                    type: "intersection", 
                    layer: 0, 
                    coordinates: nodes[id] 
                });
            }
        });

        console.log('[Frontend] 3. Sending processed data to C++ Backend...');
        const finalData = { bounds: mapBounds, roads, intersections, vehicles: [] };
        
        // Pass the abort signal to the backend request as well
        const cppRes = await fetch(`${BACKEND_URL}/api/confirm-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalData),
            signal 
        });

        if (!cppRes.ok) throw new Error("Backend C++ refused to save the file!");

        const cleanDataFromCpp = await cppRes.json();

        console.log('[Frontend] 4. Setup successful. Switching UI mode.');
        document.getElementById('initialControls').classList.add('hidden');
        document.getElementById('simulationControls').classList.remove('hidden');
        
        appState.mapData = cleanDataFromCpp;
        renderMapElements();

    } catch (error) {
        // Stop timer immediately to prevent ghost counting behind the alert
        if (mapTimer) {
            clearInterval(mapTimer);
            mapTimer = null;
        }

        // Handle user cancellation gracefully
        if (error.name === 'AbortError') {
            console.warn('[Frontend] Process aborted by user.');
        } else {
            console.error('[Frontend] Error:', error);
            alert(error.message);
        }
        
        unlockMap();
    } finally {
        // Clean up resources
        if (mapTimer) {
            clearInterval(mapTimer);
            mapTimer = null;
        }
        fetchController = null; 
        
        // Restore UI to initial state
        confirmBtn.disabled = false;
        confirmBtn.style.pointerEvents = "auto";
        confirmBtn.textContent = "Confirm Map Selection";
        confirmBtn.style.cursor = "pointer";

        // Hide the Stop button
        if (stopBtn) {
            stopBtn.classList.add('hidden');
            stopBtn.style.display = "none";
        }
    }
}