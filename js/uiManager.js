import { CycleComputer } from './cycleComputer.js';
import { WheelManager } from './wheelManager.js';
import { PaperRenderer } from './paperRenderer.js';

export class UIManager {
    constructor(dataManager) {
        this.dm = dataManager;
        this.tempInt = 36;
        this.tempDec1 = 3;
        this.tempDec2 = 0;
    }

    init() {
        this.paperChart = new PaperRenderer('paperChartCanvas');
        this.cacheDOM();
        this.setCurrentDateTime();
        this.initWheels();
        this.initTabs();
        this.initInputs();
        this.initCycleManager();
        this.initTheme();
        this.initChartOverlay();
        
        const btnTemp = document.getElementById('btn-validate-temp');
        if(btnTemp) btnTemp.addEventListener('click', () => this.validateTemperature());
        
        if(this.dom.btnValidateMucus) {
            this.dom.btnValidateMucus.addEventListener('click', () => this.validateMucus());
        }

        this.refreshAll();
    }

    cacheDOM() {
        this.dom = {
            date: document.getElementById('global-date'),
            time: document.getElementById('global-time'),
            wheelInt: document.getElementById('wheel-int'),
            wheelDec1: document.getElementById('wheel-dec1'),
            wheelDec2: document.getElementById('wheel-dec2'),
            tempDisplay: document.getElementById('temp-val-display'),
            cycleSelector: document.getElementById('cycle-selector-ui'),
            cycleInfo: document.getElementById('cycle-info-display'),
            btnDeleteCycle: document.getElementById('btn-delete-cycle'),
            btnAddCycle: document.getElementById('btn-add-cycle-main'),
            btnEditCycle: document.getElementById('btn-edit-cycle-date'),
            datePickerHidden: document.getElementById('cycle-start-edit-picker'),
            manualExclude: document.getElementById('manual-exclude-temp'),
            historyList: document.getElementById('history-list'),
            newCyclePicker: document.getElementById('new-cycle-picker'),
            btnValidateMucus: document.getElementById('btn-validate-mucus'),
            overlay: document.getElementById('full-screen-chart-overlay'),
            btnOpenChart: document.getElementById('btn-open-chart'),
            btnCloseChart: document.getElementById('btn-close-chart'),
            inputs: {
                sensation: document.querySelectorAll('input[name="mucus-sensation"]'),
                aspect: document.querySelectorAll('input[name="mucus-aspect"]'),
                bleeding: document.querySelectorAll('input[name="bleeding"]'),
                perturbations: [
                    document.getElementById('p-sleep'),
                    document.getElementById('p-alcohol'),
                    document.getElementById('p-illness'),
                    document.getElementById('p-stress'),
                    document.getElementById('p-late')
                ]
            }
        };
    }
    
    // CORRECTION : Logique exclusive saignements OU glaire
    validateMucus() {
        const bleeding = document.querySelector('input[name="bleeding"]:checked')?.value || 'none';
        const sensation = document.querySelector('input[name="mucus-sensation"]:checked')?.value;
        const aspect = document.querySelector('input[name="mucus-aspect"]:checked')?.value;

        const entryData = {
            date: this.dom.date.value
        };

        // Logique exclusive : soit saignements, soit glaire
        if (bleeding && bleeding !== 'none') {
            // Mode saignement : on sauvegarde uniquement le bleeding
            entryData.bleeding = bleeding;
            // On efface les données de glaire s'il y en avait
            entryData.mucusSensation = null;
            entryData.mucusAspect = null;
        } else {
            // Mode glaire : on sauvegarde sensation et aspect
            if (sensation) entryData.mucusSensation = sensation;
            if (aspect) entryData.mucusAspect = aspect;
            entryData.bleeding = 'none';
        }

        const success = this.dm.saveEntry(entryData);
        
        if (success) {
            const btn = this.dom.btnValidateMucus;
            const originalText = btn.innerText;
            btn.innerText = "✓ Enregistré !";
            setTimeout(() => btn.innerText = originalText, 1000);
            
            if (navigator.vibrate) navigator.vibrate(50);
            this.refreshAll();
        } else {
            alert('Erreur : date invalide');
        }
    }

    setCurrentDateTime() {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        this.dom.date.value = dateStr;
        
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        this.dom.time.value = `${hours}:${minutes}`;
    }

    initWheels() {
        const updateDisplay = () => {
            this.dom.tempDisplay.textContent = `${this.tempInt}.${this.tempDec1}${this.tempDec2}°C`;
        };

        this.wheelInt = new WheelManager({
            element: this.dom.wheelInt,
            min: 35, max: 39, currentValue: 36, isRepeating: false
        }, (v) => { this.tempInt = v; updateDisplay(); });

        this.wheelDec1 = new WheelManager({
            element: this.dom.wheelDec1,
            min: 0, max: 9, currentValue: 3, isRepeating: true
        }, (v) => { this.tempDec1 = v; updateDisplay(); });

        this.wheelDec2 = new WheelManager({
            element: this.dom.wheelDec2,
            min: 0, max: 9, currentValue: 0, isRepeating: true
        }, (v) => { this.tempDec2 = v; updateDisplay(); });
        
        updateDisplay();
    }

    validateTemperature() {
        const temp = parseFloat(`${this.tempInt}.${this.tempDec1}${this.tempDec2}`);
        const entry = {
            date: this.dom.date.value,
            time: this.dom.time.value,
            temp: temp
        };
        
        const success = this.dm.saveEntry(entry);
        if (success) {
            this.refreshAll();
        } else {
            alert('Erreur : date invalide');
        }
    }
    
    initChartOverlay() {
        if (this.dom.btnOpenChart) {
            this.dom.btnOpenChart.addEventListener('click', async () => {
                this.dom.overlay.classList.remove('hidden');
                this.updateGlobalUI(); 

                if (screen.orientation && screen.orientation.lock) {
                    try {
                        await screen.orientation.lock('landscape');
                    } catch (err) {
                        console.log("Rotation forcée bloquée");
                    }
                }
                
                setTimeout(() => {
                    const container = document.querySelector('.canvas-scroll-container');
                    if(container) container.scrollLeft = container.scrollWidth;
                }, 150);
            });
        }

        if (this.dom.btnCloseChart) {
            this.dom.btnCloseChart.addEventListener('click', () => {
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                }
                this.dom.overlay.classList.add('hidden');
            });
        }
    }

    initInputs() {
        this.dom.date.addEventListener('change', () => this.loadDataForCurrentDate());
        
        // Auto-exclusion mutuelle entre saignements et glaire
        if (this.dom.inputs.bleeding) {
            this.dom.inputs.bleeding.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (e.target.value !== 'none') {
                        // Décocher les radios de glaire
                        this.dom.inputs.sensation.forEach(r => r.checked = false);
                        this.dom.inputs.aspect.forEach(r => r.checked = false);
                    }
                });
            });
        }

        if (this.dom.inputs.sensation || this.dom.inputs.aspect) {
            [...(this.dom.inputs.sensation || []), ...(this.dom.inputs.aspect || [])].forEach(radio => {
                radio.addEventListener('change', () => {
                    // Décocher "bleeding" si on coche une glaire
                    const noneRadio = document.querySelector('input[name="bleeding"][value="none"]');
                    if (noneRadio) noneRadio.checked = true;
                });
            });
        }

        [...this.dom.inputs.perturbations, this.dom.manualExclude].forEach(i => {
            if(i) i.addEventListener('change', () => this.saveMisc());
        });
        
        const btnAutoSave = document.getElementById('btn-enable-autosave');
        const msgAutoSave = document.getElementById('autosave-msg');

        if (btnAutoSave) {
            btnAutoSave.addEventListener('click', async () => {
                const success = await this.dm.enableNativeAutoSave();
                if (success) {
                    btnAutoSave.style.display = 'none';
                    if(msgAutoSave) {
                        msgAutoSave.style.display = 'block';
                        msgAutoSave.textContent = "✅ Fichier lié : Sauvegarde automatique active";
                    }
                }
            });
        }
    }

    saveMisc() {
        const entry = { date: this.dom.date.value };
        if (this.dom.manualExclude) entry.excludeTemp = this.dom.manualExclude.checked;
        
        const perts = {};
        this.dom.inputs.perturbations.forEach(p => {
            if(p) perts[p.id] = p.checked;
        });
        entry.perturbations = perts;

        this.dm.saveEntry(entry);
        this.refreshAll();
    }

    // REFONTE : Gestion des cycles simplifiée
    initCycleManager() {
        // Changement de cycle actif
        if (this.dom.cycleSelector) {
            this.dom.cycleSelector.addEventListener('change', (e) => {
                const newIndex = parseInt(e.target.value);
                this.dm.setActiveCycleIndex(newIndex);
                this.refreshAll();
            });
        }

        // Bouton nouveau cycle
        if (this.dom.btnAddCycle) {
            this.dom.btnAddCycle.addEventListener('click', () => {
                const startDate = this.dom.newCyclePicker?.value || new Date().toISOString().split('T')[0];
                if (confirm(`Démarrer un nouveau cycle le ${startDate} ?`)) {
                    this.dm.startNewCycle(startDate);
                    this.refreshAll();
                }
            });
        }

        // Édition de la date de début du cycle actif
        if (this.dom.btnEditCycle && this.dom.datePickerHidden) {
            this.dom.btnEditCycle.addEventListener('click', () => {
                const cycle = this.dm.getCurrentCycle();
                this.dom.datePickerHidden.value = cycle.startDate;
                this.dom.datePickerHidden.style.display = 'block';
                this.dom.datePickerHidden.focus();
            });

            this.dom.datePickerHidden.addEventListener('change', (e) => {
                const newDate = e.target.value;
                if (confirm(`Modifier la date de début à ${newDate} ?`)) {
                    const activeIndex = this.dm.getActiveCycleIndex();
                    this.dm.updateCycleStartDate(activeIndex, newDate);
                    this.refreshAll();
                }
                e.target.style.display = 'none';
            });
        }

        // Suppression du cycle actif
        if (this.dom.btnDeleteCycle) {
            this.dom.btnDeleteCycle.addEventListener('click', () => {
                if (this.dm.deleteCurrentCycle()) {
                    this.refreshAll();
                }
            });
        }

        // Gestion de la liste des cycles
        const list = document.getElementById('cycles-list');
        if (list) {
            list.addEventListener('click', (e) => {
                // Clic sur un cycle pour le sélectionner
                const cycleRow = e.target.closest('.cycle-row');
                if (cycleRow && !e.target.closest('.btn-delete-cycle')) {
                    const index = parseInt(cycleRow.dataset.index);
                    this.dm.setActiveCycleIndex(index);
                    this.refreshAll();
                }

                // Suppression
                if (e.target.closest('.btn-delete-cycle')) {
                    const index = parseInt(e.target.closest('.btn-delete-cycle').dataset.index);
                    if (this.dm.deleteCycle(index)) {
                        this.refreshAll();
                    }
                }
            });

            // Édition du numéro de cycle
            list.addEventListener('change', (e) => {
                if (e.target.classList.contains('cycle-id-input')) {
                    const index = parseInt(e.target.dataset.index);
                    const newId = parseInt(e.target.value);
                    if (newId && newId > 0) {
                        this.dm.updateCycleId(index, newId);
                        e.target.blur();
                    }
                }
            });

            // Édition de la date de début
            list.addEventListener('change', (e) => {
                if (e.target.classList.contains('cycle-date-input')) {
                    const index = parseInt(e.target.dataset.index);
                    const newDate = e.target.value;
                    if (newDate) {
                        this.dm.updateCycleStartDate(index, newDate);
                        this.refreshAll();
                    }
                }
            });
        }
    }
    
    // UI REFONTE : Liste des cycles plus claire
    updateCyclesList() {
        const list = document.getElementById('cycles-list');
        if (!list) return;

        const cycles = this.dm.getAllCycles();
        const activeIndex = this.dm.getActiveCycleIndex();

        list.innerHTML = cycles.map((c, i) => {
            const startDate = new Date(c.startDate).toLocaleDateString('fr-FR');
            const isCurrent = (i === activeIndex);
            const entriesCount = c.entries.length;
            
            return `
            <div class="cycle-row ${isCurrent ? 'active-cycle' : ''}" data-index="${i}" 
                 style="background: var(--bg-card); padding: 20px; margin-bottom: 12px; border-radius: 12px; border: 2px solid ${isCurrent ? 'var(--primary)' : 'var(--border)'}; cursor: pointer;">
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.7rem; opacity: 0.7; text-transform: uppercase;">Cycle</span>
                            <input type="number" class="cycle-id-input" value="${c.id}" data-index="${i}" 
                                   style="width: 50px; text-align: center; font-size: 1.3rem; font-weight: 800; border: none; border-bottom: 1px dashed var(--border); background: transparent; color: var(--primary);">
                        </div>
                        ${isCurrent ? '<span style="background: var(--primary); color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Actif</span>' : ''}
                    </div>
                    
                    <button class="btn-delete-cycle" data-index="${i}" 
                            style="background: none; border: none; font-size: 1.3rem; color: var(--danger); cursor: pointer; padding: 8px;">
                        🗑️
                    </button>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.8rem; opacity: 0.7; margin-bottom: 4px;">Date de début</div>
                        <input type="date" class="cycle-date-input" value="${c.startDate}" data-index="${i}"
                               style="font-size: 1rem; font-weight: 600; border: 1px solid var(--border); border-radius: 6px; padding: 6px; background: var(--bg-body); color: var(--text-main);">
                    </div>
                    <div style="text-align: right; margin-left: 15px;">
                        <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">${entriesCount}</div>
                        <div style="font-size: 0.75rem; opacity: 0.7;">entrées</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    refreshAll() {
        this.updateCycleSelectorOptions();
        this.updateCycleHeaderLabel();
        this.updateGlobalUI();
        this.loadDataForCurrentDate();
        this.updateCyclesList();
    }

    updateCycleSelectorOptions() {
        if(!this.dom.cycleSelector) return;
        const cycles = this.dm.getAllCycles();
        
        this.dom.cycleSelector.innerHTML = cycles.map((c, i) => 
            `<option value="${i}" ${i === this.dm.getActiveCycleIndex() ? 'selected' : ''}>
                Cycle #${c.id} - ${c.startDate}
            </option>`
        ).join('');
    }

    updateCycleHeaderLabel() {
        if(!this.dom.cycleInfo) return;
        const cycle = this.dm.getCurrentCycle();
        const start = new Date(cycle.startDate);
        this.dom.cycleInfo.textContent = `Débuté le ${start.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`;
    }

    // CORRECTION : Chargement sécurisé des données
    loadDataForCurrentDate() {
        const date = this.dom.date.value;
        if (!date || date === 'Invalid Date') return;
        
        const cycle = this.dm.getCurrentCycle();
        const entry = cycle.entries.find(e => e.date === date);

        // Reset UI
        document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        this.dom.inputs.perturbations.forEach(p => { if(p) p.checked = false; });
        if(this.dom.manualExclude) this.dom.manualExclude.checked = false;

        if (entry) {
            // Saignements
            if (entry.bleeding && entry.bleeding !== 'none') {
                const rad = document.querySelector(`input[name="bleeding"][value="${entry.bleeding}"]`);
                if(rad) rad.checked = true;
            } else {
                // Glaire
                if (entry.mucusSensation) {
                    const rad = document.querySelector(`input[name="mucus-sensation"][value="${entry.mucusSensation}"]`);
                    if(rad) rad.checked = true;
                }
                if (entry.mucusAspect) {
                    const rad = document.querySelector(`input[name="mucus-aspect"][value="${entry.mucusAspect}"]`);
                    if(rad) rad.checked = true;
                }
            }

            // Perturbations
            if (entry.perturbations) {
                Object.keys(entry.perturbations).forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.checked = entry.perturbations[id];
                });
            }
            if(this.dom.manualExclude) this.dom.manualExclude.checked = !!entry.excludeTemp;
        }
        
        this.updateGlobalUI();
    }

    updateGlobalUI() {
        const cycle = this.dm.getCurrentCycle();
        const analysis = CycleComputer.analyzeCycle(cycle);
        
        if (this.paperChart) {
            this.paperChart.render(cycle, analysis);
        }
        
        this.updateHistoryList();
    }

    // CORRECTION : Historique adapté au cycle sélectionné
    updateHistoryList() {
        const list = document.getElementById('history-list');
        if (!list) return;
        
        const cycle = this.dm.getCurrentCycle();
        const entries = [...cycle.entries].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (entries.length === 0) {
            list.innerHTML = '<li style="text-align: center; padding: 40px; opacity: 0.5;">Aucune donnée dans ce cycle</li>';
            return;
        }
        
        list.innerHTML = entries.map(e => {
            let details = [];
            if (e.temp) details.push(`🌡️ ${e.temp}°C`);
            
            const mucusCode = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
            if (mucusCode && mucusCode !== '--') details.push(`Glaire: ${mucusCode}`);
            
            if (e.bleeding && e.bleeding !== 'none') {
                const bleedMap = {
                    'spotting': '🩸 Spotting', 
                    'medium': '🩸🩸 Moyen', 
                    'heavy': '🩸🩸🩸 Abondant'
                };
                details.push(bleedMap[e.bleeding] || e.bleeding);
            }

            const dateFr = new Date(e.date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'});

            return `
            <li class="history-item" style="display:flex; justify-content:space-between; align-items:center; padding:16px; border-bottom:1px solid var(--border); background: var(--bg-card); margin-bottom: 8px; border-radius: 8px;">
                <div>
                    <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${dateFr}</div>
                    <div style="font-size: 0.9rem; color: #666;">${details.join(' • ')}</div>
                </div>
                <button class="btn-delete-entry" data-date="${e.date}" style="border:none; background:none; color:var(--danger); font-weight:bold; font-size:1.5rem; padding:0 12px; cursor: pointer;">
                    ×
                </button>
            </li>`;
        }).join('');

        list.querySelectorAll('.btn-delete-entry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dateToDelete = e.target.dataset.date;
                if(confirm("Supprimer cette entrée ?")) {
                    this.dm.deleteEntry(dateToDelete);
                    this.refreshAll();
                }
            });
        });
    }

    initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.target).classList.add('active');
            });
        });
    }

    initTheme() {
        const toggle = document.getElementById('theme-toggle');
        if(!toggle) return;
        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
        });
    }
}