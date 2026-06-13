# plan.md — Modifications nécessaires pour la cohérence avec `doc_technique.md`

## Objectif
Rendre l’algorithme (analyse du cycle) et la visualisation cohérente avec les règles formelles décrites dans `doc_technique.md`.

---

## 1) Correctif critique : `getMucusWeight()` cassé / incohérent (poids et interprétation S vs Ø)

**Fichier :** `js/cycleComputer.js`

### Constat
- `CycleComputer.classifyMucus()` renvoie des codes : `G+`, `G`, `h`, `S`, `Ø`.
- `getMucusWeight()` contient une **double définition** et surtout des mappings erronés :
  - première table utilise `s` au lieu de `S`
  - deuxième table utilise `s` et `--` au lieu de `S` et `Ø`.

### Modifications à faire
- Supprimer la version dupliquée de `getMucusWeight()`.
- Mettre en place une seule table correcte :
  - `G+ -> 4`
  - `G  -> 3`
  - `h  -> 2`
  - `S  -> 1`
  - `Ø  -> 0`

### Résultat attendu
- Le “poids” utilisé pour :
  - rechercher le **pic de glaire** (niveau max)
  - détecter le **déclin** après le pic
  devient fiable et aligné sur les codes issus de `classifyMucus()`.

---

## 2) Refaire la modélisation de la montée thermique pour coller à la doc
**Fichier :** `js/cycleComputer.js`

### Constat
La doc demande :
- “3 températures consécutives supérieures aux 6 précédentes”
- avec une contrainte : la 3e haute ≥ (plus haute des 6 basses) + 0.20°C
- et des exceptions “non combinables” dont la sémantique exacte dépend de l’ordre temporel.

Le code actuel :
- construit une liste `vt` en **compressant** les jours exclus (`excludeTemp`).
- la notion de “consécutives” se retrouve donc recalculée sur les *valeurs valides*, pas sur les *jours réels*.

### Modifications à faire
- Représenter la série sur **tous les jours**, en gardant l’index temporel.
- Lorsqu’une température est “perturbée”, la doc dit qu’elle est exclue du calcul :
  - il faut clarifier si l’on doit :
    - **ignorer** le jour (sans casser la consécutivité), ou
    - **casser** la fenêtre consécutive.
  - Par défaut “symptômes/température basale” : la plupart des chartes traitent l’exclusion comme “le jour ne compte pas”, mais il faut appliquer la sémantique décrite dans `doc_technique.md`.
- Recalculer la détection de hautes de façon à ce que :
  - la fenêtre des “6 précédentes” et les “3 consécutives” soient basées sur la bonne définition (jours réels vs jours valides).
- Garantir que les exceptions 1 et 2 sont bien non cumulables comme la doc.

### Résultat attendu
- `coverLine`, `highTempIndices`, `tempShiftConfirmedIndex`, `exception1Used/exception2Used` correspondent précisément aux règles.

---

## 3) Corriger la logique “Pic de glaire” et la notation P (soir du jour suivant)
**Fichier :** `js/cycleComputer.js` et éventuellement `js/paperRenderer.js`

### Constat
La doc indique un mécanisme a posteriori :
- Le pic (P) est noté le **soir du jour suivant** quand la qualité diminue.
- La doc exige ensuite une phase infertile commençant après ce pic (règle 3 jours 1-2-3).

Le code actuel :
- cherche le dernier jour de poids maximal (`peakLast`)
- puis confirme un déclin sur un jour ultérieur
- mais n’encode pas explicitement le “décalage P (soir jour suivant)”.

### Modifications à faire
- Définir clairement :
  - quel index représente “jour du pic” vs “soir P”.
- Adapter `mucusPeakIndex` pour représenter la bonne référence attendue par la doc (selon ce que `PaperRenderer` et l’infertilité utilisent).
- Mettre à jour le calcul de la phase infertile post-pic en conséquence (cf. section 4).

### Résultat attendu
- La position du marqueur P sur le graphique devient cohérente avec la doc.

---

## 4) Corriger le démarrage de l’infertilité : sémantique “soir du 3e jour après” (le plus tard)
**Fichier :** `js/cycleComputer.js`

### Constat
- La doc : “infertilité commence le soir du PLUS TARDIF entre”
  - 3ème jour après pic de glaire
  - 3ème jour après la validation de montée thermique
- Le code fait `ovulationDayIndex = max(mucusPeakIndex + 3, tempShiftConfirmedIndex)`.

### Modifications à faire
- Clarifier ce que représente `tempShiftConfirmedIndex` :
  - correspond-il à la 3e haute (jour de la 3e haute) ou à la 3e haute “soir” ?
- Re-traduire exactement :
  - “soir du 3ème jour consécutif” => index + 3 vs +2 selon conventions.
- Calculer une date/indice d’infertilité final basée sur deux candidats :
  - `infertileStartFromMucusSoir`
  - `infertileStartFromTempSoir`
  - puis prendre le plus tard.
- Mettre à jour tout ce qui dépend de `ovulationDayIndex` :
  - colorisation phases dans `PaperRenderer`.

### Résultat attendu
- L’overlay (début infertile) sur le graphique et les indices logiques sont alignés.

---

## 5) Nettoyage & cohérence code (réduction des ambiguïtés)
**Fichiers :** `js/cycleComputer.js`, éventuellement `js/paperRenderer.js`

### Actions
- Supprimer la duplication de méthodes (`getMucusWeight`).
- Éliminer / corriger tout “reste de refactor” qui peut inverser la logique (ex : commentaires contradictoires).
- Ajouter des petites fonctions utilitaires pour éviter l’erreur d’index (ex : `dayIndexToSoirIndex(...)`).

### Résultat attendu
- Moins de risques de divergences futures.

---

## 6) Vérifications manuelles (tests de cohérence)
**Fichier :** aucun, procédure

### Protocole
- Créer 2-3 jeux de données d’exemple (cycles) conformes à la doc.
- Vérifier :
  1) mapping `classifyMucus` → poids → pic P attendu
  2) montée thermique : coverline + triangle (hautes) + exceptions
  3) début infertilité : overlay + indices calculés “soir du plus tardif”

---

## Priorité
1. #1 Bug `getMucusWeight()`
2. #2 Montée thermique (fenêtres / consécutivité)
3. #3 Pic P (décalage “soir jour suivant”)
4. #4 Infertilité (soir + max des 2 confirmations)
5. #5 Nettoyage / cohérence
6. #6 Vérifications

