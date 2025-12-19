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
            tempMax: 37.0,
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

        const daysCount = Math.max(40, cycle.entries.length + 2);
        const baseWidth = this.config.paddingLeft + (daysCount * this.config.dayWidth);
        const baseHeight = this.config.headerHeight + this.config.gridHeight + this.config.footerHeight;

        // --- Nouvelle logique responsive ---
        const containerWidth = this.canvas.parentElement.clientWidth || window.innerWidth;
        const scale = containerWidth / baseWidth; // facteur d’adaptation horizontal

        const totalWidth = containerWidth;
        const totalHeight = baseHeight * scale;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = totalWidth * dpr;
        this.canvas.height = totalHeight * dpr;
        this.canvas.style.width = `${totalWidth}px`;
        this.canvas.style.height = `${totalHeight}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
        this.ctx.scale(dpr * scale, dpr * scale);

        this.ctx.clearRect(0, 0, baseWidth, baseHeight);
        this.ctx.font = "12px sans-serif";
        this.ctx.fillStyle = this.config.colors.text;

        this.drawGrid(daysCount, baseWidth);
        this.drawData(cycle, analysis);
    }

    getYForTemp(temp) {
        // Mapping de la température vers les pixels Y
        // 37.5 est en haut (y = headerHeight)
        // 36.0 est en bas (y = headerHeight + gridHeight)
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

        // Lignes Horizontales (Températures)
        for (let t = config.tempMin * 10; t <= config.tempMax * 10; t++) {
            const temp = t / 10;
            const y = this.getYForTemp(temp);
            
            // Ligne forte tous les 0.5°C, légère sinon
            const isMain = (t % 5 === 0);
            ctx.strokeStyle = isMain ? config.colors.gridStrong : config.colors.grid;
            
            ctx.moveTo(config.paddingLeft, y);
            ctx.lineTo(totalWidth, y);
            ctx.stroke();
            ctx.beginPath(); // Reset path pour changer de style

            // Étiquettes Température à gauche
            if (isMain) {
                ctx.fillText(temp.toFixed(1), 5, y + 4);
            }
        }

        // Lignes Verticales (Jours)
        ctx.strokeStyle = config.colors.grid;
        for (let i = 0; i <= daysCount; i++) {
            const x = config.paddingLeft + (i * config.dayWidth);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, bottomY + config.footerHeight);
            ctx.stroke();
            ctx.beginPath();

            // Numéro du jour en bas
            if (i > 0 && i <= daysCount) {
                ctx.fillText(i, x - (config.dayWidth / 2) - 4, bottomY + 20);
            }
        }

        // Séparateurs de zones (Header / Grid / Footer)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        
        // Ligne sous le header (Glaire)
        ctx.moveTo(0, config.headerHeight);
        ctx.lineTo(totalWidth, config.headerHeight);
        
        // Ligne sous la grille (Temp)
        ctx.moveTo(0, bottomY);
        ctx.lineTo(totalWidth, bottomY);
        ctx.stroke();
    }

    drawData(cycle, analysis) {
        const { ctx, config } = this;
        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Gestion des points connectés
        let prevPoint = null;

        entries.forEach((e, index) => {
            const xCenter = config.paddingLeft + (index * config.dayWidth) + (config.dayWidth / 2);
            
            // 1. DATE (Jour/Mois)
            const d = new Date(e.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            ctx.save();
            ctx.font = "10px sans-serif";
            ctx.fillStyle = "#666";
            ctx.fillText(dateStr, xCenter - 12, config.headerHeight + config.gridHeight + 40);
            ctx.restore();

            // 2. GLAIRE (Code en haut)
            // Importation dynamique ou usage global de CycleComputer
            // On suppose que CycleComputer est disponible globalement ou passé
            // Ici on va lire directement e.mucusSensation / e.mucusAspect
            // Pour faire simple, on affiche juste une lettre ou symbole
            let mucusCode = "";
            if(e.mucusAspect === 'blanc_oeuf') mucusCode = "🥚";
            else if(e.mucusAspect === 'jaunatre') mucusCode = "🟡";
            else if(e.mucusSensation === 'mouillee') mucusCode = "💧";
            else if(e.mucusSensation === 'seche') mucusCode = "t";
            
            if(mucusCode) {
                ctx.font = "16px sans-serif";
                ctx.fillText(mucusCode, xCenter - 8, config.headerHeight - 10);
            }

            // 3. TEMPÉRATURE
            if (e.temp && !e.excludeTemp) {
                const y = this.getYForTemp(e.temp);

                // Ligne vers le point précédent
                if (prevPoint) {
                    ctx.beginPath();
                    ctx.strokeStyle = config.colors.tempLine;
                    ctx.lineWidth = 2;
                    ctx.moveTo(prevPoint.x, prevPoint.y);
                    ctx.lineTo(xCenter, y);
                    ctx.stroke();
                }

                // Point
                ctx.beginPath();
                ctx.fillStyle = config.colors.tempDot;
                
                // Si point confirmé (3 hautes), on le colorie différemment
                if (analysis && analysis.highTempIndices.includes(index)) {
                     ctx.fillStyle = '#ff5722'; // Orange pour les hautes
                }
                
                ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                ctx.fill();

                prevPoint = { x: xCenter, y: y };
            } else {
                // Rupture de la ligne si pas de temp ou exclue
                prevPoint = null;
                if(e.excludeTemp) {
                    ctx.fillText("X", xCenter - 4, this.getYForTemp(e.temp || 36.5));
                }
            }
        });

        // 4. LIGNE DE BASE (Coverline)
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