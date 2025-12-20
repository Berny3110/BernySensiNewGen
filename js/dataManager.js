export class DataManager {
    constructor() {
        this.STORAGE_KEY = 'sensitrack_v2';
        this.data = this.loadData();
        
        // Initialisation si vide
        if (!this.data.cycles || this.data.cycles.length === 0) {
            this.data.cycles = [{
                id: 1,
                startDate: new Date().toISOString().split('T')[0],
                entries: []
            }];
        }
        
        // IMPORTANT: On définit l'index actif sur le dernier cycle au démarrage
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
		
		deleteCurrentCycle() {
        if (this.data.cycles.length <= 1) {
            alert("Impossible de supprimer le seul cycle existant.");
            return false;
        }
        
        if(confirm("Voulez-vous vraiment supprimer ce cycle définitivement ?")) {
            this.data.cycles.splice(this.activeCycleIndex, 1);
            // On recule l'index
            this.activeCycleIndex = Math.max(0, this.activeCycleIndex - 1);
            this.saveData();
            return true;
        }
        return false;
    }

		async saveData() {
						// 1. Sauvegarde LocalStorage (Rapide et Synchrone)
						localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));

						// 2. Sauvegarde Fichier (Asynchrone si configuré)
						if (this.fileHandle) {
								try {
										// Créer un flux d'écriture
										const writable = await this.fileHandle.createWritable();
										await writable.write(JSON.stringify(this.data, null, 2));
										await writable.close();
										console.log("Sauvegarde fichier externe réussie");
										
										// Petit feedback visuel (optionnel)
										const dot = document.getElementById('save-status');
										if(dot) {
												dot.style.backgroundColor = '#4caf50';
												setTimeout(() => dot.style.backgroundColor = 'transparent', 1000);
										}

								} catch (err) {
										console.error("Erreur sauvegarde fichier:", err);
										// Si on perd la permission, on reset le handle
										if (err.name === 'NotAllowedError') {
												alert("Permission de sauvegarde perdue. Veuillez réactiver la sauvegarde auto.");
												this.fileHandle = null;
										}
								}
						}
				}

		async enableNativeAutoSave() {
						try {
								// Ouvre la fenêtre de choix de fichier système
								const handle = await window.showSaveFilePicker({
										suggestedName: 'SensiTrack_Backup.json',
										types: [{
												description: 'Fichier JSON SensiTrack',
												accept: {'application/json': ['.json']},
										}],
								});
								this.fileHandle = handle;
								
								// On sauvegarde immédiatement pour confirmer
								await this.saveData();
								return true;
						} catch (err) {
								console.warn("Annulation ou erreur sauvegarde auto:", err);
								return false;
						}
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
						const cycle = this.getCurrentCycle();
						const existingIndex = cycle.entries.findIndex(e => e.date === entryData.date);
						
						if (existingIndex >= 0) {
								cycle.entries[existingIndex] = { ...cycle.entries[existingIndex], ...entryData };
						} else {
								cycle.entries.push(entryData);
						}
						
						cycle.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
						
						// Sauvegarde LocalStorage + Fichier
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