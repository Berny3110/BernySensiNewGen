const ITEM_HEIGHT = 50; 
const CONTAINER_HEIGHT = 250;

export class WheelManager {
    constructor(config, onUpdate) {
        this.cfg = config; 
        this.onUpdate = onUpdate;
        this.rangeSize = (config.max - config.min) + 1;
        this.init();
    }

    init() {
        this.render();
        this.initSwipe();
    }

    render() {
        const { element, min, max, isRepeating, currentValue } = this.cfg;
        element.innerHTML = '';

        const generateSequence = () => {
            let html = '';
            for (let i = min; i <= max; i++) {
                html += `<div class="wheel-item">${isRepeating ? i : i}</div>`;
            }
            return html;
        };

        // On crée une longue liste pour simuler l'infini
        if (isRepeating) {
            element.innerHTML += generateSequence(); // bloc 1
            element.innerHTML += generateSequence(); // bloc 2
            element.innerHTML += generateSequence(); // bloc 3 (le centre)
            element.innerHTML += generateSequence(); // bloc 4
            element.innerHTML += generateSequence(); // bloc 5
            this.offsetAdjustment = 2 * this.rangeSize;
        } else {
            this.offsetAdjustment = 0;
        }

        if (!isRepeating) element.innerHTML = generateSequence();

        // Position initiale : on centre la valeur demandée
        const idxInSeq = currentValue - min;
        this.currentIndex = idxInSeq + this.offsetAdjustment;
        this.updatePosition(false);
    }

    updatePosition(smooth = true) {
        // L'offset de base pour centrer le premier item est 0 car on utilise le padding CSS
        const offset = this.currentIndex * ITEM_HEIGHT;
        this.cfg.element.style.transition = smooth ? 'transform 0.3s cubic-bezier(0.15, 0.85, 0.35, 1)' : 'none';
        this.cfg.element.style.transform = `translateY(-${offset}px)`;
        
        const items = this.cfg.element.querySelectorAll('.wheel-item');
        items.forEach(it => it.classList.remove('active'));
        if(items[this.currentIndex]) items[this.currentIndex].classList.add('active');

        // Calcul de la valeur réelle
        let val = this.cfg.min + (this.currentIndex % this.rangeSize);
        this.cfg.currentValue = val;
        if (this.onUpdate) this.onUpdate(val);
    }

    initSwipe() {
        let startY = 0, currentPos = 0, isDragging = false;
        const el = this.cfg.element;

        const onStart = (e) => {
            isDragging = true;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            const style = window.getComputedStyle(el);
            const matrix = new WebKitCSSMatrix(style.transform);
            currentPos = matrix.m42;
            el.style.transition = 'none';
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const y = e.touches ? e.touches[0].clientY : e.clientY;
            const delta = y - startY;
            el.style.transform = `translateY(${currentPos + delta}px)`;
            if (e.cancelable) e.preventDefault();
        };

        const onEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            const style = window.getComputedStyle(el);
            const matrix = new WebKitCSSMatrix(style.transform);
            const finalY = matrix.m42;
            
            let newIndex = Math.round(-finalY / ITEM_HEIGHT);

            if (this.cfg.isRepeating) {
                // Si on sort trop du bloc central, on y revient de façon invisible
                const centerStart = 2 * this.rangeSize;
                const centerEnd = 3 * this.rangeSize - 1;
                if (newIndex < centerStart) newIndex += this.rangeSize;
                if (newIndex > centerEnd) newIndex -= this.rangeSize;
            } else {
                newIndex = Math.max(0, Math.min(this.rangeSize - 1, newIndex));
            }

            this.currentIndex = newIndex;
            this.updatePosition(true);
        };

        const parent = el.parentElement;
        parent.addEventListener('touchstart', onStart, {passive: false});
        parent.addEventListener('touchmove', onMove, {passive: false});
        parent.addEventListener('touchend', onEnd);
        parent.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
    }
}