// firebase-config.js - Replace with your Firebase project config
// To enable Google and Phone authentication:
// 1. Go to https://console.firebase.google.com/
// 2. Create a project or select an existing one
// 3. Enable Authentication > Sign-in methods > Google and Phone
// 4. Copy your config values below
// 5. The Firebase SDK is loaded via CDN in index.html

export const firebaseConfig = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

/**
 * Initialize Firebase if config is provided.
 * Returns true if Firebase was initialized successfully.
 */
export function initFirebase() {
    try {
        if (!window.firebase) {
            console.warn('Firebase SDK not loaded');
            return false;
        }

        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            console.warn('Firebase config not set - Google and Phone auth disabled');
            return false;
        }

        // Avoid re-initializing
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }

        return true;
    } catch (e) {
        console.error('Firebase init error:', e);
        return false;
    }
}
