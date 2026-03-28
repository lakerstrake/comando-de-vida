// app.js - Main application entry point and router
import { store } from './store.js';
import { showToast, showModal, closeModal, escapeHtml } from './ui.js';
import { aiAssistant } from './ai-assistant.js';
import { auth } from './auth.js';
import { loadDefaultTemplates } from './templates.js';
import * as dashboard from './dashboard.js';
import * as habits from './habits.js';
import * as goals from './goals.js';
import * as planner from './planner.js';
import * as journal from './journal.js';
import * as lifewheel from './lifewheel.js';
import * as stats from './stats.js';
import * as review from './review.js';

const routes = {
    '/dashboard': dashboard,
    '/habits': habits,
    '/goals': goals,
    '/planner': planner,
    '/journal': journal,
    '/lifewheel': lifewheel,
    '/stats': stats,
    '/review': review
};

let currentModule = null;

function navigate(path) {
    if (!path || path === '/' || path === '') path = '/dashboard';
    const module = routes[path];
    if (!module) {
        navigate('/dashboard');
        return;
    }

    // Destroy current
    if (currentModule && currentModule.destroy) {
        currentModule.destroy();
    }

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('href') === '#' + path);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('href') === '#' + path);
    });

    currentModule = module;
    module.render();

    // Scroll to top
    document.querySelector('.main-area')?.scrollTo(0, 0);
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    navigate(hash);
}

// Settings panel
function showSettings() {
    const settings = store.get('settings');
    const usage = store.getStorageUsage();

    const html = `
        <form id="settings-form" class="form">
            <div class="form-group">
                <label>Tu nombre</label>
                <input type="text" id="set-name" value="${escapeHtml(settings.userName || '')}" placeholder="Guerrero">
            </div>
            <div class="form-group">
                <label><input type="checkbox" id="set-sound" ${settings.soundEnabled ? 'checked' : ''}> Sonidos activados</label>
            </div>
            <div class="form-group">
                <label>Almacenamiento usado</label>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${usage.percentage}%"></div>
                </div>
                <small class="text-secondary">${usage.kb} KB / 5 MB (${usage.percentage}%)</small>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar</button>
            <hr style="border-color:var(--border-glass);margin:16px 0">
            <div class="form-group">
                <label>Datos</label>
                <div style="display:flex;gap:8px">
                    <button type="button" class="btn btn-sm btn-ghost" id="export-btn">&#128190; Exportar</button>
                    <button type="button" class="btn btn-sm btn-ghost" id="import-btn">&#128194; Importar</button>
                </div>
            </div>
            <hr style="border-color:var(--border-glass);margin:16px 0">
            <button type="button" class="btn btn-sm btn-ghost text-danger" id="logout-btn">Cerrar sesi\u00f3n</button>
        </form>
    `;

    showModal('Configuraci\u00f3n', html);

    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        store.set('settings.userName', document.getElementById('set-name').value.trim());
        store.set('settings.soundEnabled', document.getElementById('set-sound').checked);
        closeModal();
        showToast('Configuraci\u00f3n guardada');
        if (currentModule) currentModule.render();
    });

    document.getElementById('export-btn')?.addEventListener('click', () => {
        const data = store.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comando-vida-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup descargado');
    });

    document.getElementById('import-btn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (store.importData(ev.target.result)) {
                    closeModal();
                    showToast('Datos importados correctamente');
                    navigate('/dashboard');
                } else {
                    showToast('Error al importar datos', 'error');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
        closeModal();
        auth.logout();
    });
}

// Set up auth callback
window.__onAuthReady = function(user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    // Load default templates for new users
    loadDefaultTemplates(store);

    // Update user display in sidebar
    const userName = user?.name || store.get('settings.userName') || '';
    if (user?.name && !store.get('settings.userName')) {
        store.set('settings.userName', user.name);
    }
    updateUserMenu(user);

    // Init all modules
    Object.values(routes).forEach(m => m.init && m.init());

    // Settings button
    document.getElementById('settings-btn')?.addEventListener('click', showSettings);
    document.getElementById('settings-btn-mobile')?.addEventListener('click', showSettings);

    // Router
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
};

function updateUserMenu(user) {
    const header = document.querySelector('.sidebar-header');
    if (!header || !user) return;
    const existing = header.querySelector('.user-menu');
    if (existing) existing.remove();
    const initial = (user.name || user.email || 'U')[0].toUpperCase();
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
        <div class="user-avatar">${initial}</div>
        <div class="user-info">
            <span class="user-name">${escapeHtml(user.name || user.email || 'Usuario')}</span>
            <span class="user-method">${user.method === 'guest' ? 'Modo invitado' : user.email || ''}</span>
        </div>
    `;
    header.appendChild(menu);
}

document.addEventListener('DOMContentLoaded', () => {
    auth.init();
});
