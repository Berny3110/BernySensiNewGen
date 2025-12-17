import { CycleComputer } from './cycleComputer.js';

export class UIManager {
    constructor(dataManager, chartRenderer) {
        this.dm = dataManager;
        this.chart = chartRenderer;
        
        this.tempInt = 36;
        this.tempDec1 = 3;
        this.tempDec2 = 0;
    }

    init() {
        this.cacheDOM(); // maintenant sûr
        this.initHeader();
        this.initWheels();
        this.initTabs();
        this.initInputs();
        this.initCycleManager();
        this.initTheme();
        this.initCycleSelector();   // après cacheDOM → manualExclude existe
        this.initCycleHeader();

        document.getElementById('btn-validate-temp').addEventListener('click', () => {
            this.validateTemperature(true);
        });
        document.getElementById('btn-validate-mucus').addEventListener('click', () => {
            this.validateMucus();
        });

        this.dom.inputs.sensation.forEach(input => input.addEventListener('change', () => this.validateMucus()));
        this.dom.inputs.aspect.forEach(input => input.addEventListener('change', () => this.validateMucus()));

        [...this.dom.inputs.perturbations, this.dom.manualExclude].forEach(input => {
            input.addEventListener('change', () => this.autoSave());
        });

        this.loadDataForCurrentDate();
    }

    cacheDOM() {
        this.dom = {
            date: document.getElementById('global-date'),
            time: document.getElementById('global-time'),
            wheelInt: document.getElementById('wheel-int'),
            wheelDec1: document.getElementById('wheel-dec1'),
            wheelDec2: document.getElementById('wheel-dec2'),
            tempDisplay: document.getElementById('temp-value-display'),
            mucusCode: document.getElementById('mucus-code-display'),
            historyList: document.getElementById('history-list'),
            saveStatus: document.getElementById('save-status'),
            manualExclude: document.getElementById('manual-exclude-temp'),
            cycleSelector: null,
            inputs: {
                sensation: document.querySelectorAll('input[name="sensation"]'),
                aspect: document.querySelectorAll('input[name="aspect"]'),
                perturbations: document.querySelectorAll('#perturb-panel input[type="checkbox"]:not(#manual-exclude-temp)')
            }
        };
    }

    initCycleSelector() {
        const container = document.querySelector('.cycle-info');

        // Création du sélecteur
        this.dom.cycleSelector = document.createElement('select');
        this.dom.cycleSelector.id = 'cycle-selector';
        this.dom.cycleSelector.style.marginLeft = '10px';
        this.dom.cycleSelector.style.padding = '6px';
        this.dom.cycleSelector.style.borderRadius = '6px';
        this.dom.cycleSelector.style.border = '1px solid var(--border)';
        this.dom.cycleSelector.style.background = 'var(--bg-body)';
        this.dom.cycleSelector.style.color = 'var(--text-main)';

        // Remplissage des options
        this.updateCycleSelectorOptions();

        // Événement changement
        this.dom.cycleSelector.addEventListener('change', (e) => {
            const selectedIndex = parseInt(e.target.value);
            this.dm.setActiveCycleIndex(selectedIndex);
            this.updateCycleHeaderLabel();
            this.updateGlobalUI();
            this.loadDataForCurrentDate(); // recharge avec le nouveau cycle
        });

        container.appendChild(this.dom.cycleSelector);
    }

    updateCycleSelectorOptions() {
        if (!this.dom.cycleSelector) return;

        const cycles = this.dm.getAllCycles();
        const currentIndex = this.dm.getActiveCycleIndex();

        this.dom.cycleSelector.innerHTML = '';

        cycles.forEach((cycle, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Cycle #${cycle.id} (début ${cycle.startDate})`;
            if (index === currentIndex) option.selected = true;
            this.dom.cycleSelector.appendChild(option);
        });
    }

    updateCycleHeaderLabel() {
        const cycle = this.dm.getCurrentCycle();
        const label = document.getElementById('cycle-label');
        label.textContent = `Cycle #${cycle.id} (début : ${cycle.startDate})`;

        // Mettre à jour les options du sélecteur
        this.updateCycleSelectorOptions();
    }

    initCycleHeader() {
        this.updateCycleHeaderLabel();

        const label = document.getElementById('cycle-label');
        const input = document.getElementById('cycle-start-date');

        label.addEventListener('click', () => {
            label.style.display = 'none';
            input.style.display = 'inline-block';
            input.value = this.dm.getCurrentCycle().startDate;
        });

        input.addEventListener('change', () => {
            const newDate = input.value;
            if (newDate) {
                this.dm.getCurrentCycle().startDate = newDate;
                this.dm.saveData();
                this.updateCycleHeaderLabel();
            }
            input.style.display = 'none';
            label.style.display = 'inline-block';
        });
    }

    initHeader() {
        const now = new Date();
        this.dom.date.valueAsDate = now;
        this.dom.time.value = now.toTimeString().substring(0, 5);

        this.dom.date.addEventListener('change', () => this.loadDataForCurrentDate());
        this.dom.time.addEventListener('change', () => this.autoSave());
    }

    initWheels() {
        const repeatCount = 5;
        this.populateWheel(this.dom.wheelInt, 30, 42, this.tempInt, false, 1, 1);
        this.populateWheel(this.dom.wheelDec1, 0, 9, this.tempDec1, false, 10, repeatCount);
        this.populateWheel(this.dom.wheelDec2, 0, 9, this.tempDec2, false, 100, repeatCount);

        this.attachScrollListener(this.dom.wheelInt, (val) => { this.tempInt = val; this.onTempChange(); });
        this.attachScrollListener(this.dom.wheelDec1, (val) => { this.tempDec1 = val; this.onTempChange(); });
        this.attachScrollListener(this.dom.wheelDec2, (val) => { this.tempDec2 = val; this.onTempChange(); });

        // Forcer le centrage initial après rendu
				requestAnimationFrame(() => {
            this.setWheelValue(this.dom.wheelInt, this.tempInt, (val) => this.tempInt = val);
            this.setWheelValue(this.dom.wheelDec1, this.tempDec1, (val) => this.tempDec1 = val);
            this.setWheelValue(this.dom.wheelDec2, this.tempDec2, (val) => this.tempDec2 = val);
            this.onTempChange(); // met à jour l'affichage en bas
        });
    }
    populateWheel(container, min, max, initial, descending, multiplier, repeatCount = 1) {
        container.innerHTML = '';

        // Items fantômes haut
        for (let i = 0; i < 2; i++) {
            const empty = document.createElement('div');
            empty.className = 'wheel-item empty';
            container.appendChild(empty);
        }

        let values = [];
        for (let i = min; i <= max; i++) values.push(i);
        if (descending) values.reverse();

        let repeatedValues = [];
        for (let r = 0; r < repeatCount; r++) repeatedValues.push(...values);

        repeatedValues.forEach(val => {
            const el = document.createElement('div');
            el.className = 'wheel-item';
            el.textContent = val;
            el.dataset.val = val;
            container.appendChild(el);
        });

        // Items fantômes bas
        for (let i = 0; i < 2; i++) {
            const empty = document.createElement('div');
            empty.className = 'wheel-item empty';
            container.appendChild(empty);
        }

        // Positionnement initial
        const initialIndex = values.findIndex(v => v === initial);
        if (initialIndex !== -1) {
            const middleRepeatIndex = Math.floor(repeatCount / 2) * values.length;
            const indexInSingleList = descending ? (values.length - 1 - initialIndex) : initialIndex;
            const targetIndex = middleRepeatIndex + indexInSingleList;
            const item = container.querySelectorAll('.wheel-item')[targetIndex];
            if (item) {
                const offset = item.offsetTop - (container.clientHeight / 2) + (item.clientHeight / 2);
                container.scrollTop = offset;
                Array.from(container.children).forEach(c => c.classList.remove('active'));
                item.classList.add('active');
            }
        }
    }

    attachScrollListener(element, callback) {
        let isScrolling;
        element.addEventListener('scroll', () => {
            clearTimeout(isScrolling);
            isScrolling = setTimeout(() => {
                const itemHeight = 40;
                const scrollTop = element.scrollTop + (element.clientHeight / 2) - (itemHeight / 2);
                const index = Math.round(scrollTop / itemHeight);
                const items = element.querySelectorAll('.wheel-item:not(.empty)');
                if (items[index]) {
                    const val = parseInt(items[index].dataset.val);
                    callback(val);
                    Array.from(element.children).forEach(c => c.classList.remove('active'));
                    items[index].classList.add('active');
                }
            }, 100);
        });
    }

    onTempChange() {
        const total = `${this.tempInt}.${this.tempDec1}${this.tempDec2}`;
        this.dom.tempDisplay.textContent = total;
    }

    initInputs() {
        const allInputs = [
            ...this.dom.inputs.sensation,
            ...this.dom.inputs.aspect,
            ...this.dom.inputs.perturbations
        ];
        allInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateMucusDisplay();
                this.autoSave();
            });
        });
    }

    updateMucusDisplay() {
        const s = document.querySelector('input[name="sensation"]:checked')?.value || 'rien';
        const a = document.querySelector('input[name="aspect"]:checked')?.value || 'rien';
        this.dom.mucusCode.innerText = CycleComputer.classifyMucus(s, a);
    }

    validateTemperature() {
        const entry = {
            date: this.dom.date.value,
            time: this.dom.time.value,
            temp: parseFloat(`${this.tempInt}.${this.tempDec1}${this.tempDec2}`),
        };
        this.dm.saveEntry(entry);
        this.showSaveFeedback();
        this.updateGlobalUI();
    }

    validateMucus() {
        const date = this.dom.date.value;
        const s = document.querySelector('input[name="sensation"]:checked')?.value || 'rien';
        const a = document.querySelector('input[name="aspect"]:checked')?.value || 'rien';

        const entry = {
            date: date,
            mucus: {
                sensation: s,
                aspect: a,
                code: CycleComputer.classifyMucus(s, a)
            },
            perturbations: Array.from(this.dom.inputs.perturbations)
                .filter(cb => cb.checked)
                .map(cb => cb.id)
        };
        
        this.dm.saveEntry(entry);
        this.showSaveFeedback();
        this.updateMucusDisplay();
        this.updateGlobalUI();
    }

    autoSave() {
        const date = this.dom.date.value;
        const time = this.dom.time.value;
        const temp = parseFloat(`${this.tempInt}.${this.tempDec1}${this.tempDec2}`);
        
        // Calcul de l'exclusion
        const hasPerturbation = Array.from(this.dom.inputs.perturbations).some(cb => cb.checked);
        const manualExclude = this.dom.manualExclude.checked;
        const excludeTemp = hasPerturbation || manualExclude;

        const entry = {
            date: date,
            time: time,
            temp: temp,
            excludeTemp: excludeTemp,
            mucus: {
                sensation: document.querySelector('input[name="sensation"]:checked')?.value || 'rien',
                aspect: document.querySelector('input[name="aspect"]:checked')?.value || 'rien',
                code: this.dom.mucusCode.innerText
            },
            perturbations: Array.from(this.dom.inputs.perturbations)
                .filter(cb => cb.checked)
                .map(cb => cb.id)
        };

        this.dm.saveEntry(entry);
        this.showSaveFeedback();
        this.updateGlobalUI();
    }

    showSaveFeedback() {
        this.dom.saveStatus.textContent = "Enregistré";
        this.dom.saveStatus.classList.add('visible');
        setTimeout(() => this.dom.saveStatus.classList.remove('visible'), 2000);
    }

loadDataForCurrentDate() {
        const date = this.dom.date.value;
        const cycle = this.dm.getCurrentCycle();
        const entry = cycle.entries.find(e => e.date === date);

        if (entry) {
            if (entry.temp !== undefined) {
                const tStr = entry.temp.toFixed(2).split('.');
                this.tempInt = parseInt(tStr[0]);
                this.tempDec1 = parseInt(tStr[1][0]);
                this.tempDec2 = parseInt(tStr[1][1]);
                
                this.setWheelValue(this.dom.wheelInt, this.tempInt, (val) => { this.tempInt = val; });
                this.setWheelValue(this.dom.wheelDec1, this.tempDec1, (val) => { this.tempDec1 = val; });
                this.setWheelValue(this.dom.wheelDec2, this.tempDec2, (val) => { this.tempDec2 = val; });
                this.dom.tempDisplay.textContent = entry.temp.toFixed(2);
            }
            
            if (entry.time) this.dom.time.value = entry.time;

            if (entry.mucus) {
                this.checkRadio('sensation', entry.mucus.sensation);
                this.checkRadio('aspect', entry.mucus.aspect);
            }

            this.dom.inputs.perturbations.forEach(cb => cb.checked = false);
            if (entry.perturbations) {
                entry.perturbations.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.checked = true;
                });
            }

            const hasPerturbation = entry.perturbations && entry.perturbations.length > 0;
            this.dom.manualExclude.checked = !!entry.excludeTemp && !hasPerturbation;

        } else {
            this.dom.inputs.sensation.forEach(r => r.checked = false);
            this.dom.inputs.aspect.forEach(r => r.checked = false);
            this.dom.inputs.perturbations.forEach(r => r.checked = false);
            this.dom.manualExclude.checked = false;
        }
        
        this.updateMucusDisplay();
        const tStr = `${this.tempInt}.${this.tempDec1}${this.tempDec2}`;
        this.dom.tempDisplay.textContent = parseFloat(tStr).toFixed(2);
        this.updateGlobalUI();
    }

    checkRadio(name, value) {
        const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (el) el.checked = true;
    }

    setWheelValue(wheel, value, callback = null) {
        const items = wheel.querySelectorAll('.wheel-item:not(.empty)');
        let targetItem = null;

        items.forEach(item => {
            if (parseInt(item.dataset.val) === value) {
                targetItem = item;
            }
            item.classList.remove('active');
        });

        if (targetItem) {
            targetItem.classList.add('active');

            requestAnimationFrame(() => {
                const itemHeight = targetItem.offsetHeight;
                const containerHeight = wheel.clientHeight;
                const offset = targetItem.offsetTop - (containerHeight / 2) + (itemHeight / 2);
                wheel.scrollTop = offset;

                // Forcer la mise à jour de la variable interne
                if (callback) callback(value);
            });
        }
    }


    updateGlobalUI() {
        const cycle = this.dm.getCurrentCycle();
        const analysis = CycleComputer.analyzeCycle(cycle);
        
        this.chart.render(cycle, analysis);
        this.renderHistory(cycle);
        this.updateCycleHeaderLabel(); // assure cohérence
    }

    renderHistory(cycle) {
        this.dom.historyList.innerHTML = '';
        const sorted = [...cycle.entries].sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(e => {
            const li = document.createElement('li');
            li.className = 'history-item';
            
            let details = `<strong>${e.date}</strong> : ${e.temp ? e.temp.toFixed(2) + '°C' : '--.--°C'}`;
            if (e.excludeTemp) details += ` <em>(exclue)</em>`;
            if (e.mucus && e.mucus.code !== '--') details += ` | Glaire: ${e.mucus.code}`;
            if (e.perturbations && e.perturbations.length) details += ` | ⚠️`;

            li.innerHTML = `
                <span>${details}</span>
                <button class="btn-delete" data-date="${e.date}">×</button>
            `;
            
            li.querySelector('.btn-delete').addEventListener('click', (evt) => {
                if (confirm('Supprimer cette entrée ?')) {
                    this.dm.deleteEntry(evt.target.dataset.date);
                    this.loadDataForCurrentDate();
                }
            });
            this.dom.historyList.appendChild(li);
        });
    }

    initCycleManager() {
        const btn = document.getElementById('btn-start-cycle');
        const dateInput = document.getElementById('new-cycle-date');
        
        dateInput.valueAsDate = new Date();

        btn.addEventListener('click', () => {
            const date = dateInput.value;
            if (date) {
                this.dm.startNewCycle(date);
                this.updateCycleSelectorOptions();
                this.updateCycleHeaderLabel();
                this.updateGlobalUI();
                this.loadDataForCurrentDate();
                // Pas de reload complet pour garder le sélecteur
            }
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
        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            this.dm.updateSettings('theme', next);
        });
        const saved = this.dm.getSettings().theme;
        if (saved) document.documentElement.setAttribute('data-theme', saved);
    }
}