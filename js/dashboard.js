// dashboard.js - Clean, minimal, action-focused dashboard
import { store } from './store.js';
import { today, formatDate, formatDateDisplay, getStreakForHabit, getBestStreakForHabit, getAppStreak, CATEGORIES, QUOTES, icon, showToast, playSound, animateReward, createConfetti } from './ui.js';
import { getLevelInfo, getLevelProgress, getNextLevel, addXP, checkAchievements, XP } from './gamification.js';

export function render() {
    const container = document.getElementById('main-content');
    const todayStr = today();
    const userName = store.get('settings.userName') || 'Tú';
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const todayDone = completions[todayStr] || [];
    const tasks = store.get('planner.tasks') || [];
    const todayTasks = tasks.filter(t => t.date === todayStr);
    const gam = store.get('gamification') || { xp: 0 };
    const xp = gam.xp || 0;
    const level = getLevelInfo(xp);
    const xpPct = getLevelProgress(xp);
    const nextLvl = getNextLevel(xp);
    const appStreak = getAppStreak(completions);

    const pendingHabits = habits.filter(h => !todayDone.includes(h.id));
    const doneHabits = habits.filter(h => todayDone.includes(h.id));
    const habitPct = habits.length ? Math.round((doneHabits.length / habits.length) * 100) : 0;
    const allDone = habits.length > 0 && pendingHabits.length === 0;

    // Top habits to show: pending sorted by streak desc, then done ones
    const pendingSorted = pendingHabits
        .map(h => ({ ...h, streak: getStreakForHabit(h.id, completions) }))
        .sort((a, b) => b.streak - a.streak);
    const habitDisplay = [...pendingSorted, ...doneHabits.map(h => ({ ...h, streak: getStreakForHabit(h.id, completions) }))].slice(0, 5);

    // MIT — most important pending task
    const mit = todayTasks.filter(t => !t.completed).sort((a, b) =>
        ((b.urgent && b.important) ? 2 : b.important ? 1 : 0) - ((a.urgent && a.important) ? 2 : a.important ? 1 : 0)
    )[0] || null;

    // Mood today
    const journalEntries = store.get('journal.entries') || [];
    const todayEntry = journalEntries.find(e => e.date === todayStr);
    const todayMood = todayEntry?.mood || 0;

    const hour = new Date().getHours();
    const greeting = hour < 6 ? 'Buenas noches' : hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const quote = QUOTES[new Date().getDate() % QUOTES.length];

    // One key insight
    const insight = getTopInsight(habits, completions, todayDone);

    container.innerHTML = `
        <div class="dash-clean">

            <!-- Header -->
            <div class="dash-header-clean">
                <div class="dash-greeting-wrap">
                    <h1 class="dash-greeting">${greeting}, ${userName}</h1>
                    <p class="dash-date text-secondary">${formatDateDisplay(todayStr)}</p>
                </div>
                <div class="dash-top-right">
                    ${appStreak > 0 ? `
                    <div class="dash-streak-chip">
                        ${icon('flame', 13, 'streak-icon')}
                        <span>${appStreak}d</span>
                    </div>` : ''}
                    <a href="#/profile" class="dash-level-chip" title="Ver perfil">
                        <span style="font-size:1rem">${level.icon}</span>
                        <div class="dash-level-chip-bar" style="--fill:${xpPct}%;--color:${level.color}"></div>
                    </a>
                </div>
            </div>

            <!-- Habits section -->
            <div class="dash-section">
                <div class="dash-section-header">
                    <span class="dash-section-title">Hábitos de hoy</span>
                    <span class="dash-section-meta ${allDone ? 'text-success' : ''}">${doneHabits.length}/${habits.length}</span>
                </div>

                ${habits.length === 0 ? `
                <div class="dash-empty-habits">
                    <p>Crea tu primer hábito para empezar</p>
                    <a href="#/habits" class="btn btn-primary btn-sm">+ Nuevo hábito</a>
                </div>` : `

                <div class="dash-habit-progress">
                    <div class="dash-habit-bar">
                        <div class="dash-habit-bar-fill ${allDone ? 'all-done' : ''}" style="width:${habitPct}%"></div>
                    </div>
                    ${allDone ? `<span class="dash-all-done-label">✓ Completados</span>` : ''}
                </div>

                <div class="dash-habits-list" id="dash-habits-list">
                    ${habitDisplay.map(h => _habitRow(h, todayDone)).join('')}
                </div>

                ${habits.length > 5 ? `
                <a href="#/habits" class="dash-see-all">Ver todos los hábitos (${habits.length}) ${icon('arrowRight', 12, 'inline-arrow-icon')}</a>
                ` : `<a href="#/habits" class="dash-see-all">Gestionar hábitos ${icon('arrowRight', 12, 'inline-arrow-icon')}</a>`}
                `}
            </div>

            <!-- Priority task -->
            <div class="dash-section">
                <div class="dash-section-header">
                    <span class="dash-section-title">Tarea principal</span>
                </div>
                ${mit ? `
                <div class="dash-mit" data-id="${mit.id}">
                    <button class="dash-mit-check ${mit.completed ? 'checked' : ''}" data-id="${mit.id}" aria-label="Completar tarea">
                        ${mit.completed ? icon('check', 14, '') : ''}
                    </button>
                    <div class="dash-mit-info">
                        <span class="dash-mit-title ${mit.completed ? 'done-text' : ''}">${mit.title || mit.text || 'Tarea sin título'}</span>
                        ${mit.urgent && mit.important ? '<span class="dash-mit-tag urgent">Urgente</span>' : ''}
                    </div>
                    <a href="#/planner" class="dash-mit-go">${icon('arrowRight', 13, 'inline-arrow-icon')}</a>
                </div>` : `
                <a href="#/planner" class="dash-mit dash-mit-empty">
                    <span class="text-muted">+ Añadir tarea principal del día</span>
                    ${icon('arrowRight', 13, 'inline-arrow-icon')}
                </a>`}
            </div>

            <!-- Mood check -->
            ${todayMood === 0 ? `
            <div class="dash-section">
                <div class="dash-section-header">
                    <span class="dash-section-title">¿Cómo te sientes hoy?</span>
                </div>
                <div class="dash-mood-row" id="dash-mood-row">
                    ${[[1,'😔'],[2,'😕'],[3,'😐'],[4,'🙂'],[5,'😄']].map(([v,e]) => `
                        <button class="dash-mood-btn" data-mood="${v}" title="${v}/5">${e}</button>`).join('')}
                </div>
            </div>` : `
            <div class="dash-section">
                <div class="dash-section-header">
                    <span class="dash-section-title">Estado de ánimo hoy</span>
                    <span class="dash-section-meta">${['','😔','😕','😐','🙂','😄'][todayMood]} ${todayMood}/5</span>
                </div>
            </div>`}

            <!-- Insight -->
            ${insight ? `
            <div class="dash-insight" style="border-left-color:${insight.color}">
                <span class="dash-insight-emoji">${insight.emoji}</span>
                <div>
                    <p class="dash-insight-text">${insight.text}</p>
                    ${insight.action ? `<a href="${insight.link || '#/habits'}" class="dash-insight-link">${insight.action}</a>` : ''}
                </div>
            </div>` : ''}

            <!-- Quote -->
            <div class="dash-quote">
                <p>"${quote}"</p>
            </div>

            <!-- Quick actions -->
            <div class="dash-quick-actions">
                <a href="#/journal" class="dash-action-btn">
                    <span class="dash-action-icon">📝</span>
                    <span>Diario</span>
                </a>
                <a href="#/wellbeing" class="dash-action-btn">
                    <span class="dash-action-icon">💨</span>
                    <span>Bienestar</span>
                </a>
                <a href="#/goals" class="dash-action-btn">
                    <span class="dash-action-icon">🎯</span>
                    <span>Metas</span>
                </a>
                <a href="#/stats" class="dash-action-btn">
                    <span class="dash-action-icon">📊</span>
                    <span>Stats</span>
                </a>
            </div>
        </div>
    `;

    _attachListeners();
}

function _habitRow(habit, todayDone) {
    const done = todayDone.includes(habit.id);
    const catInfo = CATEGORIES[habit.category] || {};
    const streak = habit.streak || 0;
    return `
        <div class="dash-habit-row ${done ? 'dash-habit-done' : ''}" data-id="${habit.id}">
            <button class="dash-habit-check ${done ? 'checked' : ''}" data-id="${habit.id}"
                style="--cat:${catInfo.color || 'var(--accent-primary)'}" aria-label="Completar ${habit.name}">
                ${done ? icon('check', 15, '') : ''}
            </button>
            <div class="dash-habit-info">
                <span class="dash-habit-name">${habit.name}</span>
                ${habit.cue ? `<span class="dash-habit-cue text-muted">${habit.cue}</span>` : ''}
            </div>
            ${streak > 0 ? `
            <div class="dash-habit-streak ${streak >= 7 ? 'hot' : ''}">
                ${icon('flame', 11, 'streak-icon')} ${streak}
            </div>` : ''}
        </div>`;
}

function _attachListeners() {
    const todayStr = today();

    // Habit toggle
    document.querySelectorAll('.dash-habit-check').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            _toggleHabit(btn.dataset.id);
        });
    });

    // MIT task toggle
    document.querySelectorAll('.dash-mit-check').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const tasks = store.get('planner.tasks') || [];
            const task = tasks.find(t => t.id === id);
            if (!task) return;
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            store.set('planner.tasks', tasks);
            if (task.completed) {
                addXP(XP.TASK_COMPLETE);
                showToast('Tarea completada. +8 XP', 'success');
            }
            render();
        });
    });

    // Mood selection
    document.querySelectorAll('.dash-mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mood = parseInt(btn.dataset.mood);
            const entries = store.get('journal.entries') || [];
            const idx = entries.findIndex(e => e.date === todayStr);
            if (idx >= 0) {
                entries[idx].mood = mood;
            } else {
                entries.push({ date: todayStr, mood, createdAt: new Date().toISOString() });
            }
            store.set('journal.entries', entries);
            const labels = { 1: 'Difícil, pero aquí estás. Eso cuenta.', 2: 'Los días bajos también forman parte del camino.', 3: 'Neutro está bien. Los mejores momentos suelen surgir de la calma.', 4: 'Bien es suficiente para construir algo grande.', 5: 'Excelente energía. Aprovéchala en lo que más importa.' };
            showToast(labels[mood] || 'Estado registrado.', 'info', 4000);
            render();
        });
    });
}

function _toggleHabit(habitId) {
    const todayStr = today();
    const completions = store.get('habits.completions') || {};
    const todayList = [...(completions[todayStr] || [])];
    const isDone = todayList.includes(habitId);

    if (isDone) {
        completions[todayStr] = todayList.filter(id => id !== habitId);
    } else {
        completions[todayStr] = [...todayList, habitId];
        const streak = getStreakForHabit(habitId, completions);
        const records = store.get('stats.streakRecords') || {};
        if (!records[habitId] || streak > records[habitId]) {
            records[habitId] = streak;
            store.set('stats.streakRecords', records);
        }
        const bonus = Math.min(streak * XP.HABIT_STREAK_BONUS, 30);
        addXP(XP.HABIT_COMPLETE + bonus);

        const allHabits = (store.get('habits.items') || []).filter(h => !h.archived);
        const newDone = completions[todayStr] || [];
        if (allHabits.length > 0 && allHabits.every(h => newDone.includes(h.id))) {
            addXP(XP.ALL_HABITS_DONE);
            createConfetti(document.body);
            showToast('¡Todos los hábitos completados! +20 XP', 'success', 4000);
        } else {
            playSound('complete');
            const milestones = [7, 14, 21, 30, 66, 100];
            if (milestones.includes(streak)) {
                showToast(`🔥 ¡${streak} días seguidos! Racha ${streak >= 66 ? 'automatizada' : 'activa'}`, 'success', 4000);
                createConfetti(document.body);
            }
        }
        checkAchievements();
    }

    store.set('habits.completions', completions);
    render();
}

// ── Single best insight ──
function getTopInsight(habits, completions, todayDone) {
    // Streak at risk
    const atRisk = habits.filter(h => {
        if (todayDone.includes(h.id)) return false;
        let s = 0;
        const d = new Date();
        d.setDate(d.getDate() - 1);
        for (let i = 0; i < 60; i++) {
            const ds = formatDate(d);
            if ((completions[ds] || []).includes(h.id)) { s++; d.setDate(d.getDate() - 1); }
            else break;
        }
        return s >= 3;
    });
    if (atRisk.length) return {
        emoji: '🔥',
        text: `${atRisk.length > 1 ? atRisk.length + ' rachas en riesgo' : `"${atRisk[0].name}" tiene una racha activa`} — no la pierdas hoy`,
        color: '#ef4444',
        action: 'Ver hábitos',
        link: '#/habits'
    };

    // Trend
    const last7 = [], prev7 = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        const rate = habits.length ? (completions[ds] || []).filter(id => habits.some(h => h.id === id)).length / habits.length : 0;
        if (i < 7) last7.push(rate); else prev7.push(rate);
    }
    const l7 = last7.reduce((s, v) => s + v, 0) / 7;
    const p7 = prev7.reduce((s, v) => s + v, 0) / 7;
    if (p7 > 0.05 && l7 - p7 >= 0.1) return {
        emoji: '📈',
        text: `Tu semana está siendo mejor que la anterior (+${Math.round((l7 - p7) * 100)}% en hábitos)`,
        color: '#10b981', action: null
    };

    // Social
    const socialLog = store.get('wellbeing.socialLog') || {};
    let socialDays = 0;
    for (let i = 1; i <= 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if ((socialLog[formatDate(d)] || []).length > 0) socialDays++;
    }
    if (socialDays === 0) return {
        emoji: '❤️',
        text: 'Conecta con alguien hoy — las relaciones son el predictor #1 de felicidad a largo plazo',
        color: '#ec4899',
        action: 'Centro de bienestar',
        link: '#/wellbeing'
    };

    return null;
}

export function init() {}
export function destroy() {}
