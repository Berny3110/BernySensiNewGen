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

				// --- 2. Détection du Sommet (Peak Day) selon glaire ---
				let potentialPeak = null;
				let peakWeight = 0;
				
				for (let i = 0; i < entries.length; i++) {
						const e = entries[i];
						const code = this.classifyMucus(e.mucusSensation, e.mucusAspect);
						const weight = this.getMucusWeight(code);

						if (weight >= 3) {
								if (weight >= peakWeight) {
										potentialPeak = i;
										peakWeight = weight;
								}
						}
				}
				
				// Validation muqueuse du pic : doit être suivi de jours de moindre fertilité (au moins un des 3 suivants)
				if (potentialPeak !== null && potentialPeak < entries.length - 1) {
						let confirmed = false;
						
						for (let i = 1; i <= 3 && (potentialPeak + i) < entries.length; i++) {
								const nextEntry = entries[potentialPeak + i];
								const nextCode = this.classifyMucus(nextEntry.mucusSensation, nextEntry.mucusAspect);
								const nextWeight = this.getMucusWeight(nextCode);
								
								if (nextWeight < peakWeight) {
										confirmed = true;
										break;
								}
						}
						
						if (confirmed) {
								analysis.peakDayIndex = potentialPeak;
						}
				}

				// --- 3. Température (Règle Sensiplan avec exceptions strictes) ---
				const isValidTemp = (entry) => entry && typeof entry.temp === 'number' && !entry.excludeTemp;

				// Parcours : on cherche un index i tel que les 6 précédents valides existent (ou au moins 4 valides)
				for (let i = 6; i < entries.length; i++) {
						// Récupérer les 6 températures basses précédentes (valide = non excludeTemp)
						let lowTemps = [];
						let lowIndices = [];
						for (let k = 1; k <= 6; k++) {
								const prev = entries[i - k];
								if (prev && isValidTemp(prev)) {
										lowTemps.push(prev.temp);
										lowIndices.push(i - k);
								}
						}

						// Besoin d'au moins 4 températures valides parmi les 6
						if (lowTemps.length < 4) continue;

						const maxLow = Math.max(...lowTemps);

						// Recherche des hautes après l'index i (on commence à i)
						let highs = []; // indices des jours avec temp > maxLow
						let exception2Used = false; // si on a ignoré une retombée (temp <= maxLow)
						let lowStreak = 0; // nombre de retombées consécutives rencontrées entre hautes
						let j = i;

						// On parcourt jusqu'à la fin pour collecter hautes en respectant la règle "une seule retombée"
						while (j < entries.length && highs.length < 3) {
								const cur = entries[j];
								if (!isValidTemp(cur)) { j++; continue; }

								if (cur.temp > maxLow) {
										highs.push(j);
										lowStreak = 0; // reset streak dès qu'on trouve une haute
								} else {
										// temp <= maxLow : candidate pour exception 2
										lowStreak++;
										if (lowStreak === 1) {
												// on peut ignorer une seule retombée
												exception2Used = true;
												// on continue la recherche sans ajouter d'indice
										} else {
												// deuxième retombée consécutive -> on ne peut plus ignorer, fenêtre invalide
												break;
										}
								}
								j++;
						}

						// Si on a 3 hautes collectées (en respectant max 1 retombée entre elles)
						if (highs.length >= 3) {
								const thirdHighTemp = entries[highs[2]].temp;

								// Règle standard : 3ème haute >= maxLow + 0.2
								if (thirdHighTemp >= maxLow + 0.2) {
										analysis.coverLine = maxLow;
										analysis.highTempIndices = highs.slice(0, 3);
										analysis.tempShiftConfirmedIndex = highs[2];
										analysis.postOvulatoryInfertileStartIndex = highs[2] + 1;
										break;
								}

								// Si la 3ème haute n'atteint pas +0.2, on peut appliquer Exception 1
								// Exception 1 n'est pas applicable si on a utilisé Exception 2
								if (!exception2Used) {
										// Chercher une 4ème haute (temp > maxLow) après highs[2] qui soit >= maxLow + 0.2
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
														} else {
																// une haute mais pas assez haute, on continue (mais si une retombée survient après, exception1 échoue)
																k++;
																continue;
														}
												} else {
														// si on rencontre une retombée après la 3ème haute, on ne peut pas appliquer exception1
														interveningLow = true;
														break;
												}
										}

										if (foundFourth !== null && !interveningLow) {
												// montée validée par Exception 1
												analysis.coverLine = maxLow;
												analysis.highTempIndices = highs.slice(0, 3);
												analysis.tempShiftConfirmedIndex = foundFourth;
												analysis.postOvulatoryInfertileStartIndex = foundFourth + 1;
												break;
										}
								}

								// Sinon, cette fenêtre ne valide pas la montée ; continuer la boucle principale
								continue;
						}

						// Cas : pas assez de hautes trouvées -> continuer
						
				}
				
				return analysis;
		}

}
