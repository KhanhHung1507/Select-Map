import { appState } from './config.js';
import { initMap } from './map.js';
import { confirmMapSelection } from './api.js';
import { 
    togglePauseMenu, resumeSimulation, selectNewMap, 
    addElement, checkZoomState, onMapClick, updateInfoPanel 
} from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('confirmMapBtn').addEventListener('click', confirmMapSelection);
    document.getElementById('pauseBtn').addEventListener('click', togglePauseMenu);
    document.getElementById('resumeBtn').addEventListener('click', resumeSimulation);
    document.getElementById('selectNewMapBtn').addEventListener('click', selectNewMap);
    document.getElementById('addRoadBtn').addEventListener('click', () => addElement('road'));
    document.getElementById('addVehicleBtn').addEventListener('click', () => addElement('vehicle'));
    document.getElementById('addIntersectionBtn').addEventListener('click', () => addElement('intersection'));

    appState.map.on('click', onMapClick);
    appState.map.on('zoomend', checkZoomState);
    appState.map.on('moveend', checkZoomState);
    
    checkZoomState();
    updateInfoPanel(); 
}