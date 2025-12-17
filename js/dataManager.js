export class DataManager {
    constructor() {
        this.STORAGE_KEY = 'sensitrack_v2';
        this.data = this.loadData();
        // Index du cycle actif (par défaut le dernier)
        this.activeCycleIndex = this.data.cycles.length - 1;
    }

    loadData() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) return JSON.parse(raw);
        return {
            settings: { theme: 'light' },
            cycles: [{
                id: 1,
                startDate: new Date().toISOString().split('T')[0],
                entries: []
            }]
        };
    }

    saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    }

    getAllCycles() {
        return this.data.cycles;
    }

    getCurrentCycle() {
        return this.data.cycles[this.activeCycleIndex] || this.data.cycles[this.data.cycles.length - 1];
    }

    getActiveCycleIndex() {
        return this.activeCycleIndex;
    }

    setActiveCycleIndex(index) {
        if (index >= 0 && index < this.data.cycles.length) {
            this.activeCycleIndex = index;
        }
    }

    saveEntry(entryData) {
        const cycle = this.getCurrentCycle(); // toujours dans le cycle courant
        const existingIndex = cycle.entries.findIndex(e => e.date === entryData.date);
        
        if (existingIndex >= 0) {
            cycle.entries[existingIndex] = { ...cycle.entries[existingIndex], ...entryData };
        } else {
            cycle.entries.push(entryData);
        }
        
        cycle.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        this.saveData();
    }

    deleteEntry(date) {
        const cycle = this.getCurrentCycle();
        cycle.entries = cycle.entries.filter(e => e.date !== date);
        this.saveData();
    }

    startNewCycle(startDate) {
        const newId = this.data.cycles.length + 1;
        this.data.cycles.push({
            id: newId,
            startDate: startDate,
            entries: []
        });
        this.activeCycleIndex = this.data.cycles.length - 1; // nouveau devient actif
        this.saveData();
    }
    
    getSettings() { return this.data.settings; }
    updateSettings(k, v) { this.data.settings[k] = v; this.saveData(); }
}