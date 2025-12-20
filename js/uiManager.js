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
        this.initCycleManager(); // Gestionnaire de cycle
        this.initTheme();
        this.initChartOverlay();
        
        const btnTemp = document.getElementById('btn-validate-temp');
        if(btnTemp) btnTemp.addEventListener('click', () => this.validateTemperature());
				
				if(this.dom.btnValidateMucus) {
						this.dom.btnValidateMucus.addEventListener('click', () => this.validateMucus());
				}

        // CORRECTION BUG CHARGEMENT : On force le rafraichissement total dès le début
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
            inputs: {
                sensation: document.querySelectorAll('input[name="sensation"]'),
                aspect: document.querySelectorAll('input[name="aspect"]'),
                perturbations: [
                    document.getElementById('p-sleep'),
                    document.getElementById('p-alcohol'),
                    document.getElementById('p-illness'),
                    document.getElementById('p-stress'),
                    document.getElementById('p-late')
                ]
            }
						
        };
				
				if(!document.getElementById('btn-delete-cycle')) {
						const container = document.querySelector('.cycle-actions');
						if(container) {
								const btnDel = document.createElement('button');
								btnDel.id = 'btn-delete-cycle';
								btnDel.className = 'btn-mini';
								btnDel.style.borderColor = 'red';
								btnDel.style.color = 'red';
								btnDel.innerHTML = '🗑️';
								container.appendChild(btnDel);
								this.dom.btnDeleteCycle = btnDel;
						}
					}	
				
				this.dom.overlay = document.getElementById('full-screen-chart-overlay');
        this.dom.btnOpenChart = document.getElementById('btn-open-chart');
        this.dom.btnCloseChart = document.getElementById('btn-close-chart');

    }
		
		
		validateMucus() {
				const sensation = document.querySelector('input[name="sensation"]:checked')?.value;
				const aspect = document.querySelector('input[name="aspect"]:checked')?.value;
				const flow = document.querySelector('input[name="flow"]:checked')?.value; // Nouvelle ligne

				const date = this.dom.date.value;
				
				this.dm.saveEntry({
						date: date,
						mucusSensation: sensation,
						mucusAspect: aspect,
						bleedingFlow: flow // On enregistre le flux
				});

				this.refreshAll();
		}

    // --- GESTION TEMPERATURE ---
		setCurrentDateTime() {
				const now = new Date();
				
				// Format YYYY-MM-DD pour l'input date
				const dateStr = now.toISOString().split('T')[0];
				this.dom.date.value = dateStr;
				
				// Format HH:MM pour l'input time
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

    createWheel(container, min, max, active) {
        if(!container) return;
        container.innerHTML = '<div></div>'; // Padding
        for (let i = min; i <= max; i++) {
            const el = document.createElement('div');
            el.textContent = i;
            el.dataset.val = i;
            container.appendChild(el);
        }
        container.innerHTML += '<div></div>'; // Padding
    }

    onWheelScroll(wheel) {
        clearTimeout(wheel.scrollTimeout);
        wheel.scrollTimeout = setTimeout(() => {
            const items = wheel.querySelectorAll('div[data-val]');
            let closest = null;
            let minDist = Infinity;
            const center = wheel.scrollTop + (wheel.clientHeight / 2);

            items.forEach(item => {
                const dist = Math.abs((item.offsetTop + item.clientHeight / 2) - center);
                if (dist < minDist) {
                    minDist = dist;
                    closest = item;
                }
            });

            if (closest) {
                wheel.scrollTo({ top: closest.offsetTop - (wheel.clientHeight / 2) + (closest.clientHeight / 2), behavior: 'smooth' });
                const val = parseInt(closest.dataset.val);
                if (wheel === this.dom.wheelInt) this.tempInt = val;
                if (wheel === this.dom.wheelDec1) this.tempDec1 = val;
                if (wheel === this.dom.wheelDec2) this.tempDec2 = val;
                this.updateTempDisplay();
            }
        }, 100);
    }

    updateTempDisplay() {
        if (this.dom.tempDisplay) {
            this.dom.tempDisplay.textContent = `${this.tempInt}.${this.tempDec1}${this.tempDec2}°C`;
        }
    }

    validateTemperature() {
        const temp = parseFloat(`${this.tempInt}.${this.tempDec1}${this.tempDec2}`);
        const entry = {
            date: this.dom.date.value,
            time: this.dom.time.value,
            temp: temp
        };
        this.dm.saveEntry(entry);
        this.refreshAll();
    }
		
		// Dans js/uiManager.js, modifiez la fonction initChartOverlay :
		initChartOverlay() {
				if (this.dom.btnOpenChart) {
						this.dom.btnOpenChart.addEventListener('click', async () => {
								this.dom.overlay.classList.remove('hidden');
								this.updateGlobalUI(); 

								// Tenter de forcer le paysage sur Android/Chrome
								if (screen.orientation && screen.orientation.lock) {
										try {
												await screen.orientation.lock('landscape');
										} catch (err) {
												console.log("La rotation forcée a été bloquée ou n'est pas supportée.");
										}
								}
								
								// Scroll auto vers la fin du cycle
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

    // --- GESTION GLAIRE & INFOS ---
		initInputs() {
				this.dom.date.addEventListener('change', () => this.loadDataForCurrentDate());
				
				// On retire les écouteurs 'change' sur les radios de glaire
				// On ajoute l'écouteur sur le bouton Valider
				if(this.dom.btnValidateMucus) {
						this.dom.btnValidateMucus.addEventListener('click', () => {
								this.saveMucus();
						});
				}

				// Les perturbations restent en auto-save (c'est plus pratique pour des checkbox)
				[...this.dom.inputs.perturbations, this.dom.manualExclude].forEach(i => {
						if(i) i.addEventListener('change', () => this.saveMisc());
				});
				
				// GESTION DU BOUTON SAUVEGARDE AUTO
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
				
				const bleedingRadios = document.querySelectorAll('input[name="bleeding"]');
        bleedingRadios.forEach(r => {
            r.addEventListener('click', () => { // Click permet de déselectionner si besoin
               this.saveBleeding();
            });
        });
		}
		
		saveBleeding() {
        const val = document.querySelector('input[name="bleeding"]:checked')?.value;
        // Si c'est 'spotting', on l'enregistre. Si c'est 'menses', on pourrait proposer nouveau cycle
        // Pour l'instant on enregistre juste la donnée.
        this.dm.saveEntry({
            date: document.getElementById('global-date').value,
            bleeding: val
        });
        this.refreshAll();
    }

    saveMucus() {
        const sensation = document.querySelector('input[name="sensation"]:checked')?.value;
        const aspect = document.querySelector('input[name="aspect"]:checked')?.value;
        this.dm.saveEntry({
            date: this.dom.date.value,
            mucusSensation: sensation,
            mucusAspect: aspect
        });
        this.refreshAll();
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

		initCycleManager() {
				// Gestionnaire "Nouveau Cycle" via Input Date caché
				if (this.dom.btnAddCycle && this.dom.newCyclePicker) {
						this.dom.btnAddCycle.addEventListener('click', () => {
								// Ouvre le sélecteur natif
								this.dom.newCyclePicker.showPicker(); 
						});

						this.dom.newCyclePicker.addEventListener('change', (e) => {
								if(e.target.value) {
										this.dm.startNewCycle(e.target.value);
										this.refreshAll();
										// Reset pour pouvoir resélectionner la même date si besoin
										this.dom.newCyclePicker.value = ''; 
								}
						});
				}

				// Gestionnaire "Modifier Date Cycle" (Code existant amélioré)
				if (this.dom.btnEditCycle && this.dom.datePickerHidden) {
						this.dom.btnEditCycle.addEventListener('click', () => this.dom.datePickerHidden.showPicker());
						this.dom.datePickerHidden.addEventListener('change', (e) => {
								const cycle = this.dm.getCurrentCycle();
								if(e.target.value) { 
										cycle.startDate = e.target.value; 
										this.dm.saveData(); 
										this.refreshAll(); 
								}
						});
				}
				
				if (this.dom.btnDeleteCycle) {
            this.dom.btnDeleteCycle.addEventListener('click', () => {
                if(this.dm.deleteCurrentCycle()) {
                    this.refreshAll();
                }
            });
        }

				if (this.dom.cycleSelector) {
						this.dom.cycleSelector.addEventListener('change', (e) => {
								this.dm.setActiveCycleIndex(parseInt(e.target.value));
								this.refreshAll();
						});
				}
		}

    refreshAll() {
        this.updateCycleSelectorOptions();
        this.updateCycleHeaderLabel();
        this.updateGlobalUI();
        this.loadDataForCurrentDate();
    }

		updateCycleSelectorOptions() {
				if(!this.dom.cycleSelector) return;
				const cycles = this.dm.getAllCycles();
				
				// Affichage: "#ID - Date (YYYY-MM-DD)"
				this.dom.cycleSelector.innerHTML = cycles.map((c, i) => 
						`<option value="${i}" ${i === this.dm.getActiveCycleIndex() ? 'selected' : ''}>
								#${c.id} - ${c.startDate}
						</option>`
				).join('');
		}

    updateCycleHeaderLabel() {
        if(!this.dom.cycleInfo) return;
        const cycle = this.dm.getCurrentCycle();
        const start = new Date(cycle.startDate);
        this.dom.cycleInfo.textContent = `Débuté le ${start.toLocaleDateString('fr-FR', {day:'numeric', month:'short'})}`;
    }

    // --- UTILS ---
    loadDataForCurrentDate() {
        const date = this.dom.date.value;
        const cycle = this.dm.getCurrentCycle();
        const entry = cycle.entries.find(e => e.date === date);

        // Reset UI
        document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        this.dom.inputs.perturbations.forEach(p => { if(p) p.checked = false; });
        if(this.dom.manualExclude) this.dom.manualExclude.checked = false;

        if (entry) {
            if (entry.mucusSensation) {
                const rad = document.querySelector(`input[name="sensation"][value="${entry.mucusSensation}"]`);
                if(rad) rad.checked = true;
            }
            if (entry.mucusAspect) {
                const rad = document.querySelector(`input[name="aspect"][value="${entry.mucusAspect}"]`);
                if(rad) rad.checked = true;
            }
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
						
						this.updateHistoryList(cycle);
				}

    updateHistoryList(cycle) {
        if(!this.dom.historyList) return;
        const entries = [...cycle.entries].reverse();
        this.dom.historyList.innerHTML = entries.map(e => `
            <li class="history-item">
                <strong>${e.date}</strong>: ${e.temp ? e.temp + '°' : '--'} 
                | Glaire: ${CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect)}
            </li>
        `).join('');
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