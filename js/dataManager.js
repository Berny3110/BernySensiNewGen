/**
 * Gestionnaire central des données de l’application SensiTrack.
 *
 * Responsabilités principales :
 * - Charger et sauvegarder les données (localStorage + sauvegarde native via File System Access API)
 * - Gérer la liste des cycles : création, suppression, sélection, mise à jour
 * - Gérer les entrées quotidiennes : validation, nettoyage, fusion, tri
 * - Maintenir les paramètres utilisateur (thème, préférences…)
 * - Assurer la cohérence des données même en cas de cycles vides ou suppression complète
 *
 * Ce module sert de couche de persistance et d’orchestration,
 * garantissant que l’interface et les modules d’analyse disposent
 * toujours de données propres, cohérentes et à jour.
 */




export class DataManager {
    constructor() {
        this.STORAGE_KEY = 'sensitrack_v2';
        this.data = this.loadData();
        
        if (!this.data.cycles || this.data.cycles.length === 0) {
            this.data.cycles = [{
                id: 1,
                startDate: new Date().toISOString().split('T')[0],
                entries: []
            }];
        }
        
        this.activeCycleIndex = this.data.cycles.length - 1;
        this.fileHandle = null; 
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
    
    // CORRECTION : Permettre la suppression même du dernier cycle
    deleteCurrentCycle() {
        if(confirm("Voulez-vous vraiment supprimer ce cycle définitivement ?")) {
            this.data.cycles.splice(this.activeCycleIndex, 1);
            
            // Si plus de cycles, en créer un nouveau
            if (this.data.cycles.length === 0) {
                this.data.cycles = [{
                    id: 1,
                    startDate: new Date().toISOString().split('T')[0],
                    entries: []
                }];
            }
            
            this.activeCycleIndex = Math.min(this.activeCycleIndex, this.data.cycles.length - 1);
            this.saveData();
            return true;
        }
        return false;
    }

    async saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));

        if (this.fileHandle) {
            try {
                const writable = await this.fileHandle.createWritable();
                await writable.write(JSON.stringify(this.data, null, 2));
                await writable.close();
                
                const dot = document.getElementById('save-status');
                if(dot) {
                    dot.style.backgroundColor = '#4caf50';
                    setTimeout(() => dot.style.backgroundColor = 'transparent', 1000);
                }
            } catch (err) {
                console.error("Erreur sauvegarde fichier:", err);
                if (err.name === 'NotAllowedError') {
                    alert("Permission de sauvegarde perdue. Veuillez réactiver la sauvegarde auto.");
                    this.fileHandle = null;
                }
            }
        }
    }

    async enableNativeAutoSave() {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'SensiTrack_Backup.json',
                types: [{
                    description: 'Fichier JSON SensiTrack',
                    accept: {'application/json': ['.json']},
                }],
            });
            this.fileHandle = handle;
            await this.saveData();
            return true;
        } catch (err) {
            console.warn("Annulation ou erreur sauvegarde auto:", err);
            return false;
        }
    }
    
    updateCycleId(index, newId) {
        if (this.data.cycles[index]) {
            this.data.cycles[index].id = newId;
            this.saveData();
        }
    }
    
    updateCycleStartDate(index, newDate) {
        if (this.data.cycles[index] && newDate && newDate !== 'Invalid Date') {
            this.data.cycles[index].startDate = newDate;
            this.saveData();
        }
    }

    deleteCycle(index) {
        if (confirm("Supprimer ce cycle et toutes ses données ?")) {
            this.data.cycles.splice(index, 1);
            
            // Si plus de cycles, créer un cycle par défaut
            if (this.data.cycles.length === 0) {
                this.data.cycles = [{
                    id: 1,
                    startDate: new Date().toISOString().split('T')[0],
                    entries: []
                }];
            }
            
            if (index === this.activeCycleIndex) {
                this.activeCycleIndex = Math.min(this.activeCycleIndex, this.data.cycles.length - 1);
            } else if (index < this.activeCycleIndex) {
                this.activeCycleIndex--;
            }
            
            this.saveData();
            return true;
        }
        return false;
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

    // CORRECTION : Validation stricte et nettoyage des données
    saveEntry(entryData) {
        // Validation de la date
        if (!entryData.date || entryData.date === '' || entryData.date === 'Invalid Date') {
            console.error('Date invalide, sauvegarde annulée', entryData);
            return false;
        }

        // Nettoyage : supprimer les clés undefined/null
        const cleanData = {};
        for (const [key, value] of Object.entries(entryData)) {
            if (value !== undefined && value !== null && value !== '') {
                cleanData[key] = value;
            }
        }

        const cycle = this.getCurrentCycle();
        const existingIndex = cycle.entries.findIndex(e => e.date === cleanData.date);
        
        if (existingIndex >= 0) {
            // Fusion intelligente : ne pas écraser avec undefined
            cycle.entries[existingIndex] = { 
                ...cycle.entries[existingIndex], 
                ...cleanData 
            };
        } else {
            cycle.entries.push(cleanData);
        }
        
        cycle.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        this.saveData();
        return true;
    }

    deleteEntry(date) {
        const cycle = this.getCurrentCycle();
        cycle.entries = cycle.entries.filter(e => e.date !== date);
        this.saveData();
    }

    startNewCycle(startDate) {
        if (!startDate || startDate === '' || startDate === 'Invalid Date') {
            alert('Date invalide');
            return false;
        }
        
        const newId = Math.max(...this.data.cycles.map(c => c.id || 0), 0) + 1;
        this.data.cycles.push({
            id: newId,
            startDate: startDate,
            entries: []
        });
        this.activeCycleIndex = this.data.cycles.length - 1;
        this.saveData();
        return true;
    }
    
    getSettings() { return this.data.settings; }
    updateSettings(k, v) { this.data.settings[k] = v; this.saveData(); }
}