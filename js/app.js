/**
 * Point d’entrée principal de l’application.
 *
 * - Initialise le DataManager (gestion des données et logique métier)
 * - Initialise le UIManager (gestion de l’interface utilisateur)
 * - Lance la configuration initiale de l’UI une fois le DOM chargé
 *
 * Ce fichier orchestre simplement l’initialisation globale
 * et délègue toute la logique aux modules spécialisés.
 */


import { DataManager } from './dataManager.js';
import { UIManager } from './uiManager.js';

document.addEventListener('DOMContentLoaded', () => {
    const dm = new DataManager();
    const ui = new UIManager(dm); 
    ui.init();
});