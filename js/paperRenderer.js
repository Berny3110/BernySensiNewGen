export class PaperRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            dayWidth: 30,
            headerHeight: 40,  // RÉDUIT : moins d'espace au-dessus
            footerHeight: 100, // AUGMENTÉ : plus d'espace pour dates/saignements
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
                peak: '#ff4081',
                bleeding: '#d32f2f'
            }
        };
        
        this.updateThemeColors();
    }
    
    updateThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
            this.config.colors.background = '#2a2a2a';
            this.config.colors.grid = '#4a4a4a';
            this.config.colors.gridStrong = '#666666';
            this.config.colors.text = '#e0e0e0';
            this.config.colors.tempLine = '#64b5f6';
            this.config.colors.tempDot = '#ffffff';
        } else {
            this.config.colors.background = '#ffffff';
            this.config.colors.grid = '#e0e0e0';
            this.config.colors.gridStrong = '#9e9e9e';
            this.config.colors.text = '#333333';
            this.config.colors.tempLine = '#2962ff';
            this.config.colors.tempDot = '#000000';
        }
    }

    render(cycle, analysis, zoom = 1.0) {
        if (!cycle || !cycle.entries) return;
        
        this.updateThemeColors();
        
        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculs de dimensions avec ZOOM
        const daysCount = Math.max(40, entries.length + 2);
        const dayWidth = this.config.dayWidth * zoom;
        const baseWidth = this.config.paddingLeft + (daysCount * dayWidth);
        const baseHeight = this.config.headerHeight + this.config.gridHeight + this.config.footerHeight;

        // NOUVEAU : Hauteur adaptée à la largeur du viewport en mode paysage
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth || window.innerWidth;
        
        // En mode paysage, on adapte la hauteur à la largeur disponible
        let canvasWidth, canvasHeight;
        
        if (window.innerHeight < window.innerWidth) {
            // Mode paysage : on privilégie la hauteur disponible
            canvasHeight = window.innerHeight - 60; // Moins l'header
            const aspectRatio = baseWidth / baseHeight;
            canvasWidth = Math.min(baseWidth * zoom, containerWidth);
            
            // Si le canvas est trop large, on adapte
            if (canvasWidth > containerWidth) {
                canvasWidth = containerWidth;
            }
        } else {
            // Mode portrait : on garde le comportement normal
            canvasWidth = Math.min(baseWidth * zoom, containerWidth);
            canvasHeight = baseHeight * zoom;
        }

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;

        const scaleX = canvasWidth / baseWidth;
        const scaleY = canvasHeight / baseHeight;
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr * scaleX * zoom, dpr * scaleY * zoom);

        // Fond
        this.ctx.fillStyle = this.config.colors.background;
        this.ctx.fillRect(0, 0, baseWidth / zoom, baseHeight / zoom);
        
        this.ctx.font = "12px sans-serif";
        this.ctx.fillStyle = this.config.colors.text;

        // Dessin des éléments (avec ajustement du dayWidth pour le zoom)
        this.drawGrid(daysCount, baseWidth / zoom, dayWidth / zoom);
        this.drawData(cycle, analysis, entries, dayWidth / zoom);
        this.drawBleeding(entries, dayWidth / zoom);
    }

    getYForTemp(temp) {
        if (temp > this.config.tempMax) temp = this.config.tempMax;
        if (temp < this.config.tempMin) temp = this.config.tempMin;

        const range = this.config.tempMax - this.config.tempMin;
        const ratio = (this.config.tempMax - temp) / range;
        return this.config.headerHeight + (ratio * this.config.gridHeight);
    }

    drawGrid(daysCount, totalWidth, dayWidth) {
        const { ctx, config } = this;
        const bottomY = config.headerHeight + config.gridHeight;

        ctx.beginPath();
        ctx.lineWidth = 1;

        // Grille horizontale (températures)
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
                ctx.fillStyle = config.colors.text;
                ctx.fillText(temp.toFixed(1), 5, y + 4);
            }
        }

        // Grille verticale (jours)
        ctx.strokeStyle = config.colors.grid;
        for (let i = 0; i <= daysCount; i++) {
            const x = config.paddingLeft + (i * dayWidth);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, bottomY + config.footerHeight);
            ctx.stroke();
            ctx.beginPath();

            if (i > 0 && i <= daysCount) {
                ctx.fillStyle = config.colors.text;
                ctx.fillText(i, x - (dayWidth / 2) - 4, bottomY + 20);
            }
        }

        // Bordures principales
        ctx.strokeStyle = config.colors.gridStrong;
        ctx.lineWidth = 2;
        ctx.moveTo(0, config.headerHeight);
        ctx.lineTo(totalWidth, config.headerHeight);
        ctx.moveTo(0, bottomY);
        ctx.lineTo(totalWidth, bottomY);
        ctx.stroke();
    }

    drawData(cycle, analysis, entries, dayWidth) {
        const { ctx, config } = this;
        
        let prevPoint = null;

        entries.forEach((e, index) => {
            const xCenter = config.paddingLeft + (index * dayWidth) + (dayWidth / 2);
            
            // DATE (en bas, avec plus d'espace)
            const d = new Date(e.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            ctx.save();
            ctx.font = "11px sans-serif";
            ctx.fillStyle = config.colors.text;
            ctx.fillText(dateStr, xCenter - 14, config.headerHeight + config.gridHeight + 50);
            ctx.restore();

            // GLAIRE (symboles au-dessus, mais avec moins d'espace)
            let mucusCode = "";
            if(e.mucusAspect === 'blanc_oeuf') mucusCode = "🥚";
            else if(e.mucusAspect === 'jaunatre') mucusCode = "🟡";
            else if(e.mucusSensation === 'mouillee') mucusCode = "💧";
            else if(e.mucusSensation === 'seche') mucusCode = "🌵";
            
            if(mucusCode) {
                ctx.font = "14px sans-serif"; // Taille réduite
                ctx.fillStyle = config.colors.text;
                ctx.fillText(mucusCode, xCenter - 7, config.headerHeight - 8);
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
                
                if(e.excludeTemp && e.temp) {
                    ctx.fillStyle = config.colors.text;
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
            ctx.setLineDash([5, 5]);
            ctx.moveTo(config.paddingLeft, yCover);
            ctx.lineTo(config.paddingLeft + (entries.length * dayWidth), yCover);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawBleeding(entries, dayWidth) {
        const { ctx, config } = this;

        ctx.font = "16px sans-serif"; // Taille de base

        entries.forEach((e, index) => {
            if (!e.bleeding || e.bleeding === 'none') return;

            const xCenter = config.paddingLeft + (index * dayWidth) + (dayWidth / 2);
            // NOUVEAU : Position plus basse pour éviter les chevauchements
            const yBaseline = config.headerHeight + config.gridHeight + 70;

            let emoji = "";
            switch (e.bleeding) {
                case "spotting":
                    emoji = "💉";
                    break;
                case "light":
                    emoji = "🩸";
                    break;
                case "medium":
                    emoji = "🩸🩸";
                    break;
                case "heavy":
                    emoji = "🩸🩸🩸";
                    break;
            }

            ctx.save();
            ctx.translate(xCenter, yBaseline);
            ctx.rotate(-Math.PI / 2);
            ctx.scale(0.4, 0.4); // Taille réduite
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(emoji, 0, 0);
            ctx.restore();
        });
    }
}