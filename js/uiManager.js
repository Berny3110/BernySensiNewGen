/**
 * Gestionnaire principal de l’interface utilisateur de SensiTrack.
 */

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
        this.editingCycleIndex = null; // Index du cycle en cours d'édition (null si aucun)
    }

    init() {
        this.paperChart = new PaperRenderer('paperChartCanvas');
        this.cacheDOM();
        
        this._lockOrientation('portrait');
        
        setTimeout(() => this.setCurrentDateTime(), 80);
        this.initWheels();
        this.initTabs();
        this.initInputs();
        this.initCycleNavigation();
        this.initCycleManager();
        this.initTheme();
        this.initChartOverlay();

        const btnTemp = document.getElementById('btn-validate-temp');
        if (btnTemp) btnTemp.addEventListener('click', () => this.validateTemperature());
        
        if (this.dom.btnValidateMucus) {
            this.dom.btnValidateMucus.addEventListener('click', () => this.validateMucus());
        }

        const btnMisc = document.getElementById('btn-validate-misc');
        if (btnMisc) btnMisc.addEventListener('click', () => this.validateMisc());

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
            
            cycleDisplayCompact: document.getElementById('cycle-display-compact'),
            btnPrevCycle: document.getElementById('btn-prev-cycle'),
            btnNextCycle: document.getElementById('btn-next-cycle'),
            
            manualExclude: document.getElementById('manual-exclude-temp'),
            historyList: document.getElementById('history-list'),
            btnValidateMucus: document.getElementById('btn-validate-mucus'),
            overlay: document.getElementById('full-screen-chart-overlay'),
            btnOpenChart: document.getElementById('btn-open-chart'),
            btnCloseChart: document.getElementById('btn-close-chart'),
            btnToggleRotate: document.getElementById('btn-toggle-rotate'),
            toast: document.getElementById('sensitrack-toast'),
            
            inputs: {
                sensation: document.querySelectorAll('input[name="mucus-sensation"]'),
                aspect: document.querySelectorAll('input[name="mucus-aspect"]'),
                bleeding: document.querySelectorAll('input[name="bleeding"]'),
                loveCheckbox: document.getElementById('p-love'),
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

    showToast(message) {
        if (!this.dom.toast) {
            this.dom.toast = document.getElementById('sensitrack-toast');
        }
        if (this.dom.toast) {
            this.dom.toast.textContent = message;
            this.dom.toast.classList.add('show');
            setTimeout(() => this.dom.toast.classList.remove('show'), 1800);
        }
    }
    
    validateMucus() {
        if (!this.dom.date || !this.dom.date.value) {
            alert('Veuillez sélectionner une date valide');
            return;
        }
        const entryData = { date: this.dom.date.value };
        
        const bleeding = document.querySelector('input[name="bleeding"]:checked')?.value || 'none';
        const sensation = document.querySelector('input[name="mucus-sensation"]:checked')?.value;
        const aspect = document.querySelector('input[name="mucus-aspect"]:checked')?.value;

        if (bleeding && bleeding !== 'none') {
            entryData.bleeding = bleeding;
            entryData.mucusSensation = null;
            entryData.mucusAspect = null;
        } else {
            if (typeof sensation !== 'undefined') entryData.mucusSensation = sensation;
            if (typeof aspect !== 'undefined') entryData.mucusAspect = aspect;
            entryData.bleeding = 'none';
        }

        const success = this.dm.saveEntry(entryData);
        
        if (success) {
            const btn = this.dom.btnValidateMucus;
            if (btn) {
                const originalText = btn.innerText;
                btn.innerText = "✓ Enregistré !";
                setTimeout(() => btn.innerText = originalText, 1000);
            }
            if (navigator.vibrate) navigator.vibrate(50);
            this.showToast("Glaire & saignements enregistrés ✓");
            this.refreshAll();
        } else {
            alert('Erreur : date invalide');
        }
    }

    setCurrentDateTime() {
        const now = new Date();
        const dateStr = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')
        ].join('-');

        if (this.dom.date) {
            this.dom.date.value = dateStr;
        }

        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        if (this.dom.time) {
            this.dom.time.value = `${hours}:${minutes}`;
        }
    }

    initWheels() {
        const updateDisplay = () => {
            if (this.dom.tempDisplay) {
                this.dom.tempDisplay.textContent = `${this.tempInt}.${this.tempDec1}${this.tempDec2}°C`;
            }
        };

        if (this.dom.wheelInt) {
            this.wheelInt = new WheelManager({
                element: this.dom.wheelInt,
                min: 35, max: 39, currentValue: 36, isRepeating: false
            }, (v) => { this.tempInt = v; updateDisplay(); });
        }

        if (this.dom.wheelDec1) {
            this.wheelDec1 = new WheelManager({
                element: this.dom.wheelDec1,
                min: 0, max: 9, currentValue: 3, isRepeating: true
            }, (v) => { this.tempDec1 = v; updateDisplay(); });
        }

        if (this.dom.wheelDec2) {
            this.wheelDec2 = new WheelManager({
                element: this.dom.wheelDec2,
                min: 0, max: 9, currentValue: 0, isRepeating: true
            }, (v) => { this.tempDec2 = v; updateDisplay(); });
        }
        
        updateDisplay();
    }

    validateTemperature() {
        if (!this.dom.date || !this.dom.date.value) {
            alert('Veuillez sélectionner une date valide');
            return;
        }
        const temp = parseFloat(`${this.tempInt}.${this.tempDec1}${this.tempDec2}`);
        const entry = {
            date: this.dom.date.value,
            time: this.dom.time ? this.dom.time.value : '07:00',
            temp: temp
        };
        
        const success = this.dm.saveEntry(entry);
        if (success) {
            const btn = document.getElementById('btn-validate-temp');
            if (btn) {
                const originalText = btn.innerText;
                btn.innerText = "✓ Enregistré !";
                setTimeout(() => btn.innerText = originalText, 1000);
            }
            if (navigator.vibrate) navigator.vibrate(50);
            this.showToast("Température enregistrée ✓");
            this.refreshAll();
        } else {
            alert('Erreur : date invalide');
        }
    }
    
    initCycleNavigation() {
        if (this.dom.btnPrevCycle) {
            this.dom.btnPrevCycle.addEventListener('click', () => {
                const current = this.dm.getActiveCycleIndex();
                if (current > 0) {
                    this.dm.setActiveCycleIndex(current - 1);
                    this.editingCycleIndex = null;
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
                    this.editingCycleIndex = null;
                    this.refreshAll();
                }
            });
        }
    }
    
    updateCycleNavDisplay() {
        const cycles = this.dm.getAllCycles();
        const activeIndex = this.dm.getActiveCycleIndex();
        const cycle = cycles[activeIndex] || cycles[0];
        if (!cycle) return;
        
        if (this.dom.cycleDisplayCompact) {
            const status = activeIndex === cycles.length - 1 ? ' (En cours)' : '';
            this.dom.cycleDisplayCompact.textContent = `Cycle #${cycle.id}${status}`;
        }
        
        if (this.dom.btnPrevCycle) {
            this.dom.btnPrevCycle.disabled = activeIndex <= 0;
        }
        if (this.dom.btnNextCycle) {
            this.dom.btnNextCycle.disabled = activeIndex >= cycles.length - 1;
        }
    }
        
    _lockOrientation(type) {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock(type).catch(() => {});
        }
    }

    initChartOverlay() {
        if (this.dom.btnOpenChart) {
            this.dom.btnOpenChart.addEventListener('click', () => {
                this.dom.overlay.classList.remove('hidden');
                this.chartZoom = 1.0;

                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }

                setTimeout(() => {
                    this.updateGlobalUI();
                    const container = document.getElementById('canvas-scroll-container');
                    if (container) { 
                        container.scrollLeft = 0; 
                        container.scrollTop = 0; 
                    }
                }, 150);
            });
        }

        if (this.dom.btnCloseChart) {
            this.dom.btnCloseChart.addEventListener('click', () => {
                this.dom.overlay.classList.add('hidden');
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('portrait').catch(() => {});
                }
            });
        }

        if (this.dom.btnToggleRotate) {
            this.dom.btnToggleRotate.addEventListener('click', () => {
                this.dom.overlay.classList.toggle('rotate-90');
                setTimeout(() => this.updateGlobalUI(), 100);
            });
        }

        window.addEventListener('orientationchange', () => {
            if (!this.dom.overlay.classList.contains('hidden')) {
                setTimeout(() => { this.updateGlobalUI(); }, 400);
            }
        });

        window.addEventListener('resize', () => {
            if (!this.dom.overlay.classList.contains('hidden')) {
                this.updateGlobalUI();
            }
        });

        const container = document.getElementById('canvas-scroll-container') || this.dom.overlay;
        if (!container) return;

        const updateContainerTouchAction = () => {
            container.style.touchAction = (this.chartZoom && this.chartZoom !== 1.0) ? 'none' : 'auto';
        };

        updateContainerTouchAction();

        let pointers = new Map();
        let pinchStartDist = 0;
        let pinchStartZoom = this.chartZoom || 1.0;
        let lastTap = 0;
        let isDragging = false;
        let lastPointerPos = null;

        function getDistance(p1, p2) {
            const dx = p2.clientX - p1.clientX;
            const dy = p2.clientY - p1.clientY;
            return Math.hypot(dx, dy);
        }
        function getCenter(p1, p2) {
            return { x: (p1.clientX + p2.clientX) / 2, y: (p1.clientY + p2.clientY) / 2 };
        }

        container.addEventListener('pointerdown', (e) => {
            try { container.setPointerCapture(e.pointerId); } catch (err) {}
            pointers.set(e.pointerId, e);

            const now = Date.now();
            if (now - lastTap < 300) {
                this.chartZoom = 1.0;
                this.updateGlobalUI();
                updateContainerTouchAction();
            }
            lastTap = now;

            if (pointers.size === 1 && (this.chartZoom && this.chartZoom !== 1.0)) {
                isDragging = true;
                lastPointerPos = { x: e.clientX, y: e.clientY };
            }

            if (pointers.size === 2) {
                const pts = Array.from(pointers.values());
                pinchStartDist = getDistance(pts[0], pts[1]);
                pinchStartZoom = this.chartZoom || 1.0;
            }
        }, { passive: true });

        container.addEventListener('pointermove', (e) => {
            if (!pointers.has(e.pointerId)) return;
            pointers.set(e.pointerId, e);

            if (pointers.size === 2) {
                const pts = Array.from(pointers.values());
                const curDist = getDistance(pts[0], pts[1]);
                if (pinchStartDist > 0) {
                    const center = getCenter(pts[0], pts[1]);
                    const rect = container.getBoundingClientRect();
                    const centerX = center.x - rect.left;
                    const centerY = center.y - rect.top;

                    const oldZoom = pinchStartZoom;
                    const scale = curDist / pinchStartDist;
                    const newZoom = Math.max(0.5, Math.min(3.0, pinchStartZoom * scale));
                    if (newZoom === this.chartZoom) return;

                    const ratio = newZoom / oldZoom;
                    const prevScrollLeft = container.scrollLeft;
                    const prevScrollTop = container.scrollTop;
                    const newScrollLeft = Math.max(0, Math.round((prevScrollLeft + centerX) * ratio - centerX));
                    const newScrollTop = Math.max(0, Math.round((prevScrollTop + centerY) * ratio - centerY));

                    this.chartZoom = newZoom;
                    updateContainerTouchAction();
                    this.updateGlobalUI();

                    setTimeout(() => {
                        container.scrollLeft = newScrollLeft;
                        container.scrollTop = newScrollTop;
                    }, 0);

                    if (e.cancelable) e.preventDefault();
                }
                return;
            }

            if (isDragging && pointers.size === 1 && lastPointerPos) {
                let dx = e.clientX - lastPointerPos.x;
                let dy = e.clientY - lastPointerPos.y;

                if (window.innerHeight > window.innerWidth && this.dom.overlay.classList.contains('rotate-90')) {
                    let temp = dx;
                    dx = dy;
                    dy = -temp;
                }

                container.scrollLeft -= dx;
                container.scrollTop -= dy;
                
                lastPointerPos = { x: e.clientX, y: e.clientY };
                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        container.addEventListener('pointerup', (e) => {
            pointers.delete(e.pointerId);
            try { container.releasePointerCapture(e.pointerId); } catch (err) {}
            if (pointers.size < 2) pinchStartDist = 0;
            if (pointers.size === 0) { isDragging = false; lastPointerPos = null; }
        }, { passive: true });

        container.addEventListener('pointercancel', (e) => {
            pointers.delete(e.pointerId);
            pinchStartDist = 0;
            isDragging = false;
            lastPointerPos = null;
        }, { passive: true });

        container.addEventListener('wheel', (e) => {
            const rect = container.getBoundingClientRect();
            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;

            const delta = e.deltaY;
            const factor = e.ctrlKey ? 0.0015 : 0.0025;
            const change = 1 - (delta * factor);
            const newZoom = Math.max(0.5, Math.min(3.0, this.chartZoom * change));
            if (newZoom === this.chartZoom) return;

            const ratio = newZoom / this.chartZoom;
            const prevScrollLeft = container.scrollLeft;
            const prevScrollTop = container.scrollTop;
            const newScrollLeft = Math.max(0, Math.round((prevScrollLeft + centerX) * ratio - centerX));
            const newScrollTop = Math.max(0, Math.round((prevScrollTop + centerY) * ratio - centerY));

            this.chartZoom = newZoom;
            updateContainerTouchAction();
            this.updateGlobalUI();
            setTimeout(() => {
                container.scrollLeft = newScrollLeft;
                container.scrollTop = newScrollTop;
            }, 0);

            e.preventDefault();
        }, { passive: false });
    }

    initInputs() {
        if (this.dom.date) {
            this.dom.date.addEventListener('change', () => this.loadDataForCurrentDate());
        }
        
        if (this.dom.inputs.bleeding) {
            this.dom.inputs.bleeding.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.updateMucusUIState(e.target.value !== 'none');
                    if (e.target.value !== 'none') {
                        this.dom.inputs.sensation.forEach(r => r.checked = false);
                        this.dom.inputs.aspect.forEach(r => r.checked = false);
                    }
                });
            });
        }

        if (this.dom.inputs.sensation || this.dom.inputs.aspect) {
            [...(this.dom.inputs.sensation || []), ...(this.dom.inputs.aspect || [])].forEach(radio => {
                radio.addEventListener('change', () => {
                    const noneRadio = document.querySelector('input[name="bleeding"][value="none"]');
                    if (noneRadio) {
                        noneRadio.checked = true;
                        this.updateMucusUIState(false);
                    }
                });
            });
        }

        [...this.dom.inputs.perturbations, this.dom.manualExclude, this.dom.inputs.loveCheckbox].forEach(i => {
            if (i) i.addEventListener('change', () => this.saveMisc());
        });
    }
    
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
        if (!this.dom.date || !this.dom.date.value) return false;
        const entry = { date: this.dom.date.value };
        if (this.dom.manualExclude) entry.excludeTemp = this.dom.manualExclude.checked;
        if (this.dom.inputs.loveCheckbox) entry.love = this.dom.inputs.loveCheckbox.checked;

        const perts = {};
        this.dom.inputs.perturbations.forEach(p => {
            if (p && p.id !== 'p-love') perts[p.id] = p.checked;
        });
        if (Object.keys(perts).length > 0) entry.perturbations = perts;
        
        return this.dm.saveEntry(entry);
    }

    validateMisc() {
        const success = this.saveMisc();
        if (success) {
            const btn = document.getElementById('btn-validate-misc');
            if (btn) {
                const originalText = btn.innerText;
                btn.innerText = '✓ Enregistré !';
                setTimeout(() => btn.innerText = originalText, 1000);
            }
            if (navigator.vibrate) navigator.vibrate(50);
            this.showToast('Informations enregistrées ✓');
            this.refreshAll();
        } else {
            alert('Erreur : date invalide');
        }
    }

    // =========================================================================
    // GESTION DU TABLEAU DES CYCLES (AFFICHAGE NORMAL + MODE ÉDITION SUR DEMANDE)
    // =========================================================================
    initCycleManager() {
        const btnAddCycle = document.getElementById('btn-add-cycle-main');
        const btnConfirmNew = document.getElementById('btn-confirm-new-cycle');
        const btnCancelNew = document.getElementById('btn-cancel-new-cycle');
        const newCycleForm = document.getElementById('new-cycle-form');
        const newCyclePicker = document.getElementById('new-cycle-picker');
        
        if (btnAddCycle) {
            btnAddCycle.addEventListener('click', () => {
                if (newCycleForm) {
                    newCycleForm.style.display = newCycleForm.style.display === 'none' ? 'flex' : 'none';
                    if (newCyclePicker) {
                        newCyclePicker.value = new Date().toISOString().split('T')[0];
                        newCyclePicker.focus();
                    }
                }
            });
        }
        
        if (btnConfirmNew) {
            btnConfirmNew.addEventListener('click', () => {
                const startDate = newCyclePicker?.value;
                if (startDate) {
                    this.dm.startNewCycle(startDate);
                    if (newCycleForm) newCycleForm.style.display = 'none';
                    this.editingCycleIndex = null;
                    this.showToast('Nouveau cycle créé ✓');
                    this.refreshAll();
                }
            });
        }
        
        if (btnCancelNew) {
            btnCancelNew.addEventListener('click', () => {
                if (newCycleForm) newCycleForm.style.display = 'none';
            });
        }
        
        const tbody = document.getElementById('cycles-table-body');
        if (tbody) {
            // Clic sur le tableau : délégation d'événements propre
            tbody.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (!row) return;
                
                const index = parseInt(row.dataset.index, 10);
                if (isNaN(index)) return;

                // 1. Bouton Supprimer
                if (e.target.closest('.btn-delete-cycle')) {
                    e.stopPropagation();
                    if (this.dm.deleteCycle(index)) {
                        if (this.editingCycleIndex === index) {
                            this.editingCycleIndex = null;
                        }
                        this.showToast('Cycle supprimé');
                        this.refreshAll();
                    }
                    return;
                }

                // 2. Bouton Modifier (✏️) -> Enclenche le mode édition pour cette ligne
                if (e.target.closest('.btn-edit-cycle')) {
                    e.stopPropagation();
                    this.editingCycleIndex = index;
                    this.updateCyclesTable();
                    
                    // Focus automatique sur le premier champ modifiable
                    setTimeout(() => {
                        const activeRow = tbody.querySelector(`tr[data-index="${index}"]`);
                        const idInput = activeRow?.querySelector('.cycle-id-input');
                        if (idInput) {
                            idInput.focus();
                            idInput.select();
                        }
                    }, 50);
                    return;
                }

                // 3. Bouton Enregistrer (✓) -> Valide les modifications
                if (e.target.closest('.btn-save-cycle')) {
                    e.stopPropagation();
                    this.saveCycleRowEdit(row, index);
                    return;
                }

                // 4. Bouton Annuler (✕) -> Sort du mode édition sans sauvegarder
                if (e.target.closest('.btn-cancel-edit-cycle')) {
                    e.stopPropagation();
                    this.editingCycleIndex = null;
                    this.updateCyclesTable();
                    return;
                }

                // Si on clique dans un input de la ligne en cours d'édition, ne rien faire de spécial
                if (e.target.closest('input')) {
                    e.stopPropagation();
                    return;
                }

                // 5. Clic standard sur la ligne -> Sélectionne le cycle actif
                if (this.editingCycleIndex !== null && this.editingCycleIndex !== index) {
                    this.editingCycleIndex = null;
                }
                this.dm.setActiveCycleIndex(index);
                this.refreshAll();
            });

            // Double-clic sur une cellule N° ou Date pour éditer rapidement
            tbody.addEventListener('dblclick', (e) => {
                const row = e.target.closest('tr');
                if (!row) return;
                const index = parseInt(row.dataset.index, 10);
                if (isNaN(index)) return;

                this.editingCycleIndex = index;
                this.updateCyclesTable();
                setTimeout(() => {
                    const activeRow = tbody.querySelector(`tr[data-index="${index}"]`);
                    const idInput = activeRow?.querySelector('.cycle-id-input');
                    if (idInput) {
                        idInput.focus();
                        idInput.select();
                    }
                }, 50);
            });

            // Validation par la touche Entrée ou annulation par Échap
            tbody.addEventListener('keydown', (e) => {
                if (e.target.classList.contains('cycle-id-input') || e.target.classList.contains('cycle-date-input')) {
                    const row = e.target.closest('tr');
                    const index = parseInt(row?.dataset.index, 10);
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (row && !isNaN(index)) {
                            this.saveCycleRowEdit(row, index);
                        }
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        this.editingCycleIndex = null;
                        this.updateCyclesTable();
                    }
                }
            });
        }
    }

    saveCycleRowEdit(row, index) {
        const idInput = row.querySelector('.cycle-id-input');
        const dateInput = row.querySelector('.cycle-date-input');
        let changed = false;

        if (idInput) {
            const newId = parseInt(idInput.value, 10);
            if (!isNaN(newId) && newId > 0) {
                this.dm.updateCycleId(index, newId);
                changed = true;
            }
        }

        if (dateInput && dateInput.value) {
            this.dm.updateCycleStartDate(index, dateInput.value);
            changed = true;
        }

        this.editingCycleIndex = null;
        if (changed) {
            this.showToast('Cycle mis à jour ✓');
        }
        this.refreshAll();
    }
        
    updateCyclesTable() {
        const tbody = document.getElementById('cycles-table-body');
        if (!tbody) return;

        const cycles = this.dm.getAllCycles();
        const activeIndex = this.dm.getActiveCycleIndex();

        // Tri par date de début (du plus ancien au plus récent)
        const sortedCycles = cycles
            .map((c, originalIndex) => ({ ...c, originalIndex }))
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        tbody.innerHTML = sortedCycles.map((c, idx) => {
            const start = new Date(c.startDate);
            start.setHours(0, 0, 0, 0);

            let end;
            const nextCycle = sortedCycles[idx + 1];
            if (nextCycle) {
                end = new Date(nextCycle.startDate);
                end.setDate(end.getDate() - 1);
                end.setHours(0, 0, 0, 0);
            } else {
                end = new Date();
                end.setHours(0, 0, 0, 0);
            }

            const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const duration = `${days}j`;
            const entriesCount = c.entries ? c.entries.length : 0;
            const isCurrent = c.originalIndex === activeIndex;
            const isLast = idx === sortedCycles.length - 1;
            const isEditing = this.editingCycleIndex === c.originalIndex;

            // Date formatée pour l'affichage propre
            let dateDisplay = c.startDate;
            try {
                const parts = c.startDate.split('-');
                if (parts.length === 3) {
                    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
                    const day = parseInt(parts[2], 10);
                    const monthName = months[parseInt(parts[1], 10) - 1];
                    const year = parts[0];
                    dateDisplay = `${day} ${monthName} ${year}`;
                }
            } catch (e) {}

            // 1. SI LA LIGNE EST EN COURS D'ÉDITION
            if (isEditing) {
                return `
                    <tr class="cycle-row-editing ${isCurrent ? 'active-cycle' : ''}" data-index="${c.originalIndex}">
                        <td class="cycle-id-cell">
                            <input type="number" class="cycle-id-input" value="${c.id}" min="1" title="Modifier le numéro">
                        </td>
                        <td class="cycle-date-cell">
                            <input type="date" class="cycle-date-input" value="${c.startDate}" title="Modifier la date de début">
                        </td>
                        <td>
                            <span class="cycle-duration ${isCurrent ? 'current' : ''}">${duration}</span>
                            ${isCurrent ? `<span class="cycle-status-tag">${isLast ? 'EN COURS' : 'ACTIF'}</span>` : ''}
                        </td>
                        <td>${entriesCount}</td>
                        <td class="cycle-actions-cell">
                            <button class="btn-icon-small success btn-save-cycle" data-index="${c.originalIndex}" title="Valider les modifications">✓</button>
                            <button class="btn-icon-small btn-cancel-edit-cycle" data-index="${c.originalIndex}" title="Annuler">✕</button>
                        </td>
                    </tr>
                `;
            }

            // 2. PAR DÉFAUT : AFFICHAGE NORMAL (TEXTE CLAIR, PAS D'INPUTS EN PERMANENCE !)
            return `
                <tr class="${isCurrent ? 'active-cycle' : ''}" data-index="${c.originalIndex}">
                    <td class="cycle-id-cell" title="Double-cliquer pour modifier">
                        <span class="cycle-id-badge">#${c.id}</span>
                    </td>
                    <td class="cycle-date-cell" title="Double-cliquer pour modifier">
                        <span class="cycle-date-text">${dateDisplay}</span>
                    </td>
                    <td>
                        <span class="cycle-duration ${isCurrent ? 'current' : ''}">${duration}</span>
                        ${isCurrent ? `<span class="cycle-status-tag">${isLast ? 'EN COURS' : 'ACTIF'}</span>` : ''}
                    </td>
                    <td>${entriesCount}</td>
                    <td class="cycle-actions-cell">
                        <button class="btn-icon-small btn-edit-cycle" data-index="${c.originalIndex}" title="Modifier ce cycle">✏️</button>
                        <button class="btn-icon-small danger btn-delete-cycle" data-index="${c.originalIndex}" title="Supprimer ce cycle">🗑️</button>
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
        if (!this.dom.date) return;
        const date = this.dom.date.value;
        if (!date || date === 'Invalid Date') return;
        
        const cycle = this.dm.getCurrentCycle();
        const entry = cycle && cycle.entries ? cycle.entries.find(e => e.date === date) : null;

        // Réinitialiser les champs
        document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
        this.dom.inputs.perturbations.forEach(p => { if (p) p.checked = false; });
        if (this.dom.manualExclude) this.dom.manualExclude.checked = false;
        if (this.dom.inputs.loveCheckbox) {
            this.dom.inputs.loveCheckbox.checked = !!(entry && entry.love);
        }

        if (entry) {
            // Saignements
            if (entry.bleeding && entry.bleeding !== 'none') {
                const rad = document.querySelector(`input[name="bleeding"][value="${entry.bleeding}"]`);
                if (rad) rad.checked = true;
                this.updateMucusUIState(true);
            } else {
                this.updateMucusUIState(false);
                if (entry.mucusSensation) {
                    const rad = document.querySelector(`input[name="mucus-sensation"][value="${entry.mucusSensation}"]`);
                    if (rad) rad.checked = true;
                }
                if (entry.mucusAspect) {
                    const rad = document.querySelector(`input[name="mucus-aspect"][value="${entry.mucusAspect}"]`);
                    if (rad) rad.checked = true;
                }
            }

            // Perturbations
            if (entry.perturbations) {
                Object.keys(entry.perturbations).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.checked = !!entry.perturbations[id];
                });
            }
            if (this.dom.manualExclude) {
                this.dom.manualExclude.checked = !!(entry.excludeTemp || entry.exclude);
            }

            // Température
            if (entry.temp && typeof entry.temp === 'number') {
                const tempFloat = parseFloat(entry.temp);
                const intVal = Math.floor(tempFloat);
                const decimals = Math.round((tempFloat - intVal) * 100);
                const dec1Val = Math.floor(decimals / 10);
                const dec2Val = decimals % 10;
                
                this.tempInt = intVal;
                this.tempDec1 = dec1Val;
                this.tempDec2 = dec2Val;

                if (this.wheelInt) this.wheelInt.updatePosition ? this.wheelInt.cfg.currentValue = intVal : null;
                if (this.dom.tempDisplay) {
                    this.dom.tempDisplay.textContent = `${tempFloat.toFixed(2)}°C`;
                }
            }
        } else {
            this.updateMucusUIState(false);
            const defaultNone = document.querySelector('input[name="bleeding"][value="none"]');
            if (defaultNone) defaultNone.checked = true;
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
        const entries = cycle && cycle.entries 
            ? [...cycle.entries].sort((a, b) => new Date(b.date) - new Date(a.date))
            : [];
        
        if (entries.length === 0) {
            list.innerHTML = '<li style="text-align: center; padding: 40px; opacity: 0.5;">Aucune donnée dans ce cycle</li>';
            return;
        }
        
        list.innerHTML = entries.map(e => {
            let details = [];
            if (e.temp) {
                const tempStr = e.time ? `🌡️ ${e.temp.toFixed(2)}°C (${e.time})` : `🌡️ ${e.temp.toFixed(2)}°C`;
                details.push(tempStr);
            }
            
            const mucusCode = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
            if (mucusCode && mucusCode !== 'Ø') details.push(`Glaire: ${mucusCode}`);
            
            if (e.bleeding && e.bleeding !== 'none') {
                const bleedMap = {
                    'spotting': '💉 Spotting', 
                    'light': '🩸 Léger', 
                    'medium': '🩸🩸 Moyen', 
                    'heavy': '🩸🩸🩸 Abondant'
                };
                details.push(bleedMap[e.bleeding] || e.bleeding);
            }

            if (e.love) details.push('❤️');

            const dateFr = new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

            return `
            <li class="history-item" data-date="${e.date}" style="cursor:pointer;">
                <div class="history-info">
                    <div class="history-date">${dateFr}</div>
                    <div class="history-details">${details.join(' • ')}</div>
                </div>
                <button class="btn-delete-entry" data-date="${e.date}" title="Supprimer">✕</button>
            </li>`;
        }).join('');

        list.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-delete-entry')) return;
                
                const date = item.dataset.date;
                if (this.dom.date) this.dom.date.value = date;
                this.loadDataForCurrentDate();
                
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                const tempBtn = document.querySelector('.tab-btn[data-target="temp-panel"]');
                if (tempBtn) tempBtn.classList.add('active');
                const tempPanel = document.getElementById('temp-panel');
                if (tempPanel) tempPanel.classList.add('active');
            });
        });

        list.querySelectorAll('.btn-delete-entry').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dateToDelete = e.target.dataset.date;
                if (confirm("Supprimer cette entrée ?")) {
                    this.dm.deleteEntry(dateToDelete);
                    this.showToast('Entrée supprimée');
                    this.refreshAll();
                }
            });
        });
    }

    initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const panel = document.getElementById(target);
                if (panel) panel.classList.add('active');
                
                if (target === 'cycles-panel') this.updateCyclesTable();
                if (target === 'history-panel') this.updateHistoryList();
            });
        });
    }

    initTheme() {
        const toggle = document.getElementById('theme-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            
            if (this.paperChart) {
                this.updateGlobalUI();
            }
        });
    }
}
