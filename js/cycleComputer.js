export class CycleComputer {

    static classifyMucus(sensation, aspect) {
        const s = sensation || 'rien';
        const a = aspect || 'rien';

        if (s === 'seche' && a === 'rien') return 's';
        if (s === 'rien' && a === 'rien') return '∅';
        if (s === 'humide' && a === 'rien') return 'h';
        if ((s === 'mouillee' || s === 'rien') && (a === 'cremeux' || a === 'jaunatre')) return 'G';
        if ((s === 'humide' || s === 'mouillee' || s === 'glissante') && a === 'blanc_oeuf') return 'G+';

        return '--';
    }

    static getMucusWeight(code) {
        const weights = { 'G+': 5, 'G': 4, 'h': 3, 's': 2, '∅': 1, '--': 0 };
        return weights[code] || 0;
    }

    static isDrasticChange(aspect) {
        return aspect === 'rien' || aspect === 'jaunatre';
    }

    /**
     * Analyse complète du cycle avec double contrôle Sensiplan
     * Retourne :
     * - peakDayIndex : Jour Sommet glaire
     * - coverLine : ligne de base thermique
     * - tempShiftConfirmedIndex : jour de confirmation thermique (3 ou 4 hautes)
     * - highTempIndices : indices des températures décisives
     * - postOvulatoryInfertileStartIndex : PREMIER jour (index) de phase JAUNE (double contrôle rempli)
     */
    static analyzeCycle(cycle) {
        if (!cycle.entries || cycle.entries.length === 0) return null;

        const entries = [...cycle.entries]
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const analysis = {
            peakDayIndex: null,
            coverLine: null,
            tempShiftConfirmedIndex: null,
            highTempIndices: [],
            postOvulatoryInfertileStartIndex: null  // ← Nouveau : début phase jaune
        };

        // ==============================================================
        // 1. Détection Jour Sommet (Peak Day)
        // ==============================================================
        let potentialPeakIndex = null;

        for (let i = 0; i < entries.length; i++) {
            const current = entries[i];
            const code = current.mucus?.code || '--';
            const aspect = current.mucus?.aspect || 'rien';
            const isHighQuality = this.getMucusWeight(code) >= 4;

            if (isHighQuality) {
                potentialPeakIndex = i;
            } else if (potentialPeakIndex !== null) {
                if (this.isDrasticChange(aspect)) {
                    analysis.peakDayIndex = potentialPeakIndex;
                } else if (isHighQuality) {
                    potentialPeakIndex = i;
                }
            }
        }

        // ==============================================================
        // 2. Détection montée thermique précise (Fugue de Bach + exception)
        // ==============================================================
        let thermalConfirmed = false;
        for (let i = 0; i < entries.length; i++) {
            const current = entries[i];
            if (current.excludeTemp || !current.temp) continue;

            // 6 basses valides avant
            let lowTemps = [];
            for (let k = i - 1; k >= 0 && lowTemps.length < 6; k--) {
                const prev = entries[k];
                if (!prev.excludeTemp && prev.temp) {
                    lowTemps.unshift(parseFloat(prev.temp));
                }
            }

            if (lowTemps.length < 6) continue;

            const maxLow = Math.max(...lowTemps);
            const coverLineValue = maxLow + 0.05;

            // Série de hautes consécutives
            let highTemps = [parseFloat(current.temp)];
            let highIndices = [i];

            for (let j = i + 1; j < entries.length; j++) {
                const next = entries[j];
                if (next.excludeTemp || !next.temp) break;
                const t = parseFloat(next.temp);
                if (t > maxLow) {
                    highTemps.push(t);
                    highIndices.push(j);
                } else {
                    break;
                }
            }

            if (highTemps.length >= 3) {
                const thirdHigh = highTemps[2];

                if (thirdHigh >= maxLow + 0.2) {
                    // Confirmation au soir du 3ᵉ jour
                    analysis.coverLine = coverLineValue;
                    analysis.tempShiftConfirmedIndex = highIndices[2];
                    analysis.highTempIndices = highIndices.slice(0, 3);
                    thermalConfirmed = true;
                    break;
                } else if (highTemps.length >= 4) {
                    // Règle d'exception : confirmation au soir du 4ᵉ jour
                    analysis.coverLine = coverLineValue;
                    analysis.tempShiftConfirmedIndex = highIndices[3];
                    analysis.highTempIndices = highIndices.slice(0, 4);
                    thermalConfirmed = true;
                    break;
                }
            }
        }

        // ==============================================================
        // 3. Double contrôle : début phase JAUNE
        // ==============================================================
        if (analysis.peakDayIndex !== null && analysis.tempShiftConfirmedIndex !== null) {
            const mucusCriterionDay = analysis.peakDayIndex + 3; // soir JS + 3
            const thermalCriterionDay = analysis.tempShiftConfirmedIndex;

            // Le plus tardif des deux critères
            const infertileStartIndex = Math.max(mucusCriterionDay, thermalCriterionDay);

            if (infertileStartIndex < entries.length) {
                analysis.postOvulatoryInfertileStartIndex = infertileStartIndex;
            }
        }

        return analysis;
    }
}