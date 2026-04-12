// app.js - Main application entry point and router
import { store } from './store.js';
import { showToast, showModal, closeModal, escapeHtml } from './ui.js';
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
import * as profile from './profile.js';
import * as brief from './daily-brief.js';
import * as evening from './evening-reflection.js';
import * as wellbeing from './wellbeing.js';

const routes = {
    '/dashboard': dashboard,
    '/habits': habits,
    '/goals': goals,
    '/planner': planner,
    '/journal': journal,
    '/lifewheel': lifewheel,
    '/stats': stats,
    '/review': review,
    '/profile': profile,
    '/brief': brief,
    '/evening': evening,
    '/wellbeing': wellbeing
};

let currentModule = null;
const THEME_COLORS = {
    dark: '#061023',
    light: '#e8eef8'
};
const DEFAULT_AVATARS = [
    './assets/avatars/avatar-01.svg',
    './assets/avatars/avatar-02.svg',
    './assets/avatars/avatar-03.svg',
    './assets/avatars/avatar-04.svg',
    './assets/avatars/avatar-05.svg',
    './assets/avatars/avatar-06.svg'
];
const SIMPLE_MODE_HIDDEN_ROUTES = new Set(['/lifewheel', '/stats', '/review']);

function applyTheme(theme) {
    const activeTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', THEME_COLORS[activeTheme]);
    syncThemeButtons(activeTheme);
    return activeTheme;
}

function getSavedTheme() {
    const settings = store.get('settings') || {};
    return settings.theme === 'light' ? 'light' : 'dark';
}

function syncThemeButtons(theme) {
    const isDark = theme === 'dark';
    const sidebarLabel = document.getElementById('theme-toggle-label');
    if (sidebarLabel) {
        sidebarLabel.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';
    }
    const mobileBtn = document.getElementById('theme-toggle-btn-mobile');
    if (mobileBtn) {
        mobileBtn.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
        mobileBtn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
}

function toggleTheme() {
    const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    store.set('settings.theme', nextTheme);
    applyTheme(nextTheme);
    showToast(nextTheme === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado', 'info', 1800);
}

function getSimpleMode() {
    const settings = store.get('settings') || {};
    return settings.simpleMode !== false;
}

function applySimpleMode(enabled) {
    document.body.classList.toggle('simple-mode', Boolean(enabled));
}

function applyRouteMotion(path) {
    const content = document.getElementById('main-content');
    if (!content) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    content.dataset.route = (path || '/dashboard').replace('/', '') || 'dashboard';

    if (!reduceMotion) {
        content.classList.remove('view-ready');
        content.classList.add('view-transitioning');
        // Force animation restart for frequent route switches
        void content.offsetWidth;
    }

    const revealTargets = content.querySelectorAll(
        '.page-header, .dashboard-header, .glass-card, .quote-card, .action-btn, .brief-section, .brief-quote, .brief-cta, .evening-summary, .evening-form, .profile-section, .habit-item, .goal-item, .task-item'
    );

    revealTargets.forEach((el, index) => {
        el.style.setProperty('--stagger-index', String(Math.min(index, 20)));
        el.classList.remove('reveal-item');
        if (!reduceMotion) {
            // Force each element to replay staggered entry
            void el.offsetWidth;
            el.classList.add('reveal-item');
        }
    });

    requestAnimationFrame(() => {
        content.classList.remove('view-transitioning');
        content.classList.add('view-ready');
    });
}

function navigate(path) {
    if (!path || path === '/' || path === '') path = '/dashboard';
    if (getSimpleMode() && SIMPLE_MODE_HIDDEN_ROUTES.has(path)) {
        path = '/dashboard';
        if (window.location.hash !== '#/dashboard') {
            window.location.hash = '#/dashboard';
            return;
        }
    }
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
    applyRouteMotion(path);

    // Scroll to top
    document.querySelector('.content')?.scrollTo(0, 0);
}

function handleRoute() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    navigate(hash);
}

// Settings panel
function showSettings() {
    const settings = store.get('settings');
    const usage = store.getStorageUsage();
    const currentTheme = getSavedTheme();
    const selectedAvatar = settings.profileAvatar || '';
    const avatarOptionsHtml = DEFAULT_AVATARS.map((src, index) => `
        <button type="button" class="avatar-option ${selectedAvatar === src ? 'active' : ''}" data-avatar="${src}" aria-label="Avatar ${index + 1}">
            <img src="${src}" alt="Avatar ${index + 1}">
        </button>
    `).join('');

    const html = `
        <form id="settings-form" class="form">
            <div class="form-group">
                <label>Tu nombre</label>
                <input type="text" id="set-name" value="${escapeHtml(settings.userName || '')}" placeholder="Guerrero">
            </div>
            <div class="form-group">
                <label class="check-toggle" for="set-sound">
                    <input type="checkbox" id="set-sound" ${settings.soundEnabled ? 'checked' : ''}>
                    <span>Sonidos activados</span>
                </label>
            </div>
            <div class="form-group">
                <label class="check-toggle" for="set-simple-mode">
                    <input type="checkbox" id="set-simple-mode" ${settings.simpleMode !== false ? 'checked' : ''}>
                    <span>Modo simple (recomendado)</span>
                </label>
                <small class="text-secondary">Reduce opciones visibles para enfocarte en lo esencial.</small>
            </div>
            <div class="form-group">
                <label>Tema</label>
                <select id="set-theme">
                    <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Oscuro</option>
                    <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Claro</option>
                </select>
            </div>
            <div class="form-group">
                <label>Avatar de perfil</label>
                <input type="hidden" id="set-avatar" value="${escapeHtml(selectedAvatar)}">
                <div class="avatar-picker">
                    <button type="button" class="avatar-option avatar-option-reset ${!selectedAvatar ? 'active' : ''}" data-avatar="" aria-label="Sin avatar">
                        <span>${(settings.userName || 'U').charAt(0).toUpperCase()}</span>
                    </button>
                    ${avatarOptionsHtml}
                </div>
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
                    <button type="button" class="btn btn-sm btn-ghost" id="export-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Exportar
                    </button>
                    <button type="button" class="btn btn-sm btn-ghost" id="import-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Importar
                    </button>
                </div>
            </div>
            <hr style="border-color:var(--border-glass);margin:16px 0">
            <button type="button" class="btn btn-sm btn-ghost text-danger" id="logout-btn">Cerrar sesi\u00f3n</button>
        </form>
    `;

    showModal('Configuraci\u00f3n', html);

    document.querySelectorAll('.avatar-option').forEach((btn) => {
        btn.addEventListener('click', () => {
            const avatar = btn.dataset.avatar || '';
            document.getElementById('set-avatar').value = avatar;
            document.querySelectorAll('.avatar-option').forEach((option) => option.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const typedName = document.getElementById('set-name').value.trim();
        if (typedName) {
            store.set('settings.userName', typedName);
        }
        store.set('settings.soundEnabled', document.getElementById('set-sound').checked);
        const simpleModeEnabled = document.getElementById('set-simple-mode').checked;
        store.set('settings.simpleMode', simpleModeEnabled);
        const selectedTheme = document.getElementById('set-theme').value;
        const selectedAvatarValue = document.getElementById('set-avatar').value;
        store.set('settings.profileAvatar', selectedAvatarValue);
        store.set('settings.theme', selectedTheme);
        applyTheme(selectedTheme);
        applySimpleMode(simpleModeEnabled);
        updateUserMenu(auth.getCurrentUser());
        closeModal();
        showToast('Configuraci\u00f3n guardada');
        if (currentModule) currentModule.render();
        if (simpleModeEnabled && SIMPLE_MODE_HIDDEN_ROUTES.has(window.location.hash.slice(1))) {
            navigate('/dashboard');
        }
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
    if (user?.name && !store.get('settings.userName')) {
        store.set('settings.userName', user.name);
    }
    updateUserMenu(user);

    // Init all modules
    Object.values(routes).forEach(m => m.init && m.init());

    // Settings button
    document.getElementById('settings-btn')?.addEventListener('click', showSettings);
    document.getElementById('settings-btn-mobile')?.addEventListener('click', showSettings);
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('theme-toggle-btn-mobile')?.addEventListener('click', toggleTheme);
    applyTheme(getSavedTheme());
    applySimpleMode(getSimpleMode());

    // Router
    window.addEventListener('hashchange', handleRoute);

    // Routing logic: brief in AM, evening reflection in PM
    const hash = window.location.hash.slice(1);
    if (!hash || hash === '/' || hash === '/dashboard') {
        if (!brief.wasSeenToday()) {
            window.location.hash = '#/brief';
            return;
        }
        if (evening.shouldShow()) {
            window.location.hash = '#/evening';
            return;
        }
    }
    handleRoute();
};

function updateUserMenu(user) {
    const header = document.querySelector('.sidebar-header');
    if (!header || !user) return;
    const existing = header.querySelector('.user-menu');
    if (existing) existing.remove();
    const settings = store.get('settings') || {};
    const displayName = (settings.userName || user.name || user.email || 'Usuario').trim();
    const initial = displayName.charAt(0).toUpperCase();
    const avatar = settings.profileAvatar || '';
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
        <div class="user-avatar ${avatar ? 'has-image' : ''}">
            ${avatar ? `<img src="${escapeHtml(avatar)}" alt="Avatar de perfil" class="user-avatar-image">` : initial}
        </div>
        <div class="user-info">
            <span class="user-name">${escapeHtml(displayName)}</span>
            <span class="user-method">${user.method === 'guest' ? 'Modo invitado' : user.email || ''}</span>
        </div>
    `;
    header.appendChild(menu);
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getSavedTheme());
    applySimpleMode(getSimpleMode());
    
    // Auth init handles the transition to login or app
    auth.init().finally(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 600);
        }
    });
});
