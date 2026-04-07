// firebase-config.js - Inicialización de Firebase
import { firebaseConfig } from './config.js';

let _firebaseInitPromise = null;
let _firebaseInitialized = false;

export function initFirebase() {
    try {
        if (_firebaseInitialized) return true;
        if (!window.firebase) return false;
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return false;
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        _firebaseInitialized = true;
        return true;
    } catch (e) {
        console.error('Firebase init error:', e);
        return false;
    }
}

/** Espera a que Firebase esté disponible (con timeout) */
export function waitForFirebase(maxWait = 5000) {
    if (!_firebaseInitPromise) {
        _firebaseInitPromise = new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                if (initFirebase() || Date.now() - start > maxWait) {
                    resolve(initFirebase());
                } else {
                    setTimeout(check, 300);
                }
            };
            check();
        });
    }
    return _firebaseInitPromise;
}
