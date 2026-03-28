// auth.js - Authentication module for Comando Vida 2.0
import { store } from './store.js';
import { escapeHtml, showToast } from './ui.js';
import { initFirebase } from './firebase-config.js';

const USERS_KEY = 'CV2_USERS';
const SESSION_KEY = 'CV2_SESSION';

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'CV2_SALT_2024');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch {
        return null;
    }
}

function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function onAuthSuccess(user) {
    // Set username in store settings
    if (user.name) {
        store.set('settings.userName', user.name);
    }

    // Hide login, show app
    const loginScreen = document.getElementById('login-screen');
    const app = document.getElementById('app');
    if (loginScreen) loginScreen.style.display = 'none';
    if (app) app.style.display = '';

    // Notify app.js that auth is ready
    if (typeof window.__onAuthReady === 'function') {
        window.__onAuthReady(user);
    }
}

export const auth = {
    _mode: 'login', // 'login' or 'register'
    _phoneConfirmation: null, // Firebase phone confirmation result
    _recaptchaVerifier: null,

    init() {
        // Try to initialize Firebase (won't fail if not configured)
        initFirebase();

        const session = getSession();
        if (session) {
            // User is already logged in
            onAuthSuccess(session);
        } else {
            // Show login screen
            this.showLoginScreen();
        }
    },

    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const app = document.getElementById('app');
        if (app) app.style.display = 'none';
        if (loginScreen) {
            loginScreen.style.display = '';
            loginScreen.innerHTML = this._renderLoginHTML();
            this._bindEvents();
        }
    },

    _renderLoginHTML() {
        const isRegister = this._mode === 'register';
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

                <button class="login-btn-google" id="auth-google-btn">
                    <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    <span>Continuar con Google</span>
                </button>

                <button class="login-btn-phone" id="auth-phone-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                        <line x1="12" y1="18" x2="12.01" y2="18"/>
                    </svg>
                    <span>Continuar con Tel&eacute;fono</span>
                </button>

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

                <div class="login-divider">
                    <span>o inicia con email</span>
                </div>

                <form class="login-form" id="auth-email-form">
                    ${isRegister ? `
                    <div class="form-group">
                        <input type="text" class="login-input" id="auth-name" placeholder="Nombre" autocomplete="name">
                    </div>
                    ` : ''}
                    <div class="form-group">
                        <input type="email" class="login-input" id="auth-email" placeholder="Email" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <input type="password" class="login-input" id="auth-password" placeholder="Contrase&ntilde;a (m&iacute;nimo 6 caracteres)" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required minlength="6">
                    </div>
                    <div class="login-error" id="auth-error" style="display:none"></div>
                    <button type="submit" class="login-btn-primary" id="auth-submit-btn">
                        ${isRegister ? 'Crear Cuenta' : 'Iniciar Sesi&oacute;n'}
                    </button>
                    <button type="button" class="login-btn-secondary" id="auth-switch-btn">
                        ${isRegister ? 'Ya tengo cuenta - Iniciar Sesi&oacute;n' : 'Crear Cuenta'}
                    </button>
                </form>

                <div class="login-divider">
                    <span></span>
                </div>

                <a href="#" class="login-skip" id="auth-skip-btn">Continuar sin cuenta</a>
            </div>
        `;
    },

    _showError(msg) {
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
    },

    _hideError() {
        const el = document.getElementById('auth-error');
        if (el) el.style.display = 'none';
    },

    _bindEvents() {
        // Email form submit
        const form = document.getElementById('auth-email-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                this._hideError();

                const email = document.getElementById('auth-email')?.value.trim();
                const password = document.getElementById('auth-password')?.value;

                if (this._mode === 'register') {
                    const name = document.getElementById('auth-name')?.value.trim();
                    await this.registerWithEmail(email, password, name);
                } else {
                    await this.loginWithEmail(email, password);
                }
            });
        }

        // Switch login/register
        document.getElementById('auth-switch-btn')?.addEventListener('click', () => {
            this._mode = this._mode === 'login' ? 'register' : 'login';
            this.showLoginScreen();
        });

        // Google sign-in
        document.getElementById('auth-google-btn')?.addEventListener('click', () => {
            this.loginWithGoogle();
        });

        // Phone sign-in toggle
        document.getElementById('auth-phone-btn')?.addEventListener('click', () => {
            const phoneForm = document.getElementById('phone-form');
            if (phoneForm) {
                phoneForm.style.display = phoneForm.style.display === 'none' ? 'block' : 'none';
            }
        });

        // Send phone code
        document.getElementById('auth-send-code-btn')?.addEventListener('click', () => {
            const phone = document.getElementById('auth-phone-number')?.value.trim();
            if (phone) {
                this.loginWithPhone(phone);
            } else {
                showToast('Ingresa tu n\u00famero de tel\u00e9fono', 'error');
            }
        });

        // Verify phone code
        document.getElementById('auth-verify-code-btn')?.addEventListener('click', () => {
            const code = document.getElementById('auth-phone-code')?.value.trim();
            if (code) {
                this.verifyPhoneCode(code);
            } else {
                showToast('Ingresa el c\u00f3digo de verificaci\u00f3n', 'error');
            }
        });

        // Skip login
        document.getElementById('auth-skip-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.skipLogin();
        });
    },

    async loginWithEmail(email, password) {
        // Validation
        if (!email || !validateEmail(email)) {
            this._showError('Ingresa un email v\u00e1lido');
            return;
        }
        if (!password || password.length < 6) {
            this._showError('La contrase\u00f1a debe tener al menos 6 caracteres');
            return;
        }

        const users = getUsers();
        const passwordHash = await hashPassword(password);
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            this._showError('No existe una cuenta con ese email. \u00bfDeseas crear una?');
            return;
        }

        if (user.passwordHash !== passwordHash) {
            this._showError('Contrase\u00f1a incorrecta');
            return;
        }

        const session = {
            userId: user.id,
            name: user.name,
            email: user.email,
            method: 'email',
            loggedInAt: new Date().toISOString()
        };

        saveSession(session);
        showToast(`\u00a1Bienvenido de vuelta, ${escapeHtml(user.name)}!`);
        onAuthSuccess(session);
    },

    async registerWithEmail(email, password, name) {
        // Validation
        if (!name || name.trim().length === 0) {
            this._showError('Ingresa tu nombre');
            return;
        }
        if (!email || !validateEmail(email)) {
            this._showError('Ingresa un email v\u00e1lido');
            return;
        }
        if (!password || password.length < 6) {
            this._showError('La contrase\u00f1a debe tener al menos 6 caracteres');
            return;
        }

        const users = getUsers();

        // Check if email already exists
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            this._showError('Ya existe una cuenta con ese email. Inicia sesi\u00f3n.');
            return;
        }

        const passwordHash = await hashPassword(password);
        const newUser = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
            email: email.toLowerCase(),
            name: name.trim(),
            passwordHash,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);

        const session = {
            userId: newUser.id,
            name: newUser.name,
            email: newUser.email,
            method: 'email',
            loggedInAt: new Date().toISOString()
        };

        saveSession(session);
        showToast(`\u00a1Bienvenido, ${escapeHtml(newUser.name)}! Tu cuenta ha sido creada.`);
        onAuthSuccess(session);
    },

    loginWithGoogle() {
        if (!window.firebase || !firebase.apps || firebase.apps.length === 0) {
            showToast('Configura Firebase para usar este m\u00e9todo', 'warning');
            return;
        }

        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                const firebaseUser = result.user;
                const session = {
                    userId: firebaseUser.uid,
                    name: firebaseUser.displayName || 'Usuario',
                    email: firebaseUser.email || '',
                    photoURL: firebaseUser.photoURL || '',
                    method: 'google',
                    loggedInAt: new Date().toISOString()
                };
                saveSession(session);
                showToast(`\u00a1Bienvenido, ${escapeHtml(session.name)}!`);
                onAuthSuccess(session);
            })
            .catch((error) => {
                console.error('Google sign-in error:', error);
                if (error.code === 'auth/popup-closed-by-user') {
                    showToast('Inicio de sesi\u00f3n cancelado', 'info');
                } else if (error.code === 'auth/network-request-failed') {
                    showToast('Error de conexi\u00f3n. Verifica tu internet.', 'error');
                } else {
                    showToast('Error al iniciar con Google: ' + (error.message || 'Intenta de nuevo'), 'error');
                }
            });
    },

    loginWithPhone(phoneNumber) {
        if (!window.firebase || !firebase.apps || firebase.apps.length === 0) {
            showToast('Configura Firebase para usar este m\u00e9todo', 'warning');
            return;
        }

        // Create reCAPTCHA verifier if not exists
        if (!this._recaptchaVerifier) {
            this._recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                size: 'invisible',
                callback: () => {
                    // reCAPTCHA solved
                }
            });
        }

        firebase.auth().signInWithPhoneNumber(phoneNumber, this._recaptchaVerifier)
            .then((confirmationResult) => {
                this._phoneConfirmation = confirmationResult;
                // Show code input
                const codeSection = document.getElementById('phone-code-section');
                if (codeSection) codeSection.style.display = 'block';
                showToast('C\u00f3digo SMS enviado. Rev\u00edsa tu tel\u00e9fono.', 'info');
            })
            .catch((error) => {
                console.error('Phone sign-in error:', error);
                if (error.code === 'auth/invalid-phone-number') {
                    showToast('N\u00famero de tel\u00e9fono inv\u00e1lido. Usa formato +XX XXXXXXXXXX', 'error');
                } else if (error.code === 'auth/too-many-requests') {
                    showToast('Demasiados intentos. Intenta m\u00e1s tarde.', 'error');
                } else {
                    showToast('Error al enviar SMS: ' + (error.message || 'Intenta de nuevo'), 'error');
                }
                // Reset reCAPTCHA
                this._recaptchaVerifier = null;
            });
    },

    verifyPhoneCode(code) {
        if (!this._phoneConfirmation) {
            showToast('Primero solicita el c\u00f3digo SMS', 'error');
            return;
        }

        this._phoneConfirmation.confirm(code)
            .then((result) => {
                const firebaseUser = result.user;
                const session = {
                    userId: firebaseUser.uid,
                    name: firebaseUser.displayName || 'Usuario',
                    email: firebaseUser.email || '',
                    phone: firebaseUser.phoneNumber || '',
                    method: 'phone',
                    loggedInAt: new Date().toISOString()
                };
                saveSession(session);
                showToast(`\u00a1Bienvenido, ${escapeHtml(session.name)}!`);
                onAuthSuccess(session);
            })
            .catch((error) => {
                console.error('Phone verify error:', error);
                if (error.code === 'auth/invalid-verification-code') {
                    showToast('C\u00f3digo incorrecto. Intenta de nuevo.', 'error');
                } else {
                    showToast('Error al verificar c\u00f3digo: ' + (error.message || 'Intenta de nuevo'), 'error');
                }
            });
    },

    skipLogin() {
        const session = {
            userId: 'guest',
            name: 'Invitado',
            email: '',
            method: 'guest',
            loggedInAt: new Date().toISOString()
        };
        saveSession(session);
        showToast('\u00a1Bienvenido! Est\u00e1s usando el modo invitado.');
        onAuthSuccess(session);
    },

    logout() {
        // Sign out from Firebase if available
        if (window.firebase && firebase.apps && firebase.apps.length > 0) {
            try {
                firebase.auth().signOut();
            } catch (e) {
                // Ignore Firebase sign-out errors
            }
        }

        clearSession();
        this._mode = 'login';
        this._phoneConfirmation = null;
        this._recaptchaVerifier = null;

        showToast('Sesi\u00f3n cerrada');
        this.showLoginScreen();
    },

    getCurrentUser() {
        return getSession();
    },

    isLoggedIn() {
        return getSession() !== null;
    }
};
