# TODO — Phase #2 (Montée thermique)

- [x] 1. Lire `js/cycleComputer.js` autour de `analyzeCycle()` (section “2. Montée thermique”).
- [x] 2. Implémenter l’option A : en cas de `excludeTemp`, ignorer le jour mais **ne pas casser** la consécutivité temporelle.
- [x] 3. Refaire la logique des fenêtres :
  - comparer chaque jour à la liste des **6 précédentes basses valides** (jours réels, en excluant seulement les `excludeTemp`)
  - détecter “3 températures consécutives” sur l’axe des jours (en comptant uniquement les jours valides)
  - appliquer contraintes +0.20°C au 3e haut, et gérer exceptions 1 & 2 non cumulables.
- [ ] 4. Mettre à jour `highTempIndices`, `tempShiftConfirmedIndex`, `coverLine`, `exception1Used/exception2Used`, `retreatIndices`.
- [ ] 5. Vérifier rapidement via exécution/tests existants si présents (ou lancer un petit script de vérif si nécessaire).


