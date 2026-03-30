// auth.js - Authentication module for Comando Vida 2.0
import { store } from './store.js';
import { escapeHtml, showToast } from './ui.js';
import { initFirebase } from './firebase-config.js';
import { GOOGLE_CLIENT_ID, firebaseConfig } from './config.js';

const USERS_KEY  = 'CV2_USERS';
const SESSION_KEY = 'CV2_SESSION';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function hashPassword(password) {
    const data = new TextEncoder().encode(password + 'CV2_SALT_2024');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers()       { try { return JSON.parse(localStorage.getItem(USERS_KEY))  || []; } catch { return []; } }
function saveUsers(u)     { localStorage.setItem(USERS_KEY,   JSON.stringify(u)); }
function getSession()     { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } }
function saveSession(s)   { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
function clearSession()   { localStorage.removeItem(SESSION_KEY); }
function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/** Decode JWT payload (no verification — we trust Google's callback) */
function decodeJWT(token) {
    try {
        const payload = token.split('.')[1];
        const base64  = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}

function onAuthSuccess(user) {
    if (user.name) store.set('settings.userName', user.name);
    const loginScreen = document.getElementById('login-screen');
    const app         = document.getElementById('app');
    if (loginScreen) loginScreen.style.display = 'none';
    if (app)         app.style.display = '';
    if (typeof window.__onAuthReady === 'function') window.__onAuthReady(user);
}

// ─── Setup instructions modal (shown when credentials not configured) ─────────

function showSetupModal(method) {
    const instructions = {
        google: {
            title: 'Configurar Google Sign-In',
            steps: [
                'Ve a <strong>console.cloud.google.com/apis/credentials</strong>',
                'Crea un proyecto (o usa uno existente)',
                'Crea <em>ID de cliente OAuth 2.0</em> → <em>Aplicación web</em>',
                'En "Orígenes autorizados" agrega: <code>http://localhost:9999</code>',
                'Copia el <strong>Client ID</strong> y pégalo en <code>js/config.js</code>',
                'Recarga la página'
            ]
        },
        phone: {
            title: 'Configurar autenticación por Teléfono',
            steps: [
                'Ve a <strong>console.firebase.google.com</strong>',
                'Crea un proyecto → <em>Authentication</em> → <em>Métodos de inicio de sesión</em>',
                'Activa <strong>Teléfono</strong>',
                'Ve a Configuración del proyecto y copia los datos de la app web',
                'Pégalos en <code>js/config.js</code> bajo <em>firebaseConfig</em>',
                'Recarga la página'
            ]
        }
    };

    const info = instructions[method];
    const steps = info.steps.map((s, i) => `<li style="margin-bottom:8px">${i + 1}. ${s}</li>`).join('');

    // Create overlay inline
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(4px)';
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:28px;max-width:440px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
            <h3 style="margin:0 0 8px;font-size:1.1rem;font-weight:700;color:#1e293b">${info.title}</h3>
            <p style="margin:0 0 16px;font-size:0.875rem;color:#64748b">Este método requiere configuración previa. Sigue estos pasos:</p>
            <ol style="margin:0 0 20px;padding:0;list-style:none;font-size:0.875rem;color:#334155">
                ${steps}
            </ol>
            <div style="display:flex;gap:8px;justify-content:flex-end">
                <button id="_setup-close" style="padding:8px 20px;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:0.875rem;cursor:pointer;font-weight:500">Cerrar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === '_setup-close') overlay.remove();
    });
}

// ─── Auth module ──────────────────────────────────────────────────────────────

export const auth = {
    _mode: 'login',
    _phoneConfirmation: null,
    _recaptchaVerifier: null,
    _gisLoaded: false,

    init() {
        initFirebase();
        this._loadGIS();

        const session = getSession();
        if (session) {
            onAuthSuccess(session);
        } else {
            this.showLoginScreen();
        }
    },

    /** Dynamically load Google Identity Services script */
    _loadGIS() {
        if (document.getElementById('gis-script')) return;
        const script = document.createElement('script');
        script.id  = 'gis-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => { this._gisLoaded = true; };
        document.head.appendChild(script);
    },

    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const app         = document.getElementById('app');
        if (app)         app.style.display = 'none';
        if (loginScreen) {
            loginScreen.style.display = '';
            loginScreen.innerHTML = this._renderLoginHTML();
            this._bindEvents();
        }
    },

    _renderLoginHTML() {
        const isRegister   = this._mode === 'register';
        const googleReady  = !!GOOGLE_CLIENT_ID;
        const phoneReady   = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
        const notReadyCls  = 'login-btn-disabled';

        return `
        <div class="login-card">
            <div class="login-logo">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#818cf8" stroke-width="2" fill="rgba(129,140,248,0.1)"/>
                    <path d="M2 17l10 5 10-5" stroke="#6366f1" stroke-width="2"/>
                    <path d="M2 12l10 5 10-5" stroke="#a5b4fc" stroke-width="2"/>
                </svg>
            </div>
            <h1 class="login-title">Comando Vida 2.0</h1>
            <p class="login-subtitle">Tu centro de mando personal basado en neurociencia</p>

            <!-- Google -->
            <button class="login-btn-google${googleReady ? '' : ' ' + notReadyCls}" id="auth-google-btn">
                <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>Continuar con Google${googleReady ? '' : ' (requiere configuración)'}</span>
            </button>

            <!-- Phone -->
            <button class="login-btn-phone${phoneReady ? '' : ' ' + notReadyCls}" id="auth-phone-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
                <span>Continuar con Tel&eacute;fono${phoneReady ? '' : ' (requiere configuración)'}</span>
            </button>

            <!-- Phone form -->
            <div class="phone-verify-form" id="phone-form" style="display:none">
                <div class="form-group">
                    <input type="tel" class="login-input" id="auth-phone-number" placeholder="+52 1234567890" autocomplete="tel">
                </div>
                <button class="login-btn-primary" id="auth-send-code-btn">Enviar c&oacute;digo SMS</button>
                <div id="phone-code-section" style="display:none">
                    <div class="form-group" style="margin-top:12px">
                        <input type="text" class="login-input" id="auth-phone-code" placeholder="C&oacute;digo de 6 d&iacute;gitos" maxlength="6" inputmode="numeric" autocomplete="one-time-code">
                    </div>
                    <button class="login-btn-primary" id="auth-verify-code-btn">Verificar c&oacute;digo</button>
                </div>
                <div id="recaptcha-container"></div>
            </div>

            <div class="login-divider"><span>o inicia con email</span></div>

            <form class="login-form" id="auth-email-form" novalidate>
                ${isRegister ? `
                <div class="form-group">
                    <input type="text" class="login-input" id="auth-name" placeholder="Tu nombre" autocomplete="name" required>
                </div>` : ''}
                <div class="form-group">
                    <input type="email" class="login-input" id="auth-email" placeholder="Email" autocomplete="email" required>
                </div>
                <div class="form-group" style="position:relative">
                    <input type="password" class="login-input" id="auth-password" placeholder="Contrase&ntilde;a (m&iacute;nimo 6 caracteres)" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required minlength="6" style="padding-right:44px">
                    <button type="button" id="toggle-password" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px">
                        <svg id="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                </div>
                <div class="login-error" id="auth-error" style="display:none"></div>
                <button type="submit" class="login-btn-primary" id="auth-submit-btn">
                    ${isRegister ? 'Crear Cuenta' : 'Iniciar Sesi&oacute;n'}
                </button>
                <button type="button" class="login-btn-secondary" id="auth-switch-btn">
                    ${isRegister ? 'Ya tengo cuenta — Iniciar Sesi&oacute;n' : '&iquest;Sin cuenta? Reg&iacute;strate'}
                </button>
            </form>

            <div class="login-divider"><span></span></div>
            <a href="#" class="login-skip" id="auth-skip-btn">Continuar sin cuenta</a>
        </div>
        `;
    },

    _showError(msg) {
        const el = document.getElementById('auth-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    },
    _hideError() {
        const el = document.getElementById('auth-error');
        if (el) el.style.display = 'none';
    },
    _setLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.disabled = loading;
        if (loading) btn.dataset.orig = btn.textContent;
        else if (btn.dataset.orig) btn.textContent = btn.dataset.orig;
    },

    _bindEvents() {
        // Show/hide password
        document.getElementById('toggle-password')?.addEventListener('click', () => {
            const input = document.getElementById('auth-password');
            const icon  = document.getElementById('eye-icon');
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
            } else {
                input.type = 'password';
                icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
            }
        });

        // Email form
        document.getElementById('auth-email-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            this._hideError();
            const email    = document.getElementById('auth-email')?.value.trim();
            const password = document.getElementById('auth-password')?.value;
            if (this._mode === 'register') {
                const name = document.getElementById('auth-name')?.value.trim();
                await this.registerWithEmail(email, password, name);
            } else {
                await this.loginWithEmail(email, password);
            }
        });

        // Switch login/register
        document.getElementById('auth-switch-btn')?.addEventListener('click', () => {
            this._mode = this._mode === 'login' ? 'register' : 'login';
            this.showLoginScreen();
        });

        // Google
        document.getElementById('auth-google-btn')?.addEventListener('click', () => {
            if (!GOOGLE_CLIENT_ID) { showSetupModal('google'); return; }
            this.loginWithGoogle();
        });

        // Phone toggle
        document.getElementById('auth-phone-btn')?.addEventListener('click', () => {
            if (!firebaseConfig.apiKey) { showSetupModal('phone'); return; }
            const pf = document.getElementById('phone-form');
            if (pf) pf.style.display = pf.style.display === 'none' ? 'block' : 'none';
        });

        // Send SMS code
        document.getElementById('auth-send-code-btn')?.addEventListener('click', () => {
            const phone = document.getElementById('auth-phone-number')?.value.trim();
            if (phone) this.loginWithPhone(phone);
            else showToast('Ingresa tu número de teléfono', 'error');
        });

        // Verify SMS code
        document.getElementById('auth-verify-code-btn')?.addEventListener('click', () => {
            const code = document.getElementById('auth-phone-code')?.value.trim();
            if (code) this.verifyPhoneCode(code);
            else showToast('Ingresa el código de verificación', 'error');
        });

        // Skip
        document.getElementById('auth-skip-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.skipLogin();
        });
    },

    // ── Email / Password ──────────────────────────────────────────────────────

    async loginWithEmail(email, password) {
        if (!email || !validateEmail(email)) { this._showError('Ingresa un email válido'); return; }
        if (!password || password.length < 6) { this._showError('La contraseña debe tener al menos 6 caracteres'); return; }

        this._setLoading('auth-submit-btn', true);
        const users        = getUsers();
        const passwordHash = await hashPassword(password);
        const user         = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        this._setLoading('auth-submit-btn', false);

        if (!user) { this._showError('No existe una cuenta con ese email. ¿Deseas registrarte?'); return; }
        if (user.passwordHash !== passwordHash) { this._showError('Contraseña incorrecta'); return; }

        const session = { userId: user.id, name: user.name, email: user.email, method: 'email', loggedInAt: new Date().toISOString() };
        saveSession(session);
        showToast(`¡Bienvenido de vuelta, ${escapeHtml(user.name)}!`);
        onAuthSuccess(session);
    },

    async registerWithEmail(email, password, name) {
        if (!name || !name.trim()) { this._showError('Ingresa tu nombre'); return; }
        if (!email || !validateEmail(email)) { this._showError('Ingresa un email válido'); return; }
        if (!password || password.length < 6) { this._showError('La contraseña debe tener al menos 6 caracteres'); return; }

        const users = getUsers();
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            this._showError('Ya existe una cuenta con ese email. Inicia sesión.');
            return;
        }

        this._setLoading('auth-submit-btn', true);
        const passwordHash = await hashPassword(password);
        this._setLoading('auth-submit-btn', false);

        const newUser = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 11),
            email: email.toLowerCase(),
            name: name.trim(),
            passwordHash,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);
        saveUsers(users);

        const session = { userId: newUser.id, name: newUser.name, email: newUser.email, method: 'email', loggedInAt: new Date().toISOString() };
        saveSession(session);
        showToast(`¡Bienvenido, ${escapeHtml(newUser.name)}! Cuenta creada.`);
        onAuthSuccess(session);
    },

    // ── Google Sign-In (Google Identity Services) ─────────────────────────────

    loginWithGoogle() {
        const handleCredential = (response) => {
            const payload = decodeJWT(response.credential);
            if (!payload) { showToast('Error al procesar respuesta de Google', 'error'); return; }

            const session = {
                userId:    payload.sub,
                name:      payload.name || payload.email.split('@')[0],
                email:     payload.email || '',
                photoURL:  payload.picture || '',
                method:    'google',
                loggedInAt: new Date().toISOString()
            };
            saveSession(session);
            showToast(`¡Bienvenido, ${escapeHtml(session.name)}!`);
            onAuthSuccess(session);
        };

        const tryGIS = () => {
            if (!window.google?.accounts?.id) {
                showToast('Cargando Google Sign-In…', 'info');
                setTimeout(tryGIS, 800);
                return;
            }
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback:  handleCredential,
                auto_select: false,
                cancel_on_tap_outside: true
            });
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // One Tap not shown — render a popup button fallback
                    this._showGooglePopup(handleCredential);
                }
            });
        };

        tryGIS();
    },

    _showGooglePopup(callback) {
        // Create a temporary container for GSI button and auto-click it
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);z-index:9999;backdrop-filter:blur(4px)';
        container.innerHTML = `
            <div style="background:#fff;border-radius:12px;padding:28px 32px;text-align:center;max-width:320px">
                <p style="margin:0 0 16px;font-weight:600;color:#1e293b">Selecciona tu cuenta de Google</p>
                <div id="_gsi-btn-container"></div>
                <button id="_gsi-cancel" style="margin-top:12px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.875rem">Cancelar</button>
            </div>
        `;
        document.body.appendChild(container);

        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (res) => { container.remove(); callback(res); } });
        google.accounts.id.renderButton(document.getElementById('_gsi-btn-container'), { theme: 'outline', size: 'large', text: 'signin_with', width: 240 });

        container.querySelector('#_gsi-cancel')?.addEventListener('click', () => container.remove());
        container.addEventListener('click', (e) => { if (e.target === container) container.remove(); });
    },

    // ── Phone (Firebase) ──────────────────────────────────────────────────────

    loginWithPhone(phoneNumber) {
        if (!window.firebase || !firebase.apps?.length) {
            showSetupModal('phone');
            return;
        }
        if (!this._recaptchaVerifier) {
            this._recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                size: 'invisible',
                callback: () => {}
            });
        }
        firebase.auth().signInWithPhoneNumber(phoneNumber, this._recaptchaVerifier)
            .then((confirmationResult) => {
                this._phoneConfirmation = confirmationResult;
                document.getElementById('phone-code-section').style.display = 'block';
                showToast('Código SMS enviado. Revisa tu teléfono.', 'info');
            })
            .catch((error) => {
                this._recaptchaVerifier = null;
                const msgs = {
                    'auth/invalid-phone-number': 'Número de teléfono inválido. Usa formato +52 XXXXXXXXXX',
                    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
                    'auth/captcha-check-failed': 'Verificación reCAPTCHA fallida. Recarga la página.'
                };
                showToast(msgs[error.code] || 'Error al enviar SMS: ' + (error.message || 'Intenta de nuevo'), 'error');
            });
    },

    verifyPhoneCode(code) {
        if (!this._phoneConfirmation) { showToast('Primero solicita el código SMS', 'error'); return; }
        this._phoneConfirmation.confirm(code)
            .then((result) => {
                const u = result.user;
                const session = { userId: u.uid, name: u.displayName || 'Usuario', email: u.email || '', phone: u.phoneNumber || '', method: 'phone', loggedInAt: new Date().toISOString() };
                saveSession(session);
                showToast(`¡Bienvenido, ${escapeHtml(session.name)}!`);
                onAuthSuccess(session);
            })
            .catch((error) => {
                const msgs = {
                    'auth/invalid-verification-code': 'Código incorrecto. Intenta de nuevo.',
                    'auth/code-expired': 'El código ha expirado. Solicita uno nuevo.'
                };
                showToast(msgs[error.code] || 'Error al verificar código', 'error');
            });
    },

    // ── Guest ─────────────────────────────────────────────────────────────────

    skipLogin() {
        const session = { userId: 'guest', name: 'Invitado', email: '', method: 'guest', loggedInAt: new Date().toISOString() };
        saveSession(session);
        showToast('¡Bienvenido! Modo invitado activado.');
        onAuthSuccess(session);
    },

    // ── Logout ────────────────────────────────────────────────────────────────

    logout() {
        if (window.google?.accounts?.id) {
            try { google.accounts.id.disableAutoSelect(); } catch {}
        }
        if (window.firebase && firebase.apps?.length) {
            try { firebase.auth().signOut(); } catch {}
        }
        clearSession();
        this._mode = 'login';
        this._phoneConfirmation = null;
        this._recaptchaVerifier = null;
        showToast('Sesión cerrada');
        this.showLoginScreen();
    },

    getCurrentUser() { return getSession(); },
    isLoggedIn()     { return getSession() !== null; }
};
