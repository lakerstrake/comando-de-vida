// review.js - Weekly Review — science-based reflection + auto insights
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, playSound, CATEGORIES } from './ui.js';
import { addXP, XP } from './gamification.js';

export function render() {
    const container = document.getElementById('main-content');
    const reviews = store.get('weeklyReviews') || [];

    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = formatDate(weekStart);
    const weekEndStr = formatDate(weekEnd);

    const existing = reviews.find(r => r.weekStart === weekStartStr);

    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const entries = store.get('journal.entries') || [];

    const weekDates = [];
    const cur = new Date(weekStart);
    while (cur <= weekEnd && formatDate(cur) <= today()) {
        weekDates.push(formatDate(cur));
        cur.setDate(cur.getDate() + 1);
    }
    const daysLogged = weekDates.length;

    // ── Per-habit completion rates this week
    const habitStats = habits.map(h => {
        let done = 0;
        weekDates.forEach(d => { if ((completions[d] || []).includes(h.id)) done++; });
        return { ...h, done, pct: daysLogged ? Math.round((done / daysLogged) * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct);

    // ── Overall habit rate
    const totalHabitOps = habits.length * daysLogged;
    let totalHabitDone = 0;
    weekDates.forEach(d => {
        totalHabitDone += (completions[d] || []).filter(id => habits.some(h => h.id === id)).length;
    });
    const habitWeekPct = totalHabitOps ? Math.round((totalHabitDone / totalHabitOps) * 100) : 0;

    // ── Tasks
    let tasksDone = 0, tasksTotal = 0;
    weekDates.forEach(d => {
        const dt = tasks.filter(t => t.date === d);
        tasksTotal += dt.length;
        tasksDone += dt.filter(t => t.completed).length;
    });
    const taskPct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : null;

    // ── Journal
    const journalDays = weekDates.filter(d => entries.some(e => e.date === d)).length;

    // ── Mood average this week
    const moodValues = weekDates.map(d => entries.find(e => e.date === d)?.mood || 0).filter(m => m > 0);
    const avgMood = moodValues.length ? (moodValues.reduce((s, v) => s + v, 0) / moodValues.length).toFixed(1) : null;
    const moodLabels = ['', '😔', '😕', '😐', '🙂', '😄'];

    // ── Streaks at risk (habits with streaks but < 100% this week)
    const atRisk = habitStats.filter(h => h.pct < 100 && h.pct > 0 && h.done > 0);

    // ── Auto-generated insights (smart, data-based)
    const insights = _generateInsights({ habitStats, habitWeekPct, taskPct, tasksDone, tasksTotal, journalDays, daysLogged, avgMood, atRisk, completions, habits, entries, weekDates });

    // ── Previous week comparison
    const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd); prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);
    const prevDates = [];
    const pc = new Date(prevWeekStart);
    while (pc <= prevWeekEnd) { prevDates.push(formatDate(pc)); pc.setDate(pc.getDate() + 1); }
    let prevHabitDone = 0;
    prevDates.forEach(d => { prevHabitDone += (completions[d] || []).filter(id => habits.some(h => h.id === id)).length; });
    const prevPct = (habits.length * 7) ? Math.round((prevHabitDone / (habits.length * 7)) * 100) : 0;
    const trend = prevPct > 0 ? habitWeekPct - prevPct : null;

    container.innerHTML = `
    <div class="rv-page">
        <div class="rv-header">
            <h1>Revisión semanal</h1>
            <span class="text-secondary rv-dates">${formatDateDisplay(weekStartStr)} – ${formatDateDisplay(weekEndStr)}</span>
        </div>

        <!-- Auto-stats scorecard -->
        <div class="rv-scorecard">
            <div class="rv-score-item">
                <span class="rv-score-num ${habitWeekPct >= 80 ? 'good' : habitWeekPct >= 50 ? 'mid' : 'low'}">${habitWeekPct}%</span>
                <span class="rv-score-label">Hábitos</span>
                ${trend !== null ? `<span class="rv-score-trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}%</span>` : ''}
            </div>
            ${taskPct !== null ? `
            <div class="rv-score-item">
                <span class="rv-score-num ${taskPct >= 80 ? 'good' : taskPct >= 50 ? 'mid' : 'low'}">${taskPct}%</span>
                <span class="rv-score-label">Tareas (${tasksDone}/${tasksTotal})</span>
            </div>` : ''}
            <div class="rv-score-item">
                <span class="rv-score-num ${journalDays >= daysLogged * 0.7 ? 'good' : 'mid'}">${journalDays}/${daysLogged}</span>
                <span class="rv-score-label">Días de diario</span>
            </div>
            ${avgMood ? `
            <div class="rv-score-item">
                <span class="rv-score-num">${moodLabels[Math.round(parseFloat(avgMood))]}</span>
                <span class="rv-score-label">Ánimo promedio (${avgMood})</span>
            </div>` : ''}
        </div>

        <!-- Per-habit breakdown -->
        ${habitStats.length ? `
        <div class="rv-section">
            <h3 class="rv-section-title">Hábitos esta semana</h3>
            <div class="rv-habits-list">
                ${habitStats.map(h => `
                <div class="rv-habit-row">
                    <span class="rv-habit-name">${h.name}</span>
                    <div class="rv-habit-bar-wrap">
                        <div class="rv-habit-bar-fill" style="width:${h.pct}%;background:${CATEGORIES[h.category]?.color || 'var(--accent-primary)'}"></div>
                    </div>
                    <span class="rv-habit-pct ${h.pct === 100 ? 'good' : h.pct >= 50 ? 'mid' : 'low'}">${h.done}/${daysLogged}</span>
                </div>`).join('')}
            </div>
        </div>` : ''}

        <!-- Auto-insights -->
        ${insights.length ? `
        <div class="rv-section">
            <h3 class="rv-section-title">Análisis automático</h3>
            <div class="rv-insights">
                ${insights.map(ins => `
                <div class="rv-insight-item" style="border-left-color:${ins.color}">
                    <span class="rv-insight-emoji">${ins.emoji}</span>
                    <div>
                        <p class="rv-insight-text">${ins.text}</p>
                        ${ins.action ? `<p class="rv-insight-action">${ins.action}</p>` : ''}
                    </div>
                </div>`).join('')}
            </div>
        </div>` : ''}

        <!-- Reflection form -->
        <form id="rv-form">
            <div class="rv-section">
                <h3 class="rv-section-title">Reflexión</h3>

                <div class="form-group">
                    <label>Principal logro de la semana</label>
                    <textarea id="rv-well" rows="2" placeholder="El mayor avance o victoria de esta semana...">${existing?.wentWell || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Un ajuste concreto para la próxima semana</label>
                    <textarea id="rv-improve" rows="2" placeholder="Un cambio específico y medible que harás diferente...">${existing?.improve || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Foco principal de la próxima semana</label>
                    <select id="rv-focus">
                        <option value="">Selecciona un área</option>
                        ${Object.entries(CATEGORIES).map(([k, c]) => `
                        <option value="${k}" ${(existing?.nextWeekFocus || [])[0] === k ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Calificación de la semana</label>
                    <div class="rv-stars">
                        ${[1,2,3,4,5].map(s => `
                        <button type="button" class="rv-star ${(existing?.overallRating || 0) >= s ? 'active' : ''}" data-star="${s}">★</button>`).join('')}
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Guardar revisión${existing ? '' : ' +35 XP'}</button>
            </div>
        </form>

        <!-- History -->
        ${reviews.length > 1 ? `
        <div class="rv-section">
            <h3 class="rv-section-title">Revisiones anteriores</h3>
            <div class="rv-history">
                ${reviews.slice().reverse().slice(0, 8).map(r => `
                <div class="rv-history-row">
                    <span class="text-secondary">${formatDateDisplay(r.weekStart)}</span>
                    <span class="rv-history-stars">${'★'.repeat(r.overallRating || 0)}${'☆'.repeat(5 - (r.overallRating || 0))}</span>
                    ${r.wentWell ? `<span class="rv-history-note">${r.wentWell.substring(0, 60)}${r.wentWell.length > 60 ? '…' : ''}</span>` : ''}
                </div>`).join('')}
            </div>
        </div>` : ''}

    </div>`;

    _bindForm({ existing, weekStartStr, weekEndStr });
}

function _generateInsights({ habitStats, habitWeekPct, taskPct, tasksDone, tasksTotal, journalDays, daysLogged, avgMood, habits }) {
    const insights = [];

    // Best habit
    const best = habitStats[0];
    if (best && best.pct === 100) {
        insights.push({ emoji: '🏆', color: '#10b981', text: `"${best.name}" fue tu hábito perfecto esta semana — 100% completado. La consistencia forma la identidad (James Clear).`, action: null });
    } else if (best && best.pct >= 70) {
        insights.push({ emoji: '📈', color: '#10b981', text: `Tu hábito más consistente: "${best.name}" (${best.pct}%). Construye sobre esa base.`, action: null });
    }

    // Weakest habit
    const worst = [...habitStats].reverse()[0];
    if (worst && worst.pct < 30 && habitStats.length > 1) {
        insights.push({ emoji: '🎯', color: '#f59e0b', text: `"${worst.name}" tuvo solo ${worst.pct}% de cumplimiento. Considera reducirlo a 2 min al día (BJ Fogg: el tamaño importa más que la intención).`, action: `Edita el hábito y añade un disparador (cue) más específico.` });
    }

    // Overall rate
    if (habitWeekPct >= 85) {
        insights.push({ emoji: '🔥', color: '#6366f1', text: `Semana de alto rendimiento: ${habitWeekPct}% de hábitos completados. Estás en el umbral de automatización.`, action: null });
    } else if (habitWeekPct < 40 && habits.length > 0) {
        insights.push({ emoji: '⚠️', color: '#ef4444', text: `Solo el ${habitWeekPct}% de hábitos completados. Considera reducir el número de hábitos activos — menos es más consistente (Fogg, 2019).`, action: null });
    }

    // Task execution
    if (taskPct !== null && taskPct < 50 && tasksTotal >= 3) {
        insights.push({ emoji: '📋', color: '#f59e0b', text: `Solo el ${taskPct}% de tareas completadas (${tasksDone}/${tasksTotal}). Planifica menos o usa la regla de las 3 MIT al día.`, action: null });
    } else if (taskPct !== null && taskPct >= 90 && tasksTotal >= 3) {
        insights.push({ emoji: '⚡', color: '#10b981', text: `Ejecución de tareas excepcional: ${taskPct}%. El sistema de planificación está funcionando.`, action: null });
    }

    // Journal
    if (journalDays === 0) {
        insights.push({ emoji: '📝', color: '#8b5cf6', text: `Sin entradas de diario esta semana. Escribir 3 minutos reduce el cortisol 23% (Pennebaker, 1997) y consolida aprendizajes.`, action: 'Propósito: 1 entrada por día la próxima semana.' });
    } else if (journalDays >= daysLogged) {
        insights.push({ emoji: '📓', color: '#6366f1', text: `Diario completo: ${journalDays}/${daysLogged} días. La escritura reflexiva acelera el crecimiento personal (Kolb, 1984).`, action: null });
    }

    // Mood insight
    const mood = parseFloat(avgMood);
    if (!isNaN(mood) && mood < 3) {
        insights.push({ emoji: '💙', color: '#3b82f6', text: `Semana emocionalmente difícil (ánimo promedio: ${avgMood}/5). Las semanas duras son datos, no destino. Revisa el sueño y el movimiento primero.`, action: null });
    } else if (!isNaN(mood) && mood >= 4) {
        insights.push({ emoji: '✨', color: '#10b981', text: `Bienestar elevado esta semana (ánimo: ${avgMood}/5). El estado emocional positivo amplía el repertorio cognitivo (Fredrickson, 2001).`, action: null });
    }

    return insights.slice(0, 4); // max 4 insights
}

function _bindForm({ existing, weekStartStr, weekEndStr }) {
    let rating = existing?.overallRating || 0;
    document.querySelectorAll('.rv-star').forEach(btn => {
        btn.addEventListener('click', () => {
            rating = parseInt(btn.dataset.star);
            document.querySelectorAll('.rv-star').forEach((s, i) => s.classList.toggle('active', i < rating));
        });
    });

    document.getElementById('rv-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const isNew = !existing;
        const review = {
            id: existing?.id || generateId(),
            weekStart: weekStartStr,
            weekEnd: weekEndStr,
            overallRating: rating,
            wentWell: document.getElementById('rv-well').value.trim(),
            improve: document.getElementById('rv-improve').value.trim(),
            nextWeekFocus: [document.getElementById('rv-focus').value].filter(Boolean),
            completedAt: new Date().toISOString()
        };
        const all = store.get('weeklyReviews') || [];
        const idx = all.findIndex(r => r.weekStart === weekStartStr);
        if (idx >= 0) all[idx] = review; else all.push(review);
        store.set('weeklyReviews', all);
        if (isNew) addXP(XP.WEEKLY_REVIEW);
        playSound('complete');
        showToast(isNew ? `Revisión guardada. +${XP.WEEKLY_REVIEW} XP` : 'Revisión actualizada', 'success');
        render();
    });
}

export function init() {}
export function destroy() {}
