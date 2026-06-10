import { appState } from './config.js';
import { unlockMap, clearMapElements } from './map.js';

export function updateInfoPanel() {
    const infoContent = document.getElementById('infoContent');

    if (!appState.selectedObject) {
        infoContent.innerHTML = '<p style="color: #999; font-size: 12px;">Click on a road, intersection, or vehicle to view details.</p>';
        return;
    }

    const { data, type } = appState.selectedObject;
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

export function togglePauseMenu() {
    document.getElementById('pauseMenu').classList.toggle('hidden');
}

export function resumeSimulation() {
    document.getElementById('pauseMenu').classList.add('hidden');
}

export function selectNewMap() {
    unlockMap();
    appState.mapData = null;
    appState.selectedObject = null;

    document.getElementById('initialControls').classList.remove('hidden');
    document.getElementById('simulationControls').classList.add('hidden');
    document.getElementById('pauseMenu').classList.add('hidden');
    
    const mapStatus = document.getElementById('mapStatus');
    mapStatus.textContent = 'Map Unlocked';
    mapStatus.classList.add('unlocked');
    mapStatus.classList.remove('locked');

    clearMapElements();
    updateInfoPanel();
}

export function addElement(type) {
    alert(`Add ${type} mode activated. Click on the map to place a new ${type}.`);
}

export function checkZoomState() {
    if (appState.mapLocked) return;

    const currentZoom = appState.map.getZoom();
    const confirmBtn = document.getElementById('confirmMapBtn');
    let warningMsg = document.getElementById('zoomWarning');

    if (!warningMsg) {
        warningMsg = document.createElement('div');
        warningMsg.id = 'zoomWarning';
        warningMsg.style.color = '#e74c3c';
        warningMsg.style.fontSize = '12px';
        warningMsg.style.marginTop = '10px';
        warningMsg.style.fontWeight = '600';
        confirmBtn.parentNode.insertBefore(warningMsg, confirmBtn.nextSibling);
    }

    if (currentZoom < 16) {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.style.cursor = 'not-allowed';
        warningMsg.textContent = `Current zoom: ${currentZoom}. Please zoom in to level 15+ to confirm.`;
    } else {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
        warningMsg.textContent = ''; 
    }
}

export function onMapClick(event) {
    if (event.originalEvent.target === appState.map._container) {
        appState.selectedObject = null;
        updateInfoPanel();
    }
}