// profile.js - User profile module with XP/Level/Achievements
import { store } from './store.js';
import { escapeHtml, showToast, showModal, icon } from './ui.js';
import { auth } from './auth.js';
import { getLevelInfo, getNextLevel, getLevelProgress, LEVELS, ACHIEVEMENTS, hasAchievement } from './gamification.js';

export function render() {
    const container = document.getElementById('main-content');
    const user = auth.getCurrentUser();
    const settings = store.get('settings') || {};
    const habits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const goals = (store.get('goals.items') || []).filter((goal) => goal.status === 'active');
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
    const methodLabel = { google: 'Google', phone: 'Telefono', email: 'Email', guest: 'Modo invitado' }[user?.method] || 'Desconocido';
    const memberSince = user?.loggedInAt
        ? new Date(user.loggedInAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
        : '-';

    const unlockedAchs = ACHIEVEMENTS.filter((achievement) => hasAchievement(achievement.id));
    const lockedAchs = ACHIEVEMENTS.filter((achievement) => !hasAchievement(achievement.id));

    container.innerHTML = `
        <div class="profile-page">
            <div class="page-header">
                <h1 class="page-title">Perfil</h1>
            </div>

            <div class="profile-hero glass-card">
                <div class="profile-avatar-lg ${avatarSrc ? 'has-image' : ''}" style="background:linear-gradient(135deg,${level.color},${level.color}99)">
                    ${avatarSrc ? `<img src="${escapeHtml(avatarSrc)}" alt="Avatar de perfil" class="profile-avatar-img">` : escapeHtml(initial)}
                </div>
                <div class="profile-info">
                    <h2 class="profile-name">${escapeHtml(displayName)}</h2>
                    <p class="profile-email text-secondary">${escapeHtml(user?.email || user?.phone || '')}</p>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
                        <span class="profile-method-badge">${escapeHtml(methodLabel)}</span>
                        <span class="level-hero-badge" style="background:${level.color}22;color:${level.color};border:1px solid ${level.color}44">
                            ${level.icon} Niv. ${level.level} - ${level.name}
                        </span>
                    </div>
                </div>
            </div>

            <div class="glass-card xp-card">
                <div class="xp-card-top">
                    <div class="xp-level-circle" style="--level-color:${level.color}">
                        <span class="xp-level-num">${level.level}</span>
                        <span class="xp-level-label">NVL</span>
                    </div>
                    <div class="xp-info">
                        <div class="xp-name">${level.icon} ${level.name}</div>
                        <div class="xp-bar-wrap">
                            <div class="xp-bar">
                                <div class="xp-bar-fill" style="width:${progress}%;background:${level.color}"></div>
                            </div>
                            <span class="xp-bar-label">${xp} XP${nextLvl ? ` - ${xpToNext} para Niv. ${nextLvl.level}` : ' - Maximo nivel'}</span>
                        </div>
                    </div>
                </div>
                <div class="xp-levels-row">
                    ${LEVELS.map((lvl) => `
                        <div class="xp-level-dot ${lvl.level <= level.level ? 'reached' : ''}" title="Niv.${lvl.level}: ${lvl.name}" style="${lvl.level <= level.level ? `background:${lvl.color}` : ''}">
                            ${lvl.level === level.level ? `<span style="font-size:0.55rem;font-weight:700;color:#fff">${lvl.level}</span>` : ''}
                        </div>`).join('')}
                </div>
            </div>

            <div class="profile-stats-row">
                <div class="glass-card profile-stat">
                    <span class="profile-stat-num">${habits.length}</span>
                    <span class="text-secondary">Habitos</span>
                </div>
                <div class="glass-card profile-stat">
                    <span class="profile-stat-num">${goals.length}</span>
                    <span class="text-secondary">Metas</span>
                </div>
                <div class="glass-card profile-stat">
                    <span class="profile-stat-num">${entries.length}</span>
                    <span class="text-secondary">Diario</span>
                </div>
            </div>

            <div class="glass-card profile-section">
                <h3 class="card-heading">Logros desbloqueados <span class="ach-count">${unlockedAchs.length}/${ACHIEVEMENTS.length}</span></h3>
                ${unlockedAchs.length ? `
                <div class="achievements-grid">
                    ${unlockedAchs.map((achievement) => `
                        <div class="achievement-badge unlocked" title="${achievement.desc}">
                            <span class="ach-icon">${achievement.icon}</span>
                            <span class="ach-name">${achievement.name}</span>
                            <span class="ach-xp">+${achievement.xpReward} XP</span>
                        </div>`).join('')}
                </div>` : '<p class="text-secondary" style="font-size:0.8125rem;margin-top:8px">Completa acciones para desbloquear logros.</p>'}
            </div>

            ${lockedAchs.length ? `
            <div class="glass-card profile-section">
                <h3 class="card-heading">Por desbloquear</h3>
                <div class="achievements-grid">
                    ${lockedAchs.map((achievement) => `
                        <div class="achievement-badge locked" title="${achievement.desc}">
                            <span class="ach-icon">${icon('lock', 14, 'ui-icon')}</span>
                            <span class="ach-name">${achievement.name}</span>
                            <span class="ach-desc">${achievement.desc}</span>
                        </div>`).join('')}
                </div>
            </div>` : ''}

            <div class="glass-card profile-section">
                <h3 class="card-heading">Cuenta</h3>
                <div class="profile-detail-row">
                    <span class="text-secondary">XP total ganado</span>
                    <strong>${gam.totalXPEarned || xp} XP</strong>
                </div>
                <div class="profile-detail-row">
                    <span class="text-secondary">Metodo de acceso</span>
                    <span>${escapeHtml(methodLabel)}</span>
                </div>
                <div class="profile-detail-row">
                    <span class="text-secondary">Sesion iniciada</span>
                    <span>${escapeHtml(memberSince)}</span>
                </div>
            </div>

            <div class="glass-card profile-section">
                <h3 class="card-heading">Acciones</h3>
                <button class="btn btn-ghost profile-action-btn" id="profile-edit-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Editar nombre
                </button>
                <button class="btn btn-ghost profile-action-btn" id="profile-export-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar mis datos
                </button>
            </div>

            <button class="btn-logout-full" id="profile-logout-btn">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Cerrar sesion
            </button>
        </div>
    `;

    document.getElementById('profile-logout-btn')?.addEventListener('click', () => {
        showModal('Cerrar sesion', '<p style="margin:0">Seguro que quieres cerrar sesion?</p>', [
            { id: 'confirm', label: 'Cerrar sesion', type: 'danger', handler: () => auth.logout() },
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
                id: 'save',
                label: 'Guardar',
                type: 'primary',
                handler: () => {
                    const val = document.getElementById('profile-name-input')?.value.trim();
                    if (val) {
                        store.set('settings.userName', val);
                        const sidebarName = document.querySelector('.user-menu .user-name');
                        if (sidebarName) sidebarName.textContent = val;
                        const sidebarAvatar = document.querySelector('.user-menu .user-avatar');
                        if (sidebarAvatar && !sidebarAvatar.classList.contains('has-image')) {
                            sidebarAvatar.textContent = val.charAt(0).toUpperCase();
                        }
                        showToast('Nombre actualizado');
                        render();
                    }
                }
            },
            { id: 'cancel', label: 'Cancelar', type: 'ghost', handler: () => {} }
        ]);
    });

    document.getElementById('profile-export-btn')?.addEventListener('click', () => {
        const blob = new Blob([store.exportData()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = Object.assign(document.createElement('a'), {
            href: url,
            download: `cv2-backup-${new Date().toISOString().split('T')[0]}.json`
        });
        anchor.click();
        URL.revokeObjectURL(url);
        showToast('Backup descargado');
    });
}

export function init() {}
export function destroy() {}
