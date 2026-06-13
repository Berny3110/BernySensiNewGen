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

						// ─────────────────────────────────────────────────────────
						// Catégorie G+ (Glaire supérieure - Fertilité maximale)
						// ─────────────────────────────────────────────────────────
						// Selon Sensiplan, dès que l'aspect est "clair/translucide", c'est G+ peu importe la sensation
						if (sensation === 'mouille' && aspect === 'clair') return 'G+';
						if (sensation === 'humide'  && aspect === 'clair') return 'G+';
						if (sensation === 'sec'     && aspect === 'clair') return 'G+';
						if (sensation === 'rien'    && aspect === 'clair') return 'G+';
						if (sensation === 'none'    && aspect === 'clair') return 'G+';

						// Dès que la sensation est "mouillé/lubrifié", c'est G+ peu importe l'aspect
						if (sensation === 'mouille' && aspect === 'epais') return 'G+';
						if (sensation === 'mouille' && aspect === 'rien')  return 'G+';
						if (sensation === 'mouille' && aspect === 'none')  return 'G+';

						// ─────────────────────────────────────────────────────────
						// Catégorie G (Glaire inférieure)
						// ─────────────────────────────────────────────────────────
						// L'aspect est "épais/crémeux/trouble", et la sensation n'est pas "mouillé"
						if (sensation === 'humide' && aspect === 'epais') return 'G';
						if (sensation === 'sec'    && aspect === 'epais') return 'G';
						if (sensation === 'rien'   && aspect === 'epais') return 'G';
						if (sensation === 'none'   && aspect === 'epais') return 'G';

						// ─────────────────────────────────────────────────────────
						// Catégorie h (Sensation humide sans glaire visible)
						// ─────────────────────────────────────────────────────────
						if (sensation === 'humide' && aspect === 'rien') return 'h';
						if (sensation === 'humide' && aspect === 'none') return 'h';

						// ─────────────────────────────────────────────────────────
						// Catégorie S (Sensation sèche/rêche, rien de visible)
						// ─────────────────────────────────────────────────────────
						if (sensation === 'sec' && aspect === 'rien') return 'S';
						if (sensation === 'sec' && aspect === 'none') return 'S';

						// ─────────────────────────────────────────────────────────
						// Catégorie Ø (Rien senti, rien vu)
						// ─────────────────────────────────────────────────────────
						if (sensation === 'rien' && aspect === 'rien') return 'Ø';
						if (sensation === 'rien' && aspect === 'none') return 'Ø';
						if (sensation === 'none' && aspect === 'rien') return 'Ø';
						if (sensation === 'none' && aspect === 'none') return 'Ø';

						// Sécurité par défaut
						return 'Ø';
				}


				static getMucusWeight(code) {
					// Poids alignés avec les codes renvoyés par classifyMucus()
					// G+ (max) -> 4, G -> 3, h -> 2, S -> 1, Ø -> 0
					return ({ 'G+': 4, 'G': 3, 'h': 2, 'S': 1, 'Ø': 0 })[code] ?? 0;
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


				// Option A (doc_technique.md) : si excludeTemp est vrai,
				// on ignore le jour dans les calculs de température, mais
				// on ne « casse » pas la consécutivité temporelle (les indices restent ceux des jours réels).
				//
				// Implémentation :
				// - on garde un balayage sur tous les jours (0..n-1)
				// - on maintient une liste des 6 températures basses valides précédentes
				// - quand on trouve une haute candidate (> max des 6 basses), on tente de construire
				//   3 hautes « successives » en avançant jour par jour (en ignorant les excludeTemp)
				// - exception 2 : au plus une fois où on retombe sur/ sous la ligne de référence entre les hautes
				// - exception 1 : si la 3e haute ne satisfait pas +0.20, on attend une 4e haute (> coverLine)

				const roundEntriesTemp = i => round05(entries[i].temp);
				const tempAt = i => {
						if (!validTemp(entries[i])) return null;
						return roundEntriesTemp(i);
				};

				let shiftOk = false;
				let tentative = null;

				// On cherche une première haute à partir du moment où on a au moins 6 basses valides avant.
				// `i` = jour candidat de haute
				for (let i = 0; i < n && !shiftOk; i++) {
						// Build window of last 6 valid temps strictly before i
						const lows = [];
						for (let j = i - 1; j >= 0 && lows.length < 6; j--) {
									const t = tempAt(j);
									if (t !== null) lows.unshift({ entryIdx: j, temp: t });
						}
						if (lows.length < 6) continue;

						const maxRef = Math.max(...lows.map(r => r.temp));
						const candTemp = tempAt(i);
						if (candTemp === null) continue;
						if (candTemp <= maxRef) continue; // 1ère haute strictement > max des 6 précédentes

						// Tentative construction des 3 hautes
						const highs = [i];
						const retreats = [];
						let ex2Used = false;
						let failed = false;
						let sawThirdIndex = null;

						let day = i + 1;
						while (day < n && highs.length < 3) {
									const t = tempAt(day);
									if (t === null) {
											day++;
											continue; // exclu => on l'ignore
									}

									if (t > maxRef) {
											highs.push(day);
											if (highs.length === 3) sawThirdIndex = day;
											day++;
											continue;
									}

									// t <= maxRef => retrait (exception 2)
									if (!ex2Used) {
											ex2Used = true;
											retreats.push(day);
											day++;
											continue;
									}

									// 2ème retrait => échec de tentative
									failed = true;
									break;
						}

						if (!failed) {
									// Sauvegarde tentative si on n'a pas encore rejeté
									tentative = {
										coverLine: maxRef,
										lowTempIndices: lows.map(r => r.entryIdx),
										highTempIndices: [...highs],
										retreatIndices: [...retreats],
										exception2Used: ex2Used
									};
						}

						if (failed) continue;
						if (highs.length < 3) {
									// pas assez de hautes avant fin => on laisse la tentative (comme dans l'ancien code)
									continue;
						}

						// Contrôle +0.20 au 3e jour haut
						const t3 = tempAt(highs[2]);
						if (t3 !== null && t3 >= maxRef + 0.20) {
									result.coverLine = maxRef;
									result.lowTempIndices = lows.map(r => r.entryIdx);
									result.highTempIndices = highs.slice(0, 3);
									result.retreatIndices = retreats;
									result.exception2Used = ex2Used;
									result.tempShiftConfirmedIndex = highs[2];
									shiftOk = true;
									break;
						}

						// Exception 1 : si la 3e n'atteint pas +0.20 et qu'on n'a pas déjà utilisé exception 2
						if (!ex2Used) {
									// Chercher une 4e haute STRICTEMENT > coverLine après le 3e haut
									let found = false;
									for (let k = highs[2] + 1; k < n; k++) {
												const tk = tempAt(k);
												if (tk === null) continue;
												if (tk > maxRef) {
													result.coverLine = maxRef;
													result.lowTempIndices = lows.map(r => r.entryIdx);
													result.highTempIndices = [...highs.slice(0, 3), k];
													result.retreatIndices = retreats;
													result.exception1Used = true;
													result.tempShiftConfirmedIndex = k;
													shiftOk = true;
													found = true;
													break;
												}
									}
									if (found) break;
						}
				}

				// Si la montée n'est pas encore confirmée mais qu'une tentative existe
				if (!shiftOk && tentative) {
						result.coverLine = tentative.coverLine;
						result.lowTempIndices = tentative.lowTempIndices;
						result.highTempIndices = tentative.highTempIndices;
						result.retreatIndices = tentative.retreatIndices;
						// tempShiftConfirmedIndex reste null
				}


        // ── 3. Pic de glaire (P) ──────────────────────────────────────────────────
        //
        // Doc_technique (convention) : P se note le SOIR du jour suivant la diminution.
        // Pour éviter toute ambiguïté, on représente ici P par l’index du JOUR où la
        // diminution (qualité < niveau maximal) est observée.
        //
        // Logique :
        // - On limite la recherche du “dernier jour au niveau max” à ≤ tempShiftConfirmedIndex
        //   (G+ après confirmation thermique ignoré)
        // - Puis on cherche le premier jour ultérieur < maxW
        //   => cet index devient result.mucusPeakIndex (soir associé au jour suivant).

        const mucusLimit = result.tempShiftConfirmedIndex !== null
            ? result.tempShiftConfirmedIndex
            : n - 1;

        let maxW = 0;
        let peakDayLast = null; // dernier index ≤ mucusLimit avec la meilleure qualité

        for (let i = 0; i <= mucusLimit; i++) {
            const e = entries[i];
            if (!('mucusSensation' in e) && !('mucusAspect' in e)) continue;
            const code = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
            const w = CycleComputer.getMucusWeight(code);
            if (w >= 3 && w >= maxW) {
                maxW = w;
                peakDayLast = i;
            }
        }

        if (peakDayLast !== null) {
            for (let k = peakDayLast + 1; k < n; k++) {
                const e = entries[k];
                if (!('mucusSensation' in e) && !('mucusAspect' in e)) continue;
                const code = CycleComputer.classifyMucus(e.mucusSensation, e.mucusAspect);
                if (CycleComputer.getMucusWeight(code) < maxW) {
                    result.mucusPeakIndex = k;
                    break;
                }
            }
        }

				// ── 4. Jour d'ovulation (Confirmation de la période infertile) ────────

        //
        // Sensiplan : Les deux indicateurs doivent être présents.
        // L'infertilité commence au soir du PLUS TARDIF des deux confirmations :
        //   - Température → tempShiftConfirmedIndex (3ème ou 4ème jour haut)
        //   - Mucus  → mucusPeakIndex + 3 (Le 3ème jour APRÈS le jour du pic)

        if (result.mucusPeakIndex !== null && result.tempShiftConfirmedIndex !== null) {
            const mucusConfirmationIndex = result.mucusPeakIndex + 3;
            
            // On s'assure qu'on a bien enregistré au moins 3 jours après le pic
            if (mucusConfirmationIndex < n) {
                result.ovulationDayIndex = Math.max(
                    mucusConfirmationIndex,
                    result.tempShiftConfirmedIndex
                );
            } else {
                // S'il n'y a pas encore 3 jours d'enregistrés après le pic, l'ovulation n'est pas confirmée
                result.ovulationDayIndex = null;
            }
        }

        return result;
    }
}