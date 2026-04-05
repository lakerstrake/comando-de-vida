// auth.js - Authentication module for Comando Vida 2.0
import { store } from './store.js';
import { escapeHtml, showToast } from './ui.js';
import { initFirebase } from './firebase-config.js';
import { GOOGLE_CLIENT_ID, firebaseConfig } from './config.js';

const USERS_KEY   = 'CV2_USERS';
const SESSION_KEY  = 'CV2_SESSION';
const GID_KEY      = 'CV2_GOOGLE_CID';   // user-configured Google Client ID

/** Runtime Google Client ID: config.js OR user-saved in localStorage */
function getGoogleClientId() {
    return localStorage.getItem(GID_KEY) || GOOGLE_CLIENT_ID || '';
}

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
    const savedName = (store.get('settings.userName') || '').trim();
    if (!savedName && user.name) {
        store.set('settings.userName', user.name);
    }
    const loginScreen = document.getElementById('login-screen');
    const app         = document.getElementById('app');
    if (loginScreen) loginScreen.style.display = 'none';
    if (app)         app.style.display = '';
    if (typeof window.__onAuthReady === 'function') window.__onAuthReady(user);
}

// ─── Setup instructions modal (shown when credentials not configured) ─────────

function showGoogleSetupModal(onSuccess) {
    const saved = localStorage.getItem(GID_KEY) || '';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,8,22,0.82);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(14px)';
    overlay.innerHTML = `
        <div style="background:rgba(8,16,36,0.97);border:1px solid rgba(75,145,255,0.3);border-radius:22px;padding:30px 28px 26px;max-width:420px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,0.6);position:relative;overflow:hidden">
            <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 5%,rgba(66,133,244,0.8) 40%,rgba(15,186,132,0.5) 70%,transparent 95%)"></div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
                <div style="width:40px;height:40px;border-radius:10px;background:rgba(66,133,244,0.12);border:1px solid rgba(66,133,244,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700;color:#e8f0ff;letter-spacing:-0.02em">Activar Google Sign-In</h3>
                    <p style="margin:0;font-size:0.78rem;color:rgba(130,165,225,0.7)">Solo necesitas un Client ID (gratis)</p>
                </div>
            </div>

            <div style="background:rgba(75,145,255,0.06);border:1px solid rgba(75,145,255,0.15);border-radius:12px;padding:14px 16px;margin-bottom:18px">
                <p style="margin:0 0 8px;font-size:0.8rem;font-weight:600;color:rgba(180,210,255,0.9)">3 pasos rápidos:</p>
                <ol style="margin:0;padding-left:18px;font-size:0.79rem;color:rgba(140,175,225,0.8);line-height:1.7">
                    <li>Ve a <strong style="color:#7cb3ff">console.cloud.google.com/apis/credentials</strong></li>
                    <li>Crea OAuth 2.0 → App Web → Agrega <code style="background:rgba(75,145,255,0.15);padding:1px 5px;border-radius:4px;font-size:0.76rem">${location.origin}</code> como origen</li>
                    <li>Copia el <strong style="color:#7cb3ff">Client ID</strong> y pégalo abajo</li>
                </ol>
            </div>

            <input type="text" id="_gcid-input" placeholder="123456789-abc.apps.googleusercontent.com"
                value="${saved}"
                style="width:100%;box-sizing:border-box;padding:12px 14px;border-radius:11px;border:1px solid rgba(75,145,255,0.25);background:rgba(255,255,255,0.05);color:#e8f0ff;font-size:0.85rem;font-family:inherit;margin-bottom:10px;outline:none;transition:border-color 0.2s">
            <div id="_gcid-error" style="display:none;font-size:0.78rem;color:#f87171;margin-bottom:8px;padding:8px 10px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.2)"></div>

            <div style="display:flex;gap:8px">
                <button id="_gcid-cancel" style="flex:1;padding:11px;border-radius:11px;border:1px solid rgba(75,145,255,0.18);background:rgba(75,145,255,0.07);color:rgba(150,190,255,0.85);font-size:0.875rem;cursor:pointer;font-weight:600;font-family:inherit">Cancelar</button>
                <button id="_gcid-save" style="flex:2;padding:11px;border-radius:11px;border:none;background:linear-gradient(135deg,#3b78f5,#2563eb);color:#fff;font-size:0.875rem;cursor:pointer;font-weight:700;font-family:inherit;box-shadow:0 4px 16px rgba(59,120,245,0.35)">Guardar y continuar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#_gcid-input');
    const errEl = overlay.querySelector('#_gcid-error');

    input.addEventListener('focus', () => { input.style.borderColor = 'rgba(75,145,255,0.6)'; });
    input.addEventListener('blur',  () => { input.style.borderColor = 'rgba(75,145,255,0.25)'; });

    overlay.querySelector('#_gcid-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#_gcid-save').addEventListener('click', () => {
        const val = input.value.trim();
        if (!val || !val.includes('.apps.googleusercontent.com')) {
            errEl.textContent = 'Pega un Client ID válido (termina en .apps.googleusercontent.com)';
            errEl.style.display = 'block';
            return;
        }
        localStorage.setItem(GID_KEY, val);
        overlay.remove();
        showToast('Google configurado. Iniciando sesión…', 'info');
        if (typeof onSuccess === 'function') onSuccess();
    });

    setTimeout(() => input.focus(), 100);
}

function showSetupModal(method) {
    const instructions = {
        google: {
            title: 'Activar Google Sign-In',
            steps: [
                'Ve a <strong>console.firebase.google.com</strong>',
                'Crea o selecciona un proyecto → <em>Authentication</em>',
                'En <em>Métodos de inicio de sesión</em> activa <strong>Google</strong>',
                'En Configuración del proyecto → tu app web, copia los datos de Firebase',
                'Pégalos en <code>js/config.js</code> bajo <code>firebaseConfig</code>',
                'Recarga la página — ¡listo!'
            ]
        },
        'google-firebase': {
            title: 'Habilitar Google en Firebase',
            steps: [
                'Ve a <strong>console.firebase.google.com</strong> → tu proyecto',
                'Authentication → <em>Sign-in method</em>',
                'Haz clic en <strong>Google</strong> → actívalo',
                'Guarda y recarga la página'
            ]
        },
        'firebase-domain': {
            title: 'Agregar dominio autorizado',
            steps: [
                'Ve a <strong>console.firebase.google.com</strong> → tu proyecto',
                'Authentication → <em>Settings</em> → <em>Authorized domains</em>',
                'Agrega el dominio donde corre la app (ej: <code>localhost</code>)',
                'Guarda y recarga la página'
            ]
        },
        phone: {
            title: 'Activar autenticación por Teléfono',
            steps: [
                'Ve a <strong>console.firebase.google.com</strong>',
                'Crea un proyecto → <em>Authentication</em> → <em>Métodos de inicio de sesión</em>',
                'Activa <strong>Teléfono</strong>',
                'En Configuración del proyecto, copia los datos de la app web',
                'Pégalos en <code>js/config.js</code> bajo <code>firebaseConfig</code>',
                'Recarga la página'
            ]
        }
    };

    const info = instructions[method];
    const steps = info.steps.map((s, i) => `<li style="margin-bottom:8px">${i + 1}. ${s}</li>`).join('');

    // Create overlay inline
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(4,10,22,0.72);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(12px)';
    overlay.innerHTML = `
        <div style="background:rgba(10,18,36,0.96);border:1px solid rgba(75,145,255,0.28);border-radius:20px;padding:28px 28px 24px;max-width:440px;width:100%;box-shadow:0 28px 70px rgba(0,0,0,0.55)">
            <h3 style="margin:0 0 6px;font-size:1.05rem;font-weight:700;color:#e8f0ff;letter-spacing:-0.02em">${info.title}</h3>
            <p style="margin:0 0 18px;font-size:0.825rem;color:rgba(140,175,225,0.75);line-height:1.5">Sigue estos pasos rápidos:</p>
            <ol style="margin:0 0 22px;padding:0;list-style:none;font-size:0.85rem;color:rgba(200,220,255,0.85);display:flex;flex-direction:column;gap:10px">
                ${steps}
            </ol>
            <div style="display:flex;gap:8px;justify-content:flex-end">
                <button id="_setup-close" style="padding:9px 22px;border-radius:10px;border:1px solid rgba(75,145,255,0.25);background:rgba(75,145,255,0.1);color:rgba(160,200,255,0.9);font-size:0.875rem;cursor:pointer;font-weight:600;font-family:inherit;transition:all 0.2s">Entendido</button>
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
        const isRegister  = this._mode === 'register';
        const fbReady     = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
        const googleReady = fbReady || !!getGoogleClientId();

        return `
        <div class="login-card">

            <!-- Logo & branding -->
            <div class="login-logo">
                <div class="login-logo-mark">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#4b91ff" stroke-width="1.75" fill="rgba(75,145,255,0.12)"/>
                        <path d="M2 17l10 5 10-5" stroke="#4b91ff" stroke-width="1.75"/>
                        <path d="M2 12l10 5 10-5" stroke="#0fba84" stroke-width="1.75"/>
                    </svg>
                </div>
                <h1 class="login-title">Comando Vida</h1>
                <p class="login-subtitle">Tu centro de mando basado en neurociencia</p>
            </div>

            <!-- Social auth -->
            <button class="login-btn-google" id="auth-google-btn">
                <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>Continuar con Google</span>
            </button>

            <!-- Phone auth (optional) -->
            <button class="login-btn-phone${fbReady ? '' : ' login-btn-disabled'}" id="auth-phone-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
                <span>Continuar con Tel&eacute;fono${fbReady ? '' : ' — requiere Firebase'}</span>
            </button>

            <!-- Phone form -->
            <div class="phone-verify-form" id="phone-form" style="display:none">
                <input type="tel" class="login-input" id="auth-phone-number" placeholder="+57 300 000 0000" autocomplete="tel" style="margin-bottom:8px">
                <button class="login-btn-primary" id="auth-send-code-btn" style="height:40px;font-size:0.85rem">Enviar SMS</button>
                <div id="phone-code-section" style="display:none;margin-top:10px">
                    <input type="text" class="login-input" id="auth-phone-code" placeholder="C&oacute;digo de 6 d&iacute;gitos" maxlength="6" inputmode="numeric" autocomplete="one-time-code" style="margin-bottom:8px">
                    <button class="login-btn-primary" id="auth-verify-code-btn" style="height:40px;font-size:0.85rem">Verificar c&oacute;digo</button>
                </div>
                <div id="recaptcha-container"></div>
            </div>

            <!-- Email divider -->
            <div class="login-divider"><span>o con email</span></div>

            <!-- Email form -->
            <form class="login-form" id="auth-email-form" novalidate>
                ${isRegister ? `<input type="text" class="login-input" id="auth-name" placeholder="Tu nombre" autocomplete="name" required autofocus>` : ''}
                <input type="email" class="login-input" id="auth-email" placeholder="Email" autocomplete="email" required ${!isRegister ? 'autofocus' : ''}>
                <div style="position:relative">
                    <input type="password" class="login-input" id="auth-password"
                        placeholder="${isRegister ? 'Contraseña (mín. 6 caracteres)' : 'Contraseña'}"
                        autocomplete="${isRegister ? 'new-password' : 'current-password'}"
                        required minlength="6" style="padding-right:46px">
                    <button type="button" id="toggle-password" style="position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:rgba(120,155,210,0.6);padding:4px;display:flex;align-items:center">
                        <svg id="eye-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                </div>
                ${!isRegister ? `<div style="text-align:right;margin-top:-4px"><button type="button" id="auth-forgot-btn" style="background:none;border:none;font-size:0.78rem;color:rgba(100,145,220,0.75);cursor:pointer;padding:2px 0;font-family:inherit;transition:color 0.2s">¿Olvidaste tu contraseña?</button></div>` : ''}
                <div class="login-error" id="auth-error"></div>
                <button type="submit" class="login-btn-primary" id="auth-submit-btn">
                    ${isRegister ? 'Crear cuenta' : 'Iniciar sesi&oacute;n'}
                </button>
                <button type="button" class="login-btn-secondary" id="auth-switch-btn">
                    ${isRegister ? '¿Ya tienes cuenta? Inicia sesi&oacute;n' : '¿Nuevo aquí? Crea tu cuenta gratis'}
                </button>
            </form>

            <!-- Guest -->
            <a href="#" class="login-skip" id="auth-skip-btn">Continuar sin cuenta &rarr;</a>
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
        if (loading) {
            btn.dataset.orig = btn.innerHTML;
            btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Cargando…</span>`;
        } else if (btn.dataset.orig) {
            btn.innerHTML = btn.dataset.orig;
        }
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
            const fbReady  = !!(firebaseConfig.apiKey && firebaseConfig.projectId);
            const gisReady = !!getGoogleClientId();
            if (!fbReady && !gisReady) {
                showGoogleSetupModal(() => {
                    // After user saves their Client ID, re-render then auto-trigger GIS
                    this.showLoginScreen();
                    setTimeout(() => this.loginWithGoogle(), 300);
                });
                return;
            }
            this.loginWithGoogle();
        });

        // Phone toggle
        document.getElementById('auth-phone-btn')?.addEventListener('click', () => {
            if (!(firebaseConfig.apiKey && firebaseConfig.projectId)) { showSetupModal('phone'); return; }
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

        // Forgot password
        document.getElementById('auth-forgot-btn')?.addEventListener('click', () => {
            this._showForgotPassword();
        });

        // Skip
        document.getElementById('auth-skip-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.skipLogin();
        });
    },

    _showForgotPassword() {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(4,10,22,0.72);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;backdrop-filter:blur(12px)';
        overlay.innerHTML = `
            <div style="background:rgba(10,18,36,0.96);border:1px solid rgba(75,145,255,0.28);border-radius:20px;padding:28px;max-width:380px;width:100%;box-shadow:0 28px 70px rgba(0,0,0,0.55)">
                <h3 style="margin:0 0 6px;font-size:1rem;font-weight:700;color:#e8f0ff;letter-spacing:-0.02em">Restablecer contraseña</h3>
                <p style="margin:0 0 18px;font-size:0.825rem;color:rgba(140,175,225,0.7);line-height:1.5">Ingresa tu email y crea una nueva contraseña.</p>
                <input type="email" id="_fp-email" placeholder="Email" autocomplete="email"
                    style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;border:1px solid rgba(75,145,255,0.22);background:rgba(255,255,255,0.05);color:#e8f0ff;font-size:0.875rem;font-family:inherit;margin-bottom:10px;outline:none">
                <input type="password" id="_fp-newpass" placeholder="Nueva contraseña (mín. 6 caracteres)" autocomplete="new-password"
                    style="width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;border:1px solid rgba(75,145,255,0.22);background:rgba(255,255,255,0.05);color:#e8f0ff;font-size:0.875rem;font-family:inherit;margin-bottom:10px;outline:none">
                <div id="_fp-error" style="display:none;padding:9px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#f87171;font-size:0.8rem;margin-bottom:10px"></div>
                <div id="_fp-success" style="display:none;padding:9px 12px;background:rgba(15,186,132,0.12);border:1px solid rgba(15,186,132,0.25);border-radius:8px;color:#34d399;font-size:0.8rem;margin-bottom:10px"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
                    <button id="_fp-cancel" style="padding:9px 18px;border-radius:10px;border:1px solid rgba(75,145,255,0.2);background:rgba(75,145,255,0.08);color:rgba(160,200,255,0.85);font-size:0.85rem;cursor:pointer;font-weight:600;font-family:inherit">Cancelar</button>
                    <button id="_fp-submit" style="padding:9px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#3b78f5,#2563eb);color:#fff;font-size:0.85rem;cursor:pointer;font-weight:700;font-family:inherit">Restablecer</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const showErr = (msg) => {
            const el = overlay.querySelector('#_fp-error');
            el.textContent = msg; el.style.display = 'block';
        };

        overlay.querySelector('#_fp-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        overlay.querySelector('#_fp-submit').addEventListener('click', async () => {
            overlay.querySelector('#_fp-error').style.display = 'none';
            const email   = overlay.querySelector('#_fp-email').value.trim();
            const newPass = overlay.querySelector('#_fp-newpass').value;
            if (!email || !validateEmail(email)) { showErr('Ingresa un email válido'); return; }
            if (!newPass || newPass.length < 6)  { showErr('La contraseña debe tener al menos 6 caracteres'); return; }

            const users = getUsers();
            const idx   = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
            if (idx === -1) { showErr('No existe una cuenta con ese email'); return; }

            const btn = overlay.querySelector('#_fp-submit');
            btn.disabled = true; btn.textContent = 'Guardando…';
            users[idx].passwordHash = await hashPassword(newPass);
            saveUsers(users);

            const suc = overlay.querySelector('#_fp-success');
            suc.textContent = '¡Contraseña actualizada! Ya puedes iniciar sesión.';
            suc.style.display = 'block';
            setTimeout(() => overlay.remove(), 2200);
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

    // ── Google Sign-In ────────────────────────────────────────────────────────
    // Method 1 (preferred): Firebase Auth with Google Provider — only needs Firebase config
    // Method 2 (fallback):  Google Identity Services (GIS) — needs separate Client ID

    loginWithGoogle() {
        const fbReady = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

        // Method 1: Firebase Google Auth (simpler — same config as phone auth)
        if (fbReady && window.firebase?.apps?.length) {
            const btn = document.getElementById('auth-google-btn');
            if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Conectando…'; }

            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');

            firebase.auth().signInWithPopup(provider)
                .then(result => {
                    const u = result.user;
                    const session = {
                        userId:    u.uid,
                        name:      u.displayName || u.email?.split('@')[0] || 'Usuario',
                        email:     u.email || '',
                        photoURL:  u.photoURL || '',
                        method:    'google',
                        loggedInAt: new Date().toISOString()
                    };
                    saveSession(session);
                    showToast(`¡Bienvenido, ${escapeHtml(session.name)}!`);
                    onAuthSuccess(session);
                })
                .catch(err => {
                    if (btn) { btn.disabled = false; btn.querySelector('span').textContent = 'Continuar con Google'; }
                    const ignorable = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
                    if (ignorable.includes(err.code)) return;
                    if (err.code === 'auth/unauthorized-domain') {
                        showSetupModal('firebase-domain');
                    } else if (err.code === 'auth/operation-not-allowed') {
                        showSetupModal('google-firebase');
                    } else {
                        showToast(err.message || 'Error al iniciar sesión con Google', 'error');
                    }
                });
            return;
        }

        // Method 2: Google Identity Services (GIS)
        const gid = getGoogleClientId();
        if (!gid) {
            showGoogleSetupModal(() => {
                this.showLoginScreen();
                setTimeout(() => this.loginWithGoogle(), 300);
            });
            return;
        }
        this._loginWithGIS();
    },

    _loginWithGIS() {
        const handleCredential = (response) => {
            if (!response || !response.credential) {
                showToast('No se recibió credencial de Google', 'error');
                return;
            }
            const payload = decodeJWT(response.credential);
            if (!payload) {
                showToast('Error al procesar respuesta de Google', 'error');
                return;
            }
            const session = {
                userId:    payload.sub,
                name:      payload.name || payload.email?.split('@')[0] || 'Usuario',
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
                client_id: getGoogleClientId(),
                callback:  handleCredential,
                auto_select: false,
                cancel_on_tap_outside: true
            });
            // Try to show the native prompt first
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // Fallback to custom popup
                    setTimeout(() => this._showGooglePopup(handleCredential), 300);
                }
            });
        };
        tryGIS();
    },

    _showGooglePopup(callback) {
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:9999;backdrop-filter:blur(8px)';
        container.innerHTML = `
            <div style="background:rgba(10,18,36,0.95);border:1px solid rgba(75,145,255,0.3);border-radius:20px;padding:32px;text-align:center;max-width:300px;box-shadow:0 24px 60px rgba(0,0,0,0.5)">
                <p style="margin:0 0 20px;font-weight:700;font-size:1rem;color:#e8f0ff;font-family:var(--font-display)">Selecciona tu cuenta</p>
                <div id="_gsi-btn-container" style="display:flex;justify-content:center"></div>
                <button id="_gsi-cancel" style="margin-top:16px;background:none;border:none;color:rgba(100,130,180,0.65);cursor:pointer;font-size:0.825rem;font-family:var(--font-primary)">Cancelar</button>
            </div>
        `;
        document.body.appendChild(container);

        const handleClose = () => {
            container.remove();
        };

        // Initialize with callback that closes popup and processes credential
        google.accounts.id.initialize({
            client_id: getGoogleClientId(),
            callback: (response) => {
                handleClose();
                if (typeof callback === 'function') {
                    callback(response);
                }
            },
            auto_select: false,
            cancel_on_tap_outside: false
        });

        // Render the button
        google.accounts.id.renderButton(document.getElementById('_gsi-btn-container'), {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            width: 240
        });

        container.querySelector('#_gsi-cancel')?.addEventListener('click', handleClose);
        container.addEventListener('click', (e) => {
            if (e.target === container) handleClose();
        });
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
