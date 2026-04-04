// profile.js - Clean minimal profile page
import { store } from './store.js';
import { escapeHtml, showToast, showModal, closeModal, icon } from './ui.js';
import { auth } from './auth.js';
import { getLevelInfo, getNextLevel, getLevelProgress, LEVELS, ACHIEVEMENTS, hasAchievement } from './gamification.js';

export function render() {
    const container = document.getElementById('main-content');
    const user = auth.getCurrentUser();
    const settings = store.get('settings') || {};
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const goals = (store.get('goals.items') || []).filter(g => g.status === 'active');
    const entries = store.get('journal.entries') || [];
    const gam = store.get('gamification') || { xp: 0, achievements: [] };

    const xp = gam.xp || 0;
    const level = getLevelInfo(xp);
    const nextLvl = getNextLevel(xp);
    const progress = getLevelProgress(xp);
    const xpToNext = nextLvl ? nextLvl.min - xp : 0;

    const displayName = (settings.userName || user?.name || user?.email || 'Usuario').trim();
    const initial = (displayName[0] || 'U').toUpperCase();
    const avatarSrc = settings.profileAvatar || '';
    const methodLabel = { google: 'Google', phone: 'Teléfono', email: 'Email', guest: 'Modo invitado' }[user?.method] || 'Desconocido';

    const unlockedAchs = ACHIEVEMENTS.filter(a => hasAchievement(a.id));
    const lockedAchs = ACHIEVEMENTS.filter(a => !hasAchievement(a.id));

    container.innerHTML = `
        <div class="prf-page">

            <!-- Hero -->
            <div class="prf-hero">
                <div class="prf-avatar ${avatarSrc ? 'has-image' : ''}" style="background:${level.color}33">
                    ${avatarSrc ? `<img src="${escapeHtml(avatarSrc)}" alt="Avatar" class="prf-avatar-img">` : `<span>${escapeHtml(initial)}</span>`}
                </div>
                <div class="prf-hero-info">
                    <h1 class="prf-name">${escapeHtml(displayName)}</h1>
                    <span class="prf-level-badge" style="background:${level.color}22;color:${level.color}">${level.icon} Nivel ${level.level} — ${level.name}</span>
                </div>
            </div>

            <!-- XP bar -->
            <div class="prf-xp-block">
                <div class="prf-xp-bar-wrap">
                    <div class="prf-xp-bar-fill" style="width:${progress}%;background:${level.color}"></div>
                </div>
                <p class="text-muted" style="font-size:0.75rem;margin-top:4px">
                    ${xp} XP${nextLvl ? ` · ${xpToNext} para Nivel ${nextLvl.level}` : ' · Nivel máximo'}
                </p>
                <div class="prf-levels-row">
                    ${LEVELS.map(lvl => `
                        <div class="prf-level-dot ${lvl.level <= level.level ? 'reached' : ''}"
                            title="Niv.${lvl.level}: ${lvl.name}"
                            style="${lvl.level <= level.level ? `background:${lvl.color}` : ''}">
                        </div>`).join('')}
                </div>
            </div>

            <!-- Stats -->
            <div class="prf-stats-row">
                <div class="prf-stat"><strong>${habits.length}</strong><span class="text-muted">Hábitos</span></div>
                <div class="prf-stat"><strong>${goals.length}</strong><span class="text-muted">Metas</span></div>
                <div class="prf-stat"><strong>${entries.length}</strong><span class="text-muted">Entradas</span></div>
                <div class="prf-stat"><strong>${xp}</strong><span class="text-muted">XP</span></div>
            </div>

            <!-- Achievements unlocked -->
            <div class="prf-section">
                <p class="prf-section-label">Logros desbloqueados <span class="text-muted">${unlockedAchs.length}/${ACHIEVEMENTS.length}</span></p>
                ${unlockedAchs.length ? `
                <div class="prf-ach-grid">
                    ${unlockedAchs.map(a => `
                        <div class="prf-ach unlocked" title="${a.desc}">
                            <span class="prf-ach-icon">${a.icon}</span>
                            <span class="prf-ach-name">${a.name}</span>
                            <span class="prf-ach-xp">+${a.xpReward} XP</span>
                        </div>`).join('')}
                </div>` : `<p class="text-secondary" style="font-size:0.82rem">Completa acciones para desbloquear logros.</p>`}
            </div>

            <!-- Achievements locked -->
            ${lockedAchs.length ? `
            <div class="prf-section">
                <p class="prf-section-label">Por desbloquear</p>
                <div class="prf-ach-grid">
                    ${lockedAchs.map(a => `
                        <div class="prf-ach locked" title="${a.desc}">
                            <span class="prf-ach-icon">${icon('lock', 14, '')}</span>
                            <span class="prf-ach-name">${a.name}</span>
                            <span class="prf-ach-xp text-muted">${a.desc}</span>
                        </div>`).join('')}
                </div>
            </div>` : ''}

            <!-- Account -->
            <div class="prf-section">
                <p class="prf-section-label">Cuenta</p>
                <div class="prf-detail-row">
                    <span class="text-secondary">XP total ganado</span>
                    <strong>${gam.totalXPEarned || xp} XP</strong>
                </div>
                <div class="prf-detail-row">
                    <span class="text-secondary">Acceso</span>
                    <span>${escapeHtml(methodLabel)}</span>
                </div>
            </div>

            <!-- Actions -->
            <div class="prf-section">
                <p class="prf-section-label">Acciones</p>
                <button class="btn btn-ghost prf-action-btn" id="prf-edit-name">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar nombre
                </button>
                <button class="btn btn-ghost prf-action-btn" id="prf-export">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Exportar mis datos
                </button>
                <button class="btn btn-ghost prf-action-btn prf-logout" id="prf-logout">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Cerrar sesión
                </button>
            </div>

        </div>
    `;

    document.getElementById('prf-logout')?.addEventListener('click', () => {
        showModal('Cerrar sesión', '<p style="margin:0">¿Seguro que quieres cerrar sesión?</p>', [
            { id: 'confirm', label: 'Cerrar sesión', type: 'danger', handler: () => auth.logout() },
            { id: 'cancel', label: 'Cancelar', type: 'ghost', handler: () => {} }
        ]);
    });

    document.getElementById('prf-edit-name')?.addEventListener('click', () => {
        const current = settings.userName || user?.name || '';
        showModal('Editar nombre', `
            <div class="form-group">
                <label>Tu nombre</label>
                <input type="text" id="prf-name-input" value="${escapeHtml(current)}" placeholder="Tu nombre" maxlength="50" autofocus>
            </div>
        `, [
            {
                id: 'save', label: 'Guardar', type: 'primary',
                handler: () => {
                    const val = document.getElementById('prf-name-input')?.value.trim();
                    if (val) {
                        store.set('settings.userName', val);
                        const el = document.querySelector('.user-menu .user-name');
                        if (el) el.textContent = val;
                        const av = document.querySelector('.user-menu .user-avatar');
                        if (av && !av.classList.contains('has-image')) av.textContent = val.charAt(0).toUpperCase();
                        showToast('Nombre actualizado');
                        render();
                    }
                }
            },
            { id: 'cancel', label: 'Cancelar', type: 'ghost', handler: () => {} }
        ]);
    });

    document.getElementById('prf-export')?.addEventListener('click', () => {
        const blob = new Blob([store.exportData()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement('a'), {
            href: url,
            download: `cv2-backup-${new Date().toISOString().split('T')[0]}.json`
        });
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup descargado');
    });
}

export function init() {}
export function destroy() {}
