export class PaperRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            dayWidth: 30,
            headerHeight: 80,
            footerHeight: 60,
            tempMin: 36.0,
            tempMax: 37.0, // CORRECTION : 37°C max au lieu de 37.5
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
        
        // Détection du mode sombre
        this.updateThemeColors();
    }
    
    updateThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
            // Mode sombre : arrière-plan plus clair pour meilleur contraste
            this.config.colors.background = '#2a2a2a'; // Gris foncé mais lisible
            this.config.colors.grid = '#4a4a4a';
            this.config.colors.gridStrong = '#666666';
            this.config.colors.text = '#e0e0e0';
            this.config.colors.tempLine = '#64b5f6';
            this.config.colors.tempDot = '#ffffff';
        } else {
            // Mode clair
            this.config.colors.background = '#ffffff';
            this.config.colors.grid = '#e0e0e0';
            this.config.colors.gridStrong = '#9e9e9e';
            this.config.colors.text = '#333333';
            this.config.colors.tempLine = '#2962ff';
            this.config.colors.tempDot = '#000000';
        }
    }

    render(cycle, analysis) {
        if (!cycle || !cycle.entries) return;
        
        // Mise à jour des couleurs selon le thème actuel
        this.updateThemeColors();
        
        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculs de dimensions
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

        // Fond de couleur selon le thème
        this.ctx.fillStyle = this.config.colors.background;
        this.ctx.fillRect(0, 0, baseWidth, baseHeight);
        
        this.ctx.font = "12px sans-serif";
        this.ctx.fillStyle = this.config.colors.text;

        // Dessin des éléments
        this.drawGrid(daysCount, baseWidth);
        this.drawData(cycle, analysis, entries);
        this.drawBleeding(entries); // NOUVEAU : Dessin des saignements
    }

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
            const x = config.paddingLeft + (i * config.dayWidth);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, bottomY + config.footerHeight);
            ctx.stroke();
            ctx.beginPath();

            if (i > 0 && i <= daysCount) {
                ctx.fillStyle = config.colors.text;
                ctx.fillText(i, x - (config.dayWidth / 2) - 4, bottomY + 20);
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

    drawData(cycle, analysis, entries) {
        const { ctx, config } = this;
        
        let prevPoint = null;

        entries.forEach((e, index) => {
            const xCenter = config.paddingLeft + (index * config.dayWidth) + (config.dayWidth / 2);
            
            // DATE
            const d = new Date(e.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            ctx.save();
            ctx.font = "10px sans-serif";
            ctx.fillStyle = config.colors.text;
            ctx.fillText(dateStr, xCenter - 12, config.headerHeight + config.gridHeight + 40);
            ctx.restore();

            // GLAIRE (symboles)
            let mucusCode = "";
            if(e.mucusAspect === 'blanc_oeuf') mucusCode = "🥚";
            else if(e.mucusAspect === 'jaunatre') mucusCode = "🟡";
            else if(e.mucusSensation === 'mouillee') mucusCode = "💧";
            else if(e.mucusSensation === 'seche') mucusCode = "t";
            
            if(mucusCode) {
                ctx.font = "16px sans-serif";
                ctx.fillStyle = config.colors.text;
                ctx.fillText(mucusCode, xCenter - 8, config.headerHeight - 10);
            }

            // TEMPÉRATURE
            if (e.temp && !e.excludeTemp) {
                const y = this.getYForTemp(e.temp);

                // CORRECTION : Tracer la ligne seulement s'il y a un point précédent
                if (prevPoint) {
                    ctx.beginPath();
                    ctx.strokeStyle = config.colors.tempLine;
                    ctx.lineWidth = 2;
                    ctx.moveTo(prevPoint.x, prevPoint.y);
                    ctx.lineTo(xCenter, y);
                    ctx.stroke();
                }

                // Point de température
                ctx.beginPath();
                ctx.fillStyle = config.colors.tempDot;
                
                if (analysis && analysis.highTempIndices && analysis.highTempIndices.includes(index)) {
                     ctx.fillStyle = '#ff5722'; 
                }
                
                ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                ctx.fill();

                prevPoint = { x: xCenter, y: y };
            } else {
                // CORRECTION : Créer un "trou" si pas de température
                prevPoint = null;
                
                if(e.excludeTemp && e.temp) {
                    ctx.fillStyle = config.colors.text;
                    ctx.fillText("X", xCenter - 4, this.getYForTemp(e.temp || 36.5));
                }
            }
        });

        // COVERLINE (ligne de base)
        if (analysis && analysis.coverLine) {
            const yCover = this.getYForTemp(analysis.coverLine);
            ctx.beginPath();
            ctx.strokeStyle = config.colors.coverLine;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.moveTo(config.paddingLeft, yCover);
            ctx.lineTo(config.paddingLeft + (entries.length * config.dayWidth), yCover);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // NOUVEAU : Dessin des saignements
    drawBleeding(entries) {
        const { ctx, config } = this;
        
        entries.forEach((e, index) => {
            if (!e.bleeding || e.bleeding === 'none') return;

            const xCenter = config.paddingLeft + (index * config.dayWidth) + (config.dayWidth / 2);
            const yBaseline = config.headerHeight + config.gridHeight + 25; 
            
            ctx.fillStyle = config.colors.bleeding;
            
            switch(e.bleeding) {
                case 'spotting':
                    ctx.beginPath();
                    ctx.arc(xCenter, yBaseline, 3, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'light':
                    ctx.fillRect(xCenter - 2, yBaseline - 6, 4, 12);
                    break;
                case 'medium':
                    ctx.fillRect(xCenter - 4, yBaseline - 10, 8, 20);
                    break;
                case 'heavy':
                    ctx.fillRect(xCenter - 6, yBaseline - 12, 12, 24);
                    break;
            }
        });
    }
}