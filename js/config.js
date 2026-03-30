// config.js — Credenciales de autenticación para Comando Vida 2.0
// ================================================================
// Para activar cada método de login, rellena los valores abajo.
// Los métodos sin configurar mostrarán instrucciones al usuario.

// ----------------------------------------------------------------
// GOOGLE SIGN-IN
// 1. Ve a https://console.cloud.google.com/apis/credentials
// 2. Crea un proyecto (o usa uno existente)
// 3. Crea credencial → "ID de cliente de OAuth 2.0" → "Aplicación web"
// 4. En "Orígenes autorizados" agrega: http://localhost:9999
// 5. Copia el Client ID aquí:
export const GOOGLE_CLIENT_ID = '';  // Ej: "1234567890-abc.apps.googleusercontent.com"

// ----------------------------------------------------------------
// FIREBASE (para autenticación por TELÉFONO / SMS)
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un proyecto → Authentication → Sign-in methods → Teléfono
// 3. Copia tu configuración de Firebase aquí:
export const firebaseConfig = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
};
