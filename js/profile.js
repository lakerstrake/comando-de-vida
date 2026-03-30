// profile.js - User profile module
import { store } from './store.js';
import { escapeHtml, showToast, showModal, closeModal } from './ui.js';
import { auth } from './auth.js';

export function render() {
    const container = document.getElementById('main-content');
    const user = auth.getCurrentUser();
    const settings = store.get('settings') || {};
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const goals = (store.get('goals.items') || []).filter(g => g.status === 'active');
    const entries = store.get('journal.entries') || [];

    const initial = ((user?.name || user?.email || 'U')[0]).toUpperCase();
    const methodLabel = {
        google: 'Google',
        phone: 'Teléfono',
        email: 'Email',
        guest: 'Modo invitado'
    }[user?.method] || 'Desconocido';

    const memberSince = user?.loggedInAt
        ? new Date(user.loggedInAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : '-';

    container.innerHTML = `
        <div class="profile-page" style="animation: pageEnter 0.3s ease">
            <div class="page-header">
                <h1 class="page-title">Perfil</h1>
            </div>

            <div class="profile-hero glass-card">
                <div class="profile-avatar-lg">${escapeHtml(initial)}</div>
                <div class="profile-info">
                    <h2 class="profile-name">${escapeHtml(user?.name || settings.userName || 'Usuario')}</h2>
                    <p class="profile-email text-secondary">${escapeHtml(user?.email || user?.phone || '')}</p>
                    <span class="profile-method-badge">${escapeHtml(methodLabel)}</span>
                </div>
            </div>

            <div class="profile-stats-row">
                <div class="glass-card profile-stat">
                    <span class="profile-stat-num">${habits.length}</span>
                    <span class="text-secondary">Hábitos activos</span>
                </div>
                <div class="glass-card profile-stat">
                    <span class="profile-stat-num">${goals.length}</span>
                    <span class="text-secondary">Metas activas</span>
                </div>
                <div class="glass-card profile-stat">
                    <span class="profile-stat-num">${entries.length}</span>
                    <span class="text-secondary">Entradas diario</span>
                </div>
            </div>

            <div class="glass-card profile-section">
                <h3 class="card-heading">Información de cuenta</h3>
                <div class="profile-detail-row">
                    <span class="text-secondary">Método de acceso</span>
                    <span>${escapeHtml(methodLabel)}</span>
                </div>
                <div class="profile-detail-row">
                    <span class="text-secondary">Sesión iniciada</span>
                    <span>${escapeHtml(memberSince)}</span>
                </div>
                ${settings.userName ? `
                <div class="profile-detail-row">
                    <span class="text-secondary">Nombre en la app</span>
                    <span>${escapeHtml(settings.userName)}</span>
                </div>` : ''}
            </div>

            <div class="glass-card profile-section">
                <h3 class="card-heading">Acciones</h3>
                <button class="btn btn-ghost profile-action-btn" id="profile-edit-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Editar nombre
                </button>
                <button class="btn btn-ghost profile-action-btn" id="profile-export-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Exportar mis datos
                </button>
            </div>

            <button class="btn-logout-full" id="profile-logout-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Cerrar Sesión
            </button>
        </div>
    `;

    document.getElementById('profile-logout-btn')?.addEventListener('click', () => {
        showModal('Cerrar sesión', '<p style="margin:0">¿Seguro que quieres cerrar sesión?</p>', [
            { id: 'confirm', label: 'Cerrar sesión', type: 'danger', handler: () => auth.logout() },
            { id: 'cancel', label: 'Cancelar', type: 'ghost', handler: () => {} }
        ]);
    });

    document.getElementById('profile-edit-btn')?.addEventListener('click', () => {
        const current = settings.userName || user?.name || '';
        showModal('Editar nombre', `
            <div class="form-group">
                <label>Tu nombre</label>
                <input type="text" class="form-control" id="profile-name-input" value="${escapeHtml(current)}" placeholder="Tu nombre" maxlength="50">
            </div>
        `, [
            {
                id: 'save', label: 'Guardar', type: 'primary', handler: () => {
                    const val = document.getElementById('profile-name-input')?.value.trim();
                    if (val) {
                        store.set('settings.userName', val);
                        showToast('Nombre actualizado');
                        render();
                    }
                }
            },
            { id: 'cancel', label: 'Cancelar', type: 'ghost', handler: () => {} }
        ]);
    });

    document.getElementById('profile-export-btn')?.addEventListener('click', () => {
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
}

export function init() {}
export function destroy() {}
