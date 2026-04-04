// dashboard.js — Science-based command center
import { store } from './store.js';
import { today, formatDate, formatDateDisplay, getStreakForHabit, getAppStreak, CATEGORIES, icon, showToast, playSound, animateReward, createConfetti } from './ui.js';
import { getLevelInfo, getLevelProgress, getNextLevel, addXP, checkAchievements, XP, getDailyChallenge } from './gamification.js';

// ── Commitment Score ─────────────────────────────────────────────
// Research: composite behavioral scores predict long-term habit retention
// (Gardner et al., 2012; Wood & Neal, 2016)
function getCommitmentScore(habits, completions, tasks, entries, todayStr) {
    const habitsDone = habits.filter(h => (completions[todayStr] || []).includes(h.id)).length;
    const habitsPct = habits.length ? habitsDone / habits.length : 0;

    const todayTasks = tasks.filter(t => t.date === todayStr);
    const tasksPct = todayTasks.length
        ? todayTasks.filter(t => t.completed).length / todayTasks.length
        : null;

    const hasJournal = entries.some(e => e.date === todayStr && (e.gratitude || e.reflection || e.win));
    const hasEvening = entries.some(e => e.date === todayStr && e.eveningReflection);

    // Weighted: habits 45%, tasks 30%, journal 15%, reflection 10%
    let score = habitsPct * 45;
    if (tasksPct !== null) score += tasksPct * 30;
    else score += 15; // no tasks planned = neutral, not penalized
    if (hasJournal) score += 15;
    if (hasEvening) score += 10;

    return Math.min(100, Math.round(score));
}

// ── Single top insight based on real patterns ────────────────────
function getTopInsight(habits, completions, todayDone, todayStr) {
    // 1. Streak at risk
    const atRisk = habits.filter(h => {
        if (todayDone.includes(h.id)) return false;
        let s = 0;
        const d = new Date(); d.setDate(d.getDate() - 1);
        for (let i = 0; i < 90; i++) {
            if ((completions[formatDate(d)] || []).includes(h.id)) { s++; d.setDate(d.getDate() - 1); }
            else break;
        }
        return s >= 3;
    });
    if (atRisk.length) return {
        emoji: '🔥', color: '#ef4444',
        text: `${atRisk.length > 1 ? `${atRisk.length} rachas en riesgo` : `"${atRisk[0].name}" tiene racha activa`} — no la pierdas hoy`,
        action: 'Ver hábitos', link: '#/habits', urgent: true
    };

    // 2. 7-day trend vs previous 7 days (neuroscience: momentum builds on wins)
    const last7 = [], prev7 = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        const rate = habits.length ? (completions[ds] || []).filter(id => habits.some(h => h.id === id)).length / habits.length : 0;
        if (i < 7) last7.push(rate); else prev7.push(rate);
    }
    const l7 = last7.reduce((s, v) => s + v, 0) / 7;
    const p7 = prev7.reduce((s, v) => s + v, 0) / 7;
    if (p7 > 0.1 && l7 - p7 >= 0.12) return {
        emoji: '📈', color: '#10b981',
        text: `Esta semana +${Math.round((l7 - p7) * 100)}% mejor que la anterior. El momentum se acumula.`,
        action: null
    };
    if (p7 > 0.3 && p7 - l7 >= 0.15) return {
        emoji: '⚠️', color: '#f59e0b',
        text: `Esta semana ${Math.round((p7 - l7) * 100)}% menos que la anterior. Recupera el ritmo hoy.`,
        action: 'Ver estadísticas', link: '#/stats', urgent: false
    };

    // 3. Best day of week (dopamine anchoring)
    const dowCounts = Array(7).fill(0), dowTotal = Array(7).fill(0);
    for (let i = 1; i <= 28; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        const dow = d.getDay();
        const done = habits.length ? (completions[ds] || []).filter(id => habits.some(h => h.id === id)).length / habits.length : 0;
        dowCounts[dow] += done; dowTotal[dow]++;
    }
    const todayDow = new Date().getDay();
    const todayAvg = dowTotal[todayDow] ? dowCounts[todayDow] / dowTotal[todayDow] : 0;
    const bestDow = dowCounts.indexOf(Math.max(...dowCounts.map((c, i) => dowTotal[i] ? c / dowTotal[i] : 0)));
    const days = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
    if (bestDow === todayDow && todayAvg > 0.6) return {
        emoji: '⚡', color: '#6366f1',
        text: `Los ${days[todayDow]} son tu mejor día históricamente. Aprovecha el momentum.`,
        action: null
    };

    // 4. Social connection (Harvard Study of Adult Development: #1 predictor of wellbeing)
    const socialLog = store.get('wellbeing.socialLog') || {};
    let socialDays = 0;
    for (let i = 1; i <= 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if ((socialLog[formatDate(d)] || []).length > 0) socialDays++;
    }
    if (socialDays === 0) return {
        emoji: '❤️', color: '#ec4899',
        text: 'Sin conexión social esta semana. Las relaciones son el predictor #1 de felicidad (Harvard, 80 años de estudio).',
        action: 'Registrar conexión', link: '#/wellbeing', urgent: false
    };

    // 5. Journal streak prompt (Pennebaker: writing reduces cortisol 23%)
    const journalDays = (() => {
        let streak = 0; const d = new Date(); d.setDate(d.getDate() - 1);
        for (let i = 0; i < 7; i++) {
            if (entries && store.get('journal.entries')?.some(e => e.date === formatDate(d))) { streak++; d.setDate(d.getDate() - 1); }
            else break;
        }
        return streak;
    })();
    if (journalDays === 0) return {
        emoji: '📝', color: '#8b5cf6',
        text: 'Escribir 3 minutos reduce el cortisol un 23% (Pennebaker, 1997). Abre tu diario hoy.',
        action: 'Abrir diario', link: '#/journal', urgent: false
    };

    return null;
}

export function render() {
    const container = document.getElementById('main-content');
    const todayStr = today();
    const hour = new Date().getHours();
    const userName = store.get('settings.userName') || 'Tú';
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const todayDone = completions[todayStr] || [];
    const tasks = store.get('planner.tasks') || [];
    const todayTasks = tasks.filter(t => t.date === todayStr);
    const entries = store.get('journal.entries') || [];
    const gam = store.get('gamification') || { xp: 0 };
    const xp = gam.xp || 0;
    const level = getLevelInfo(xp);
    const xpPct = getLevelProgress(xp);
    const nextLvl = getNextLevel(xp);
    const appStreak = getAppStreak(completions);
    const challenge = getDailyChallenge();

    const pendingHabits = habits.filter(h => !todayDone.includes(h.id));
    const doneHabits = habits.filter(h => todayDone.includes(h.id));
    const habitPct = habits.length ? Math.round((doneHabits.length / habits.length) * 100) : 0;
    const allDone = habits.length > 0 && pendingHabits.length === 0;

    const pendingSorted = pendingHabits
        .map(h => ({ ...h, streak: getStreakForHabit(h.id, completions) }))
        .sort((a, b) => b.streak - a.streak);
    const habitDisplay = [...pendingSorted, ...doneHabits.map(h => ({ ...h, streak: getStreakForHabit(h.id, completions) }))].slice(0, 6);

    const mit = todayTasks.filter(t => !t.completed)
        .sort((a, b) => ((b.urgent && b.important ? 2 : b.important ? 1 : 0) - (a.urgent && a.important ? 2 : a.important ? 1 : 0)))[0] || null;

    const todayEntry = entries.find(e => e.date === todayStr);
    const todayMood = todayEntry?.mood || 0;

    const commitScore = getCommitmentScore(habits, completions, tasks, entries, todayStr);
    const insight = getTopInsight(habits, completions, todayDone, todayStr);

    // Time-aware greeting + context message (circadian science)
    const greeting = hour < 6 ? `Buenas noches` : hour < 12 ? `Buenos días` : hour < 18 ? `Buenas tardes` : `Buenas noches`;
    const contextMsg = hour < 12
        ? 'Activa el BDNF con movimiento. Tu cerebro aprende mejor en las primeras horas.'
        : hour < 15
        ? 'Hora óptima para trabajo cognitivo profundo (pico de cortisol ya pasó).'
        : hour < 19
        ? 'El segundo pico de energía. Termina lo pendiente antes de que baje la glucosa cerebral.'
        : 'Reduce el estrés del día. El cerebro consolida memorias mientras duermes.';

    // Challenge status
    const challengeDone = store.get(`challenge.${todayStr}`) === challenge?.id;

    container.innerHTML = `
    <div class="dash-clean">

        <!-- Header -->
        <div class="dash-header-clean">
            <div class="dash-greeting-wrap">
                <p class="dash-date text-secondary">${new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
                <h1 class="dash-greeting">${greeting}, ${userName}</h1>
                <p class="dash-context-msg">${contextMsg}</p>
            </div>
            <div class="dash-top-right">
                ${appStreak > 0 ? `<div class="dash-streak-chip">${icon('flame',13,'streak-icon')}<span>${appStreak}d</span></div>` : ''}
                <a href="#/profile" class="dash-level-chip" title="Nivel ${level.level}: ${level.name}">
                    <span style="font-size:1rem;position:relative;z-index:1">${level.icon}</span>
                    <div class="dash-level-chip-bar" style="--fill:${xpPct}%;--color:${level.color}"></div>
                </a>
            </div>
        </div>

        <!-- Commitment Score -->
        <div class="dash-score-block">
            <div class="dash-score-ring">
                <svg viewBox="0 0 44 44" class="dash-score-svg">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bg-tertiary)" stroke-width="4"/>
                    <circle cx="22" cy="22" r="18" fill="none"
                        stroke="${commitScore >= 80 ? '#10b981' : commitScore >= 50 ? '#4f46e5' : '#f59e0b'}"
                        stroke-width="4" stroke-linecap="round"
                        stroke-dasharray="${Math.round(commitScore * 1.131)} ${Math.round((100 - commitScore) * 1.131)}"
                        transform="rotate(-90 22 22)"/>
                </svg>
                <span class="dash-score-num">${commitScore}</span>
            </div>
            <div class="dash-score-info">
                <span class="dash-score-label">Compromiso hoy</span>
                <p class="dash-score-desc">
                    ${commitScore >= 90 ? 'Día excepcional. Estás en modo élite.' :
                      commitScore >= 70 ? 'Sólido. Sigue así hasta el final del día.' :
                      commitScore >= 40 ? 'Buen arranque. Completa hábitos y tareas pendientes.' :
                      'Todavía hay tiempo. Una acción a la vez.'}
                </p>
                ${nextLvl ? `<div class="dash-xp-mini"><div class="dash-xp-mini-fill" style="width:${xpPct}%;background:${level.color}"></div></div><span class="text-muted" style="font-size:0.68rem">${nextLvl.min - xp} XP para Niv.${nextLvl.level}</span>` : ''}
            </div>
        </div>

        <!-- Daily Challenge -->
        ${challenge ? `
        <div class="dash-challenge ${challengeDone ? 'done' : ''}" id="dash-challenge">
            <span class="dash-challenge-emoji">${challenge.emoji}</span>
            <div class="dash-challenge-info">
                <span class="dash-challenge-label">DESAFÍO DE HOY</span>
                <span class="dash-challenge-text">${challenge.title}</span>
                <span class="dash-challenge-science">${challenge.science}</span>
            </div>
            ${!challengeDone ? `<button class="dash-challenge-btn" id="complete-challenge">✓</button>` : `<span style="color:var(--accent-success);font-size:1rem">✓</span>`}
        </div>` : ''}

        <!-- MIT — Most Important Task (Ivy Lee Method) -->
        <div class="dash-section">
            <div class="dash-section-header">
                <span class="dash-section-title">Tarea principal</span>
                <a href="#/planner" class="dash-section-link">Ver todas</a>
            </div>
            ${mit ? `
            <div class="dash-mit" data-id="${mit.id}">
                <button class="dash-mit-check ${mit.completed ? 'checked' : ''}" data-id="${mit.id}">
                    ${mit.completed ? icon('check', 14, '') : ''}
                </button>
                <div class="dash-mit-info">
                    <span class="dash-mit-title ${mit.completed ? 'done-text' : ''}">${mit.title || mit.text || 'Sin título'}</span>
                    ${mit.urgent && mit.important ? '<span class="dash-mit-tag urgent">Crítico</span>' : mit.important ? '<span class="dash-mit-tag">Importante</span>' : ''}
                </div>
                <a href="#/planner" class="dash-mit-go">${icon('arrowRight', 13, '')}</a>
            </div>` : `
            <a href="#/planner" class="dash-mit dash-mit-empty">
                <span class="text-muted">+ Define tu tarea más importante del día</span>
                ${icon('arrowRight', 12, '')}
            </a>`}
        </div>

        <!-- Habits -->
        <div class="dash-section">
            <div class="dash-section-header">
                <span class="dash-section-title">Hábitos de hoy</span>
                <span class="dash-section-meta ${allDone ? 'text-success' : ''}">${doneHabits.length}/${habits.length}${allDone ? ' ✓' : ''}</span>
            </div>
            ${habits.length > 0 ? `
            <div class="dash-habit-progress">
                <div class="dash-habit-bar"><div class="dash-habit-bar-fill ${allDone ? 'all-done' : ''}" style="width:${habitPct}%"></div></div>
            </div>
            <div class="dash-habits-list" id="dash-habits-list">
                ${habitDisplay.map(h => _habitRow(h, todayDone)).join('')}
            </div>
            <a href="#/habits" class="dash-see-all">
                ${habits.length > 6 ? `Ver todos (${habits.length})` : 'Gestionar hábitos'} ${icon('arrowRight', 11, '')}
            </a>` : `
            <div class="dash-empty-habits">
                <p>Los hábitos son la base del cambio. Crea el primero.</p>
                <a href="#/habits" class="btn btn-primary btn-sm">+ Crear hábito</a>
            </div>`}
        </div>

        <!-- Mood (if not logged) -->
        ${todayMood === 0 ? `
        <div class="dash-section">
            <div class="dash-section-header">
                <span class="dash-section-title">¿Cómo te sientes?</span>
                <span class="text-muted" style="font-size:0.72rem">Correlaciona con tus hábitos</span>
            </div>
            <div class="dash-mood-row" id="dash-mood-row">
                ${[[1,'😔','Mal'],[2,'😕','Bajo'],[3,'😐','Neutral'],[4,'🙂','Bien'],[5,'😄','Genial']].map(([v,e,l]) => `
                    <button class="dash-mood-btn" data-mood="${v}" title="${l}">
                        <span>${e}</span><span class="dash-mood-label">${l}</span>
                    </button>`).join('')}
            </div>
        </div>` : `
        <div class="dash-section">
            <div class="dash-section-header">
                <span class="dash-section-title">Ánimo de hoy</span>
                <span class="dash-section-meta">${['','😔','😕','😐','🙂','😄'][todayMood]} ${['','Mal','Bajo','Neutral','Bien','Genial'][todayMood]}</span>
            </div>
        </div>`}

        <!-- Insight -->
        ${insight ? `
        <div class="dash-insight ${insight.urgent ? 'urgent' : ''}" style="border-left-color:${insight.color}">
            <span class="dash-insight-emoji">${insight.emoji}</span>
            <div>
                <p class="dash-insight-text">${insight.text}</p>
                ${insight.action ? `<a href="${insight.link || '#/habits'}" class="dash-insight-link">${insight.action} →</a>` : ''}
            </div>
        </div>` : ''}

        <!-- Quick actions -->
        <div class="dash-quick-actions">
            <a href="#/journal" class="dash-action-btn">
                <span class="dash-action-icon">📝</span><span>Diario</span>
            </a>
            <a href="#/wellbeing" class="dash-action-btn">
                <span class="dash-action-icon">💨</span><span>Bienestar</span>
            </a>
            <a href="#/goals" class="dash-action-btn">
                <span class="dash-action-icon">🎯</span><span>Metas</span>
            </a>
            <a href="#/stats" class="dash-action-btn">
                <span class="dash-action-icon">📊</span><span>Stats</span>
            </a>
        </div>

    </div>`;

    _attachListeners(todayStr, tasks, entries, challenge, challengeDone);
}

function _habitRow(habit, todayDone) {
    const done = todayDone.includes(habit.id);
    const cat = CATEGORIES[habit.category] || {};
    const streak = habit.streak || 0;
    const timeIcon = { morning: '🌅', afternoon: '☀️', evening: '🌙', anytime: '' }[habit.timeContext] || '';
    return `
        <div class="dash-habit-row ${done ? 'dash-habit-done' : ''}" data-id="${habit.id}">
            <button class="dash-habit-check ${done ? 'checked' : ''}" data-id="${habit.id}"
                style="--cat:${cat.color || 'var(--accent-primary)'}" aria-label="Completar">
                ${done ? icon('check', 15, '') : ''}
            </button>
            <div class="dash-habit-info">
                <span class="dash-habit-name">${timeIcon ? `<span style="font-size:0.85em">${timeIcon}</span> ` : ''}${habit.name}</span>
                ${habit.cue ? `<span class="dash-habit-cue">${habit.cue}</span>` : ''}
            </div>
            ${streak > 0 ? `
            <div class="dash-habit-streak ${streak >= 7 ? 'hot' : ''}">
                ${icon('flame', 11, 'streak-icon')} ${streak}
            </div>` : ''}
        </div>`;
}

function _attachListeners(todayStr, tasks, entries, challenge, challengeDone) {
    // Habit toggle
    document.querySelectorAll('.dash-habit-check').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); _toggleHabit(btn.dataset.id); });
    });

    // MIT toggle
    document.querySelectorAll('.dash-mit-check').forEach(btn => {
        btn.addEventListener('click', () => {
            const allTasks = store.get('planner.tasks') || [];
            const task = allTasks.find(t => t.id === btn.dataset.id);
            if (!task) return;
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            store.set('planner.tasks', allTasks);
            if (task.completed) { addXP(XP.TASK_COMPLETE); showToast(`Tarea completada. +${XP.TASK_COMPLETE} XP`, 'success'); }
            render();
        });
    });

    // Mood
    document.querySelectorAll('.dash-mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mood = parseInt(btn.dataset.mood);
            const allEntries = store.get('journal.entries') || [];
            const idx = allEntries.findIndex(e => e.date === todayStr);
            if (idx >= 0) allEntries[idx].mood = mood;
            else allEntries.push({ date: todayStr, mood, createdAt: new Date().toISOString() });
            store.set('journal.entries', allEntries);
            const labels = {
                1: 'Difícil, pero aquí estás. Eso ya es valentía.',
                2: 'Los días bajos construyen resiliencia.',
                3: 'La calma es el estado base del alto rendimiento.',
                4: 'Bien es el punto de partida para lo excelente.',
                5: 'Energía alta. Prioriza el trabajo más importante ahora.'
            };
            showToast(labels[mood], 'info', 4000);
            render();
        });
    });

    // Daily challenge
    if (!challengeDone && challenge) {
        document.getElementById('complete-challenge')?.addEventListener('click', () => {
            store.set(`challenge.${todayStr}`, challenge.id);
            addXP(challenge.xp || 15);
            checkAchievements();
            playSound('complete');
            showToast(`Desafío completado. +${challenge.xp || 15} XP`, 'success');
            render();
        });
    }
}

function _toggleHabit(habitId) {
    const todayStr = today();
    const completions = store.get('habits.completions') || {};
    const list = [...(completions[todayStr] || [])];
    const isDone = list.includes(habitId);

    if (isDone) {
        completions[todayStr] = list.filter(id => id !== habitId);
        store.set('habits.completions', completions);
        render(); return;
    }

    completions[todayStr] = [...list, habitId];
    const streak = getStreakForHabit(habitId, completions);
    const records = store.get('stats.streakRecords') || {};
    if (!records[habitId] || streak > records[habitId]) { records[habitId] = streak; store.set('stats.streakRecords', records); }

    const bonus = Math.min(streak * XP.HABIT_STREAK_BONUS, 30);
    addXP(XP.HABIT_COMPLETE + bonus);

    const allHabits = (store.get('habits.items') || []).filter(h => !h.archived);
    const newDone = completions[todayStr] || [];
    if (allHabits.length > 0 && allHabits.every(h => newDone.includes(h.id))) {
        addXP(XP.ALL_HABITS_DONE);
        createConfetti(document.body);
        showToast('¡Todos los hábitos completados! +20 XP 🎉', 'success', 4000);
    } else {
        playSound('complete');
        const milestones = [7, 14, 21, 30, 66, 100];
        if (milestones.includes(streak)) {
            showToast(`🔥 ${streak} días seguidos. ${streak >= 66 ? 'Hábito automatizado.' : 'Racha activa.'}`, 'success', 4000);
            if (streak >= 7) createConfetti(document.body);
        }
    }
    checkAchievements();
    store.set('habits.completions', completions);
    render();
}

export function init() {}
export function destroy() {}
