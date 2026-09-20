/**
 * Gestionnaire des notifications Push & Rappels Quotidiens pour SensiTrack (PWA).
 *
 * Gère :
 * - L'ouverture / fermeture du popover (au clic sur la cloche et au clic extérieur)
 * - La demande et vérification des permissions (Notification.permission)
 * - L'activation / désactivation du toggle et la synchronisation avec localStorage
 * - La sélection et persistance des heures de rappel (matin et soir)
 * - Les hooks d'abonnement / désabonnement au PushManager du Service Worker
 * - L'envoi d'une notification de test pour valider le fonctionnement
 */

export class NotificationManager {
    constructor(uiManager) {
        this.ui = uiManager;
        this.STORAGE_KEY_ENABLED = 'sensitrack_notif_enabled';
        this.STORAGE_KEY_MORNING = 'sensitrack_notif_morning';
        this.STORAGE_KEY_EVENING = 'sensitrack_notif_evening';

        this.DEFAULT_MORNING = '08:00';
        this.DEFAULT_EVENING = '20:00';

        this.isOpen = false;
    }

    init() {
        this.cacheDOM();
        if (!this.dom.bellBtn || !this.dom.popover) return;

        this.loadSettings();
        this.bindEvents();
        this.updatePermissionUI();
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
            scheduleSection: document.getElementById('notif-schedule-section')
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
                if (this.ui?.showToast) {
                    this.ui.showToast(`Rappel matin : ${val} ✓`);
                }
            });
        }

        // Modification de l'heure du soir
        if (this.dom.timeEvening) {
            this.dom.timeEvening.addEventListener('change', (e) => {
                const val = e.target.value || this.DEFAULT_EVENING;
                localStorage.setItem(this.STORAGE_KEY_EVENING, val);
                if (this.ui?.showToast) {
                    this.ui.showToast(`Rappel soir : ${val} ✓`);
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
    }

    closePopover() {
        if (!this.dom.popover) return;
        this.dom.popover.setAttribute('hidden', '');
        this.dom.bellBtn.setAttribute('aria-expanded', 'false');
        this.isOpen = false;
    }

    updatePermissionUI() {
        // Détecter si on tourne dans une iframe
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
            // Si jamais le localStorage indiquait true mais la permission est default, on réaligne
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
                await this.subscribeUserToPush();
                localStorage.setItem(this.STORAGE_KEY_ENABLED, 'true');
                if (this.dom.masterToggle) this.dom.masterToggle.checked = true;
                this.updateStatusBadge(true);
                if (this.dom.permissionMsg) this.dom.permissionMsg.style.display = 'none';
                if (this.dom.testBtn) this.dom.testBtn.disabled = false;
                if (this.ui?.showToast) this.ui.showToast("Notifications activées ✓");
            } else if (permission === 'denied') {
                this.setDeniedState("Notifications bloquées par votre navigateur. Autorisez-les dans les paramètres du site.");
                if (this.ui?.showToast) this.ui.showToast("Autorisation refusée");
            } else {
                // L'utilisateur a fermé la boîte sans répondre
                if (this.dom.masterToggle) this.dom.masterToggle.checked = false;
                localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
                this.updateStatusBadge(false);
            }
        } else {
            await this.unsubscribeUserFromPush();
            localStorage.setItem(this.STORAGE_KEY_ENABLED, 'false');
            if (this.dom.masterToggle) this.dom.masterToggle.checked = false;
            this.updateStatusBadge(false);
            if (this.ui?.showToast) this.ui.showToast("Notifications désactivées");
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
     * Simulation / Placeholder pour l'abonnement push via le Service Worker
     */
    async subscribeUserToPush() {
        console.log('[Push] Simulation d’abonnement Push Manager via Service Worker...');
        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.ready;
                console.log('[Push] Service Worker prêt pour le push:', reg.scope);
                
                // --- Code d'abonnement réel (décommenter lors de la liaison au serveur VAPID) ---
                // const publicVapidKey = 'VOTRE_CLE_PUBLIQUE_VAPID';
                // const subscription = await reg.pushManager.subscribe({
                //     userVisibleOnly: true,
                //     applicationServerKey: this.urlBase64ToUint8Array(publicVapidKey)
                // });
                // await fetch('/api/push-subscribe', {
                //     method: 'POST',
                //     headers: { 'Content-Type': 'application/json' },
                //     body: JSON.stringify({
                //         subscription,
                //         morning: this.dom.timeMorning?.value || this.DEFAULT_MORNING,
                //         evening: this.dom.timeEvening?.value || this.DEFAULT_EVENING
                //     })
                // });
                
                return true;
            } catch (err) {
                console.warn('[Push] Impossible d’accéder au Service Worker pour le Push:', err);
            }
        }
        return true;
    }

    /**
     * Simulation / Placeholder pour la désinscription push
     */
    async unsubscribeUserFromPush() {
        console.log('[Push] Simulation de désinscription Push Manager...');
        if ('serviceWorker' in navigator) {
            try {
                const reg = await navigator.serviceWorker.ready;
                // const subscription = await reg.pushManager.getSubscription();
                // if (subscription) {
                //     await subscription.unsubscribe();
                // }
                console.log('[Push] Désabonnement effectué avec succès');
                return true;
            } catch (err) {
                console.warn('[Push] Erreur lors de la désinscription:', err);
            }
        }
        return true;
    }

    /**
     * Teste l'envoi immédiat d'une notification système
     */
    async sendTestNotification() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            if (this.ui?.showToast) this.ui.showToast("Activez d'abord les notifications !");
            return;
        }

        const title = "SensiTrack — Rappel";
        const options = {
            body: "C'est l'heure de noter votre température et vos observations du cycle !",
            icon: './maskable_icon_x192_v4.png',
            badge: './maskable_icon_x192_v4.png',
            tag: 'sensitrack-reminder-test',
            renotify: true
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
