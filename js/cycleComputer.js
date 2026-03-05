/**
 * Module d'analyse du cycle selon les règles Sympto / Sensiplan.
 *
 * Ordre d'analyse :
 *   1. Saignements
 *   2. Montée thermique  ← en premier, pour connaître la borne de recherche mucus
 *   3. Pic de glaire     ← limité à ≤ tempShiftConfirmedIndex (un G+ APRÈS la confirmation
 *                          thermique est ignoré car l'ovulation est déjà acquise)
 *   4. Ovulation = max(mucusPeakIndex, tempShiftConfirmedIndex)
 */

export class CycleComputer {

    /**
     * Classification Sympto / Sensiplan
     *  t  = sec (seche + rien)
     *  h  = humide
     *  G  = glaire inférieure (crémeux, jaunâtre, collant, humide+aspect)
     *  G+ = glaire supérieure (blanc d'œuf, filant, mouillée, glissante)
     * --  = rien observé
     */
    static classifyMucus(sensation, aspect) {
        if (!sensation) sensation = 'none';
        if (!aspect)    aspect   = 'none';

        if (sensation === 'mouillee'  || sensation === 'glissante' ||
            aspect    === 'blanc_oeuf'|| aspect    === 'filant') return 'G+';

        if (aspect === 'cremeux' || aspect === 'jaunatre' || aspect === 'collant') return 'G';

        if (sensation === 'humide') return 'h';

        if (sensation === 'seche' && (aspect === 'rien' || aspect === 'none')) return 's';

        if ((sensation === 'rien' || sensation === 'none') &&
            (aspect    === 'rien' || aspect    === 'none')) return '--';

        return 'h';
    }

    static getMucusWeight(code) {
        return { 'G+': 4, 'G': 3, 'h': 2, 's': 1, '--': 0 }[code] ?? 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Analyse complète d'un cycle.
     *
     * Résultat :
     * {
     *   mucusPeakIndex        : index dans entries du pic de glaire (null si absent)
     *   coverLine             : valeur de la ligne de référence (arrondie au 0.05°)
     *   lowTempIndices        : [6 idx] groupes de référence, du plus ancien au plus récent
     *   highTempIndices       : [3 idx] 3 temperatures hautes confirmées
     *   retreatIndices        : [idx] retrait(s) toléré(s) par l'exception 2
     *   tempShiftConfirmedIndex : idx de la temp qui confirme le shift (3e ou 4e selon exception)
     *   exception1Used        : booléen
     *   exception2Used        : booléen
     *   ovulationDayIndex     : idx du jour d'ovulation = max(peakIdx, confirmIdx)
     *   bleedingDays          : [idx]
     *   spottingDays          : [idx]
     * }
     */
    static analyzeCycle(cycle) {
        if (!cycle || !Array.isArray(cycle.entries) || cycle.entries.length === 0) return null;

        const entries = [...cycle.entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        const n = entries.length;

        const result = {
            mucusPeakIndex:         null,
            coverLine:              null,
            lowTempIndices:         [],
            highTempIndices:        [],
            retreatIndices:         [],
            tempShiftConfirmedIndex:null,
            exception1Used:         false,
            exception2Used:         false,
            ovulationDayIndex:      null,
            bleedingDays:           [],
            spottingDays:           []
        };

        // Arrondi au demi-dixième (0.05 °C)
        const round05 = t => Math.round(t * 20) / 20;
        const validTemp = e => e && typeof e.temp === 'number' && !e.excludeTemp;

        // ── 1. Saignements ────────────────────────────────────────────────────
        entries.forEach((e, i) => {
            if (e.bleeding === 'spotting')               result.spottingDays.push(i);
            else if (e.bleeding && e.bleeding !== 'none') result.bleedingDays.push(i);
        });

        // ── 2. Montée thermique ───────────────────────────────────────────────
        //
        // a) On travaille uniquement sur les températures valides (non exclues)
        // b) Toutes les températures sont arrondies au demi-dixième
        // c) Première haute : strictement > max des 6 précédentes valides
        // d) 3 hautes consécutives, la 3e devant atteindre coverLine + 0.20°C
        // e) Exception 1 : si la 3e n'est pas à +0.20°C, on attend une 4e haute
        //    (elle doit juste être > coverLine, sans exigence des +0.20°C)
        // f) Exception 2 : une seule température en retrait (≤ coverLine) tolérée
        //    ENTRE les hautes — elle n'est pas comptée, pas de triangle
        // g) Exceptions 1 et 2 non cumulables
        // h) Si la séquence échoue, on repart de la prochaine candidate

        const vt = []; // { entryIdx, temp (arrondi) }
        for (let i = 0; i < n; i++) {
            if (validTemp(entries[i])) vt.push({ entryIdx: i, temp: round05(entries[i].temp) });
        }

        let shiftOk = false;
        let ss = 6; // on a besoin d'au moins 6 températures avant la candidate

        while (ss < vt.length && !shiftOk) {
            const refGroup = vt.slice(ss - 6, ss);
            const maxRef   = Math.max(...refGroup.map(r => r.temp));
            const cand     = vt[ss];

            // Candidate pas strictement plus haute → avancer
            if (cand.temp <= maxRef) { ss++; continue; }

            // ── Candidate trouvée : collecter les 3 hautes ──────────────────
            const highs    = [cand.entryIdx];
            let ex2Used    = false;
            const retreats = [];
            let failed     = false;
            let vi         = ss + 1;

            while (vi < vt.length && highs.length < 3) {
                const cur = vt[vi];
                if (cur.temp > maxRef) {
                    highs.push(cur.entryIdx);
                } else {
                    if (!ex2Used) {
                        // Exception 2 : on tolère UN seul retrait
                        ex2Used = true;
                        retreats.push(cur.entryIdx);
                    } else {
                        // Deuxième retrait → séquence invalide
                        failed = true;
                        break;
                    }
                }
                vi++;
            }

            if (failed || highs.length < 3) { ss++; continue; }

            // ── Vérification de la 3e haute ──────────────────────────────────
            const t3 = round05(entries[highs[2]].temp);

            if (t3 >= maxRef + 0.20) {
                // ✅ Confirmation standard
                result.coverLine              = maxRef;
                result.lowTempIndices         = refGroup.map(r => r.entryIdx);
                result.highTempIndices        = highs.slice(0, 3);
                result.retreatIndices         = retreats;
                result.exception2Used         = ex2Used;
                result.tempShiftConfirmedIndex = highs[2];
                shiftOk = true;

            } else if (!ex2Used) {
                // ── Exception 1 : on attend une 4e haute (> coverLine suffit) ──
                let found1 = false;
                // La 4e doit être la prochaine température valide ET > maxRef
                if (vi < vt.length && vt[vi].temp > maxRef) {
                    result.coverLine              = maxRef;
                    result.lowTempIndices         = refGroup.map(r => r.entryIdx);
                    result.highTempIndices        = highs.slice(0, 3);
                    result.retreatIndices         = retreats;
                    result.exception1Used         = true;
                    result.tempShiftConfirmedIndex = vt[vi].entryIdx;
                    shiftOk  = true;
                    found1   = true;
                }
                if (!found1) ss++;

            } else {
                // Exception 2 déjà utilisée + 3e pas à +0.20 → non cumulable → échec
                ss++;
            }
        }

        // ── 3. Pic de glaire ──────────────────────────────────────────────────
        //
        // Recherche limitée aux entrées dont l'index ≤ tempShiftConfirmedIndex
        // (un G+ apparaissant APRÈS la confirmation thermique est ignoré :
        //  l'ovulation est déjà acquise, on ne remet pas le pic en cause)
        //
        // Parmi ces entrées, on cherche la DERNIÈRE occurrence du niveau max (G ou G+).
        // Le marqueur P est affiché seulement si au moins un jour ultérieur
        // (jusqu'à la fin du cycle) présente un niveau inférieur.

        const mucusLimit = result.tempShiftConfirmedIndex !== null
            ? result.tempShiftConfirmedIndex
            : n - 1;

        let maxW     = 0;
        let peakLast = null; // dernier index ≤ mucusLimit avec le niveau maximal

        for (let i = 0; i <= mucusLimit; i++) {
            const e = entries[i];
            if (!('mucusSensation' in e) && !('mucusAspect' in e)) continue;
            const code = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
            const w    = CycleComputer.getMucusWeight(code);
            if (w >= 3 && w >= maxW) { maxW = w; peakLast = i; }
        }

        if (peakLast !== null) {
            // Confirmer le déclin : chercher un jour APRÈS peakLast avec qualité inférieure
            // (on cherche jusqu'à la fin du cycle, pas seulement jusqu'à mucusLimit)
            for (let k = peakLast + 1; k < n; k++) {
                const e = entries[k];
                if (!('mucusSensation' in e) && !('mucusAspect' in e)) continue;
                const code = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
                if (CycleComputer.getMucusWeight(code) < maxW) {
                    result.mucusPeakIndex = peakLast;
                    break;
                }
            }
        }

        // ── 4. Jour d'ovulation ───────────────────────────────────────────────
        //
        // Les deux indicateurs doivent être présents.
        // Ovulation = le PLUS TARDIF des deux confirmations :
        //   - Mucus  → mucusPeakIndex   (le jour du pic lui-même)
        //   - Température → tempShiftConfirmedIndex
        //
        // NOTE : on prend max(peakIdx, confirmIdx), PAS peakIdx+3.

        if (result.mucusPeakIndex !== null && result.tempShiftConfirmedIndex !== null) {
            result.ovulationDayIndex = Math.max(
                result.mucusPeakIndex,
                result.tempShiftConfirmedIndex
            );
        }

        return result;
    }
}