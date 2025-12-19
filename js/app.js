import { DataManager } from './dataManager.js';
import { UIManager } from './uiManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const dm = new DataManager();
    const ui = new UIManager(dm); 
    ui.init();
});