/**
 * Moteur de rendu graphique du cycle sur canvas — Version 3 CORRIGÉE.
 *
 * CORRECTIONS :
 * - Inversion de l'ordre d'affichage : les symboles (glaire, saignements, love, perturbations)
 *   apparaissent maintenant SOUS les jours de cycle et dates (au lieu de dessus)
 * - Simplification du système "love" : traité comme les autres informations
 * - Mode paysage : corrections pour que le bouton retour soit bien positionné
 */

import { CycleComputer } from './cycleComputer.js';

export class PaperRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            dayWidth: 32,
            headerHeight: 40,
            footerHeight: 180, 
            tempMin: 35.9,
            tempMax: 37.1,
            gridHeight: 300,
            paddingLeft: 46,
            colors: {
                background: '#080d15',          // Fond sombre console Stitch
                grid: 'rgba(30, 45, 66, 0.45)', // Lignes millimétrées sombres subtiles
                gridStrong: '#1e2d42',          // Lignes de repère plus marquées
                tempLine: '#38bdf8',            // Cyan électrique Stitch
                tempDot: '#ffffff',             // Point blanc
                tempDotBorder: '#0284c7',       // Cerclage bleu
                text: '#94a3b8',                // Typo secondaire gris bleu
                textBright: '#ffffff',          // Typo blanche pour les jours
                coverLine: '#38bdf8',           // Coverline cyan
                peak: '#f43f5e',                // Marqueur ovulation rose/rouge
                bleeding: '#e11d48',            // Gouttes de règles
                bgFirstDays: 'rgba(56, 189, 248, 0.06)',
                bgOvulation: 'rgba(244, 63, 94, 0.22)',
                bgPostOv1_3: 'rgba(244, 63, 94, 0.10)',
                bgInfertile: 'rgba(56, 189, 248, 0.06)',
                highTempFill: '#f97316',        // Triangles orange haute température
                hatchBg: 'rgba(180, 83, 9, 0.18)', // Fond boîte diagnostic
                hatchLine: 'rgba(245, 158, 11, 0.75)', // Hachures jaunes/oranges
                retreatStroke: '#64748b',
                refTempNumber: '#38bdf8',
                'G+': '#f59e0b',                // Glaire G+ orange doré
                'G':  '#f59e0b',
                'h':  '#38bdf8',
                'S':  '#64748b',
                'Ø':  '#475569',
            }
        };

        this.updateThemeColors();
    }
		
		drawFooterSymbols(cycle, entries, dayWidth, gridHeight) {
				const { ctx, config } = this;
				const bottomY = config.headerHeight + gridHeight;

				// CORRECTION : On place les symboles APRÈS les jours et dates
				// Ordre visuel (de haut en bas) :
				// 1. Graphique de température
				// 2. Numéros de jours de cycle (bottomY + 20)
				// 3. Dates (bottomY + 38)
				// 4. Code de glaire (bottomY + 60)  ← DÉPLACÉ SOUS LES DATES
				// 5. Emojis glaire (bottomY + 85)
				// 6. Saignements (bottomY + 110)
				// 7. Love / Rapports (bottomY + 135)
				// 8. Perturbations (bottomY + 160)

				const lanes = {
						mucusCode: bottomY + 60,    // Déplacé plus bas
						mucusEmoji: bottomY + 85,
						bleeding: bottomY + 110,
						love: bottomY + 135,
						disturbance: bottomY + 160
				};

				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';

				entries.forEach(e => {
						const cycleDay = this.getCycleDay(e.date, cycle.startDate);
						if (cycleDay < 1) return;
						const xCenter = config.paddingLeft + (cycleDay - 1) * dayWidth + dayWidth / 2;

						// 1. Glaire : Code (G+, G, h...)
						if (e.mucusSensation || e.mucusAspect) {
								const code = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
								ctx.font = 'bold 14px sans-serif';
								ctx.fillStyle = config.colors[code] || '#888888';
								ctx.fillText(code, xCenter, lanes.mucusCode);
						}

						// 2. Glaire : Emojis Sensation/Aspect
						let emojiStr = '';
						if (e.mucusSensation === 'mouille') emojiStr += '💦';
						else if (e.mucusSensation === 'humide') emojiStr += '💧';
						else if (e.mucusSensation === 'sec') emojiStr += '🌵';
						
						if (e.mucusAspect === 'clair') emojiStr += '🥚';
						else if (e.mucusAspect === 'epais') emojiStr += '🥛';

						if (emojiStr) {
								ctx.font = '12px sans-serif';
								ctx.fillText(emojiStr, xCenter, lanes.mucusEmoji);
						}

						// 3. Saignements
						if (e.bleeding && e.bleeding !== 'none') {
								let bEmoji = e.bleeding === 'heavy' ? '🩸🩸🩸' : (e.bleeding === 'medium' ? '🩸🩸' : '🩸');
								if (e.bleeding === 'spotting') bEmoji = '💉';
								ctx.font = '12px sans-serif';
								ctx.fillText(bEmoji, xCenter, lanes.bleeding);
						}

						// 4. Love (Rapports) - SIMPLIFIÉ : on lit directement e.love comme un booléen
						if (e.love) {
								ctx.font = '14px sans-serif';
								ctx.fillText('❤️', xCenter, lanes.love);
						}

						// 5. Perturbations - détection de n'importe quelle perturbation
						const hasDisturbance = e.perturbations && Object.values(e.perturbations).some(v => v === true);
						if (hasDisturbance) {
								ctx.font = '14px sans-serif';
								ctx.fillText('⚠️', xCenter, lanes.disturbance);
						}
				});
		}

    roundTempForDisplay(temp) {
        return Math.round(temp * 20) / 20;
    }

    getCycleDay(entryDate, cycleStartDate) {
        const start = new Date(cycleStartDate);
        const entry = new Date(entryDate);
        const diffDays = Math.floor((entry - start) / (1000 * 60 * 60 * 24));
        return diffDays + 1;
    }

    updateThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        if (isDark) {
            this.config.colors.background = '#080d15';
            this.config.colors.grid = 'rgba(30, 45, 66, 0.45)';
            this.config.colors.gridStrong = '#1e2d42';
            this.config.colors.text = '#94a3b8';
            this.config.colors.textBright = '#ffffff';
            this.config.colors.tempLine = '#38bdf8';
            this.config.colors.tempDot = '#ffffff';
            this.config.colors.coverLine = '#38bdf8';
            this.config.colors.refTempNumber = '#38bdf8';
        } else {
            this.config.colors.background = '#ffffff';
            this.config.colors.grid = '#e2e8f0';
            this.config.colors.gridStrong = '#cbd5e1';
            this.config.colors.text = '#475569';
            this.config.colors.textBright = '#0f172a';
            this.config.colors.tempLine = '#0284c7';
            this.config.colors.tempDot = '#0284c7';
            this.config.colors.coverLine = '#0284c7';
            this.config.colors.refTempNumber = '#0284c7';
        }
    }

    getYForTemp(temp, gridHeight) {
        gridHeight = gridHeight ?? this._gridHeight ?? this.config.gridHeight;
        temp = this.roundTempForDisplay(temp);
        if (temp > this.config.tempMax) temp = this.config.tempMax;
        if (temp < this.config.tempMin) temp = this.config.tempMin;
        const range = this.config.tempMax - this.config.tempMin;
        const ratio = (this.config.tempMax - temp) / range;
        return this.config.headerHeight + (ratio * gridHeight);
    }

    render(cycle, analysis, zoom = 1.0) {
        if (!cycle || !cycle.entries) return;

        this.updateThemeColors();

        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        let maxCycleDay = 40;
        if (entries.length > 0) {
            const lastCycleDay = this.getCycleDay(entries[entries.length - 1].date, cycle.startDate);
            maxCycleDay = Math.max(maxCycleDay, lastCycleDay + 5);
        }

        const dayWidth = this.config.dayWidth * zoom;
        const gridHeight = this.config.gridHeight * zoom;
        this._gridHeight = gridHeight;

        const canvasWidth = this.config.paddingLeft + (maxCycleDay * dayWidth) + 20;
        const canvasHeight = this.config.headerHeight + gridHeight + this.config.footerHeight;

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;

        const { ctx, config } = this;

        // Fond
        ctx.fillStyle = config.colors.background;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Colonnes colorées (phases)
        if (analysis && analysis.ovulationDayIndex !== null) {
            const ovuDay = this.getCycleDay(entries[analysis.ovulationDayIndex].date, cycle.startDate);
            
            // Jours 1-5 (bleu)
            for (let d = 1; d <= Math.min(5, maxCycleDay); d++) {
                const x = config.paddingLeft + (d - 1) * dayWidth;
                ctx.fillStyle = config.colors.bgFirstDays;
                ctx.fillRect(x, config.headerHeight, dayWidth, gridHeight);
            }
            
            // Ovulation (rouge)
            const xOvu = config.paddingLeft + (ovuDay - 1) * dayWidth;
            ctx.fillStyle = config.colors.bgOvulation;
            ctx.fillRect(xOvu, config.headerHeight, dayWidth, gridHeight);
            
            // Phase infertile (bleu) — commence dès J+1 après ovulation
            const infertileStart = ovuDay + 1;
            if (infertileStart <= maxCycleDay) {
                for (let d = infertileStart; d <= maxCycleDay; d++) {
                    const x = config.paddingLeft + (d - 1) * dayWidth;
                    ctx.fillStyle = config.colors.bgInfertile;
                    ctx.fillRect(x, config.headerHeight, dayWidth, gridHeight);
                }
            }
        }

        // Grille
        ctx.strokeStyle = config.colors.grid;
        ctx.lineWidth = 1;
        for (let i = 1; i <= maxCycleDay; i++) {
            const x = config.paddingLeft + (i - 1) * dayWidth;
            ctx.beginPath();
            ctx.moveTo(x, config.headerHeight);
            ctx.lineTo(x, config.headerHeight + gridHeight);
            ctx.stroke();
        }

        // Lignes horizontales (0.1°C)
        const tempRange = config.tempMax - config.tempMin;
        const stepCount = Math.round(tempRange / 0.1);
        for (let i = 0; i <= stepCount; i++) {
            const temp = config.tempMin + (i * 0.1);
            const y = this.getYForTemp(temp, gridHeight);
            const isStrong = (Math.round(temp * 10) % 5 === 0);
            
            ctx.strokeStyle = isStrong ? config.colors.gridStrong : config.colors.grid;
            ctx.lineWidth = isStrong ? 1.5 : 0.8;
            ctx.beginPath();
            ctx.moveTo(config.paddingLeft, y);
            ctx.lineTo(config.paddingLeft + maxCycleDay * dayWidth, y);
            ctx.stroke();
            
            if (isStrong) {
                ctx.save();
                ctx.font = '500 10px "JetBrains Mono", monospace';
                ctx.fillStyle = config.colors.text;
                ctx.textAlign = 'right';
                ctx.fillText(temp.toFixed(1), config.paddingLeft - 5, y + 3);
                ctx.restore();
            }
        }

        // SECTION : NUMÉROS DE JOURS ET DATES (avant les symboles)
        for (let d = 1; d <= maxCycleDay; d++) {
            const xCenter = config.paddingLeft + (d - 1) * dayWidth + dayWidth / 2;
            
            // Numéro de jour
            ctx.save();
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.fillStyle = config.colors.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(d, xCenter, config.headerHeight + gridHeight + 8);
            ctx.restore();
        }

        // Coverline (bleue horizontale)
        if (analysis && analysis.coverLine !== null) {
            const yCover = this.getYForTemp(analysis.coverLine, gridHeight);
            ctx.save();
            ctx.strokeStyle = config.colors.coverLine;
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(config.paddingLeft, yCover);
            ctx.lineTo(config.paddingLeft + maxCycleDay * dayWidth, yCover);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // Rectangle hachuré (de coverline à +0.2)
        if (analysis && analysis.coverLine !== null && analysis.highTempIndices && analysis.highTempIndices.length > 0) {
            const yRefTop = this.getYForTemp(analysis.coverLine + 0.2, gridHeight);
            const yRefBottom = this.getYForTemp(analysis.coverLine, gridHeight);
            const hatchHeight = yRefBottom - yRefTop;

            if (hatchHeight > 0) {
                for (let i = 0; i < analysis.highTempIndices.length; i++) {
                    const idx = analysis.highTempIndices[i];
                    const cycleDay = this.getCycleDay(entries[idx].date, cycle.startDate);
                    const xLeft = config.paddingLeft + (cycleDay - 1) * dayWidth;
                    this.drawHatchedRect(xLeft, yRefTop, dayWidth, hatchHeight);
                }
            }
        }

        // Dessin des températures
        let prevPoint = null;
        let prevCycleDay = null;

        entries.forEach((e, entryIndex) => {
            const cycleDay = this.getCycleDay(e.date, cycle.startDate);
            const xCenter = config.paddingLeft + (cycleDay - 1) * dayWidth + dayWidth / 2;

            // DATE (SOUS le numéro de jour)
            const d = new Date(e.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            ctx.save();
            ctx.font = '10px sans-serif';
            ctx.fillStyle = config.colors.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(dateStr, xCenter, config.headerHeight + gridHeight + 28);
            ctx.restore();

            // TEMPÉRATURE
            const tempValid = e.temp && !e.excludeTemp;

            if (tempValid) {
                const rounded = this.roundTempForDisplay(e.temp);
                const y = this.getYForTemp(rounded, gridHeight);

                // Ligne reliant les points
                if (prevPoint && prevCycleDay !== null) {
                    ctx.beginPath();
                    ctx.strokeStyle = config.colors.tempLine;
                    ctx.lineWidth = 2;
                    ctx.setLineDash(cycleDay - prevCycleDay > 1 ? [5, 5] : []);
                    ctx.moveTo(prevPoint.x, prevPoint.y);
                    ctx.lineTo(xCenter, y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Numéro 1-6 sous les températures de référence
                if (analysis && analysis.lowTempIndices && analysis.lowTempIndices.includes(entryIndex)) {
                    const pos = analysis.lowTempIndices.indexOf(entryIndex);
                    const label = String(analysis.lowTempIndices.length - pos);
                    ctx.save();
                    ctx.font = 'bold 10px sans-serif';
                    ctx.fillStyle = config.colors.refTempNumber;
                    ctx.textAlign = 'center';
                    ctx.fillText(label, xCenter, y + 14);
                    ctx.restore();

                    ctx.save();
                    ctx.strokeStyle = config.colors.refTempNumber;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(xCenter, y, 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // Triangle pour les hautes températures
                const isHighTemp = analysis && analysis.highTempIndices && analysis.highTempIndices.includes(entryIndex);
                const isConfirmTemp = analysis && analysis.tempShiftConfirmedIndex === entryIndex;

                if (isHighTemp || (analysis && analysis.exception1Used && isConfirmTemp)) {
                    this.drawFilledTriangle(xCenter, y - 15, 7, config.colors.highTempFill);
                }

                // Triangle vide pour les retraits
                if (analysis && analysis.retreatIndices && analysis.retreatIndices.includes(entryIndex)) {
                    this.drawEmptyTriangle(xCenter, y - 14, 7, config.colors.retreatStroke);
                }

                // Point de température
                ctx.beginPath();
                const isHigh = analysis && analysis.highTempIndices && analysis.highTempIndices.includes(entryIndex);
                const isConfirm = analysis && analysis.tempShiftConfirmedIndex === entryIndex;
                ctx.fillStyle = (isHigh || isConfirm) ? config.colors.highTempFill : config.colors.tempDot;
                ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                ctx.fill();

                prevPoint = { x: xCenter, y };
                prevCycleDay = cycleDay;

            } else {
                prevPoint = null;
                prevCycleDay = null;

                if (e.excludeTemp && e.temp) {
                    const y = this.getYForTemp(e.temp, gridHeight);
                    ctx.beginPath();
                    ctx.fillStyle = '#9e9e9e';
                    ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = config.colors.text;
                    ctx.font = 'bold 10px "JetBrains Mono", monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('✕', xCenter, y + 4);
                }
            }
        });

        // Marqueur du pic de glaire
        if (analysis && analysis.mucusPeakIndex !== null) {
            const peakEntry = entries[analysis.mucusPeakIndex];
            if (peakEntry) {
                const peakCycleDay = this.getCycleDay(peakEntry.date, cycle.startDate);
                const xPeak = config.paddingLeft + (peakCycleDay - 1) * dayWidth + dayWidth / 2;
                ctx.save();
                ctx.strokeStyle = config.colors.peak;
                ctx.lineWidth = 2.5;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(xPeak, config.headerHeight);
                ctx.lineTo(xPeak, config.headerHeight + gridHeight);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
        }

        // APPEL À LA FONCTION POUR DESSINER LES SYMBOLES EN BAS
        this.drawFooterSymbols(cycle, entries, dayWidth, gridHeight);
    }

    drawFilledTriangle(xCenter, yTip, size, color) {
        const { ctx } = this;
        ctx.save();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(xCenter, yTip);
        ctx.lineTo(xCenter - size, yTip + size * 1.5);
        ctx.lineTo(xCenter + size, yTip + size * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawEmptyTriangle(xCenter, yTip, size, strokeColor) {
        const { ctx } = this;
        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xCenter, yTip);
        ctx.lineTo(xCenter - size, yTip + size * 1.5);
        ctx.lineTo(xCenter + size, yTip + size * 1.5);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    drawHatchedRect(xLeft, yTop, width, height) {
        const { ctx, config } = this;
        ctx.save();

        ctx.fillStyle = config.colors.hatchBg;
        ctx.fillRect(xLeft, yTop, width, height);

        ctx.beginPath();
        ctx.rect(xLeft, yTop, width, height);
        ctx.clip();

        ctx.strokeStyle = config.colors.hatchLine;
        ctx.lineWidth = 1;
        const step = 5;
        for (let sx = xLeft - height; sx < xLeft + width + height; sx += step) {
            ctx.beginPath();
            ctx.moveTo(sx, yTop);
            ctx.lineTo(sx + height, yTop + height);
            ctx.stroke();
        }

        ctx.restore();
    }

}