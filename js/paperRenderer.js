// js/paperRenderer.js
export class PaperRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            dayWidth: 30,
            headerHeight: 80,
            footerHeight: 60,
            tempMin: 36.0,
            tempMax: 37.5, // Augmenté un peu pour la marge
            gridHeight: 300,
            paddingLeft: 40,
            colors: {
                grid: '#e0e0e0',
                gridStrong: '#9e9e9e',
                tempLine: '#2962ff',
                tempDot: '#000000',
                text: '#333333',
                coverLine: '#00bfa5',
                peak: '#ff4081'
            }
        };
    }

    render(cycle, analysis) {
        if (!cycle || !cycle.entries) return;
        
        // 1. Récupération sécurisée des entrées
        const entries = cycle.entries;

        // 2. Calculs de dimensions
        const daysCount = Math.max(40, entries.length + 2);
        const baseWidth = this.config.paddingLeft + (daysCount * this.config.dayWidth);
        const baseHeight = this.config.headerHeight + this.config.gridHeight + this.config.footerHeight;

        // Gestion Retina / Responsive
        const containerWidth = this.canvas.parentElement.clientWidth || window.innerWidth;
        const scale = containerWidth / baseWidth; 

        const totalWidth = containerWidth;
        const totalHeight = baseHeight * scale;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = totalWidth * dpr;
        this.canvas.height = totalHeight * dpr;
        this.canvas.style.width = `${totalWidth}px`;
        this.canvas.style.height = `${totalHeight}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0); 
        this.ctx.scale(dpr * scale, dpr * scale);

        this.ctx.clearRect(0, 0, baseWidth, baseHeight);
        this.ctx.font = "12px sans-serif";
        this.ctx.fillStyle = this.config.colors.text;

        // 3. Dessin des éléments de base
        this.drawGrid(daysCount, baseWidth);
        this.drawData(cycle, analysis);
        
        // 4. DESSIN DES SAIGNEMENTS (CORRIGÉ)
        entries.forEach((e, index) => {
            // On vérifie bleedingFlow (nom utilisé dans votre saveEntry)
            if (!e.bleedingFlow || e.bleedingFlow === 'none') return;

            // CORRECTION ICI : Ajout de 'this.' devant config
            const xCenter = this.config.paddingLeft + (index * this.config.dayWidth) + (this.config.dayWidth / 2);
            const yBaseline = this.config.headerHeight + this.config.gridHeight + 25; 
            
            this.ctx.fillStyle = "#d32f2f"; // Rouge Sensiplan
            
            switch(e.bleedingFlow) {
                case 'spotting':
                    this.ctx.beginPath();
                    this.ctx.arc(xCenter, yBaseline, 2, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                case 'light':
                    this.ctx.fillRect(xCenter - 1, yBaseline - 5, 2, 10);
                    break;
                case 'medium':
                    this.ctx.fillRect(xCenter - 3, yBaseline - 8, 6, 16);
                    break;
                case 'heavy':
                    this.ctx.fillRect(xCenter - 5, yBaseline - 10, 10, 20);
                    break;
            }
        });
    }

    // ... (Le reste des méthodes getYForTemp, drawGrid, drawData ne change pas) ...
    getYForTemp(temp) {
        if (temp > this.config.tempMax) temp = this.config.tempMax;
        if (temp < this.config.tempMin) temp = this.config.tempMin;

        const range = this.config.tempMax - this.config.tempMin;
        const ratio = (this.config.tempMax - temp) / range;
        return this.config.headerHeight + (ratio * this.config.gridHeight);
    }

    drawGrid(daysCount, totalWidth) {
        const { ctx, config } = this;
        const bottomY = config.headerHeight + config.gridHeight;

        ctx.beginPath();
        ctx.lineWidth = 1;

        for (let t = config.tempMin * 10; t <= config.tempMax * 10; t++) {
            const temp = t / 10;
            const y = this.getYForTemp(temp);
            const isMain = (t % 5 === 0);
            ctx.strokeStyle = isMain ? config.colors.gridStrong : config.colors.grid;
            
            ctx.moveTo(config.paddingLeft, y);
            ctx.lineTo(totalWidth, y);
            ctx.stroke();
            ctx.beginPath(); 

            if (isMain) {
                ctx.fillText(temp.toFixed(1), 5, y + 4);
            }
        }

        ctx.strokeStyle = config.colors.grid;
        for (let i = 0; i <= daysCount; i++) {
            const x = config.paddingLeft + (i * config.dayWidth);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, bottomY + config.footerHeight);
            ctx.stroke();
            ctx.beginPath();

            if (i > 0 && i <= daysCount) {
                ctx.fillText(i, x - (config.dayWidth / 2) - 4, bottomY + 20);
            }
        }

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.moveTo(0, config.headerHeight);
        ctx.lineTo(totalWidth, config.headerHeight);
        ctx.moveTo(0, bottomY);
        ctx.lineTo(totalWidth, bottomY);
        ctx.stroke();
    }

    drawData(cycle, analysis) {
        const { ctx, config } = this;
        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let prevPoint = null;

        entries.forEach((e, index) => {
            const xCenter = config.paddingLeft + (index * config.dayWidth) + (config.dayWidth / 2);
            
            // DATE
            const d = new Date(e.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            ctx.save();
            ctx.font = "10px sans-serif";
            ctx.fillStyle = "#666";
            ctx.fillText(dateStr, xCenter - 12, config.headerHeight + config.gridHeight + 40);
            ctx.restore();

            // GLAIRE
            let mucusCode = "";
            if(e.mucusAspect === 'blanc_oeuf') mucusCode = "🥚";
            else if(e.mucusAspect === 'jaunatre') mucusCode = "🟡";
            else if(e.mucusSensation === 'mouillee') mucusCode = "💧";
            else if(e.mucusSensation === 'seche') mucusCode = "t";
            
            if(mucusCode) {
                ctx.font = "16px sans-serif";
                ctx.fillText(mucusCode, xCenter - 8, config.headerHeight - 10);
            }

            // TEMPÉRATURE
            if (e.temp && !e.excludeTemp) {
                const y = this.getYForTemp(e.temp);

                if (prevPoint) {
                    ctx.beginPath();
                    ctx.strokeStyle = config.colors.tempLine;
                    ctx.lineWidth = 2;
                    ctx.moveTo(prevPoint.x, prevPoint.y);
                    ctx.lineTo(xCenter, y);
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.fillStyle = config.colors.tempDot;
                
                if (analysis && analysis.highTempIndices && analysis.highTempIndices.includes(index)) {
                     ctx.fillStyle = '#ff5722'; 
                }
                
                ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                ctx.fill();

                prevPoint = { x: xCenter, y: y };
            } else {
                prevPoint = null;
                if(e.excludeTemp) {
                    ctx.fillText("X", xCenter - 4, this.getYForTemp(e.temp || 36.5));
                }
            }
        });

        // COVERLINE
        if (analysis && analysis.coverLine) {
            const yCover = this.getYForTemp(analysis.coverLine);
            ctx.beginPath();
            ctx.strokeStyle = config.colors.coverLine;
            ctx.lineWidth = 2;
            ctx.moveTo(config.paddingLeft, yCover);
            ctx.lineTo(config.paddingLeft + (entries.length * config.dayWidth), yCover);
            ctx.stroke();
        }
    }
}