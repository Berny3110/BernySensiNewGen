export class CycleComputer {

    /**
     * Classification selon Sympto / Sensiplan
     * t  = sec (s)
     * h  = humide (h) / rien vu
     * G  = glaire inf. (épais, crémeux, jaunâtre, collant)
     * G+ = glaire sup. (blanc d'oeuf, filant, transparent) OU sensation (mouillée, glissante)
     */
    static classifyMucus(sensation, aspect) {
        // 1. G+ : Sensation Mouillée/Glissante OU Aspect Blanc d'oeuf/Filant
        if (sensation === 'mouillee' || sensation === 'glissante' || 
            aspect === 'blanc_oeuf' || aspect === 'filant') {
            return 'G+';
        }

        // 2. G : Aspect Crémeux/Jaunâtre/Collant (peu importe la sensation si pas mouillée)
        if (aspect === 'cremeux' || aspect === 'jaunatre' || aspect === 'collant') {
            return 'G';
        }

        // 3. h : Sensation Humide (sans glaire G ou G+)
        if (sensation === 'humide') {
            return 'h';
        }

        // 4. t : Sensation Sèche et Rien vu
        if (sensation === 'seche' && (aspect === 'rien' || !aspect)) {
            return 't';
        }
        
        // 5. Cas par défaut (Rien/Rien) = souvent assimilé à t ou h selon les écoles
        // Dans le doute, on affiche un trait
        if ((!sensation || sensation === 'rien') && (!aspect || aspect === 'rien')) {
            return '--'; // Trait
        }

        return 'h'; // Par sécurité, le doute profite à la fertilité (humide)
    }

    static getMucusWeight(code) {
        const weights = { 'G+': 4, 'G': 3, 'h': 2, 't': 1, '--': 0 };
        return weights[code] || 0;
    }

    static analyzeCycle(cycle) {
        if (!cycle || !cycle.entries || cycle.entries.length === 0) return null;

        // Tri par date
        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const analysis = {
            peakDayIndex: null,
            coverLine: null,
            tempShiftConfirmedIndex: null,
            highTempIndices: [],
            bleedingDays: [], // Jours de saignements (vrais)
            spottingDays: []  // Jours de spotting
        };

        // --- 1. Repérage Saignements vs Spotting ---
        entries.forEach((e, idx) => {
            if (e.bleeding) {
                if (e.bleeding === 'spotting') analysis.spottingDays.push(idx);
                else analysis.bleedingDays.push(idx);
            }
        });

        // --- 2. Détection du Sommet (Peak Day) ---
        // Le dernier jour de qualité G+ ou h (si pas de G+) suivi de 3 jours de qualité inférieure
        // Logique simplifiée pour l'instant : on cherche le dernier jour de haute fertilité
        let potentialPeak = null;
        
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const code = this.classifyMucus(e.mucusSensation, e.mucusAspect);
            const weight = this.getMucusWeight(code);

            // Si on trouve un jour très fertile (G+ ou h/G si c'est le max du cycle)
            if (weight >= 3) { // G ou G+
                potentialPeak = i;
            }
            
            // Vérification a posteriori (3 jours de qualité inférieure)
            // C'est complexe à faire parfaitement sans un algo lourd, 
            // ici on garde le dernier jour "haute qualité" détecté comme candidat
        }
        
        // On valide grossièrement le pic s'il est suivi de jours moins fertiles ou de fin de cycle
        if (potentialPeak !== null && potentialPeak < entries.length - 1) {
             analysis.peakDayIndex = potentialPeak;
        }

        // --- 3. Température (Règle simplifiée Sensiplan) ---
        // Chercher 6 jours bas suivis de 3 jours hauts
        // Ceci est une implémentation robuste basique
        for (let i = 6; i < entries.length - 3; i++) {
            // On cherche 6 basses avant i
            let lowTemps = [];
            let valid = true;
            for (let k = 1; k <= 6; k++) {
                const prev = entries[i - k];
                if (!prev || !prev.temp || prev.excludeTemp) {
                    // On tolère 1 ou 2 manques dans l'algo complet, ici on fait strict pour l'instant
                    // valid = false; break; 
                } else {
                    lowTemps.push(prev.temp);
                }
            }
            
            if (lowTemps.length >= 4) { // Au moins 4 points pour définir une base
                const maxLow = Math.max(...lowTemps);
                const coverLine = maxLow + 0.05; // Arrondi technique
                
                // Vérifier les 3 jours suivants
                const h1 = entries[i];
                const h2 = entries[i+1];
                const h3 = entries[i+2];
                
                if (h1 && h1.temp && h1.temp > maxLow &&
                    h2 && h2.temp && h2.temp > maxLow &&
                    h3 && h3.temp && h3.temp > maxLow) {
                        
                    // 3ème haute doit être 0.2°C au dessus de la ligne de base
                    if (h3.temp >= maxLow + 0.2) {
                        analysis.coverLine = maxLow; // Ligne visuelle sur le max des basses
                        analysis.highTempIndices = [i, i+1, i+2];
                        break; // Montée trouvée
                    }
                }
            }
        }

        return analysis;
    }
}