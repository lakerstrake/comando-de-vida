// evening-reflection.js - Quick end-of-day check-in
import { store } from './store.js';
import { today, escapeHtml, playSound, icon } from './ui.js';
import { addXP, checkAchievements } from './gamification.js';

const SEEN_KEY = 'CV2_EVENING_DATE';

export function wasSeenToday() {
    return localStorage.getItem(SEEN_KEY) === today();
}

function markSeen() {
    localStorage.setItem(SEEN_KEY, today());
}

export function shouldShow() {
    return new Date().getHours() >= 20 && !wasSeenToday();
}

export function render() {
    const container = document.getElementById('main-content');
    const todayStr = today();
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const entries = store.get('journal.entries') || [];

    const todayDone = completions[todayStr] || [];
    const habitsDone = habits.filter(h => todayDone.includes(h.id)).length;
    const habitsPct = habits.length ? Math.round((habitsDone / habits.length) * 100) : 0;
    const todayTasks = tasks.filter(t => t.date === todayStr);
    const tasksDone = todayTasks.filter(t => t.completed).length;
    const existing = entries.find(e => e.date === todayStr);

    const topStreaks = habits
        .map(h => ({ name: h.name, streak: _calcStreak(h.id, completions) }))
        .filter(e => e.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 2);

    container.innerHTML = `
        <div class="ev-page">
            <div class="ev-header">
                <div class="ev-moon">${icon('moon', 26, 'moon-icon')}</div>
                <h1>Reflexión Nocturna</h1>
                <p class="text-secondary">2 minutos para cerrar el día con intención</p>
            </div>

            <!-- Day summary -->
            <div class="ev-block">
                <p class="ev-block-label">Tu día</p>
                <div class="ev-stats-row">
                    <div class="ev-stat">
                        <div class="ev-stat-circle">
                            <svg viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-tertiary)" stroke-width="3"/>
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent-primary)" stroke-width="3"
                                    stroke-dasharray="${habitsPct} ${100 - habitsPct}" stroke-linecap="round" transform="rotate(-90 18 18)"/>
                            </svg>
                            <span>${habitsPct}%</span>
                        </div>
                        <p class="ev-stat-label">Hábitos<br><strong>${habitsDone}/${habits.length}</strong></p>
                    </div>
                    ${todayTasks.length ? `
                    <div class="ev-stat">
                        <div class="ev-stat-circle">
                            <svg viewBox="0 0 36 36">
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-tertiary)" stroke-width="3"/>
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" stroke-width="3"
                                    stroke-dasharray="${todayTasks.length ? Math.round(tasksDone/todayTasks.length*100) : 0} ${100 - (todayTasks.length ? Math.round(tasksDone/todayTasks.length*100) : 0)}" stroke-linecap="round" transform="rotate(-90 18 18)"/>
                            </svg>
                            <span>${todayTasks.length ? Math.round(tasksDone/todayTasks.length*100) : 0}%</span>
                        </div>
                        <p class="ev-stat-label">Tareas<br><strong>${tasksDone}/${todayTasks.length}</strong></p>
                    </div>` : ''}
                    ${topStreaks.length ? `
                    <div class="ev-streaks">
                        ${topStreaks.map(s => `
                            <div class="ev-streak-row">
                                ${icon('flame', 12, 'streak-icon')}
                                <span>${escapeHtml(s.name)}</span>
                                <strong>${s.streak}d</strong>
                            </div>`).join('')}
                    </div>` : ''}
                </div>
                ${habitsPct === 100 ? `<p class="ev-perfect">${icon('check', 12, '')} Día completo. Todos los hábitos completados.</p>` : ''}
            </div>

            <!-- Questions -->
            <form id="ev-form">
                <div class="ev-block">
                    <p class="ev-block-label"><span class="ev-num">01</span> ¿Qué salió bien hoy?</p>
                    <textarea id="ev-well" rows="2" placeholder="Algo pequeño o grande... todo cuenta" maxlength="300">${existing?.eveningReflection?.wentWell || ''}</textarea>
                </div>

                <div class="ev-block">
                    <p class="ev-block-label"><span class="ev-num">02</span> ¿Qué harías diferente mañana?</p>
                    <textarea id="ev-improve" rows="2" placeholder="Una sola cosa que cambiarías" maxlength="300">${existing?.eveningReflection?.improve || ''}</textarea>
                </div>

                <div class="ev-block">
                    <p class="ev-block-label"><span class="ev-num">03</span> ¿Cómo fue tu energía hoy?</p>
                    <div class="ev-energy-row" id="ev-energy-row">
                        ${[1,2,3,4,5,6,7,8,9,10].map(v => `
                            <button type="button" class="ev-energy-dot ${(existing?.eveningReflection?.energy || 0) >= v ? 'active' : ''}" data-val="${v}">${v}</button>`).join('')}
                    </div>
                    <div class="ev-energy-labels">
                        <span class="text-muted">Sin energía</span>
                        <span class="text-muted">Máxima energía</span>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-block">Cerrar el día</button>
            </form>

            <button class="btn btn-ghost btn-block ev-skip" id="ev-skip">Omitir por hoy</button>
        </div>
    `;

    let selectedEnergy = existing?.eveningReflection?.energy || 0;
    document.querySelectorAll('.ev-energy-dot').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedEnergy = parseInt(btn.dataset.val, 10);
            document.querySelectorAll('.ev-energy-dot').forEach(d => {
                d.classList.toggle('active', parseInt(d.dataset.val, 10) <= selectedEnergy);
            });
        });
    });

    document.getElementById('ev-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const reflection = {
            wentWell: document.getElementById('ev-well').value.trim(),
            improve: document.getElementById('ev-improve').value.trim(),
            energy: selectedEnergy,
            savedAt: new Date().toISOString()
        };
        const all = store.get('journal.entries') || [];
        const idx = all.findIndex(e => e.date === todayStr);
        if (idx >= 0) { all[idx].eveningReflection = reflection; all[idx].updatedAt = new Date().toISOString(); }
        else all.push({ date: todayStr, eveningReflection: reflection, createdAt: new Date().toISOString() });
        store.set('journal.entries', all);
        markSeen();
        addXP(20);
        checkAchievements();
        playSound('complete');
        _showCongrats(habitsPct);
    });

    document.getElementById('ev-skip')?.addEventListener('click', () => {
        markSeen();
        window.location.hash = '#/dashboard';
    });
}

function _showCongrats(habitsPct) {
    const msg = habitsPct === 100 ? 'Día perfecto. Mañana, a repetirlo.'
        : habitsPct >= 75 ? 'Buen cierre de jornada. Cada acción cuenta.'
        : 'Mañana es una nueva oportunidad. Descansa bien.';
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `
        <div class="levelup-card">
            <div class="levelup-icon">${icon('moon', 28, 'moon-icon')}</div>
            <p class="levelup-sub">Reflexión guardada — +20 XP</p>
            <h2 class="levelup-title">Día cerrado</h2>
            <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:20px">${msg}</p>
            <button class="btn btn-primary" style="width:100%"
                onclick="this.closest('.levelup-overlay').remove();window.location.hash='#/dashboard'">
                Ir al dashboard
            </button>
        </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('show'), 50);
}

function _calcStreak(habitId, completions) {
    let streak = 0;
    const d = new Date();
    const todayStr = today();
    while (true) {
        const ds = d.toISOString().split('T')[0];
        if ((completions[ds] || []).includes(habitId)) {
            streak++; d.setDate(d.getDate() - 1);
        } else {
            if (streak === 0 && ds === todayStr) { d.setDate(d.getDate() - 1); continue; }
            break;
        }
    }
    return streak;
}

export function init() {}
export function destroy() {}
