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

console.log("🔥 cycleComputer.js chargé !");

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

		static analyzeCycle(cycle, options = { allowTempOnly: false }) {
				if (!cycle || !Array.isArray(cycle.entries) || cycle.entries.length === 0) {
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
						retreatIndices: [],  // Sera rempli seulement si shift confirmé
						postOvulatoryInfertileStartIndex: null
				};

				const classify = (sensation, aspect) => CycleComputer.classifyMucus(sensation, aspect);
				const weightOf = (code) => CycleComputer.getMucusWeight(code);
				const isValidTemp = (entry) => entry && typeof entry.temp === 'number' && !entry.excludeTemp;

				// 1. Saignements / spotting (inchangé)
				entries.forEach((e, idx) => {
						if (e.bleeding) {
								if (e.bleeding === 'spotting') analysis.spottingDays.push(idx);
								else if (e.bleeding !== 'none') analysis.bleedingDays.push(idx);
						}
				});

				// --- 2. Détection du Pic de glaire (peakDayIndex)
				// On repère le dernier jour avec poids >= 3 (G ou G+), puis on confirme rétrospectivement
				let potentialPeak = null;
				let peakWeight = 0;
				for (let i = 0; i < entries.length; i++) {
						const e = entries[i];
						
						const hasMucusObservation =
								('mucusSensation' in e) || ('mucusAspect' in e);

						const code = hasMucusObservation
								? classify(e.mucusSensation, e.mucusAspect)
								: '--';
						
						const w = weightOf(code);
						if (w >= 3) {
								// on prend le dernier jour le plus fertile rencontré (poids >= 3)
								if (w >= peakWeight) {
										potentialPeak = i;
										peakWeight = w;
								}
						}
				}

				// Confirmation rétrospective : les 3 jours suivants doivent être de qualité moindre (poids < peakWeight)
				if (potentialPeak !== null && potentialPeak < entries.length - 1) {
						let confirmed = false;
						let lesserCount = 0;
						for (let k = 1; k <= 3 && (potentialPeak + k) < entries.length; k++) {
								const next = entries[potentialPeak + k];
								const nextCode = classify(next.mucusSensation, next.mucusAspect);
								const nextW = weightOf(nextCode);
								if (nextW < peakWeight) lesserCount++;
						}
						if (lesserCount >= 1 && lesserCount === Math.min(3, entries.length - 1 - potentialPeak)) {
								// Si on a au moins 1 jour de moindre qualité parmi les 3 suivants et pas d'incohérence majeure,
								// on considère le pic confirmé. (Comportement conservateur : on exige que les jours disponibles
								// après le pic montrent une tendance à la baisse ; si moins de 3 jours disponibles, on exige cohérence)
								confirmed = true;
						} else {
								// Variante plus stricte : exiger que les 3 jours suivants (s'ils existent) soient tous de moindre poids.
								// Ici on applique une règle intermédiaire : si 3 jours disponibles, ils doivent être tous < peakWeight.
								if ((potentialPeak + 3) < entries.length) {
										let allLesser = true;
										for (let k = 1; k <= 3; k++) {
												const next = entries[potentialPeak + k];
												const nextW = weightOf(classify(next.mucusSensation, next.mucusAspect));
												if (nextW >= peakWeight) { allLesser = false; break; }
										}
										if (allLesser) confirmed = true;
								}
						}

						if (confirmed) analysis.peakDayIndex = potentialPeak;
				}

		// 3. Montée thermique – version corrigée et complète
		let shiftConfirmed = false;
		for (let i = 6; i < entries.length && !shiftConfirmed; i++) {
				const lowTemps = [];
				const lowIndices = [];
				for (let k = 1; k <= 6; k++) {
						const prev = entries[i - k];
						if (prev && isValidTemp(prev)) {
								lowTemps.push(prev.temp);
								lowIndices.push(i - k);
						}
				}
				if (lowTemps.length < 4) continue;

				const maxLow = Math.max(...lowTemps);
				const highs = [];
				let exception2Used = false;
				let consecutiveLows = 0;
				let j = i;
				const tempRetreats = [];  // Temporaire pour cette fenêtre

				while (j < entries.length && highs.length < 3) {
						const cur = entries[j];
						if (!isValidTemp(cur)) { j++; continue; }

						if (cur.temp > maxLow) {
								highs.push(j);
								consecutiveLows = 0;
						} else {
								consecutiveLows++;
								if (consecutiveLows === 1 && !exception2Used) {
										exception2Used = true;
										tempRetreats.push(j);
								} else {
										break;  // Deuxième basse consécutive → invalide
								}
						}
						j++;
				}

				if (highs.length >= 3) {
						const thirdHighTemp = entries[highs[2]].temp;

						// Règle standard : 3ème haute >= maxLow + 0.2
						if (thirdHighTemp >= maxLow + 0.2) {
								analysis.coverLine = maxLow;
								analysis.highTempIndices = highs.slice(0, 3);
								analysis.tempShiftConfirmedIndex = highs[2];
								analysis.retreatIndices.push(...tempRetreats);
								shiftConfirmed = true;
								continue;  // Pas besoin d'aller plus loin
						}

						// Exception 1 : 4ème haute si la 3ème n'atteint pas +0.2°C et pas d'exception 2 utilisée
						if (!exception2Used) {
								let k = highs[2] + 1;
								let foundFourth = null;
								let interveningLow = false;

								while (k < entries.length) {
										const cur = entries[k];
										if (!isValidTemp(cur)) { k++; continue; }

										if (cur.temp > maxLow) {
												if (cur.temp >= maxLow + 0.2) {
														foundFourth = k;
														break;
												}
												// Si juste > maxLow mais < +0.2, on continue (pas une vraie 4e validante)
												k++;
										} else {
												interveningLow = true;
												break;
										}
								}

								if (foundFourth !== null && !interveningLow) {
										analysis.coverLine = maxLow;
										analysis.highTempIndices = highs.slice(0, 3);
										analysis.tempShiftConfirmedIndex = foundFourth;
										analysis.retreatIndices.push(...tempRetreats);
										shiftConfirmed = true;
								}
						}
				}
		}

				// --- 4. Début infertile post‑ovulatoire (Sensiplan strict) ---
				// On calcule des candidats exprimés en "startIndex" utilisable par le renderer,
				// c.-à-d. le nombre de jours complets écoulés depuis le début (0 = début du jour 1).

				let mucusCandidateStart = null;
				if (analysis.peakDayIndex !== null) {
						// peakDayIndex est 0-based (ex: 7 = jour 8)
						// "soir du 3e jour après le pic" = fin du jour (peakDay + 3)
						// startIndex = (peakDayIndex + 1) + 3 = peakDayIndex + 4
						mucusCandidateStart = analysis.peakDayIndex + 4;
				}

				let tempCandidateStart = null;
				if (analysis.tempShiftConfirmedIndex !== null) {
						// tempShiftConfirmedIndex est l'indice 0-based de la 3ème haute (ou 4ème validante)
						// "soir du 3e jour de température haute" = fin du jour correspondant à tempShiftConfirmedIndex + 1
						// startIndex = tempShiftConfirmedIndex + 1
						tempCandidateStart = analysis.tempShiftConfirmedIndex + 1;
				}

				// RÈGLE SENSIPLAN STRICTE : la porte qui s'ouvre EN DERNIER gagne
				if (mucusCandidateStart !== null && tempCandidateStart !== null) {
						analysis.postOvulatoryInfertileStartIndex = Math.max(mucusCandidateStart, tempCandidateStart);
				} else {
						// Si l'un manque → pas d'infertilité post‑ovulatoire (sauf option allowTempOnly)
						if (options && options.allowTempOnly && tempCandidateStart !== null) {
								analysis.postOvulatoryInfertileStartIndex = tempCandidateStart;
						} else {
								analysis.postOvulatoryInfertileStartIndex = null;
						}
				}

				return analysis;

				return analysis;

		}


}
