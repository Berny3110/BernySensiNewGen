/**
 * Moteur de rendu graphique du cycle sur canvas.
 *
 * Responsabilités principales :
 * - Générer une représentation “papier” du cycle menstruel sur un canvas HTML5
 * - Dessiner la grille (jours, températures, repères visuels)
 * - Afficher les données du cycle : températures, glaire (3 lignes), dates, saignements
 * - Intégrer les résultats d’analyse (coverline, jours hauts, pic)
 * - Gérer le zoom, l’adaptation à l’orientation et la mise à l’échelle haute résolution (DPR)
 * - Ajuster automatiquement les couleurs selon le thème clair/sombre
 *
 * Ce module constitue la couche de visualisation principale,
 * transformant les données brutes et l’analyse Sensiplan
 * en un graphique lisible, précis et ergonomique.
 */

import { CycleComputer } from './cycleComputer.js';

export class PaperRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            dayWidth: 30,
            headerHeight: 60,
            footerHeight: 100,
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
                bleeding: '#d32f2f',
                postOvulatoryBg: "rgba(33, 150, 243, 0.15)",
                highTempFill: '#ff5722',
                highTempStripBg: 'rgba(255,87,34,0.12)',
                highTempStripLine: 'rgba(255,87,34,0.6)',
                excludedTriangle: '#9e9e9e',
                confirmTriangle: '#ff4081',
                lowCircleStroke: '#2196f3'
            }
        };

        this.updateThemeColors();
    }

    roundTempForDisplay(temp) {
        return Math.round(temp * 20) / 20;
    }

    // Calcule le jour de cycle (1, 2, 3...) pour une date donnée
    getCycleDay(entryDate, cycleStartDate) {
        const start = new Date(cycleStartDate);
        const entry = new Date(entryDate);
        const diffTime = entry - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 1; // Jour 1 = premier jour du cycle
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

        // Calculer le dernier jour de cycle
        let maxCycleDay = 40; // Minimum par défaut
        if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1];
            const lastCycleDay = this.getCycleDay(lastEntry.date, cycle.startDate);
            maxCycleDay = Math.max(maxCycleDay, lastCycleDay + 5);
        }

        // Calculs de dimensions avec ZOOM
        const daysCount = maxCycleDay;
        const dayWidth = this.config.dayWidth * zoom;
        const baseWidth = this.config.paddingLeft + (daysCount * dayWidth);
        const baseHeight = this.config.headerHeight + this.config.gridHeight + this.config.footerHeight;

        // Détection de l'orientation et calcul des dimensions
        const container = this.canvas.parentElement;
        const containerWidth = container?.clientWidth || window.innerWidth;
        const containerHeight = container?.clientHeight || window.innerHeight;

        let canvasWidth = baseWidth;
        let canvasHeight = baseHeight;

        // S'adapter au conteneur disponible
        const isLandscape = window.innerWidth > window.innerHeight;
        if (isLandscape) {
            canvasHeight = Math.min(containerHeight, baseHeight);
        }

        canvasWidth = Math.min(baseWidth, containerWidth * 3);

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = canvasWidth * dpr;
        this.canvas.height = canvasHeight * dpr;
        this.canvas.style.width = `${canvasWidth}px`;
        this.canvas.style.height = `${canvasHeight}px`;

        const scaleX = canvasWidth / baseWidth;
        const scaleY = canvasHeight / baseHeight;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr * scaleX, dpr * scaleY);

        // Fond
        this.ctx.fillStyle = this.config.colors.background;
        this.ctx.fillRect(0, 0, baseWidth, baseHeight);

        this.ctx.font = "12px sans-serif";
        this.ctx.fillStyle = this.config.colors.text;

        // === Bandeau post-ovulatoire ===
        if (analysis && analysis.postOvulatoryInfertileStartIndex !== null) {
            const startIndex = analysis.postOvulatoryInfertileStartIndex;
            const xStart = this.config.paddingLeft + (startIndex * dayWidth);
            const yStart = this.config.headerHeight;
            const height = this.config.gridHeight;

            this.ctx.fillStyle = this.config.colors.postOvulatoryBg;
            this.ctx.fillRect(
                xStart,
                yStart,
                baseWidth - xStart,
                height
            );
        }

        // Dessin des éléments
        this.drawGrid(daysCount, baseWidth, dayWidth);
        this.drawData(cycle, analysis, entries, dayWidth);
        this.drawBleeding(cycle, entries, dayWidth);
    }

    getYForTemp(temp) {
        temp = this.roundTempForDisplay(temp);

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
        let prevCycleDay = null;

        // Precompute index map for quick lookup
        const indexByDate = {};
        entries.forEach((e, idx) => { indexByDate[e.date] = idx; });

        entries.forEach((e, entryIndex) => {
            const cycleDay = this.getCycleDay(e.date, cycle.startDate);
            const xCenter = config.paddingLeft + ((cycleDay - 1) * dayWidth) + (dayWidth / 2);

            // DATE
            const d = new Date(e.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            ctx.save();
            ctx.font = "11px sans-serif";
            ctx.fillStyle = config.colors.text;
            ctx.fillText(dateStr, xCenter - 14, config.headerHeight + config.gridHeight + 50);
            ctx.restore();

            // GLAIRE SUR 3 LIGNES
            const yGlaire1 = config.headerHeight - 35;
            const yGlaire2 = config.headerHeight - 20;
            const yGlaire3 = config.headerHeight - 5;

            ctx.save();
            ctx.font = "10px sans-serif";
            ctx.fillStyle = config.colors.text;

            // Ligne 1 : SENSATION
            if (e.mucusSensation && e.mucusSensation !== 'none' && e.mucusSensation !== 'rien') {
                let sensationEmoji = "";
                switch (e.mucusSensation) {
                    case 'seche': sensationEmoji = "🌵"; break;
                    case 'humide': sensationEmoji = "💧"; break;
                    case 'mouillee': sensationEmoji = "💦"; break;
                    case 'glissante': sensationEmoji = "⛸️"; break;
                }
                if (sensationEmoji) {
                    ctx.fillText(sensationEmoji, xCenter - 6, yGlaire1);
                }
            }

            // Ligne 2 : ASPECT
            if (e.mucusAspect && e.mucusAspect !== 'none' && e.mucusAspect !== 'rien') {
                let aspectEmoji = "";
                switch (e.mucusAspect) {
                    case 'cremeux': aspectEmoji = "🥛"; break;
                    case 'jaunatre': aspectEmoji = "🟡"; break;
                    case 'blanc_oeuf': aspectEmoji = "🥚"; break;
                    case 'filant': aspectEmoji = "🧵"; break;
                    case 'collant': aspectEmoji = "📎"; break;
                }
                if (aspectEmoji) {
                    ctx.fillText(aspectEmoji, xCenter - 6, yGlaire2);
                }
            }

            // Ligne 3 : CODE RÉSULTANT
            const mucusCode = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
            if (mucusCode && mucusCode !== '--') {
                ctx.font = "bold 11px sans-serif";
                let codeColor = config.colors.text;

                if (mucusCode === 'G+') codeColor = '#d81b60';
                else if (mucusCode === 'G') codeColor = '#ff9800';
                else if (mucusCode === 'h') codeColor = '#2196f3';
                else if (mucusCode === 't') codeColor = '#9e9e9e';

                ctx.fillStyle = codeColor;
                const codeWidth = ctx.measureText(mucusCode).width;
                ctx.fillText(mucusCode, xCenter - (codeWidth / 2), yGlaire3);
            }

            ctx.restore();

            // TEMPÉRATURE
            if (e.temp && !e.excludeTemp) {
                const rawTemp = e.temp;
                const rounded = this.roundTempForDisplay(rawTemp);
                const y = this.getYForTemp(rounded);

                if (prevPoint && prevCycleDay !== null) {
                    ctx.beginPath();
                    ctx.strokeStyle = config.colors.tempLine;
                    ctx.lineWidth = 2;

                    // POINTILLÉS si les jours ne sont pas consécutifs
                    if (cycleDay - prevCycleDay > 1) {
                        ctx.setLineDash([5, 5]);
                    } else {
                        ctx.setLineDash([]);
                    }

                    ctx.moveTo(prevPoint.x, prevPoint.y);
                    ctx.lineTo(xCenter, y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Draw high temp square background/stripes if this index is in analysis.highTempIndices
                if (analysis && analysis.highTempIndices && analysis.highTempIndices.length > 0) {
                    const globalIndex = entryIndex; // entries is sorted and entryIndex matches
                    if (analysis.highTempIndices.includes(globalIndex)) {
                        this.drawStripedSquareAt(xCenter, y, 26);
                    }
                }

                ctx.beginPath();
                ctx.fillStyle = config.colors.tempDot;

                if (analysis && analysis.highTempIndices) {
                    const globalIndex = entryIndex;
                    if (analysis.highTempIndices.includes(globalIndex)) {
                        ctx.fillStyle = config.colors.highTempFill;
                    }
                }

                ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                ctx.fill();

                // If this is the confirmed tempShift index, draw a filled triangle above the point
                if (analysis && analysis.retreatIndices && analysis.retreatIndices.includes(entryIndex)) { this.drawEmptyTriangle(xCenter, y - 12, 10, this.config.colors.excludedTriangle); }

                prevPoint = { x: xCenter, y: y };
                prevCycleDay = cycleDay;
            } else {
                // Excluded or missing temp
                prevPoint = null;
                prevCycleDay = null;

                if (e.excludeTemp && e.temp) {
                    // Draw an empty triangle to mark excluded temperature
                    const y = this.getYForTemp(e.temp || 36.5);
                    this.drawEmptyTriangle(xCenter, y - 12, 10, this.config.colors.excludedTriangle);
                    ctx.fillStyle = config.colors.text;
                    ctx.fillText("X", xCenter - 4, this.getYForTemp(e.temp || 36.5));
                }
            }
        });

        // COVERLINE
        if (analysis && analysis.coverLine) {
            const yCover = this.getYForTemp(analysis.coverLine);
            ctx.beginPath();
            ctx.strokeStyle = this.config.colors.coverLine;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.moveTo(this.config.paddingLeft, yCover);
            ctx.lineTo(this.config.paddingLeft + (entries.length * dayWidth), yCover);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Peak day marker (vertical)
        if (analysis && typeof analysis.peakDayIndex === 'number') {
            this.drawPeakDayMarker(analysis.peakDayIndex, dayWidth);
        }
    }

    // Draw a small filled upward triangle (used for confirmed shift)
    drawFilledTriangle(xCenter, yTop, size, color) {
        const { ctx } = this;
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(xCenter, yTop);
        ctx.lineTo(xCenter - size, yTop + (size * 1.2));
        ctx.lineTo(xCenter + size, yTop + (size * 1.2));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // Draw an empty (stroke) upward triangle (used for excluded temps)
    drawEmptyTriangle(xCenter, yTop, size, strokeColor) {
        const { ctx } = this;
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xCenter, yTop);
        ctx.lineTo(xCenter - size, yTop + (size * 1.2));
        ctx.lineTo(xCenter + size, yTop + (size * 1.2));
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    // Draw a striped square centered at (xCenter, yCenter)
    drawStripedSquareAt(xCenter, yCenter, boxSize = 26) {
        const { ctx, config } = this;
        const xLeft = xCenter - boxSize / 2;
        const yTop = yCenter - boxSize / 2;

        ctx.save();
        // Background
        ctx.fillStyle = config.colors.highTempStripBg;
        ctx.fillRect(xLeft, yTop, boxSize, boxSize);

        // Clip to square so stripes don't overflow
        ctx.beginPath();
        ctx.rect(xLeft, yTop, boxSize, boxSize);
        ctx.clip();

        // Draw diagonal stripes
        ctx.strokeStyle = config.colors.highTempStripLine;
        ctx.lineWidth = 1;
        const step = 5;
        for (let sx = xLeft - boxSize; sx < xLeft + boxSize * 2; sx += step) {
            ctx.beginPath();
            ctx.moveTo(sx, yTop);
            ctx.lineTo(sx + boxSize, yTop + boxSize);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Draw a vertical marker for peak day
    drawPeakDayMarker(peakDayIndex, dayWidth) {
        const { ctx, config } = this;
        const x = config.paddingLeft + (peakDayIndex * dayWidth) + (dayWidth / 2);
        const yTop = 0;
        const yBottom = config.headerHeight + config.gridHeight;

        ctx.save();
        ctx.strokeStyle = config.colors.peak;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yBottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Diamond marker at top
        ctx.save();
        ctx.fillStyle = config.colors.peak;
        ctx.translate(x, config.headerHeight - 10);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
    }

    drawBleeding(cycle, entries, dayWidth) {
        const { ctx, config } = this;

        ctx.font = "16px sans-serif";

        entries.forEach((e) => {
            if (!e.bleeding || e.bleeding === 'none') return;

            const cycleDay = this.getCycleDay(e.date, cycle.startDate);
            const xCenter = config.paddingLeft + ((cycleDay - 1) * dayWidth) + (dayWidth / 2);
            const yBaseline = config.headerHeight + config.gridHeight + 70;

            let emoji = "";
            switch (e.bleeding) {
                case "spotting": emoji = "💉"; break;
                case "light": emoji = "🩸"; break;
                case "medium": emoji = "🩸🩸"; break;
                case "heavy": emoji = "🩸🩸🩸"; break;
            }

            ctx.save();
            ctx.translate(xCenter, yBaseline);
            ctx.rotate(-Math.PI / 2);
            ctx.scale(0.4, 0.4);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(emoji, 0, 0);
            ctx.restore();
        });
    }
}
