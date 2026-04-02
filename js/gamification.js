// gamification.js — XP, Levels & Achievements system
import { store } from './store.js';
import { showToast, createConfetti, playSound, getStreakForHabit, getBestStreakForHabit, today } from './ui.js';

// ─── XP per action ────────────────────────────────────────────────────────────
export const XP = {
    HABIT_COMPLETE:       10,
    HABIT_STREAK_BONUS:   2,   // multiplied by streak days
    ALL_HABITS_DONE:      20,  // bonus when all habits done in one day
    TASK_COMPLETE:        8,
    JOURNAL_ENTRY:        15,
    GOAL_MILESTONE:       25,
    GOAL_COMPLETE:        60,
    WEEKLY_REVIEW:        35,
    LIFEWHEEL_ASSESS:     20,
    FIRST_OF_DAY:         5,   // first habit of the day bonus
};

// ─── Levels ───────────────────────────────────────────────────────────────────
export const LEVELS = [
    { level: 1,  name: 'Aprendiz',     min: 0,    color: '#94a3b8', icon: '🌱' },
    { level: 2,  name: 'Iniciado',     min: 100,  color: '#64748b', icon: '🌿' },
    { level: 3,  name: 'Practicante',  min: 250,  color: '#22c55e', icon: '⚡' },
    { level: 4,  name: 'Disciplinado', min: 500,  color: '#16a34a', icon: '🎯' },
    { level: 5,  name: 'Constante',    min: 850,  color: '#0ea5e9', icon: '💪' },
    { level: 6,  name: 'Guerrero',     min: 1300, color: '#6366f1', icon: '⚔️' },
    { level: 7,  name: 'Maestro',      min: 1900, color: '#8b5cf6', icon: '🧠' },
    { level: 8,  name: 'Experto',      min: 2600, color: '#f59e0b', icon: '🏆' },
    { level: 9,  name: 'Líder',        min: 3500, color: '#ef4444', icon: '👑' },
    { level: 10, name: 'Leyenda',      min: 4600, color: '#f97316', icon: '🌟' },
];

// ─── Achievements ─────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = [
    { id: 'first_habit',     name: 'Primer Paso',       desc: 'Completa tu primer hábito',               icon: '🌱', xpReward: 20  },
    { id: 'streak_7',        name: 'Semana de Fuego',   desc: 'Mantén un hábito 7 días seguidos',         icon: '🔥', xpReward: 30  },
    { id: 'streak_30',       name: 'Mes Invicto',       desc: 'Mantén un hábito 30 días seguidos',        icon: '💎', xpReward: 100 },
    { id: 'streak_66',       name: 'Automatizado',      desc: '66 días — hábito grabado en tu cerebro',   icon: '🧠', xpReward: 200 },
    { id: 'streak_100',      name: 'Centenario',        desc: '100 días de racha',                        icon: '💯', xpReward: 300 },
    { id: 'all_habits_day',  name: 'Día Perfecto',      desc: 'Completa todos los hábitos en un día',     icon: '⭐', xpReward: 25  },
    { id: 'tasks_10',        name: 'Ejecutor',          desc: 'Completa 10 tareas',                       icon: '✅', xpReward: 30  },
    { id: 'tasks_50',        name: 'Máquina',           desc: 'Completa 50 tareas',                       icon: '⚙️', xpReward: 75  },
    { id: 'journal_5',       name: 'Escritor',          desc: '5 entradas en el diario',                  icon: '📖', xpReward: 30  },
    { id: 'journal_30',      name: 'Cronista',          desc: '30 entradas en el diario',                 icon: '📚', xpReward: 100 },
    { id: 'goal_complete',   name: 'Conquistador',      desc: 'Completa tu primera meta',                 icon: '🏆', xpReward: 100 },
    { id: 'level_5',         name: 'Mitad del Camino',  desc: 'Alcanza el Nivel 5',                       icon: '🎯', xpReward: 50  },
    { id: 'level_10',        name: 'Leyenda Viviente',  desc: 'Alcanza el Nivel 10 — el máximo',          icon: '🌟', xpReward: 500 },
    { id: 'weekly_review',   name: 'Estratega',         desc: 'Completa tu primera revisión semanal',     icon: '📊', xpReward: 40  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getLevelInfo(xp) {
    let info = LEVELS[0];
    for (const l of LEVELS) {
        if (xp >= l.min) info = l;
        else break;
    }
    return info;
}

export function getNextLevel(xp) {
    const curr = getLevelInfo(xp);
    return LEVELS.find(l => l.level === curr.level + 1) || null;
}

export function getLevelProgress(xp) {
    const curr = getLevelInfo(xp);
    const next = getNextLevel(xp);
    if (!next) return 100;
    const range = next.min - curr.min;
    const earned = xp - curr.min;
    return Math.min(100, Math.round((earned / range) * 100));
}

// ─── Core: add XP ────────────────────────────────────────────────────────────

export function addXP(amount, silent = false) {
    const gam = _getGam();
    const prevXP = gam.xp;
    const prevLevel = getLevelInfo(prevXP).level;

    gam.xp += amount;
    gam.totalXPEarned = (gam.totalXPEarned || 0) + amount;
    _saveGam(gam);

    const newLevel = getLevelInfo(gam.xp).level;

    if (newLevel > prevLevel) {
        _onLevelUp(newLevel, gam.xp);
    } else if (!silent) {
        _showXPPop(amount);
    }

    return { xp: gam.xp, level: newLevel, leveledUp: newLevel > prevLevel };
}

// ─── Achievement unlock ───────────────────────────────────────────────────────

export function unlockAchievement(achievementId) {
    const gam = _getGam();
    if (gam.achievements.includes(achievementId)) return false;

    const ach = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!ach) return false;

    gam.achievements.push(achievementId);
    gam.achievementDates = gam.achievementDates || {};
    gam.achievementDates[achievementId] = new Date().toISOString();
    _saveGam(gam);

    // Award XP for achievement
    if (ach.xpReward) addXP(ach.xpReward, true);

    // Show achievement toast
    setTimeout(() => {
        showToast(`${ach.icon} Logro desbloqueado: ${ach.name}`, 'success');
    }, 600);

    return true;
}

export function hasAchievement(achievementId) {
    return (_getGam().achievements || []).includes(achievementId);
}

// ─── Check achievements based on current state ───────────────────────────────

export function checkAchievements() {
    const habits      = store.get('habits.items') || [];
    const completions = store.get('habits.completions') || {};
    const tasks       = store.get('planner.tasks') || [];
    const entries     = store.get('journal.entries') || [];
    const goals       = store.get('goals.items') || [];
    const todayStr    = today();

    // First habit ever
    if ((completions[todayStr] || []).length >= 1) unlockAchievement('first_habit');

    // Streak-based — use saved records to avoid recalculating full history
    const records = store.get('stats.streakRecords') || {};
    for (const h of habits.filter(h => !h.archived)) {
        const streak = getStreakForHabit(h.id, completions);
        const max    = Math.max(streak, records[h.id] || 0, getBestStreakForHabit(h.id, completions));
        if (max >= 7)   unlockAchievement('streak_7');
        if (max >= 30)  unlockAchievement('streak_30');
        if (max >= 66)  unlockAchievement('streak_66');
        if (max >= 100) unlockAchievement('streak_100');
    }

    // All habits done today
    const active = habits.filter(h => !h.archived);
    if (active.length > 0 && active.every(h => (completions[todayStr] || []).includes(h.id))) {
        unlockAchievement('all_habits_day');
    }

    // Tasks
    const completedTasks = tasks.filter(t => t.completed).length;
    if (completedTasks >= 10) unlockAchievement('tasks_10');
    if (completedTasks >= 50) unlockAchievement('tasks_50');

    // Journal
    if (entries.length >= 5)  unlockAchievement('journal_5');
    if (entries.length >= 30) unlockAchievement('journal_30');

    // Goals
    if (goals.some(g => g.status === 'completed')) unlockAchievement('goal_complete');

    // Levels
    const xp = _getGam().xp || 0;
    if (getLevelInfo(xp).level >= 5)  unlockAchievement('level_5');
    if (getLevelInfo(xp).level >= 10) unlockAchievement('level_10');
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _getGam() {
    return store.get('gamification') || { xp: 0, level: 1, achievements: [], totalXPEarned: 0 };
}

function _saveGam(gam) {
    store.set('gamification', gam);
}

function _onLevelUp(newLevel, xp) {
    const info = getLevelInfo(xp);
    playSound('streak');
    createConfetti(document.body);
    showToast(`${info.icon} ¡Subiste a Nivel ${newLevel}: ${info.name}!`, 'success');

    // Show level-up modal after a beat
    setTimeout(() => {
        const overlay = document.createElement('div');
        overlay.className = 'levelup-overlay';
        overlay.innerHTML = `
            <div class="levelup-card">
                <div class="levelup-icon">${info.icon}</div>
                <p class="levelup-sub">¡Nivel alcanzado!</p>
                <h2 class="levelup-title">Nivel ${newLevel}</h2>
                <p class="levelup-name">${info.name}</p>
                <div class="levelup-xp">${xp} XP total</div>
                <button class="btn btn-primary levelup-close" onclick="this.closest('.levelup-overlay').remove()">¡Continuar!</button>
            </div>`;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 50);
    }, 400);
}

function _showXPPop(amount) {
    const pop = document.createElement('div');
    pop.className = 'xp-pop';
    pop.textContent = `+${amount} XP`;
    // Position near center-right
    pop.style.cssText = `position:fixed;right:20px;bottom:80px;z-index:8000;pointer-events:none`;
    document.body.appendChild(pop);
    requestAnimationFrame(() => pop.classList.add('show'));
    setTimeout(() => pop.remove(), 1400);
}

