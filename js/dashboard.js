// dashboard.js - Dashboard module
import { store } from './store.js';
import { today, formatDateDisplay, getStreakForHabit, getBestStreakForHabit, getAppStreak, streakLevel, CATEGORIES, QUOTES, icon } from './ui.js';
import { getLevelInfo, getLevelProgress, getNextLevel } from './gamification.js';

export function render() {
    const container = document.getElementById('main-content');
    const userName = store.get('settings.userName') || 'Usuario';
    const habits = store.get('habits.items') || [];
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const todayStr = today();
    const todayTasks = tasks.filter((task) => task.date === todayStr);
    const completedTasks = todayTasks.filter((task) => task.completed);
    const todayCompletions = completions[todayStr] || [];
    const activeHabits = habits.filter((habit) => !habit.archived);
    const habitsDone = activeHabits.filter((habit) => todayCompletions.includes(habit.id)).length;
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    const habitRate = activeHabits.length ? (habitsDone / activeHabits.length) * 100 : 0;
    const taskRate = todayTasks.length ? (completedTasks.length / todayTasks.length) * 100 : 0;
    const goals = store.get('goals.items') || [];
    const activeGoals = goals.filter((goal) => goal.status === 'active');
    const goalProgress = activeGoals.length ? activeGoals.reduce((sum, goal) => sum + goal.progress, 0) / activeGoals.length : 0;
    const lifeScore = Math.round(habitRate * 0.4 + taskRate * 0.3 + goalProgress * 0.3);

    const streakRecords = store.get('stats.streakRecords') || {};
    const streaks = activeHabits
        .map((habit) => ({
            id: habit.id,
            name: habit.name,
            category: habit.category,
            streak: getStreakForHabit(habit.id, completions),
            best: Math.max(getBestStreakForHabit(habit.id, completions), streakRecords[habit.id] || 0)
        }))
        .filter((entry) => entry.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 5);

    const appStreak = getAppStreak(completions);
    const gam = store.get('gamification') || { xp: 0 };
    const xp = gam.xp || 0;
    const level = getLevelInfo(xp);
    const nextLvl = getNextLevel(xp);
    const xpPct = getLevelProgress(xp);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos dias' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const dayOfWeek = new Date().getDay();
    const dayOfMonth = new Date().getDate();
    const isFreshStart = dayOfWeek === 1 || dayOfMonth === 1;

    container.innerHTML = `
        <div class="dashboard">
            <div class="dashboard-header">
                <div>
                    <h1>${greeting}, ${userName}</h1>
                    <p class="text-secondary">${formatDateDisplay(todayStr)}${isFreshStart ? ' - Nuevo ciclo, nueva oportunidad' : ''}</p>
                </div>
                <a href="#/profile" class="dash-level-badge" title="Ver perfil y logros">
                    <span class="dash-level-icon">${level.icon}</span>
                    <div class="dash-level-info">
                        <span class="dash-level-name">Niv.${level.level} - ${level.name}</span>
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
                            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg-tertiary)" stroke-width="8"></circle>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent-primary)" stroke-width="8"
                                stroke-dasharray="339.3" stroke-dashoffset="${339.3 * (1 - lifeScore / 100)}"
                                stroke-linecap="round" transform="rotate(-90 60 60)"></circle>
                        </svg>
                        <span class="score-number">${lifeScore}</span>
                    </div>
                    <div class="score-info">
                        <h3 class="card-heading">Puntuacion de Vida</h3>
                        <p class="text-secondary">Basado en habitos, tareas y metas</p>
                    </div>
                </div>

                <div class="glass-card">
                    <h3 class="card-heading">Habitos Hoy</h3>
                    <div class="progress-stat">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${activeHabits.length ? (habitsDone / activeHabits.length) * 100 : 0}%"></div>
                        </div>
                        <span class="stat-number">${habitsDone}/${activeHabits.length}</span>
                    </div>
                    <a href="#/habits" class="card-link">Ver habitos ${icon('arrowRight', 13, 'inline-arrow-icon')}</a>
                </div>

                <div class="glass-card">
                    <h3 class="card-heading">Tareas Hoy</h3>
                    <div class="progress-stat">
                        <div class="progress-bar">
                            <div class="progress-fill progress-fill-teal" style="width:${todayTasks.length ? (completedTasks.length / todayTasks.length) * 100 : 0}%"></div>
                        </div>
                        <span class="stat-number">${completedTasks.length}/${todayTasks.length}</span>
                    </div>
                    <a href="#/planner" class="card-link">Ver planificador ${icon('arrowRight', 13, 'inline-arrow-icon')}</a>
                </div>

                <div class="glass-card">
                    <h3 class="card-heading">Metas Activas</h3>
                    <div class="goals-summary">
                        <span class="big-number">${activeGoals.length}</span>
                        <span class="text-secondary">Progreso promedio: ${Math.round(goalProgress)}%</span>
                    </div>
                    <a href="#/goals" class="card-link">Ver metas ${icon('arrowRight', 13, 'inline-arrow-icon')}</a>
                </div>
            </div>

            <div class="glass-card streaks-card">
                <div class="streaks-header">
                    <h3 class="card-heading">Rachas</h3>
                    ${appStreak > 0 ? `
                    <div class="app-streak-badge">
                        ${icon('flame', 13, 'streak-icon')}
                        <span>${appStreak} dia${appStreak !== 1 ? 's' : ''} activo${appStreak !== 1 ? 's' : ''}</span>
                    </div>` : ''}
                </div>
                ${streaks.length ? `
                <div class="streaks-list">
                    ${streaks.map((entry) => {
                        const lvl = streakLevel(entry.streak);
                        const streakIcon = entry.streak >= 66 ? icon('shield', 12, 'streak-icon') : icon('flame', 12, 'streak-icon');
                        return `
                        <div class="streak-item">
                            <span class="streak-category" style="color:${CATEGORIES[entry.category]?.color || '#4b91ff'}">${CATEGORIES[entry.category]?.icon || ''}</span>
                            <span class="streak-name">${entry.name}</span>
                            <div class="streak-right">
                                <span class="streak-pill streak-${lvl}" style="display:inline-flex">
                                    ${streakIcon}
                                    <span class="streak-num">${entry.streak}</span>
                                </span>
                                ${entry.best > entry.streak ? `<span class="streak-best-label">rec. ${entry.best}</span>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>` : `
                <p class="text-secondary" style="font-size:0.8125rem;margin-top:8px">Completa habitos para construir rachas.</p>`}
                <a href="#/habits" class="card-link" style="margin-top:12px;display:inline-flex;align-items:center;gap:6px">
                    Ver habitos ${icon('arrowRight', 13, 'inline-arrow-icon')}
                </a>
            </div>

            <div class="dashboard-actions">
                <a href="#/habits" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </span>
                    <span>Habitos</span>
                </a>
                <a href="#/planner" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </span>
                    <span>Pomodoro</span>
                </a>
                <a href="#/journal" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                        </svg>
                    </span>
                    <span>Diario</span>
                </a>
                <a href="#/lifewheel" class="action-btn glass-card">
                    <span class="action-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path>
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
