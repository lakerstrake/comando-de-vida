// dashboard.js - Dashboard module
import { store } from './store.js';
import { today, formatDateDisplay, getStreakForHabit, getBestStreakForHabit, getAppStreak, streakLevel, CATEGORIES, QUOTES } from './ui.js';
import { getLevelInfo, getLevelProgress, getNextLevel } from './gamification.js';

export function render() {
    const container = document.getElementById('main-content');
    const userName = store.get('settings.userName') || 'Guerrero';
    const habits = store.get('habits.items') || [];
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const todayStr = today();
    const todayTasks = tasks.filter(t => t.date === todayStr);
    const completedTasks = todayTasks.filter(t => t.completed);
    const todayCompletions = completions[todayStr] || [];
    const activeHabits = habits.filter(h => !h.archived);
    const habitsDone = activeHabits.filter(h => todayCompletions.includes(h.id)).length;
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    // Compute life score
    const habitRate = activeHabits.length ? (habitsDone / activeHabits.length) * 100 : 0;
    const taskRate = todayTasks.length ? (completedTasks.length / todayTasks.length) * 100 : 0;
    const goals = store.get('goals.items') || [];
    const activeGoals = goals.filter(g => g.status === 'active');
    const goalProgress = activeGoals.length ? activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length : 0;
    const lifeScore = Math.round(habitRate * 0.4 + taskRate * 0.3 + goalProgress * 0.3);

    // Get top streaks with records
    const streakRecords = store.get('stats.streakRecords') || {};
    const streaks = activeHabits.map(h => ({
        id: h.id,
        name: h.name,
        category: h.category,
        streak: getStreakForHabit(h.id, completions),
        best: Math.max(getBestStreakForHabit(h.id, completions), streakRecords[h.id] || 0)
    })).filter(s => s.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 5);

    const appStreak = getAppStreak(completions);

    // XP / Level
    const gam      = store.get('gamification') || { xp: 0 };
    const xp       = gam.xp || 0;
    const level    = getLevelInfo(xp);
    const nextLvl  = getNextLevel(xp);
    const xpPct    = getLevelProgress(xp);

    // Time-based greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos d\u00edas' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

    // Check fresh start
    const dayOfWeek = new Date().getDay();
    const dayOfMonth = new Date().getDate();
    const isFreshStart = dayOfWeek === 1 || dayOfMonth === 1;

    container.innerHTML = `
        <div class="dashboard">
            <div class="dashboard-header">
                <div>
                    <h1>${greeting}, ${userName}</h1>
                    <p class="text-secondary">${formatDateDisplay(todayStr)}${isFreshStart ? ' &mdash; Nuevo ciclo, nueva oportunidad' : ''}</p>
                </div>
                <a href="#/profile" class="dash-level-badge" title="Ver perfil y logros">
                    <span class="dash-level-icon">${level.icon}</span>
                    <div class="dash-level-info">
                        <span class="dash-level-name">Niv.${level.level} · ${level.name}</span>
                        <div class="dash-xp-bar">
                            <div class="dash-xp-fill" style="width:${xpPct}%;background:${level.color}"></div>
                        </div>
                    </div>
                </a>
            </div>

            <div class="quote-card glass-card">
                <p class="quote-text">${quote}</p>
            </div>

            <div class="dashboard-grid">
                <div class="glass-card score-card">
                    <div class="score-circle">
                        <svg viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg-tertiary)" stroke-width="8"/>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent-primary)" stroke-width="8"
                                stroke-dasharray="${339.3}" stroke-dashoffset="${339.3 * (1 - lifeScore / 100)}"
                                stroke-linecap="round" transform="rotate(-90 60 60)"/>
                        </svg>
                        <span class="score-number">${lifeScore}</span>
                    </div>
                    <h3 class="card-heading">Puntuaci\u00f3n de Vida</h3>
                    <p class="text-secondary">Basado en h\u00e1bitos, tareas y metas</p>
                </div>

                <div class="glass-card">
                    <h3 class="card-heading">H\u00e1bitos Hoy</h3>
                    <div class="progress-stat">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${activeHabits.length ? (habitsDone / activeHabits.length) * 100 : 0}%"></div>
                        </div>
                        <span class="stat-number">${habitsDone}/${activeHabits.length}</span>
                    </div>
                    <a href="#/habits" class="card-link">Ver h\u00e1bitos &rarr;</a>
                </div>

                <div class="glass-card">
                    <h3 class="card-heading">Tareas Hoy</h3>
                    <div class="progress-stat">
                        <div class="progress-bar">
                            <div class="progress-fill progress-fill-teal" style="width: ${todayTasks.length ? (completedTasks.length / todayTasks.length) * 100 : 0}%"></div>
                        </div>
                        <span class="stat-number">${completedTasks.length}/${todayTasks.length}</span>
                    </div>
                    <a href="#/planner" class="card-link">Ver planificador &rarr;</a>
                </div>

                <div class="glass-card">
                    <h3 class="card-heading">Metas Activas</h3>
                    <div class="goals-summary">
                        <span class="big-number">${activeGoals.length}</span>
                        <span class="text-secondary">Progreso promedio: ${Math.round(goalProgress)}%</span>
                    </div>
                    <a href="#/goals" class="card-link">Ver metas &rarr;</a>
                </div>
            </div>

            <div class="glass-card streaks-card">
                <div class="streaks-header">
                    <h3 class="card-heading">Rachas</h3>
                    ${appStreak > 0 ? `
                    <div class="app-streak-badge">
                        <span>🔥</span>
                        <span>${appStreak} día${appStreak !== 1 ? 's' : ''} activo${appStreak !== 1 ? 's' : ''}</span>
                    </div>` : ''}
                </div>
                ${streaks.length ? `
                <div class="streaks-list">
                    ${streaks.map(s => {
                        const lvl = streakLevel(s.streak);
                        const flame = s.streak >= 66 ? '💜' : s.streak >= 30 ? '🔥' : s.streak >= 7 ? '🔥' : '🔥';
                        return `
                        <div class="streak-item">
                            <span class="streak-category" style="color:${CATEGORIES[s.category]?.color || '#6366f1'}">${CATEGORIES[s.category]?.icon || ''}</span>
                            <span class="streak-name">${s.name}</span>
                            <div class="streak-right">
                                <span class="streak-pill streak-${lvl}" style="display:inline-flex">
                                    <span>${flame}</span>
                                    <span class="streak-num">${s.streak}</span>
                                </span>
                                ${s.best > s.streak ? `<span class="streak-best-label">rec. ${s.best}</span>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>` : `
                <p class="text-secondary" style="font-size:0.8125rem;margin-top:8px">Completa hábitos para construir rachas.</p>`}
                <a href="#/habits" class="card-link" style="margin-top:12px;display:inline-block">Ver hábitos →</a>
            </div>

            <div class="dashboard-actions">
                <a href="#/habits" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    </span>
                    <span>H\u00e1bitos</span>
                </a>
                <a href="#/planner" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                    </span>
                    <span>Pomodoro</span>
                </a>
                <a href="#/journal" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                    </span>
                    <span>Diario</span>
                </a>
                <a href="#/lifewheel" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>
                        </svg>
                    </span>
                    <span>Rueda de Vida</span>
                </a>
            </div>
        </div>
    `;
}

export function init() {}
export function destroy() {}
