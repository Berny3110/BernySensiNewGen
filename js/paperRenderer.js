/**
 * Moteur de rendu graphique du cycle sur canvas — Version 2.
 *
 * Nouveautés :
 * - Colonnes colorées : jours 1-5 (bleu), ovulation (rouge), J+1 à J+3 (rose), phase infertile (bleu)
 * - Ligne de référence bleue horizontale (coverline)
 * - Numéros 1-6 sous les températures de référence
 * - Triangles sur les 3 températures hautes confirmées
 * - Rectangle hachuré entre la coverline et la coverline+0.2
 * - Symbole ∅ pour les observations "rien" de glaire
 * - Zoom bidirectionnel (axes X et Y)
 */

import { CycleComputer } from './cycleComputer.js';

export class PaperRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.config = {
            dayWidth: 32,
            headerHeight: 70,
            footerHeight: 110,
            tempMin: 36.0,
            tempMax: 37.0,
            gridHeight: 300,
            paddingLeft: 44,
            colors: {
                grid: '#e0e0e0',
                gridStrong: '#9e9e9e',
                tempLine: '#2962ff',
                tempDot: '#000000',
                text: '#333333',
                coverLine: '#2196f3',       // Bleu pour coverline
                peak: '#e91e63',            // Rose pour pic de glaire
                bleeding: '#d32f2f',
                // Phases
                bgFirstDays: 'rgba(33, 150, 243, 0.13)',    // Bleu jours 1-5
                bgOvulation: 'rgba(211, 47, 47, 0.25)',      // Rouge ovulation
                bgPostOv1_3: 'rgba(233, 30, 99, 0.13)',      // Rose J+1 à J+3
                bgInfertile: 'rgba(33, 150, 243, 0.13)',     // Bleu phase infertile
                // Températures
                highTempFill: '#ff5722',
                hatchBg: 'rgba(255, 87, 34, 0.10)',
                hatchLine: 'rgba(255, 87, 34, 0.55)',
                retreatStroke: '#9e9e9e',
                refTempNumber: '#1565c0',   // Bleu foncé pour les chiffres 1-6
            }
        };

        this.updateThemeColors();
    }

    roundTempForDisplay(temp) {
        // Arrondi au demi-dixième (0.05°C)
        return Math.round(temp * 20) / 20;
    }

    getCycleDay(entryDate, cycleStartDate) {
        const start = new Date(cycleStartDate);
        const entry = new Date(entryDate);
        const diffDays = Math.floor((entry - start) / (1000 * 60 * 60 * 24));
        return diffDays + 1;
    }

    updateThemeColors() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            this.config.colors.background = '#2a2a2a';
            this.config.colors.grid = '#3a3a3a';
            this.config.colors.gridStrong = '#555555';
            this.config.colors.text = '#e0e0e0';
            this.config.colors.tempLine = '#64b5f6';
            this.config.colors.tempDot = '#ffffff';
            this.config.colors.bgFirstDays = 'rgba(33, 150, 243, 0.18)';
            this.config.colors.bgOvulation = 'rgba(211, 47, 47, 0.35)';
            this.config.colors.bgPostOv1_3 = 'rgba(233, 30, 99, 0.20)';
            this.config.colors.bgInfertile = 'rgba(33, 150, 243, 0.18)';
        } else {
            this.config.colors.background = '#ffffff';
            this.config.colors.grid = '#e0e0e0';
            this.config.colors.gridStrong = '#9e9e9e';
            this.config.colors.text = '#333333';
            this.config.colors.tempLine = '#2962ff';
            this.config.colors.tempDot = '#000000';
            this.config.colors.bgFirstDays = 'rgba(33, 150, 243, 0.13)';
            this.config.colors.bgOvulation = 'rgba(211, 47, 47, 0.25)';
            this.config.colors.bgPostOv1_3 = 'rgba(233, 30, 99, 0.13)';
            this.config.colors.bgInfertile = 'rgba(33, 150, 243, 0.13)';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Conversion température → coordonnée Y
    // ─────────────────────────────────────────────────────────────────────────
    getYForTemp(temp, gridHeight) {
        gridHeight = gridHeight ?? this._gridHeight ?? this.config.gridHeight;
        temp = this.roundTempForDisplay(temp);
        if (temp > this.config.tempMax) temp = this.config.tempMax;
        if (temp < this.config.tempMin) temp = this.config.tempMin;
        const range = this.config.tempMax - this.config.tempMin;
        const ratio = (this.config.tempMax - temp) / range;
        return this.config.headerHeight + (ratio * gridHeight);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Rendu principal
    // ─────────────────────────────────────────────────────────────────────────
    render(cycle, analysis, zoom = 1.0) {
        if (!cycle || !cycle.entries) return;

        this.updateThemeColors();

        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));

        // Nombre de jours à afficher
        let maxCycleDay = 40;
        if (entries.length > 0) {
            const lastCycleDay = this.getCycleDay(entries[entries.length - 1].date, cycle.startDate);
            maxCycleDay = Math.max(maxCycleDay, lastCycleDay + 5);
        }

        // Dimensions avec zoom bidirectionnel (X et Y)
        const dayWidth = this.config.dayWidth * zoom;
        const gridHeight = this.config.gridHeight * zoom;
        this._gridHeight = gridHeight;

        const { headerHeight, footerHeight, paddingLeft } = this.config;
        const baseWidth = paddingLeft + maxCycleDay * dayWidth;
        const baseHeight = headerHeight + gridHeight + footerHeight;

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(baseWidth * dpr);
        this.canvas.height = Math.round(baseHeight * dpr);
        this.canvas.style.width = `${baseWidth}px`;
        this.canvas.style.height = `${baseHeight}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        // Fond général
        this.ctx.fillStyle = this.config.colors.background;
        this.ctx.fillRect(0, 0, baseWidth, baseHeight);

        // Étape 1 : Bandes de fond (colonnes colorées)
        this.drawBackgroundBands(maxCycleDay, dayWidth, gridHeight, analysis, entries, cycle);

        // Étape 2 : Grille
        this.drawGrid(maxCycleDay, baseWidth, dayWidth, gridHeight);

        // Étape 3 : Données (températures, mucus, marqueurs)
        this.drawData(cycle, analysis, entries, dayWidth, gridHeight, baseWidth);

        // Étape 4 : Saignements
        this.drawBleeding(cycle, entries, dayWidth, gridHeight);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Bandes de fond colorées par colonne/jour de cycle
    // ─────────────────────────────────────────────────────────────────────────
    drawBackgroundBands(daysCount, dayWidth, gridHeight, analysis, entries, cycle) {
        const { ctx, config } = this;
        const yTop = config.headerHeight;

        // Trouver le jour de cycle de l'ovulation
        let ovulationCycleDay = null;
        if (analysis && analysis.ovulationDayIndex !== null && analysis.ovulationDayIndex !== undefined) {
            const ovulEntry = entries[analysis.ovulationDayIndex];
            if (ovulEntry) {
                ovulationCycleDay = this.getCycleDay(ovulEntry.date, cycle.startDate);
            }
        }

        for (let day = 1; day <= daysCount; day++) {
            const xLeft = config.paddingLeft + (day - 1) * dayWidth;

            let color = null;

            if (day <= 5) {
                // Jours 1-5 : bleu (phase potentiellement infertile début de cycle)
                color = config.colors.bgFirstDays;
            } else if (ovulationCycleDay !== null) {
                if (day === ovulationCycleDay) {
                    // Jour d'ovulation : rouge
                    color = config.colors.bgOvulation;
                } else if (day > ovulationCycleDay && day <= ovulationCycleDay + 3) {
                    // J+1 à J+3 : rose
                    color = config.colors.bgPostOv1_3;
                } else if (day > ovulationCycleDay + 3) {
                    // Phase infertile post-ovulatoire : bleu
                    color = config.colors.bgInfertile;
                }
                // Entre jour 5 et ovulation : fond blanc (phase fertile, pas de couleur)
            }

            if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(xLeft, yTop, dayWidth, gridHeight);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Grille
    // ─────────────────────────────────────────────────────────────────────────
    drawGrid(daysCount, totalWidth, dayWidth, gridHeight) {
        const { ctx, config } = this;
        const bottomY = config.headerHeight + gridHeight;

        // Grille horizontale (températures)
        for (let t = config.tempMin * 10; t <= config.tempMax * 10; t++) {
            const temp = t / 10;
            const y = this.getYForTemp(temp, gridHeight);
            const isMain = (t % 5 === 0);
            ctx.strokeStyle = isMain ? config.colors.gridStrong : config.colors.grid;
            ctx.lineWidth = isMain ? 1.5 : 0.7;
            ctx.beginPath();
            ctx.moveTo(config.paddingLeft, y);
            ctx.lineTo(totalWidth, y);
            ctx.stroke();

            if (isMain) {
                ctx.fillStyle = config.colors.text;
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(temp.toFixed(1), config.paddingLeft - 4, y + 4);
            }
        }

        // Grille verticale (jours)
        for (let i = 0; i <= daysCount; i++) {
            const x = config.paddingLeft + i * dayWidth;
            ctx.strokeStyle = config.colors.grid;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, bottomY + config.footerHeight);
            ctx.stroke();

            if (i > 0) {
                ctx.fillStyle = config.colors.text;
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(i, config.paddingLeft + (i - 1) * dayWidth + dayWidth / 2, bottomY + 20);
            }
        }

        // Bordures principales
        ctx.strokeStyle = config.colors.gridStrong;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, config.headerHeight);
        ctx.lineTo(totalWidth, config.headerHeight);
        ctx.moveTo(0, bottomY);
        ctx.lineTo(totalWidth, bottomY);
        ctx.stroke();
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Données principales : mucus, température, marqueurs d'analyse
    // ─────────────────────────────────────────────────────────────────────────
    drawData(cycle, analysis, entries, dayWidth, gridHeight, totalWidth) {
        const { ctx, config } = this;

        // ── Coverline (ligne de référence bleue) ──────────────────────────────
        if (analysis && analysis.coverLine !== null && analysis.coverLine !== undefined) {
            const yCover = this.getYForTemp(analysis.coverLine, gridHeight);
            ctx.save();
            ctx.strokeStyle = config.colors.coverLine;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(config.paddingLeft, yCover);
            ctx.lineTo(totalWidth, yCover);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // ── Rectangles hachurés pour les colonnes des hautes températures ────
        if (analysis && analysis.highTempIndices && analysis.highTempIndices.length > 0 &&
            analysis.coverLine !== null) {
            const yRefBottom = this.getYForTemp(analysis.coverLine, gridHeight);
            const yRefTop = this.getYForTemp(analysis.coverLine + 0.2, gridHeight);
            const hatchHeight = yRefBottom - yRefTop;

            analysis.highTempIndices.forEach(entryIdx => {
                const e = entries[entryIdx];
                if (!e) return;
                const cycleDay = this.getCycleDay(e.date, cycle.startDate);
                const xLeft = config.paddingLeft + (cycleDay - 1) * dayWidth;
                this.drawHatchedRect(xLeft, yRefTop, dayWidth, hatchHeight);
            });

            // Aussi pour la 4ème haute (exception 1) si elle existe
            if (analysis.exception1Used && analysis.tempShiftConfirmedIndex !== null) {
                const e = entries[analysis.tempShiftConfirmedIndex];
                if (e && !analysis.highTempIndices.includes(analysis.tempShiftConfirmedIndex)) {
                    const cycleDay = this.getCycleDay(e.date, cycle.startDate);
                    const xLeft = config.paddingLeft + (cycleDay - 1) * dayWidth;
                    this.drawHatchedRect(xLeft, yRefTop, dayWidth, hatchHeight);
                }
            }
        }

        // ── Dessin entrée par entrée ──────────────────────────────────────────
        let prevPoint = null;
        let prevCycleDay = null;

        entries.forEach((e, entryIndex) => {
            const cycleDay = this.getCycleDay(e.date, cycle.startDate);
            const xCenter = config.paddingLeft + (cycleDay - 1) * dayWidth + dayWidth / 2;

            // ── DATE ──────────────────────────────────────────────────────────
            const d = new Date(e.date);
            const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
            ctx.save();
            ctx.font = '10px sans-serif';
            ctx.fillStyle = config.colors.text;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(dateStr, xCenter, config.headerHeight + gridHeight + 38);
            ctx.restore();

            // ── MUCUS (3 lignes dans le header) ──────────────────────────────
            const yGlaire1 = config.headerHeight - 48; // Perturbations
            const yGlaire2 = config.headerHeight - 32; // Sensation
            const yGlaire3 = config.headerHeight - 16; // Aspect
            const yGlaire4 = config.headerHeight - 2;  // Code résultant

            ctx.save();
            ctx.font = '13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = config.colors.text;

            // Icône de perturbation
            if (e.excludeTemp || (e.perturbations && Object.values(e.perturbations).some(v => v))) {
                let icon = '🚫';
                if (e.perturbations) {
                    if (e.perturbations['p-sleep']) icon = '💤';
                    else if (e.perturbations['p-alcohol']) icon = '🍷';
                    else if (e.perturbations['p-illness']) icon = '🤒';
                    else if (e.perturbations['p-stress']) icon = '⚡';
                    else if (e.perturbations['p-late']) icon = '⏰';
										else if (e.perturbations['p-love']) icon = '❤️';
                }
                ctx.fillText(icon, xCenter, yGlaire1);
            }

            // Ligne sensation
            const hasSensationEntry = 'mucusSensation' in e;
            if (hasSensationEntry) {
                if (e.mucusSensation === 'rien') {
                    // ∅ pour "rien observé"
                    ctx.font = 'bold 13px sans-serif';
                    ctx.fillStyle = '#888';
                    ctx.fillText('∅', xCenter, yGlaire2);
                } else if (e.mucusSensation && e.mucusSensation !== 'none') {
                    let emoji = '';
                    switch (e.mucusSensation) {
												case 'sec':     emoji = '🌵'; break;
												case 'humide':  emoji = '💧'; break;
												case 'mouille': emoji = '💦'; break;
										}
                    ctx.font = '13px sans-serif';
                    ctx.fillStyle = config.colors.text;
                    if (emoji) ctx.fillText(emoji, xCenter, yGlaire2);
                }
            }

            // Ligne aspect
            const hasAspectEntry = 'mucusAspect' in e;
            if (hasAspectEntry) {
                if (e.mucusAspect === 'rien') {
                    ctx.font = 'bold 13px sans-serif';
                    ctx.fillStyle = '#888';
                    ctx.fillText('∅', xCenter, yGlaire3);
                } else if (e.mucusAspect && e.mucusAspect !== 'none') {
                    let emoji = '';
										switch (e.mucusAspect) {
												case 'epais': emoji = '🥛'; break;
												case 'clair': emoji = '🥚'; break;
										}
                    ctx.font = '13px sans-serif';
                    ctx.fillStyle = config.colors.text;
                    if (emoji) ctx.fillText(emoji, xCenter, yGlaire3);
                }
            }

            // Code résultant (G+, G, h, t)
            if (hasSensationEntry || hasAspectEntry) {
                const code = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
                if (code && code !== '--') {
                    ctx.font = 'bold 10px sans-serif';
										const codeColors = {
												'G+': '#c62828',
												'G':  '#e65100',
												'h':  '#1565c0',
												'S':  '#757575',
												'Ø':  '#888888'
										};
                    ctx.fillStyle = codeColors[code] || config.colors.text;
                    ctx.fillText(code, xCenter, yGlaire4);
                }
            }

            ctx.restore();

            // ── TEMPÉRATURE ───────────────────────────────────────────────────
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

                // ── Rectangle hachuré : déjà dessiné avant la boucle ──

                // ── Numéro 1-6 sous les températures de référence ────────────
                if (analysis && analysis.lowTempIndices && analysis.lowTempIndices.includes(entryIndex)) {
                    const pos = analysis.lowTempIndices.indexOf(entryIndex);
                    // lowTempIndices[0] = plus ancien, [5] = plus récent
                    // On numérote : plus récent = 1, plus ancien = 6
                    const label = String(analysis.lowTempIndices.length - pos);
                    ctx.save();
                    ctx.font = 'bold 10px sans-serif';
                    ctx.fillStyle = config.colors.refTempNumber;
                    ctx.textAlign = 'center';
                    ctx.fillText(label, xCenter, y + 14);
                    ctx.restore();

                    // Cercle discret autour du point de référence
                    ctx.save();
                    ctx.strokeStyle = config.colors.refTempNumber;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(xCenter, y, 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // ── Triangle pour les hautes températures confirmées ──────────
                const isHighTemp = analysis && analysis.highTempIndices &&
                    analysis.highTempIndices.includes(entryIndex);
                const isConfirmTemp = analysis &&
                    analysis.tempShiftConfirmedIndex === entryIndex;

                if (isHighTemp || (analysis && analysis.exception1Used && isConfirmTemp)) {
                    this.drawFilledTriangle(xCenter, y - 15, 7, config.colors.highTempFill);
                }

                // ── Triangle vide pour les retraits (exception 2) ─────────────
                if (analysis && analysis.retreatIndices && analysis.retreatIndices.includes(entryIndex)) {
                    this.drawEmptyTriangle(xCenter, y - 14, 7, config.colors.retreatStroke);
                }

                // ── Point de température ──────────────────────────────────────
                ctx.beginPath();
                const isHigh = analysis && analysis.highTempIndices && analysis.highTempIndices.includes(entryIndex);
                const isConfirm = analysis && analysis.tempShiftConfirmedIndex === entryIndex;
                ctx.fillStyle = (isHigh || isConfirm) ? config.colors.highTempFill : config.colors.tempDot;
                ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                ctx.fill();

                prevPoint = { x: xCenter, y };
                prevCycleDay = cycleDay;

            } else {
                // Température exclue : affichée en gris avec X
                prevPoint = null;
                prevCycleDay = null;

                if (e.excludeTemp && e.temp) {
                    const y = this.getYForTemp(e.temp, gridHeight);
                    ctx.beginPath();
                    ctx.fillStyle = '#9e9e9e';
                    ctx.arc(xCenter, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = config.colors.text;
                    ctx.font = 'bold 11px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('✕', xCenter, y + 4);
                }
            }
        });

        // ── Marqueur du pic de glaire (trait vertical rose) ───────────────────
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
                // Label "P" au-dessus
                ctx.setLineDash([]);
                ctx.font = 'bold 11px sans-serif';
                ctx.fillStyle = config.colors.peak;
                ctx.textAlign = 'center';
                ctx.fillText('P', xPeak, config.headerHeight - 52);
                ctx.restore();
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Formes géométriques
    // ─────────────────────────────────────────────────────────────────────────

    /** Triangle plein (pointe vers le haut) */
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

    /** Triangle vide (stroke) pour les retraits */
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

    /** Rectangle hachuré (de coverline à coverline+0.2) pour les hautes températures */
    drawHatchedRect(xLeft, yTop, width, height) {
        const { ctx, config } = this;
        ctx.save();

        // Fond semi-transparent
        ctx.fillStyle = config.colors.hatchBg;
        ctx.fillRect(xLeft, yTop, width, height);

        // Hachures diagonales clippées au rectangle
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

    // ─────────────────────────────────────────────────────────────────────────
    //  Saignements (footer)
    // ─────────────────────────────────────────────────────────────────────────
    drawBleeding(cycle, entries, dayWidth, gridHeight) {
        const { ctx, config } = this;
        const bottomY = config.headerHeight + gridHeight;

        ctx.font = '14px sans-serif';

        entries.forEach(e => {
            if (!e.bleeding || e.bleeding === 'none') return;

            const cycleDay = this.getCycleDay(e.date, cycle.startDate);
            const xCenter = config.paddingLeft + (cycleDay - 1) * dayWidth + dayWidth / 2;
            const yBaseline = bottomY + 72;

            let emoji = '';
            switch (e.bleeding) {
                case 'spotting': emoji = '💉'; break;
                case 'light':    emoji = '🩸'; break;
                case 'medium':   emoji = '🩸🩸'; break;
                case 'heavy':    emoji = '🩸🩸🩸'; break;
            }

            ctx.save();
            ctx.translate(xCenter, yBaseline);
            ctx.rotate(-Math.PI / 2);
            ctx.scale(0.45, 0.45);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(emoji, 0, 0);
            ctx.restore();
        });
    }
}
