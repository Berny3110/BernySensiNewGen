/**
 * Gestionnaire des notifications Push & Rappels Quotidiens pour SensiTrack (PWA).
 *
 * Gère :
 * - L'ouverture / fermeture du popover (au clic sur la cloche et au clic extérieur)
 * - La demande et vérification des permissions (Notification.permission)
 * - L'activation / désactivation du toggle et la synchronisation avec localStorage
 * - La sélection et persistance des heures de rappel (matin et soir)
 * - L'ordonnanceur local (scheduler en temps réel) qui surveille l'horloge
 * - Le déclenchement effectif des rappels programmés à la minute exacte
 * - L'envoi d'une notification de test immédiate
 */

export class NotificationManager {
    constructor(uiManager) {
        this.ui = uiManager;
        this.STORAGE_KEY_ENABLED = 'sensitrack_notif_enabled';
        this.STORAGE_KEY_MORNING = 'sensitrack_notif_morning';
        this.STORAGE_KEY_EVENING = 'sensitrack_notif_evening';
        this.STORAGE_KEY_LAST_MORNING = 'sensitrack_notif_last_morning_sent';
        this.STORAGE_KEY_LAST_EVENING = 'sensitrack_notif_last_evening_sent';

        this.DEFAULT_MORNING = '08:00';
        this.DEFAULT_EVENING = '20:00';

        this.isOpen = false;
        this.schedulerInterval = null;
    }

    init() {
        this.cacheDOM();
        if (!this.dom.bellBtn || !this.dom.popover) return;

        this.loadSettings();
        this.bindEvents();
        this.updatePermissionUI();
        this.startScheduler();
    }

    cacheDOM() {
        this.dom = {
            bellBtn: document.getElementById('notif-toggle-btn'),
            statusDot: document.getElementById('notif-status-dot'),
            popover: document.getElementById('notif-popover'),
            closeBtn: document.getElementById('notif-popover-close'),
            masterToggle: document.getElementById('notif-master-toggle'),
            switchContainer: document.getElementById('notif-switch-container'),
            permissionMsg: document.getElementById('notif-permission-msg'),
            timeMorning: document.getElementById('notif-time-morning'),
            timeEvening: document.getElementById('notif-time-evening'),
            testBtn: document.getElementById('notif-test-btn'),
            scheduleSection: document.getElementById('notif-schedule-section'),
            nextStatus: document.getElementById('notif-next-status'),
            nextText: document.getElementById('notif-next-text')
        };
    }

    loadSettings() {
        const isEnabled = localStorage.getItem(this.STORAGE_KEY_ENABLED) === 'true';
        const morningTime = localStorage.getItem(this.STORAGE_KEY_MORNING) || this.DEFAULT_MORNING;
        const eveningTime = localStorage.getItem(this.STORAGE_KEY_EVENING) || this.DEFAULT_EVENING;

        if (this.dom.timeMorning) this.dom.timeMorning.value = morningTime;
        if (this.dom.timeEvening) this.dom.timeEvening.value = eveningTime;

        if (this.dom.masterToggle) {
            this.dom.masterToggle.checked = isEnabled;
        }

        this.updateStatusBadge(isEnabled);
        this.updateNextStatusUI();
    }

    bindEvents() {
        // Clic sur la cloche -> toggle popover
        this.dom.bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePopover();
        });

        // Clic sur bouton fermer du popover
        if (this.dom.closeBtn) {
            this.dom.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePopover();
            });
        }

        // Clic extérieur pour fermer
        document.addEventListener('click', (e) => {
            if (this.isOpen && this.dom.popover && !this.dom.popover.contains(e.target) && !this.dom.bellBtn.contains(e.target)) {
                this.closePopover();
            }
        });

        // Touche Échap pour fermer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closePopover();
            }
        });

        // Changement de l'interrupteur principal
        if (this.dom.masterToggle) {
            this.dom.masterToggle.addEventListener('change', async (e) => {
                await this.handleToggleChange(e.target.checked);
            });
        }

        // Modification de l'heure du matin
        if (this.dom.timeMorning) {
            this.dom.timeMorning.addEventListener('change', (e) => {
                const val = e.target.value || this.DEFAULT_MORNING;
                localStorage.setItem(this.STORAGE_KEY_MORNING, val);
                // Réinitialiser le verrou du jour pour permettre un test immédiat
                localStorage.removeItem(this.STORAGE_KEY_LAST_MORNING);
                this.updateNextStatusUI();
                if (this.ui?.showToast) {
                    this.ui.showToast(`Rappel matin programmé : ${val} ✓`);
                }
            });
        }

        // Modification de l'heure du soir
        if (this.dom.timeEvening) {
            this.dom.timeEvening.addEventListener('change', (e) => {
                const val = e.target.value || this.DEFAULT_EVENING;
                localStorage.setItem(this.STORAGE_KEY_EVENING, val);
                // Réinitialiser le verrou du jour pour permettre un test immédiat
                localStorage.removeItem(this.STORAGE_KEY_LAST_EVENING);
                this.updateNextStatusUI();
                if (this.ui?.showToast) {
                    this.ui.showToast(`Rappel soir programmé : ${val} ✓`);
                }
            });
        }

        // Bouton de test
        if (this.dom.testBtn) {
            this.dom.testBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.sendTestNotification();
            });
        }

        // Réveil de l'écran ou retour sur l'onglet PWA
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkScheduledReminders();
            }
        });

        window.addEventListener('focus', () => {
            this.checkScheduledReminders();
        });
    }

    /**
     * Démarrage de la boucle de surveillance du temps (scheduler)
     */
    startScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
        }

        // Vérification immédiate
        this.checkScheduledReminders();

        // Surveillance toutes les 15 secondes pour intercepter la minute pile
        this.schedulerInterval = setInterval(() => {
            this.checkScheduledReminders();
        }, 15000);
    }

    /**
     * Vérifie si l'heure actuelle correspond à l'un des deux rappels programmés
     */
    checkScheduledReminders() {
        const isEnabled = localStorage.getItem(this.STORAGE_KEY_ENABLED) === 'true';
        if (!isEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
            this.updateNextStatusUI();
            return;
        }

        const now = new Date();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;
        const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const morningTime = localStorage.getItem(this.STORAGE_KEY_MORNING) || this.DEFAULT_MORNING;
        const eveningTime = localStorage.getItem(this.STORAGE_KEY_EVENING) || this.DEFAULT_EVENING;

        const lastMorningSent = localStorage.getItem(this.STORAGE_KEY_LAST_MORNING);
        const lastEveningSent = localStorage.getItem(this.STORAGE_KEY_LAST_EVENING);

        // 1. Rappel du matin
        if (currentTimeStr === morningTime && lastMorningSent !== todayDateStr) {
            localStorage.setItem(this.STORAGE_KEY_LAST_MORNING, todayDateStr);
            this.triggerReminderNotification('morning');
        }

        // 2. Rappel du soir
        if (currentTimeStr === eveningTime && lastEveningSent !== todayDateStr) {
            localStorage.setItem(this.STORAGE_KEY_LAST_EVENING, todayDateStr);
            this.triggerReminderNotification('evening');
        }

        this.updateNextStatusUI();
    }

    /**
     * Déclenche la notification programmée
     */
    async triggerReminderNotification(type) {
        const isMorning = type === 'morning';
        const title = isMorning ? "SensiTrack — Rappel du matin 🌅" : "SensiTrack — Rappel du soir 🌙";
        const body = isMorning
            ? "C'est l'heure de mesurer et noter votre température basale du réveil !"
            : "Pensez à noter vos observations de glaire et sensations de la journée.";

        const options = {
            body: body,
            icon: './maskable_icon_x192_v4.png',
            badge: './maskable_icon_x192_v4.png',
            vibrate: [200, 100, 200, 100, 200],
            tag: `sensitrack-${type}`,
            renotify: true,
            requireInteraction: true,
            data: { url: './' }
        };

        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                    await reg.showNotification(title, options);
                    if (this.ui?.showToast) this.ui.showToast(`${title} émis ✓`);
                    return;
                }
            }
            new Notification(title, options);
            if (this.ui?.showToast) this.ui.showToast(`${title} émis ✓`);
        } catch (err) {
            console.warn(`Erreur déclenchement notification ${type}:`, err);
            try {
                new Notification(title, options);
            } catch (e) {
                console.error("Échec fallback notification:", e);
            }
        }
    }

    /**
     * Met à jour le texte du prochain rappel calculé dans l'interface
     */
    updateNextStatusUI() {
        if (!this.dom.nextText) return;

        const isEnabled = localStorage.getItem(this.STORAGE_KEY_ENABLED) === 'true';
        if (!isEnabled) {
            this.dom.nextText.textContent = "Rappels désactivés";
            if (this.dom.nextStatus) this.dom.nextStatus.style.opacity = '0.6';
            return;
        }

        if (this.dom.nextStatus) this.dom.nextStatus.style.opacity = '1';

        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTotalMin = currentHours * 60 + currentMinutes;

        const morningTime = localStorage.getItem(this.STORAGE_KEY_MORNING) || this.DEFAULT_MORNING;
        const eveningTime = localStorage.getItem(this.STORAGE_KEY_EVENING) || this.DEFAULT_EVENING;

        const [mH, mM] = morningTime.split(':').map(Number);
        const [eH, eM] = eveningTime.split(':').map(Number);

        const morningTotalMin = mH * 60 + mM;
        const eveningTotalMin = eH * 60 + eM;

        if (currentTotalMin < morningTotalMin) {
            this.dom.nextText.textContent = `Prochain rappel : Aujourd'hui à ${morningTime} (Matin)`;
        } else if (currentTotalMin < eveningTotalMin) {
            this.dom.nextText.textContent = `Prochain rappel : Aujourd'hui à ${eveningTime} (Soir)`;
        } else {
            this.dom.nextText.textContent = `Prochain rappel : Demain à ${morningTime} (Matin)`;
        }
    }

    togglePopover() {
        if (this.isOpen) {
            this.closePopover();
        } else {
            this.openPopover();
        }
    }

    openPopover() {
        if (!this.dom.popover) return;
        this.dom.popover.removeAttribute('hidden');
        this.dom.bellBtn.setAttribute('aria-expanded', 'true');
        this.isOpen = true;
        this.updatePermissionUI();
        this.updateNextStatusUI();
    }

    closePopover() {
        if (!this.dom.popover) return;
        this.dom.popover.setAttribute('hidden', '');
        this.dom.bellBtn.setAttribute('aria-expanded', 'false');
        this.isOpen = false;
    }

    updatePermissionUI() {
        const isInIframe = window.self !== window.top;

        if (!('Notification' in window)) {
            this.setDeniedState("Les notifications ne sont pas prises en charge par ce navigateur ou appareil.");
            return;
        }

        const permission = Notification.permission;

        if (permission === 'denied') {
            if (isInIframe) {
                this.setDeniedState(
                    "Les notifications sont bloquées dans la prévisualisation (iframe). Les navigateurs restreignent l'API Notifications au domaine d'origine. Ouvrez l'application dans un nouvel onglet pour l'autoriser.",
                    true
                );
            } else {
                this.setDeniedState("Notifications bloquées par votre navigateur pour ce domaine. Cliquez sur le cadenas à gauche de l'URL pour les autoriser.");
            }
        } else if (permission === 'default') {
            if (this.dom.permissionMsg) {
                this.dom.permissionMsg.style.display = 'none';
                this.dom.permissionMsg.textContent = '';
            }
            if (this.dom.masterToggle) {
                this.dom.masterToggle.disabled = false;
            }
            if (this.dom.switchContainer) {
                this.dom.switchContainer.classList.remove('disabled');
            }
            if (this.dom.masterToggle && this.dom.masterToggle.checked) {
                this.dom.masterToggle.checked = false;
                localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
                this.updateStatusBadge(false);
            }
        } else if (permission === 'granted') {
            if (this.dom.permissionMsg) {
                this.dom.permissionMsg.style.display = 'none';
            }
            if (this.dom.masterToggle) {
                this.dom.masterToggle.disabled = false;
            }
            if (this.dom.switchContainer) {
                this.dom.switchContainer.classList.remove('disabled');
            }
            const isEnabled = localStorage.getItem(this.STORAGE_KEY_ENABLED) === 'true';
            if (this.dom.masterToggle) {
                this.dom.masterToggle.checked = isEnabled;
            }
            this.updateStatusBadge(isEnabled);
        }
    }

    setDeniedState(message, showOpenNewTab = false) {
        if (this.dom.masterToggle) {
            this.dom.masterToggle.checked = false;
            this.dom.masterToggle.disabled = true;
        }
        if (this.dom.switchContainer) {
            this.dom.switchContainer.classList.add('disabled');
        }
        if (this.dom.testBtn) {
            this.dom.testBtn.disabled = true;
        }
        if (this.dom.permissionMsg) {
            this.dom.permissionMsg.innerHTML = '';
            const msgSpan = document.createElement('span');
            msgSpan.textContent = message;
            this.dom.permissionMsg.appendChild(msgSpan);

            if (showOpenNewTab) {
                const openLink = document.createElement('a');
                openLink.href = window.location.href;
                openLink.target = '_blank';
                openLink.rel = 'noopener noreferrer';
                openLink.className = 'notif-open-tab-btn';
                openLink.textContent = "Ouvrir dans un nouvel onglet ↗";
                this.dom.permissionMsg.appendChild(openLink);
            }

            this.dom.permissionMsg.className = 'notif-permission-msg is-denied';
            this.dom.permissionMsg.style.display = 'flex';
        }
        localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
        this.updateStatusBadge(false);
        this.updateNextStatusUI();
    }

    async handleToggleChange(shouldEnable) {
        if (!('Notification' in window)) {
            alert("Votre navigateur ne supporte pas les notifications.");
            if (this.dom.masterToggle) this.dom.masterToggle.checked = false;
            return;
        }

        if (shouldEnable) {
            let permission = Notification.permission;

            if (permission === 'default') {
                try {
                    permission = await Notification.requestPermission();
                } catch (err) {
                    console.warn("Erreur lors de la demande de permission:", err);
                }
            }

            if (permission === 'granted') {
                localStorage.setItem(this.STORAGE_KEY_ENABLED, 'true');
                // Réinitialiser les verrous pour permettre de tester tout de suite
                localStorage.removeItem(this.STORAGE_KEY_LAST_MORNING);
                localStorage.removeItem(this.STORAGE_KEY_LAST_EVENING);

                if (this.dom.masterToggle) this.dom.masterToggle.checked = true;
                this.updateStatusBadge(true);
                this.updateNextStatusUI();

                if (this.dom.permissionMsg) this.dom.permissionMsg.style.display = 'none';
                if (this.dom.testBtn) this.dom.testBtn.disabled = false;

                // Lancement immédiat du scheduler
                this.checkScheduledReminders();

                if (this.ui?.showToast) this.ui.showToast("Rappels quotidiens activés ✓");
            } else if (permission === 'denied') {
                this.setDeniedState("Notifications bloquées par votre navigateur. Autorisez-les dans les paramètres du site.");
                if (this.ui?.showToast) this.ui.showToast("Autorisation refusée");
            } else {
                if (this.dom.masterToggle) this.dom.masterToggle.checked = false;
                localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
                this.updateStatusBadge(false);
                this.updateNextStatusUI();
            }
        } else {
            localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
            if (this.dom.masterToggle) this.dom.masterToggle.checked = false;
            this.updateStatusBadge(false);
            this.updateNextStatusUI();
            if (this.ui?.showToast) this.ui.showToast("Rappels désactivés");
        }
    }

    updateStatusBadge(isActive) {
        if (this.dom.statusDot) {
            if (isActive) {
                this.dom.statusDot.classList.add('active');
            } else {
                this.dom.statusDot.classList.remove('active');
            }
        }
        if (this.dom.bellBtn) {
            if (isActive) {
                this.dom.bellBtn.classList.add('active');
            } else {
                this.dom.bellBtn.classList.remove('active');
            }
        }
    }

    /**
     * Teste l'envoi immédiat d'une notification système
     */
    async sendTestNotification() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            if (this.ui?.showToast) this.ui.showToast("Activez d'abord les notifications !");
            return;
        }

        const title = "SensiTrack — Test réussi ! 🔔";
        const options = {
            body: "Le système de notification fonctionne parfaitement sur cet appareil.",
            icon: './maskable_icon_x192_v4.png',
            badge: './maskable_icon_x192_v4.png',
            vibrate: [200, 100, 200],
            tag: 'sensitrack-reminder-test',
            renotify: true,
            data: { url: './' }
        };

        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                    await reg.showNotification(title, options);
                    if (this.ui?.showToast) this.ui.showToast("Notification envoyée 🔔");
                    return;
                }
            }
            new Notification(title, options);
            if (this.ui?.showToast) this.ui.showToast("Notification envoyée 🔔");
        } catch (err) {
            console.warn("Erreur lors de la notification de test:", err);
            new Notification(title, options);
        }
    }
}
