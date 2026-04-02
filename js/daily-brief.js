// daily-brief.js — Morning ritual & Daily Brief module
import { store } from './store.js';
import { today, formatDate, getStreakForHabit, escapeHtml, QUOTES, CATEGORIES } from './ui.js';
import { getLevelInfo, getLevelProgress, getNextLevel } from './gamification.js';

const SEEN_KEY = 'CV2_BRIEF_DATE';

export function wasSeenToday() {
    return localStorage.getItem(SEEN_KEY) === today();
}

export function markSeen() {
    localStorage.setItem(SEEN_KEY, today());
}

export function render() {
    const container = document.getElementById('main-content');
    const habits     = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const tasks      = store.get('planner.tasks') || [];
    const gam        = store.get('gamification') || { xp: 0 };
    const settings   = store.get('settings') || {};
    const todayStr   = today();
    const todayDone  = completions[todayStr] || [];

    const xp       = gam.xp || 0;
    const level    = getLevelInfo(xp);
    const nextLvl  = getNextLevel(xp);
    const xpPct    = getLevelProgress(xp);
    const xpToNext = nextLvl ? nextLvl.min - xp : 0;

    // Top 3 habits by streak (prioritize active streaks — don't break them)
    const habitsWithStreak = habits
        .filter(h => !todayDone.includes(h.id))   // not yet done today
        .map(h => ({ ...h, streak: getStreakForHabit(h.id, completions) }))
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 3);

    // If all done already, show completion state
    const allDoneToday = habits.length > 0 && habits.every(h => todayDone.includes(h.id));

    // Today's MIT (most important task not completed)
    const todayTasks = tasks
        .filter(t => t.date === todayStr && !t.completed)
        .sort((a, b) => (b.urgent && b.important ? 1 : 0) - (a.urgent && a.important ? 1 : 0));
    const mit = todayTasks[0] || null;

    // App streak
    let appStreak = 0;
    const d = new Date();
    while (true) {
        const ds = formatDate(d);
        if ((completions[ds] || []).length > 0) { appStreak++; d.setDate(d.getDate() - 1); }
        else { if (appStreak === 0 && ds === todayStr) { d.setDate(d.getDate() - 1); continue; } break; }
    }

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const name = settings.userName || 'Guerrero';

    // Date display
    const dateOpts = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateDisplay = new Date().toLocaleDateString('es-ES', dateOpts);

    // Random quote
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    container.innerHTML = `
        <div class="brief-page" style="animation:pageEnter 0.35s ease">

            <!-- Header -->
            <div class="brief-header">
                <div class="brief-date">${dateDisplay}</div>
                <h1 class="brief-greeting">${greeting}, ${escapeHtml(name)}</h1>
                <p class="brief-subtitle">Aquí está tu panorama del día</p>
            </div>

            <!-- Level / XP -->
            <div class="glass-card brief-xp-card">
                <div class="brief-xp-left">
                    <span class="brief-level-icon">${level.icon}</span>
                    <div>
                        <div class="brief-level-name">Nivel ${level.level} · ${level.name}</div>
                        <div class="brief-xp-label">${xp} XP${nextLvl ? ` · ${xpToNext} para Nivel ${nextLvl.level}` : ' · Máximo nivel'}</div>
                    </div>
                </div>
                <div class="brief-xp-bar-wrap">
                    <div class="brief-xp-bar">
                        <div class="brief-xp-fill" style="width:${xpPct}%;background:${level.color}"></div>
                    </div>
                    ${appStreak > 0 ? `<div class="brief-app-streak">🔥 ${appStreak} día${appStreak !== 1 ? 's' : ''} activo${appStreak !== 1 ? 's' : ''}</div>` : ''}
                </div>
            </div>

            <!-- Habits prioritarios -->
            <div class="glass-card brief-section">
                <h3 class="brief-section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    ${allDoneToday ? '¡Hábitos completados!' : 'Hábitos prioritarios hoy'}
                </h3>
                ${allDoneToday ? `
                    <div class="brief-all-done">
                        <span>🎉</span>
                        <p>¡Completaste todos tus hábitos de hoy! Tus redes neuronales te lo agradecen.</p>
                    </div>` :
                habitsWithStreak.length > 0 ? `
                    <div class="brief-habits-list">
                        ${habitsWithStreak.map(h => {
                            const catInfo = CATEGORIES[h.category] || {};
                            const streakTxt = h.streak > 0
                                ? `<span class="brief-streak">${h.streak > 0 ? '🔥' : ''} ${h.streak} día${h.streak !== 1 ? 's' : ''} — ¡No la rompas!</span>`
                                : `<span class="brief-streak-new">Nuevo hábito</span>`;
                            return `
                                <div class="brief-habit-row">
                                    <span class="brief-habit-icon" style="color:${catInfo.color || '#6366f1'}">${catInfo.icon || '●'}</span>
                                    <div class="brief-habit-info">
                                        <span class="brief-habit-name">${escapeHtml(h.name)}</span>
                                        ${streakTxt}
                                    </div>
                                    <a href="#/habits" class="brief-habit-go">→</a>
                                </div>`;
                        }).join('')}
                    </div>` :
                habits.length === 0 ? `
                    <p class="text-secondary" style="font-size:0.8125rem">Aún no tienes hábitos. <a href="#/habits" style="color:var(--accent-primary)">Crea tu primer hábito →</a></p>` :
                `<div class="brief-all-done"><span>✅</span><p>¡Todos los hábitos completados hoy!</p></div>`
                }
            </div>

            <!-- MIT (Most Important Task) -->
            <div class="glass-card brief-section">
                <h3 class="brief-section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Tarea más importante hoy
                </h3>
                ${mit ? `
                    <div class="brief-mit">
                        <span class="brief-mit-dot ${mit.urgent && mit.important ? 'critical' : ''}"></span>
                        <span class="brief-mit-text">${escapeHtml(mit.text)}</span>
                        <a href="#/planner" class="brief-habit-go">→</a>
                    </div>` :
                `<p class="text-secondary" style="font-size:0.8125rem">
                    ${tasks.filter(t => t.date === todayStr && t.completed).length > 0 ? '✅ Todas las tareas completadas.' : ''}
                    <a href="#/planner" style="color:var(--accent-primary)">Planifica tu día →</a>
                </p>`}
            </div>

            <!-- Quote -->
            <div class="brief-quote">
                <p class="brief-quote-text">"${escapeHtml(quote)}"</p>
            </div>

            <!-- CTA -->
            <button class="btn brief-cta" id="brief-start-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Empezar el día
            </button>

            <button class="brief-skip" id="brief-skip-btn">Ir al dashboard</button>
        </div>
    `;

    document.getElementById('brief-start-btn')?.addEventListener('click', () => {
        markSeen();
        window.location.hash = '#/habits';
    });

    document.getElementById('brief-skip-btn')?.addEventListener('click', () => {
        markSeen();
        window.location.hash = '#/dashboard';
    });

    // Mark as seen when rendered
    markSeen();
}

export function init() {}
export function destroy() {}
