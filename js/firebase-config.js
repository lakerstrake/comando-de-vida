// firebase-config.js - Inicializacion y config runtime de Firebase
import { firebaseConfig as staticFirebaseConfig } from './config.js';

const FIREBASE_RUNTIME_KEY = 'CV2_FIREBASE_CONFIG';
const REQUIRED_FIELDS = ['apiKey', 'authDomain', 'projectId', 'appId'];
const ALLOWED_FIELDS = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
];

let _firebaseInitPromise = null;
let _firebaseInitialized = false;

function readRuntimeConfig() {
    try {
        const raw = localStorage.getItem(FIREBASE_RUNTIME_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function sanitizeConfig(config = {}) {
    const clean = {};
    for (const key of ALLOWED_FIELDS) {
        const val = config[key];
        if (typeof val === 'string' && val.trim()) {
            clean[key] = val.trim();
        }
    }
    return clean;
}

export function getFirebaseConfig() {
    const merged = {
        ...(staticFirebaseConfig || {}),
        ...readRuntimeConfig()
    };
    return sanitizeConfig(merged);
}

export function isFirebaseConfigured(config = getFirebaseConfig()) {
    return REQUIRED_FIELDS.every((key) => Boolean(config[key]));
}

export function saveFirebaseRuntimeConfig(config) {
    const clean = sanitizeConfig(config);
    if (!isFirebaseConfigured(clean)) {
        return false;
    }

    localStorage.setItem(FIREBASE_RUNTIME_KEY, JSON.stringify(clean));
    _firebaseInitPromise = null;
    _firebaseInitialized = false;
    return true;
}

export function clearFirebaseRuntimeConfig() {
    localStorage.removeItem(FIREBASE_RUNTIME_KEY);
    _firebaseInitPromise = null;
    _firebaseInitialized = false;
}

export function initFirebase() {
    try {
        if (!window.firebase) return false;
        if (_firebaseInitialized && firebase.apps?.length) return true;

        const config = getFirebaseConfig();
        if (!isFirebaseConfigured(config)) return false;

        if (firebase.apps.length === 0) {
            firebase.initializeApp(config);
        }

        _firebaseInitialized = true;
        return true;
    } catch (e) {
        console.error('Firebase init error:', e);
        return false;
    }
}

// Espera a que Firebase este disponible (con timeout)
export function waitForFirebase(maxWait = 5000) {
    if (!_firebaseInitPromise) {
        _firebaseInitPromise = new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                if (initFirebase() || Date.now() - start > maxWait) {
                    resolve(initFirebase());
                } else {
                    setTimeout(check, 250);
                }
            };
            check();
        });
    }
    return _firebaseInitPromise;
}

