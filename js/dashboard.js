// dashboard.js - Dashboard module
import { store } from './store.js';
import { today, formatDateDisplay, getStreakForHabit, CATEGORIES, QUOTES, showToast, playSound, createConfetti } from './ui.js';

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

    // Get top streaks
    const streaks = activeHabits.map(h => ({
        name: h.name,
        category: h.category,
        streak: getStreakForHabit(h.id, completions)
    })).filter(s => s.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 5);

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
                    <p class="text-secondary">${formatDateDisplay(todayStr)} ${isFreshStart ? '&#10024; Nuevo comienzo - aprovecha el impulso' : ''}</p>
                </div>
            </div>

            <div class="quote-card glass-card">
                <p class="quote-text">${quote}</p>
            </div>

            <div class="dashboard-grid">
                <div class="glass-card score-card">
                    <div class="score-circle">
                        <svg viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--accent-primary)" stroke-width="8"
                                stroke-dasharray="${339.3}" stroke-dashoffset="${339.3 * (1 - lifeScore / 100)}"
                                stroke-linecap="round" transform="rotate(-90 60 60)"/>
                        </svg>
                        <span class="score-number">${lifeScore}</span>
                    </div>
                    <h3>Puntuaci\u00f3n de Vida</h3>
                    <p class="text-secondary">Basado en h\u00e1bitos, tareas y metas</p>
                </div>

                <div class="glass-card">
                    <h3>&#9876; H\u00e1bitos Hoy</h3>
                    <div class="progress-stat">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${activeHabits.length ? (habitsDone / activeHabits.length) * 100 : 0}%"></div>
                        </div>
                        <span class="stat-number">${habitsDone}/${activeHabits.length}</span>
                    </div>
                    <a href="#/habits" class="card-link">Completar h\u00e1bitos &rarr;</a>
                </div>

                <div class="glass-card">
                    <h3>&#9745; Tareas Hoy</h3>
                    <div class="progress-stat">
                        <div class="progress-bar">
                            <div class="progress-fill progress-fill-teal" style="width: ${todayTasks.length ? (completedTasks.length / todayTasks.length) * 100 : 0}%"></div>
                        </div>
                        <span class="stat-number">${completedTasks.length}/${todayTasks.length}</span>
                    </div>
                    <a href="#/planner" class="card-link">Ver planificador &rarr;</a>
                </div>

                <div class="glass-card">
                    <h3>&#127919; Metas Activas</h3>
                    <div class="goals-summary">
                        <span class="big-number">${activeGoals.length}</span>
                        <span class="text-secondary">Progreso promedio: ${Math.round(goalProgress)}%</span>
                    </div>
                    <a href="#/goals" class="card-link">Ver metas &rarr;</a>
                </div>
            </div>

            ${streaks.length ? `
            <div class="glass-card streaks-card">
                <h3>&#128293; Rachas Activas</h3>
                <div class="streaks-list">
                    ${streaks.map(s => `
                        <div class="streak-item">
                            <span class="streak-category" style="color: ${CATEGORIES[s.category]?.color || '#fff'}">${CATEGORIES[s.category]?.icon || ''}</span>
                            <span class="streak-name">${s.name}</span>
                            <span class="streak-count ${s.streak >= 30 ? 'streak-fire' : s.streak >= 7 ? 'streak-hot' : ''}">${s.streak} d\u00edas</span>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            <div class="dashboard-actions">
                <a href="#/habits" class="action-btn glass-card">
                    <span class="action-icon">&#9745;</span>
                    <span>Registrar H\u00e1bito</span>
                </a>
                <a href="#/planner" class="action-btn glass-card">
                    <span class="action-icon">&#9200;</span>
                    <span>Pomodoro</span>
                </a>
                <a href="#/journal" class="action-btn glass-card">
                    <span class="action-icon">&#9997;</span>
                    <span>Escribir Diario</span>
                </a>
                <a href="#/lifewheel" class="action-btn glass-card">
                    <span class="action-icon">&#9678;</span>
                    <span>Rueda de Vida</span>
                </a>
            </div>
        </div>
    `;
}

export function init() {}
export function destroy() {}
