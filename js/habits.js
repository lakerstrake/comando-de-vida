// habits.js - Clean minimal habit tracker
import { store } from './store.js';
import { generateId, today, formatDate, getStreakForHabit, getBestStreakForHabit, streakMilestoneMsg, showToast, showModal, closeModal, playSound, animateReward, createConfetti, CATEGORIES, icon } from './ui.js';
import { addXP, checkAchievements, XP } from './gamification.js';

let currentView = 'list';

function cleanText(val, fallback = '') {
    const t = String(val ?? '').trim();
    return (!t || t === 'undefined' || t === 'null') ? fallback : t;
}

export function render() {
    const container = document.getElementById('main-content');
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const todayStr = today();
    const todayDone = completions[todayStr] || [];

    const totalDone = habits.filter(h => todayDone.includes(h.id)).length;
    const pct = habits.length ? Math.round((totalDone / habits.length) * 100) : 0;
    const allDone = habits.length > 0 && totalDone === habits.length;

    const pending = habits.filter(h => !todayDone.includes(h.id));
    const done = habits.filter(h => todayDone.includes(h.id));
    const hour = new Date().getHours();
    const showRisk = hour >= 19 && pending.length > 0;

    container.innerHTML = `
        <div class="hb-page">
            <div class="hb-header">
                <h1>Hábitos</h1>
                <div class="hb-header-actions">
                    <button class="btn btn-sm btn-ghost" id="hb-toggle-view">
                        ${currentView === 'list' ? 'Heatmap' : 'Lista'}
                    </button>
                    <button class="btn btn-primary btn-sm" id="hb-add">+ Nuevo</button>
                </div>
            </div>

            ${habits.length > 0 ? `
            <div class="hb-progress-bar-wrap">
                <div class="hb-progress-bar-fill ${allDone ? 'all-done' : ''}" style="width:${pct}%"></div>
            </div>
            <div class="hb-progress-label">
                <span class="${allDone ? 'text-success' : 'text-secondary'}">${totalDone}/${habits.length} completados${allDone ? ' ✓' : ''}</span>
                <span class="text-muted">${pct}%</span>
            </div>
            ` : ''}

            ${showRisk ? `
            <div class="hb-risk-banner">
                ${icon('flame', 13, 'streak-icon')} ${pending.length} hábito${pending.length > 1 ? 's' : ''} sin completar — protege tu racha
            </div>` : ''}

            ${currentView === 'list' ? _renderList(pending, done, todayDone, completions) : _renderHeatmap(habits, completions)}

            ${habits.length === 0 ? `
            <div class="hb-empty">
                <p class="hb-empty-icon">🎯</p>
                <h3>Empieza tu transformación</h3>
                <p class="text-secondary">La consistencia es más poderosa que la intensidad. Crea tu primer hábito.</p>
                <button class="btn btn-primary" id="hb-add-empty">+ Crear primer hábito</button>
            </div>` : ''}
        </div>
    `;

    document.getElementById('hb-toggle-view')?.addEventListener('click', () => {
        currentView = currentView === 'list' ? 'heatmap' : 'list';
        render();
    });
    document.getElementById('hb-add')?.addEventListener('click', showAddForm);
    document.getElementById('hb-add-empty')?.addEventListener('click', showAddForm);

    document.querySelectorAll('.hb-check').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); toggleHabit(btn.dataset.id); });
    });
    document.querySelectorAll('.hb-edit').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); editHabit(btn.dataset.id); });
    });
    document.querySelectorAll('.hb-delete').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteHabit(btn.dataset.id); });
    });
}

function _habitRow(h, todayDone, completions) {
    const done = todayDone.includes(h.id);
    const cat = CATEGORIES[h.category] || {};
    const streak = getStreakForHabit(h.id, completions);
    const best = getBestStreakForHabit(h.id, completions);
    return `
        <div class="hb-row ${done ? 'hb-row-done' : ''}" data-id="${h.id}">
            <button class="hb-check ${done ? 'checked' : ''}" data-id="${h.id}"
                style="--cat:${cat.color || 'var(--accent-primary)'}" aria-label="Completar">
                ${done ? icon('check', 14, '') : ''}
            </button>
            <div class="hb-info">
                <span class="hb-name">${cleanText(h.name, 'Hábito')}</span>
                ${h.cue ? `<span class="hb-cue">${cleanText(h.cue)}</span>` : ''}
            </div>
            <div class="hb-right">
                ${streak > 0 ? `
                <span class="hb-streak ${streak >= 7 ? 'hot' : ''}">
                    ${icon('flame', 11, 'streak-icon')} ${streak}${best > streak ? `<span class="hb-best">/${best}</span>` : ''}
                </span>` : ''}
                <button class="hb-edit btn-icon" data-id="${h.id}" title="Editar">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="hb-delete btn-icon" data-id="${h.id}" title="Eliminar">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
            </div>
        </div>`;
}

function _renderList(pending, done, todayDone, completions) {
    if (!pending.length && !done.length) return '';
    let html = '<div class="hb-list">';
    if (pending.length) {
        html += pending.map(h => _habitRow(h, todayDone, completions)).join('');
    }
    if (done.length) {
        if (pending.length) html += '<div class="hb-divider"></div>';
        html += done.map(h => _habitRow(h, todayDone, completions)).join('');
    }
    html += '</div>';
    return html;
}

function _renderHeatmap(habits, completions) {
    if (!habits.length) return '';
    let html = '<div class="hb-heatmap-wrap">';
    for (const h of habits) {
        const days = [];
        const d = new Date();
        for (let i = 89; i >= 0; i--) {
            const dt = new Date(d); dt.setDate(dt.getDate() - i);
            const ds = formatDate(dt);
            days.push({ date: ds, done: (completions[ds] || []).includes(h.id) });
        }
        const color = CATEGORIES[h.category]?.color || '#4b91ff';
        html += `
            <div class="hb-heatmap-item">
                <span class="hb-heatmap-label">${cleanText(h.name, 'Hábito')}</span>
                <div class="hb-heatmap-grid">
                    ${days.map(day => `<div class="hb-cell ${day.done ? 'done' : ''}" title="${day.date}" style="--c:${color}"></div>`).join('')}
                </div>
            </div>`;
    }
    html += '</div>';
    return html;
}

function toggleHabit(habitId) {
    const todayStr = today();
    const completions = store.get('habits.completions') || {};
    const list = [...(completions[todayStr] || [])];
    const isDone = list.includes(habitId);

    if (isDone) {
        completions[todayStr] = list.filter(id => id !== habitId);
        store.set('habits.completions', completions);
        render();
        return;
    }

    completions[todayStr] = [...list, habitId];
    const streak = getStreakForHabit(habitId, completions);

    const records = store.get('stats.streakRecords') || {};
    if (!records[habitId] || streak > records[habitId]) {
        records[habitId] = streak;
        store.set('stats.streakRecords', records);
    }

    addXP(XP.HABIT_COMPLETE + Math.min(streak * XP.HABIT_STREAK_BONUS, 30));

    const allHabits = (store.get('habits.items') || []).filter(h => !h.archived);
    if (allHabits.every(h => (completions[todayStr] || []).includes(h.id))) {
        addXP(XP.ALL_HABITS_DONE);
        createConfetti(document.body);
        showToast('¡Todos los hábitos completados! +20 XP', 'success', 4000);
    } else {
        playSound('complete');
        const msg = streakMilestoneMsg(streak);
        const milestones = [1, 3, 7, 14, 21, 30, 60, 66, 100, 200, 365];
        if (milestones.includes(streak) && msg) {
            showToast(msg, 'success');
            if (streak >= 7) { createConfetti(document.body); animateReward(document.querySelector(`[data-id="${habitId}"]`)); }
        }
    }

    checkAchievements();
    store.set('habits.completions', completions);
    render();
}

function showAddForm() {
    const activeHabits = (store.get('habits.items') || []).filter(h => !h.archived);
    showModal('Nuevo hábito', `
        <form id="hb-form" class="form">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="hb-name" placeholder="Ej: Meditar 10 minutos" required autofocus>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="hb-category">
                    ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Señal / Disparador <span class="text-muted">(opcional)</span></label>
                <input type="text" id="hb-cue" placeholder="Ej: Después de despertar...">
                <small class="form-hint">Señal → Rutina → Recompensa</small>
            </div>
            <div class="form-group">
                <label>Recompensa <span class="text-muted">(opcional)</span></label>
                <input type="text" id="hb-reward" placeholder="Ej: 5 min de música">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Crear hábito</button>
        </form>
    `);
    document.getElementById('hb-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const items = store.get('habits.items') || [];
        items.push({
            id: generateId(),
            name: cleanText(document.getElementById('hb-name').value, 'Hábito'),
            category: document.getElementById('hb-category').value,
            cue: cleanText(document.getElementById('hb-cue').value),
            reward: cleanText(document.getElementById('hb-reward').value),
            frequency: 'daily',
            createdAt: new Date().toISOString(),
            archived: false
        });
        store.set('habits.items', items);
        closeModal();
        showToast('Hábito creado. La consistencia construye identidad.');
        render();
    });
}

function editHabit(habitId) {
    const habits = store.get('habits.items') || [];
    const h = habits.find(item => item.id === habitId);
    if (!h) return;
    showModal('Editar hábito', `
        <form id="hb-edit-form" class="form">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="hb-edit-name" value="${cleanText(h.name)}" required>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="hb-edit-category">
                    ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${k === h.category ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Señal</label>
                <input type="text" id="hb-edit-cue" value="${cleanText(h.cue)}">
            </div>
            <div class="form-group">
                <label>Recompensa</label>
                <input type="text" id="hb-edit-reward" value="${cleanText(h.reward)}">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar</button>
        </form>
    `);
    document.getElementById('hb-edit-form')?.addEventListener('submit', e => {
        e.preventDefault();
        h.name = cleanText(document.getElementById('hb-edit-name').value, 'Hábito');
        h.category = document.getElementById('hb-edit-category').value;
        h.cue = cleanText(document.getElementById('hb-edit-cue').value);
        h.reward = cleanText(document.getElementById('hb-edit-reward').value);
        store.set('habits.items', habits);
        closeModal();
        showToast('Hábito actualizado');
        render();
    });
}

function deleteHabit(habitId) {
    if (!confirm('¿Eliminar este hábito? Se perderá el historial de rachas.')) return;
    store.set('habits.items', (store.get('habits.items') || []).filter(h => h.id !== habitId));
    showToast('Hábito eliminado');
    render();
}

export function init() {}
export function destroy() {}
