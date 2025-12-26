import { CycleComputer } from './cycleComputer.js';
import { WheelManager } from './wheelManager.js';
import { PaperRenderer } from './paperRenderer.js';

export class UIManager {
    constructor(dataManager) {
        this.dm = dataManager;
        this.tempInt = 36;
        this.tempDec1 = 3;
        this.tempDec2 = 0;
        this.chartZoom = 1.0;
    }

    init() {
        this.paperChart = new PaperRenderer('paperChartCanvas');
        this.cacheDOM();
        this.setCurrentDateTime();
        this.initWheels();
        this.initTabs();
        this.initInputs();
        this.initCycleNavigation();
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
            
            // Nouveau sélecteur de cycle
            cycleDisplayCompact: document.getElementById('cycle-display-compact'),
            btnPrevCycle: document.getElementById('btn-prev-cycle'),
            btnNextCycle: document.getElementById('btn-next-cycle'),
            
            manualExclude: document.getElementById('manual-exclude-temp'),
            historyList: document.getElementById('history-list'),
            btnValidateMucus: document.getElementById('btn-validate-mucus'),
            overlay: document.getElementById('full-screen-chart-overlay'),
            btnOpenChart: document.getElementById('btn-open-chart'),
            btnCloseChart: document.getElementById('btn-close-chart'),
            
            // Contrôles de zoom
            btnZoomIn: document.getElementById('btn-zoom-in'),
            btnZoomOut: document.getElementById('btn-zoom-out'),
            btnZoomReset: document.getElementById('btn-zoom-reset'),
            
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
    
    validateMucus() {
        const bleeding = document.querySelector('input[name="bleeding"]:checked')?.value || 'none';
        const sensation = document.querySelector('input[name="mucus-sensation"]:checked')?.value;
        const aspect = document.querySelector('input[name="mucus-aspect"]:checked')?.value;

        const entryData = {
            date: this.dom.date.value
        };

        if (bleeding && bleeding !== 'none') {
            entryData.bleeding = bleeding;
            entryData.mucusSensation = null;
            entryData.mucusAspect = null;
        } else {
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
    
    // NOUVEAU : Navigation par flèches entre cycles
    initCycleNavigation() {
        if (this.dom.btnPrevCycle) {
            this.dom.btnPrevCycle.addEventListener('click', () => {
                const current = this.dm.getActiveCycleIndex();
                if (current > 0) {
                    this.dm.setActiveCycleIndex(current - 1);
                    this.refreshAll();
                }
            });
        }
        
        if (this.dom.btnNextCycle) {
            this.dom.btnNextCycle.addEventListener('click', () => {
                const current = this.dm.getActiveCycleIndex();
                const cycles = this.dm.getAllCycles();
                if (current < cycles.length - 1) {
                    this.dm.setActiveCycleIndex(current + 1);
                    this.refreshAll();
                }
            });
        }
    }
    
    updateCycleNavDisplay() {
        const cycles = this.dm.getAllCycles();
        const activeIndex = this.dm.getActiveCycleIndex();
        const cycle = cycles[activeIndex];
        
        if (this.dom.cycleDisplayCompact) {
            const status = activeIndex === cycles.length - 1 ? ' (En cours)' : '';
            this.dom.cycleDisplayCompact.textContent = `Cycle #${cycle.id}${status}`;
        }
        
        // Désactiver les boutons si on est aux extrémités
        if (this.dom.btnPrevCycle) {
            this.dom.btnPrevCycle.disabled = activeIndex === 0;
        }
        if (this.dom.btnNextCycle) {
            this.dom.btnNextCycle.disabled = activeIndex === cycles.length - 1;
        }
    }
    
    initChartOverlay() {
        if (this.dom.btnOpenChart) {
            this.dom.btnOpenChart.addEventListener('click', async () => {
                this.dom.overlay.classList.remove('hidden');
                this.chartZoom = 1.0;
                this.updateGlobalUI();

                if (screen.orientation && screen.orientation.lock) {
                    try {
                        await screen.orientation.lock('landscape');
                    } catch (err) {
                        console.log("Rotation forcée bloquée");
                    }
                }
                
                setTimeout(() => {
                    const container = document.getElementById('canvas-scroll-container');
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
        
        // NOUVEAU : Contrôles de zoom
        if (this.dom.btnZoomIn) {
            this.dom.btnZoomIn.addEventListener('click', () => {
                this.chartZoom = Math.min(3.0, this.chartZoom + 0.2);
                this.updateGlobalUI();
            });
        }
        
        if (this.dom.btnZoomOut) {
            this.dom.btnZoomOut.addEventListener('click', () => {
                this.chartZoom = Math.max(0.5, this.chartZoom - 0.2);
                this.updateGlobalUI();
            });
        }
        
        if (this.dom.btnZoomReset) {
            this.dom.btnZoomReset.addEventListener('click', () => {
                this.chartZoom = 1.0;
                this.updateGlobalUI();
            });
        }
    }

    initInputs() {
        this.dom.date.addEventListener('change', () => this.loadDataForCurrentDate());
        
        // NOUVEAU : Exclusion mutuelle avec UI désactivée
        if (this.dom.inputs.bleeding) {
            this.dom.inputs.bleeding.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.updateMucusUIState(e.target.value !== 'none');
                    
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
                    if (noneRadio) {
                        noneRadio.checked = true;
                        this.updateMucusUIState(false);
                    }
                });
            });
        }

        [...this.dom.inputs.perturbations, this.dom.manualExclude].forEach(i => {
            if(i) i.addEventListener('change', () => this.saveMisc());
        });
    }
    
    // NOUVEAU : Griser/dé-griser les sections glaire
    updateMucusUIState(isBleedingSelected) {
        const sensationGrid = document.getElementById('mucus-sensation-grid');
        const aspectGrid = document.getElementById('mucus-aspect-grid');
        const sensationTitle = document.getElementById('mucus-sensation-title');
        const aspectTitle = document.getElementById('mucus-aspect-title');
        
        if (isBleedingSelected) {
            sensationGrid?.classList.add('disabled');
            aspectGrid?.classList.add('disabled');
            sensationTitle?.classList.add('disabled');
            aspectTitle?.classList.add('disabled');
            
            // Désactiver les radio cards
            sensationGrid?.querySelectorAll('.radio-card').forEach(card => card.classList.add('disabled'));
            aspectGrid?.querySelectorAll('.radio-card').forEach(card => card.classList.add('disabled'));
        } else {
            sensationGrid?.classList.remove('disabled');
            aspectGrid?.classList.remove('disabled');
            sensationTitle?.classList.remove('disabled');
            aspectTitle?.classList.remove('disabled');
            
            sensationGrid?.querySelectorAll('.radio-card').forEach(card => card.classList.remove('disabled'));
            aspectGrid?.querySelectorAll('.radio-card').forEach(card => card.classList.remove('disabled'));
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

    // REFONTE : Gestion des cycles via tableau
    initCycleManager() {
        const btnAddCycle = document.getElementById('btn-add-cycle-main');
        const btnConfirmNew = document.getElementById('btn-confirm-new-cycle');
        const btnCancelNew = document.getElementById('btn-cancel-new-cycle');
        const newCycleForm = document.getElementById('new-cycle-form');
        const newCyclePicker = document.getElementById('new-cycle-picker');
        
        if (btnAddCycle) {
            btnAddCycle.addEventListener('click', () => {
                newCycleForm.style.display = 'flex';
                newCyclePicker.value = new Date().toISOString().split('T')[0];
                newCyclePicker.focus();
            });
        }
        
        if (btnConfirmNew) {
            btnConfirmNew.addEventListener('click', () => {
                const startDate = newCyclePicker.value;
                if (startDate) {
                    this.dm.startNewCycle(startDate);
                    newCycleForm.style.display = 'none';
                    this.refreshAll();
                }
            });
        }
        
        if (btnCancelNew) {
            btnCancelNew.addEventListener('click', () => {
                newCycleForm.style.display = 'none';
            });
        }
        
        // Gestion du tableau
        const tbody = document.getElementById('cycles-table-body');
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (!row) return;
                
                const index = parseInt(row.dataset.index);
                
                // Suppression
                if (e.target.closest('.btn-delete-cycle')) {
                    e.stopPropagation();
                    if (this.dm.deleteCycle(index)) {
                        this.refreshAll();
                    }
                    return;
                }
                
                // Empêcher la sélection si on clique sur un input
                if (e.target.classList.contains('cycle-id-input') || 
                    e.target.classList.contains('cycle-date-input')) {
                    e.stopPropagation();
                    return;
                }
                
                // Sélection du cycle
                if (!e.target.closest('.cycle-actions-cell')) {
                    this.dm.setActiveCycleIndex(index);
                    this.refreshAll();
                }
            });
            
            // CORRECTION : Édition des champs avec blur au lieu de change
            tbody.addEventListener('blur', (e) => {
                if (e.target.classList.contains('cycle-id-input')) {
                    const index = parseInt(e.target.dataset.index);
                    const newId = parseInt(e.target.value);
                    if (newId && newId > 0) {
                        this.dm.updateCycleId(index, newId);
                        this.refreshAll();
                    }
                }
                
                if (e.target.classList.contains('cycle-date-input')) {
                    const index = parseInt(e.target.dataset.index);
                    const newDate = e.target.value;
                    if (newDate) {
                        this.dm.updateCycleStartDate(index, newDate);
                        this.refreshAll();
                    }
                }
            }, true); // Utiliser capture pour attraper les événements blur
        }
    }
    
    updateCyclesTable() {
        const tbody = document.getElementById('cycles-table-body');
        if (!tbody) return;
        
        const cycles = this.dm.getAllCycles();
        const activeIndex = this.dm.getActiveCycleIndex();
        
        // CORRECTION : Trier par date de début (du plus ancien au plus récent)
        const sortedCycles = cycles.map((c, originalIndex) => ({ ...c, originalIndex }))
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
        tbody.innerHTML = sortedCycles.map((c) => {
            const startDate = new Date(c.startDate);
            const entriesCount = c.entries.length;
            
            // Calcul de la durée
            let duration = '—';
            if (c.entries.length > 0) {
                const sortedEntries = [...c.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
                const firstDate = new Date(sortedEntries[0].date);
                const lastDate = new Date(sortedEntries[sortedEntries.length - 1].date);
                const days = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
                duration = `${days}j`;
            }
            
            const isCurrent = c.originalIndex === activeIndex;
            
            return `
                <tr class="${isCurrent ? 'active-cycle' : ''}" data-index="${c.originalIndex}">
                    <td>
                        <input type="number" class="cycle-id-input" value="${c.id}" data-index="${c.originalIndex}" min="1">
                    </td>
                    <td>
                        <input type="date" class="cycle-date-input" value="${c.startDate}" data-index="${c.originalIndex}">
                    </td>
                    <td>${duration}</td>
                    <td>${entriesCount}</td>
                    <td class="cycle-actions-cell">
                        <button class="btn-icon-small danger btn-delete-cycle" data-index="${c.originalIndex}" title="Supprimer">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    refreshAll() {
        this.updateCycleNavDisplay();
        this.updateGlobalUI();
        this.loadDataForCurrentDate();
        this.updateCyclesTable();
    }

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
                this.updateMucusUIState(true);
            } else {
                this.updateMucusUIState(false);
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
        } else {
            this.updateMucusUIState(false);
        }
        
        this.updateGlobalUI();
    }

    updateGlobalUI() {
        const cycle = this.dm.getCurrentCycle();
        const analysis = CycleComputer.analyzeCycle(cycle);
        
        if (this.paperChart) {
            this.paperChart.render(cycle, analysis, this.chartZoom);
        }
        
        this.updateHistoryList();
    }

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
                    'spotting': '💉 Spotting', 
                    'light': '🩸 Léger', 
                    'medium': '🩸🩸 Moyen', 
                    'heavy': '🩸🩸🩸 Abondant'
                };
                details.push(bleedMap[e.bleeding] || e.bleeding);
            }

            const dateFr = new Date(e.date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'});

            return `
            <li class="history-item">
                <div>
                    <div style="font-weight: 700; color: var(--primary); margin-bottom: 4px;">${dateFr}</div>
                    <div style="font-size: 0.9rem; color: #666;">${details.join(' • ')}</div>
                </div>
                <button class="btn-delete-entry" data-date="${e.date}">×</button>
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
            
            // Rafraîchir le graphique pour mettre à jour les couleurs
            if (this.paperChart) {
                this.updateGlobalUI();
            }
        });
    }
}