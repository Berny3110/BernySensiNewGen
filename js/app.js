import { DataManager } from './dataManager.js';
import { UIManager } from './uiManager.js';
import { ChartRenderer } from './chartRenderer.js';

document.addEventListener('DOMContentLoaded', () => {
    const dm = new DataManager();
    const chart = new ChartRenderer('cycleChart');
    const ui = new UIManager(dm, chart);
    ui.init();
});