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
    const habits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const entries = store.get('journal.entries') || [];

    const todayDone = completions[todayStr] || [];
    const habitsDone = habits.filter((habit) => todayDone.includes(habit.id)).length;
    const habitsPct = habits.length ? Math.round((habitsDone / habits.length) * 100) : 0;

    const todayTasks = tasks.filter((task) => task.date === todayStr);
    const tasksDone = todayTasks.filter((task) => task.completed).length;
    const tasksPct = todayTasks.length ? Math.round((tasksDone / todayTasks.length) * 100) : 0;

    const existingEntry = entries.find((entry) => entry.date === todayStr);
    const topStreaks = habits
        .map((habit) => ({ name: habit.name, streak: _calcStreak(habit.id, completions) }))
        .filter((entry) => entry.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 2);

    container.innerHTML = `
        <div class="evening-page">
            <div class="evening-header">
                <div class="evening-moon">${icon('moon', 28, 'moon-icon')}</div>
                <h1 class="evening-title">Reflexion Nocturna</h1>
                <p class="evening-subtitle">2 minutos para cerrar el dia con intencion</p>
            </div>

            <div class="glass-card evening-summary">
                <h3 class="card-heading" style="margin-bottom:14px">Tu dia de hoy</h3>
                <div class="evening-stats">
                    <div class="evening-stat">
                        <div class="evening-stat-circle" style="--pct:${habitsPct}">
                            <svg viewBox="0 0 36 36" class="evening-circle-svg">
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-tertiary)" stroke-width="3"></circle>
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent-primary)" stroke-width="3"
                                    stroke-dasharray="${Math.round(habitsPct)} ${100 - Math.round(habitsPct)}"
                                    stroke-linecap="round" transform="rotate(-90 18 18)"></circle>
                            </svg>
                            <span>${habitsPct}%</span>
                        </div>
                        <p class="evening-stat-label">Habitos<br><strong>${habitsDone}/${habits.length}</strong></p>
                    </div>
                    <div class="evening-stat">
                        <div class="evening-stat-circle" style="--pct:${tasksPct}">
                            <svg viewBox="0 0 36 36" class="evening-circle-svg">
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-tertiary)" stroke-width="3"></circle>
                                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#0a8f6a" stroke-width="3"
                                    stroke-dasharray="${Math.round(tasksPct)} ${100 - Math.round(tasksPct)}"
                                    stroke-linecap="round" transform="rotate(-90 18 18)"></circle>
                            </svg>
                            <span>${tasksPct}%</span>
                        </div>
                        <p class="evening-stat-label">Tareas<br><strong>${tasksDone}/${todayTasks.length}</strong></p>
                    </div>
                    ${topStreaks.length ? `
                    <div class="evening-streak-highlight">
                        ${topStreaks.map((entry) => `
                            <div class="evening-streak-row">
                                <span class="evening-streak-flame">${icon('flame', 13, 'streak-icon')}</span>
                                <div>
                                    <span class="evening-streak-name">${escapeHtml(entry.name)}</span>
                                    <span class="evening-streak-days">${entry.streak} dias</span>
                                </div>
                            </div>`).join('')}
                    </div>` : ''}
                </div>

                ${habitsPct === 100 ? `<p class="evening-perfect">${icon('check', 13, 'streak-icon')} Dia completo. Todos los habitos fueron completados.</p>` : ''}
            </div>

            <form class="glass-card evening-form" id="evening-form">
                <h3 class="card-heading" style="margin-bottom:16px">3 preguntas rapidas</h3>

                <div class="evening-question">
                    <label class="evening-q-label">
                        <span class="evening-q-num">01</span>
                        Que salio bien hoy?
                    </label>
                    <textarea class="evening-textarea" id="ev-went-well" rows="2"
                        placeholder="Algo pequeno o grande... todo cuenta"
                        maxlength="300">${existingEntry?.eveningReflection?.wentWell || ''}</textarea>
                </div>

                <div class="evening-question">
                    <label class="evening-q-label">
                        <span class="evening-q-num">02</span>
                        Que harias diferente manana?
                    </label>
                    <textarea class="evening-textarea" id="ev-improve" rows="2"
                        placeholder="Una sola cosa que cambiarias"
                        maxlength="300">${existingEntry?.eveningReflection?.improve || ''}</textarea>
                </div>

                <div class="evening-question">
                    <label class="evening-q-label">
                        <span class="evening-q-num">03</span>
                        Como fue tu energia hoy?
                    </label>
                    <div class="energy-meter" id="energy-meter">
                        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => `
                            <button type="button" class="energy-dot ${existingEntry?.eveningReflection?.energy === val ? 'active' : ''}"
                                data-val="${val}" title="${val}">${val}</button>`).join('')}
                    </div>
                    <div class="energy-labels">
                        <span>Sin energia</span>
                        <span>Maxima energia</span>
                    </div>
                </div>

                <input type="hidden" id="ev-energy-val" value="${existingEntry?.eveningReflection?.energy || ''}">

                <button type="submit" class="btn brief-cta" style="margin-top:8px">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Cerrar el dia
                </button>
            </form>

            <button class="brief-skip" id="ev-skip-btn">Omitir por hoy</button>
        </div>
    `;

    let selectedEnergy = existingEntry?.eveningReflection?.energy || 0;
    document.querySelectorAll('.energy-dot').forEach((btn) => {
        btn.addEventListener('click', () => {
            selectedEnergy = parseInt(btn.dataset.val, 10);
            document.getElementById('ev-energy-val').value = selectedEnergy;
            document.querySelectorAll('.energy-dot').forEach((dot) => {
                dot.classList.toggle('active', parseInt(dot.dataset.val, 10) <= selectedEnergy);
            });
        });
    });

    document.getElementById('evening-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const wentWell = document.getElementById('ev-went-well')?.value.trim();
        const improve = document.getElementById('ev-improve')?.value.trim();
        const energy = selectedEnergy || parseInt(document.getElementById('ev-energy-val')?.value, 10) || 0;

        const reflection = { wentWell, improve, energy, savedAt: new Date().toISOString() };
        const allEntries = store.get('journal.entries') || [];
        const idx = allEntries.findIndex((entry) => entry.date === todayStr);
        if (idx >= 0) {
            allEntries[idx].eveningReflection = reflection;
            allEntries[idx].updatedAt = new Date().toISOString();
        } else {
            allEntries.push({ date: todayStr, eveningReflection: reflection, createdAt: new Date().toISOString() });
        }
        store.set('journal.entries', allEntries);

        markSeen();
        addXP(20);
        checkAchievements();
        playSound('complete');
        _showCongrats(habitsPct);
    });

    document.getElementById('ev-skip-btn')?.addEventListener('click', () => {
        markSeen();
        window.location.hash = '#/dashboard';
    });
}

function _showCongrats(habitsPct) {
    const message = habitsPct === 100
        ? 'Dia perfecto. Manana, a repetirlo.'
        : habitsPct >= 75
            ? 'Buen cierre de jornada. Cada accion cuenta.'
            : 'Manana es una nueva oportunidad. Descansa bien.';

    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `
        <div class="levelup-card">
            <div class="levelup-icon">${icon('moon', 30, 'moon-icon')}</div>
            <p class="levelup-sub">Reflexion guardada - +20 XP</p>
            <h2 class="levelup-title" style="font-size:1.5rem">Dia cerrado</h2>
            <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:20px">${message}</p>
            <button class="btn btn-primary levelup-close" style="width:100%"
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
        const dateStr = d.toISOString().split('T')[0];
        if ((completions[dateStr] || []).includes(habitId)) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            if (streak === 0 && dateStr === todayStr) {
                d.setDate(d.getDate() - 1);
                continue;
            }
            break;
        }
    }
    return streak;
}

export function init() {}
export function destroy() {}
