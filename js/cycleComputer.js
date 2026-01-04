/**
 * Module d’analyse du cycle selon les règles Sympto / Sensiplan.
 *
 * Cette classe fournit :
 * - La classification du mucus (t, h, G, G+) selon sensation et aspect
 * - L’attribution d’un poids de fertilité à chaque observation
 * - L’analyse complète d’un cycle :
 *      • Détection du jour sommet (Peak Day)
 *      • Identification des jours de saignement et spotting
 *      • Calcul de la ligne de base (coverline)
 *      • Validation du décalage thermique (3 hautes après 6 basses)
 *      • Détermination du début de la phase infertile post‑ovulatoire
 *
 * L’objectif est de fournir une interprétation algorithmique fidèle
 * aux principes Sensiplan, tout en restant robuste face aux données
 * incomplètes ou hétérogènes.
 */


export class CycleComputer {

    /**
     * Classification selon Sympto / Sensiplan
     * t  = sec (s)
     * h  = humide (h) / rien vu
     * G  = glaire inf. (épais, crémeux, jaunâtre, collant)
     * G+ = glaire sup. (blanc d'oeuf, filant, transparent) OU sensation (mouillée, glissante)
     */
    static classifyMucus(sensation, aspect) {
        // Vérification des valeurs nulles/undefined
        if (!sensation) sensation = 'none';
        if (!aspect) aspect = 'none';
        
        // 1. G+ : Sensation Mouillée/Glissante OU Aspect Blanc d'oeuf/Filant
        if (sensation === 'mouillee' || sensation === 'glissante' || 
            aspect === 'blanc_oeuf' || aspect === 'filant') {
            return 'G+';
        }

        // 2. G : Aspect Crémeux/Jaunâtre/Collant
        if (aspect === 'cremeux' || aspect === 'jaunatre' || aspect === 'collant') {
            return 'G';
        }

        // 3. h : Sensation Humide (sans glaire G ou G+)
        if (sensation === 'humide') {
            return 'h';
        }

        // 4. t : Sensation Sèche et Rien vu
        if (sensation === 'seche' && (aspect === 'rien' || aspect === 'none')) {
            return 't';
        }
        
        // 5. Rien/Rien = trait (pas d'observation significative)
        if ((sensation === 'rien' || sensation === 'none') && 
            (aspect === 'rien' || aspect === 'none')) {
            return '--';
        }

        // Par sécurité : le doute profite à la fertilité
        return 'h';
    }

    static getMucusWeight(code) {
        const weights = { 'G+': 4, 'G': 3, 'h': 2, 't': 1, '--': 0 };
        return weights[code] || 0;
    }

    static analyzeCycle(cycle) {
        if (!cycle || !cycle.entries || cycle.entries.length === 0) {
            return null;
        }

        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const analysis = {
            peakDayIndex: null,
            coverLine: null,
            tempShiftConfirmedIndex: null,
            highTempIndices: [],
            bleedingDays: [],
            spottingDays: [],
            postOvulatoryInfertileStartIndex: null
        };

        // --- 1. Repérage Saignements vs Spotting ---
        entries.forEach((e, idx) => {
            if (e.bleeding) {
                if (e.bleeding === 'spotting') {
                    analysis.spottingDays.push(idx);
                } else if (e.bleeding !== 'none') {
                    analysis.bleedingDays.push(idx);
                }
            }
        });

        // --- 2. Détection du Sommet (Peak Day) ---
        let potentialPeak = null;
        let peakWeight = 0;
        
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const code = this.classifyMucus(e.mucusSensation, e.mucusAspect);
            const weight = this.getMucusWeight(code);

            // Chercher le jour le plus fertile (G+ prioritaire)
            if (weight >= 3) {
                // Si c'est aussi fertile ou plus fertile, on prend ce jour
                if (weight >= peakWeight) {
                    potentialPeak = i;
                    peakWeight = weight;
                }
            }
        }
        
        // Validation du pic : doit être suivi de jours de moindre fertilité
        if (potentialPeak !== null && potentialPeak < entries.length - 1) {
            let confirmed = false;
            
            // Vérifier les 3 jours suivants
            for (let i = 1; i <= 3 && (potentialPeak + i) < entries.length; i++) {
                const nextEntry = entries[potentialPeak + i];
                const nextCode = this.classifyMucus(nextEntry.mucusSensation, nextEntry.mucusAspect);
                const nextWeight = this.getMucusWeight(nextCode);
                
                // Si les jours suivants sont moins fertiles, on confirme
                if (nextWeight < peakWeight) {
                    confirmed = true;
                    break;
                }
            }
            
            if (confirmed) {
                analysis.peakDayIndex = potentialPeak;
            }
        }

        // --- 3. Température (Règle Sensiplan simplifiée) ---
        // Chercher 6 jours bas suivis de 3 jours hauts
        for (let i = 6; i < entries.length - 2; i++) {
            // Collecter les 6 températures basses précédentes
            let lowTemps = [];
            
            for (let k = 1; k <= 6; k++) {
                const prev = entries[i - k];
                if (prev && prev.temp && !prev.excludeTemp) {
                    lowTemps.push(prev.temp);
                }
            }
            
            // Besoin d'au moins 4 températures valides
            if (lowTemps.length >= 4) {
                const maxLow = Math.max(...lowTemps);
                
                // Vérifier les 3 jours suivants (hauts)
                const h1 = entries[i];
                const h2 = entries[i + 1];
                const h3 = entries[i + 2];
                
                if (h1 && h1.temp && !h1.excludeTemp && h1.temp > maxLow &&
                    h2 && h2.temp && !h2.excludeTemp && h2.temp > maxLow &&
                    h3 && h3.temp && !h3.excludeTemp && h3.temp > maxLow) {
                    
                    // La 3ème température haute doit être ≥ 0.2°C au-dessus
                    if (h3.temp >= maxLow + 0.2) {
                        analysis.coverLine = maxLow;
                        analysis.highTempIndices = [i, i + 1, i + 2];
                        analysis.tempShiftConfirmedIndex = i + 2;
                        
                        // Phase infertile post-ovulatoire commence après la 3ème haute
                        analysis.postOvulatoryInfertileStartIndex = i + 3;
                        break;
                    }
                }
            }
        }

        return analysis;
    }
}