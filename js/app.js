// app.js - Main application entry point and router
import { store } from './store.js';
import { showToast, showModal, closeModal, escapeHtml } from './ui.js';
import { aiAssistant } from './ai-assistant.js';
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
}

// First-time welcome
function checkFirstTime() {
    const name = store.get('settings.userName');
    if (!name) {
        const html = `
            <div class="welcome-screen">
                <h2 style="margin-bottom:8px">Bienvenido a Comando Vida 2.0</h2>
                <p class="text-secondary" style="margin-bottom:16px">Tu centro de mando personal basado en neurociencia para transformar tu vida.</p>
                <form id="welcome-form" class="form">
                    <div class="form-group">
                        <label>\u00bfC\u00f3mo te llamas?</label>
                        <input type="text" id="welcome-name" placeholder="Tu nombre" required autofocus>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block btn-lg">&#128640; Comenzar Transformaci\u00f3n</button>
                </form>
                <div style="margin-top:16px">
                    <p class="text-secondary" style="font-size:0.85rem">
                        &#129504; Esta app aplica principios de:<br>
                        &bull; <strong>Neuroplasticidad</strong> - Tu cerebro cambia con cada acci\u00f3n repetida<br>
                        &bull; <strong>Habit Stacking</strong> - Conecta h\u00e1bitos nuevos a existentes (James Clear)<br>
                        &bull; <strong>Dopamina</strong> - Sistema de recompensas para mantener motivaci\u00f3n<br>
                        &bull; <strong>Metacognici\u00f3n</strong> - Revisi\u00f3n semanal para autorregulaci\u00f3n<br>
                        &bull; <strong>Intenciones de implementaci\u00f3n</strong> - Metas SMART con plan concreto
                    </p>
                </div>
            </div>
        `;

        showModal('', html);
        document.getElementById('welcome-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('welcome-name').value.trim();
            if (name) {
                store.set('settings.userName', name);
                closeModal();
                showToast(`\u00a1Bienvenido, ${escapeHtml(name)}! Tu transformaci\u00f3n empieza ahora.`);
                navigate('/dashboard');
            }
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Init all modules
    Object.values(routes).forEach(m => m.init && m.init());

    // Settings button
    document.getElementById('settings-btn')?.addEventListener('click', showSettings);
    document.getElementById('settings-btn-mobile')?.addEventListener('click', showSettings);

    // Router
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    // First time check
    setTimeout(checkFirstTime, 300);
});
