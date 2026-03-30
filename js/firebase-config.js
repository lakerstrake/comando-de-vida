// firebase-config.js - Inicialización de Firebase
import { firebaseConfig } from './config.js';

export function initFirebase() {
    try {
        if (!window.firebase) return false;
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return false;
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
        return true;
    } catch (e) {
        console.error('Firebase init error:', e);
        return false;
    }
}
