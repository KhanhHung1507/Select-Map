import { BACKEND_URL, appState } from './config.js';
import { lockMap, unlockMap, renderMapElements } from './map.js';

export async function confirmMapSelection() {
    if (appState.map.getZoom() < 15) {
        return alert("Please zoom in closer (level 15+) to avoid server overload!");
    }

    const confirmBtn = document.getElementById('confirmMapBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = "⏳ Getting Data & Processing Algorithm...";
    confirmBtn.style.cursor = "wait";

    lockMap();
    const b = appState.map.getBounds();
    const mapBounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };

    try {
        console.log('[Frontend] 1. Fetching data from Overpass API...');
        const query = `[out:json][timeout:25];(way["highway"](${mapBounds.south}, ${mapBounds.west}, ${mapBounds.north}, ${mapBounds.east}););out body;>;out skel qt;`;
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
        const { elements } = await res.json();

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
                    if (!nodeUsage[id]) nodeUsage[id] = {};
                    nodeUsage[id][layer] = (nodeUsage[id][layer] || 0) + 1; 
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
                    // ---------------------------------------
                    
                    width: laneCount * 2, 
                    coordinates: coords
                });
            }
        });

        const intersections = [];
        Object.entries(nodeUsage).forEach(([id, layers]) => {
            Object.entries(layers).forEach(([layer, count]) => {
                if (count > 1 && nodes[id]) {
                    intersections.push({ 
                        id: Number(id), type: "intersection", layer: parseInt(layer), coordinates: nodes[id] 
                    });
                }
            });
        });

        console.log('[Frontend] 3. Sending processed data to C++ Backend...');
        const finalData = { bounds: mapBounds, roads, intersections, vehicles: [] };
        const cppRes = await fetch(`${BACKEND_URL}/api/confirm-map`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalData)
        });

        if (!cppRes.ok) throw new Error("Backend C++ refused to save the file!");

        console.log('[Frontend] 4. Setup successful. Switching UI mode.');
        document.getElementById('initialControls').classList.add('hidden');
        document.getElementById('simulationControls').classList.remove('hidden');
        
        appState.mapData = finalData;
        renderMapElements();

    } catch (error) {
        console.error('[Frontend] Error:', error);
        alert(error.message);
        unlockMap();
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm Map Selection";
        confirmBtn.style.cursor = "pointer";
    }
}