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

    /**
     * Génère l'objet complet d'export pour le transfert entre appareils.
     */
    exportBackup() {
        return {
            app: 'SensiTrack',
            version: 'sensitrack_v2',
            exportDate: new Date().toISOString(),
            data: this.data,
            notifications: {
                enabled: localStorage.getItem('sensitrack_notif_enabled') === 'true',
                morning: localStorage.getItem('sensitrack_notif_morning') || '08:00',
                evening: localStorage.getItem('sensitrack_notif_evening') || '20:00'
            }
        };
    }

    /**
     * Analyse et pré-valide un fichier de sauvegarde JSON.
     */
    parseBackup(rawText) {
        let parsed;
        try {
            parsed = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Le fichier sélectionné n'est pas un fichier JSON valide.");
        }

        let dataToRestore = null;
        let notifsToRestore = null;

        if (parsed && parsed.data && Array.isArray(parsed.data.cycles)) {
            dataToRestore = parsed.data;
            notifsToRestore = parsed.notifications;
        } else if (parsed && Array.isArray(parsed.cycles)) {
            dataToRestore = parsed;
        } else {
            throw new Error("Structure invalide : aucun cycle SensiTrack détecté dans ce fichier.");
        }

        if (!dataToRestore.cycles || dataToRestore.cycles.length === 0) {
            throw new Error("La sauvegarde ne contient aucun cycle.");
        }

        for (const c of dataToRestore.cycles) {
            if (!c.startDate || !Array.isArray(c.entries)) {
                throw new Error("Format d'un ou plusieurs cycles corrompu.");
            }
        }

        const totalEntries = dataToRestore.cycles.reduce((acc, c) => acc + (c.entries ? c.entries.length : 0), 0);
        return {
            parsed,
            dataToRestore,
            notifsToRestore,
            cyclesCount: dataToRestore.cycles.length,
            entriesCount: totalEntries,
            exportDate: parsed.exportDate ? new Date(parsed.exportDate).toLocaleDateString('fr-FR') : null
        };
    }

    /**
     * Valide et importe une sauvegarde issue d'un autre smartphone.
     * @param {string} rawText - Contenu JSON brut
     * @param {'merge'|'replace'} mode - 'merge' = fusionne sans rien perdre (recommandé), 'replace' = écrase tout
     */
    importBackup(rawText, mode = 'merge') {
        const info = this.parseBackup(rawText);
        const dataToRestore = info.dataToRestore;
        const notifsToRestore = info.notifsToRestore;

        let addedCyclesCount = 0;
        let mergedCyclesCount = 0;
        let addedEntriesCount = 0;

        // Calcul des entrées actuelles
        const currentTotalEntries = (this.data.cycles || []).reduce((acc, c) => acc + (c.entries ? c.entries.length : 0), 0);

        if (mode === 'replace' || currentTotalEntries === 0) {
            // Remplacement total ou smartphone vide
            this.data = JSON.parse(JSON.stringify(dataToRestore));
            this.activeCycleIndex = Math.max(0, this.data.cycles.length - 1);
            addedCyclesCount = this.data.cycles.length;
            addedEntriesCount = info.entriesCount;
        } else {
            // Mode FUSION : Ne supprime ni n'écrase aucune donnée déjà présente
            const existingCycles = this.data.cycles || [];
            const importedCycles = JSON.parse(JSON.stringify(dataToRestore.cycles || []));

            // Si le seul cycle existant est vide (par défaut), on peut le nettoyer
            const hasOnlyEmptyDefaultCycle = existingCycles.length === 1 && (!existingCycles[0].entries || existingCycles[0].entries.length === 0);
            if (hasOnlyEmptyDefaultCycle) {
                existingCycles.length = 0;
            }

            for (const impCycle of importedCycles) {
                // Chercher si un cycle existe déjà avec la même date de début
                const matchingCycle = existingCycles.find(c => c.startDate === impCycle.startDate);

                if (matchingCycle) {
                    mergedCyclesCount++;
                    if (!Array.isArray(matchingCycle.entries)) matchingCycle.entries = [];

                    for (const impEntry of (impCycle.entries || [])) {
                        const existingEntryIndex = matchingCycle.entries.findIndex(e => e.date === impEntry.date);
                        if (existingEntryIndex >= 0) {
                            // Date déjà présente : on complète les champs sans effacer les existants
                            const current = matchingCycle.entries[existingEntryIndex];
                            const merged = { ...current };
                            for (const [key, val] of Object.entries(impEntry)) {
                                if (val !== undefined && val !== null && val !== '') {
                                    // Si la valeur actuelle est vide, ou mise à jour
                                    merged[key] = val;
                                }
                            }
                            matchingCycle.entries[existingEntryIndex] = merged;
                        } else {
                            // Nouvelle date dans ce cycle
                            matchingCycle.entries.push(impEntry);
                            addedEntriesCount++;
                        }
                    }

                    matchingCycle.entries.sort((a, b) => new Date(a.date) - new Date(b.date));
                } else {
                    // Nouveau cycle qui n'existait pas sur cet appareil
                    addedCyclesCount++;
                    addedEntriesCount += (impCycle.entries ? impCycle.entries.length : 0);
                    existingCycles.push(impCycle);
                }
            }

            // Trier les cycles par ordre chronologique
            existingCycles.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

            // Réassigner les numéros de cycle 1..N
            existingCycles.forEach((c, idx) => {
                c.id = idx + 1;
            });

            this.data.cycles = existingCycles;
            this.activeCycleIndex = Math.max(0, this.data.cycles.length - 1);
        }

        this.saveData();

        // Restauration des préférences de notification si disponibles
        if (notifsToRestore) {
            if (mode === 'replace' || !localStorage.getItem('sensitrack_notif_enabled')) {
                if (typeof notifsToRestore.morning === 'string') {
                    localStorage.setItem('sensitrack_notif_morning', notifsToRestore.morning);
                }
                if (typeof notifsToRestore.evening === 'string') {
                    localStorage.setItem('sensitrack_notif_evening', notifsToRestore.evening);
                }
                if (typeof notifsToRestore.enabled === 'boolean') {
                    localStorage.setItem('sensitrack_notif_enabled', notifsToRestore.enabled ? 'true' : 'false');
                }
            }
        }

        const totalEntries = this.data.cycles.reduce((acc, c) => acc + (c.entries ? c.entries.length : 0), 0);
        return {
            mode,
            cyclesCount: this.data.cycles.length,
            entriesCount: totalEntries,
            addedCyclesCount,
            mergedCyclesCount,
            addedEntriesCount
        };
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
		saveEntry(rawData) {
						if (!rawData || !rawData.date) return false;
						
						const cleanData = { date: rawData.date };
						
						// J'ai remis TOUTES les clés nécessaires au fonctionnement de l'appli
						const allowedKeys = [
								'time', 
								'temp', 
								'excludeTemp', 
								'mucusSensation', 
								'mucusAspect', 
								'bleeding', 
								'perturbations', 
								'notes', 
								'love'
						];

						allowedKeys.forEach(key => {
								if (rawData[key] !== undefined && rawData[key] !== null && rawData[key] !== '') {
										cleanData[key] = rawData[key];
								}
						});

						const cycle = this.getCurrentCycle();
						const existingIndex = cycle.entries.findIndex(e => e.date === cleanData.date);
						
						if (existingIndex >= 0) {
								cycle.entries[existingIndex] = { ...cycle.entries[existingIndex], ...cleanData };
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