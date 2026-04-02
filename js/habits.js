// habits.js - Habit Tracker module
import { store } from './store.js';
import { generateId, today, formatDate, getStreakForHabit, getBestStreakForHabit, streakLevel, streakMilestoneMsg, showToast, showModal, closeModal, playSound, animateReward, createConfetti, CATEGORIES } from './ui.js';
import { addXP, checkAchievements, XP } from './gamification.js';

let currentView = 'list'; // list | heatmap

export function render() {
    const container = document.getElementById('main-content');
    const habits = store.get('habits.items') || [];
    const completions = store.get('habits.completions') || {};
    const todayStr = today();
    const todayCompletions = completions[todayStr] || [];
    const activeHabits = habits.filter(h => !h.archived);

    // Group by category
    const grouped = {};
    for (const cat of Object.keys(CATEGORIES)) {
        const catHabits = activeHabits.filter(h => h.category === cat);
        if (catHabits.length) grouped[cat] = catHabits;
    }

    const totalDone = activeHabits.filter(h => todayCompletions.includes(h.id)).length;
    const totalActive = activeHabits.length;
    const pct = totalActive ? Math.round((totalDone / totalActive) * 100) : 0;
    const pending = totalActive - totalDone;

    // Streak-at-risk: after 19:00 with pending habits
    const hour = new Date().getHours();
    const riskBanner = (hour >= 19 && pending > 0 && totalActive > 0) ? `
        <div class="streak-risk-banner">
            <span class="streak-risk-icon">⚠️</span>
            <div>
                <strong>Rachas en riesgo</strong>
                <span>Tienes ${pending} hábito${pending > 1 ? 's' : ''} sin completar hoy. No pierdas tu racha.</span>
            </div>
        </div>` : '';

    container.innerHTML = `
        <div class="habits-page">
            <div class="page-header">
                <h1>Hábitos</h1>
                <div class="header-actions">
                    <button class="btn btn-sm btn-ghost" onclick="window.habitsToggleView()">${currentView === 'list' ? '⊞ Heatmap' : '☰ Lista'}</button>
                    <button class="btn btn-primary btn-sm" id="add-habit-btn">+ Nuevo Hábito</button>
                </div>
            </div>

            ${riskBanner}

            <div class="glass-card habit-progress-card">
                <div class="habit-progress-info">
                    <span class="habit-progress-text">Progreso de hoy</span>
                    <span class="habit-progress-count">${totalDone}/${totalActive} · ${pct}%</span>
                </div>
                <div class="progress-bar" style="margin:10px 0 4px">
                    <div class="progress-fill" style="width:${pct}%;transition:width 0.6s ease"></div>
                </div>
                ${pct === 100 && totalActive > 0 ? '<p class="all-done-msg">🎉 ¡Todos completados! Tu cerebro te lo agradece.</p>' : ''}
            </div>

            ${currentView === 'list' ? renderListView(grouped, todayCompletions, completions) : renderHeatmapView(activeHabits, completions)}

            ${!activeHabits.length ? `
                <div class="empty-state glass-card">
                    <p class="empty-icon">🎯</p>
                    <h3>Empieza tu transformación</h3>
                    <p>La neurociencia muestra que repetir una acción 66 días crea una vía neuronal automática. Tu primer hábito es el más importante.</p>
                    <button class="btn btn-primary" id="add-habit-empty">+ Crear primer hábito</button>
                </div>
            ` : ''}
        </div>
    `;

    // Event listeners
    document.getElementById('add-habit-btn')?.addEventListener('click', showAddHabitForm);
    document.getElementById('add-habit-empty')?.addEventListener('click', showAddHabitForm);

    document.querySelectorAll('.habit-check').forEach(cb => {
        cb.addEventListener('click', (e) => {
            const habitId = e.currentTarget.dataset.id;
            toggleHabit(habitId);
        });
    });

    document.querySelectorAll('.habit-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const habitId = e.currentTarget.dataset.id;
            deleteHabit(habitId);
        });
    });

    document.querySelectorAll('.habit-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const habitId = e.currentTarget.dataset.id;
            editHabit(habitId);
        });
    });
}

function renderListView(grouped, todayCompletions, completions) {
    let html = '';
    for (const [cat, habits] of Object.entries(grouped)) {
        const catInfo = CATEGORIES[cat];
        html += `
            <div class="habit-category">
                <h3 class="category-header" style="color:${catInfo.color}">
                    <span>${catInfo.icon}</span> ${catInfo.name}
                </h3>
                <div class="habits-list">
                    ${habits.map(h => {
                        const done = todayCompletions.includes(h.id);
                        const streak = getStreakForHabit(h.id, completions);
                        const best = getBestStreakForHabit(h.id, completions);
                        const lvl = streakLevel(streak);
                        const streakHtml = streak > 0 ? `
                            <div class="streak-pill streak-${lvl}">
                                <span class="streak-flame">${streak >= 66 ? '💜' : streak >= 30 ? '🔥' : streak >= 7 ? '🔥' : '🔥'}</span>
                                <span class="streak-num">${streak}</span>
                                ${best > streak ? `<span class="streak-rec">/ ${best}</span>` : ''}
                            </div>` : '<div class="streak-pill streak-zero">—</div>';
                        return `
                            <div class="habit-item glass-card ${done ? 'habit-done' : ''}" ${h.stackAfter ? `style="margin-left:20px;border-left:3px solid ${catInfo.color}"` : ''}>
                                <button class="habit-check ${done ? 'checked' : ''}" data-id="${h.id}" style="--cat-color:${catInfo.color}" aria-label="Completar hábito">
                                    ${done ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                                </button>
                                <div class="habit-info">
                                    <span class="habit-name">${h.name}</span>
                                    ${h.cue ? `<span class="habit-cue">↳ ${h.cue}</span>` : ''}
                                </div>
                                <div class="habit-meta">
                                    ${streakHtml}
                                    <button class="btn-icon habit-edit" data-id="${h.id}" title="Editar">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button class="btn-icon habit-delete" data-id="${h.id}" title="Eliminar">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    return html;
}

function renderHeatmapView(habits, completions) {
    let html = '<div class="heatmap-container">';
    for (const h of habits) {
        const days = [];
        const d = new Date();
        for (let i = 89; i >= 0; i--) {
            const dt = new Date(d);
            dt.setDate(dt.getDate() - i);
            const dateStr = formatDate(dt);
            const done = (completions[dateStr] || []).includes(h.id);
            days.push({ date: dateStr, done });
        }
        const catColor = CATEGORIES[h.category]?.color || '#6c5ce7';
        html += `
            <div class="heatmap-habit glass-card">
                <div class="heatmap-label">${h.name}</div>
                <div class="heatmap-grid">
                    ${days.map(d => `<div class="heatmap-cell ${d.done ? 'heatmap-done' : ''}" title="${d.date}" style="--done-color: ${catColor}"></div>`).join('')}
                </div>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

function toggleHabit(habitId) {
    const todayStr = today();
    const completions = store.get('habits.completions') || {};
    const todayCompletions = completions[todayStr] || [];

    if (todayCompletions.includes(habitId)) {
        completions[todayStr] = todayCompletions.filter(id => id !== habitId);
        store.set('habits.completions', completions);
        render();
        return;
    }

    completions[todayStr] = [...todayCompletions, habitId];
    const streak = getStreakForHabit(habitId, completions);

    // Save best streak record
    const records = store.get('stats.streakRecords') || {};
    if (!records[habitId] || streak > records[habitId]) {
        records[habitId] = streak;
        store.set('stats.streakRecords', records);
    }

    // Award XP: base + streak bonus
    const streakBonus = Math.min(streak * XP.HABIT_STREAK_BONUS, 30);
    addXP(XP.HABIT_COMPLETE + streakBonus);

    // Bonus XP if all habits done today
    const activeHabits = (store.get('habits.items') || []).filter(h => !h.archived);
    const todayDone = completions[todayStr] || [];
    if (activeHabits.every(h => todayDone.includes(h.id))) {
        addXP(XP.ALL_HABITS_DONE);
    }

    checkAchievements();

    // Milestone message
    const milestoneMsg = streakMilestoneMsg(streak);
    const isMilestone = [1, 3, 7, 14, 21, 30, 60, 66, 100, 200, 365].includes(streak);

    if (isMilestone && milestoneMsg) {
        playSound('streak');
        showToast(milestoneMsg, 'success');
        if (streak >= 7) createConfetti(document.body);
        if (streak >= 7) animateReward(document.querySelector(`[data-id="${habitId}"]`));
    } else if (Math.random() < 0.12) {
        // Variable reward: 12% chance of dopamine message
        const bonusMsgs = [
            '¡Racha activa! Cada repetición fortalece la sinapsis.',
            '¡Constancia es poder! Tu cerebro está aprendiendo.',
            '¡Hábito registrado! La disciplina es libertad.',
            '¡Cada día cuenta! Estás construyendo tu mejor versión.'
        ];
        showToast(bonusMsgs[Math.floor(Math.random() * bonusMsgs.length)], 'success');
        playSound('complete');
    } else {
        playSound('complete');
    }

    store.set('habits.completions', completions);
    render();
}

function showAddHabitForm() {
    const habits = store.get('habits.items') || [];
    const activeHabits = habits.filter(h => !h.archived);

    const formHtml = `
        <form id="habit-form" class="form">
            <div class="form-group">
                <label>Nombre del h\u00e1bito</label>
                <input type="text" id="habit-name" placeholder="Ej: Meditar 10 minutos" required>
            </div>
            <div class="form-group">
                <label>Categor\u00eda</label>
                <select id="habit-category">
                    ${Object.entries(CATEGORIES).map(([key, cat]) =>
                        `<option value="${key}">${cat.icon} ${cat.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Frecuencia</label>
                <select id="habit-frequency">
                    <option value="daily">Diario</option>
                    <option value="weekdays">Lun-Vie</option>
                </select>
            </div>
            <div class="form-group">
                <label>Apilar despu\u00e9s de (Habit Stacking)</label>
                <select id="habit-stack">
                    <option value="">Ninguno</option>
                    ${activeHabits.map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
                </select>
                <small class="form-hint">Conecta este h\u00e1bito a uno existente para activar el apilamiento neuronal</small>
            </div>
            <div class="form-group">
                <label>Se\u00f1al / Disparador (Cue)</label>
                <input type="text" id="habit-cue" placeholder="Ej: Despu\u00e9s de servir mi caf\u00e9...">
                <small class="form-hint">El loop de h\u00e1bitos: Se\u00f1al &rarr; Rutina &rarr; Recompensa</small>
            </div>
            <div class="form-group">
                <label>Recompensa</label>
                <input type="text" id="habit-reward" placeholder="Ej: 5 min de m\u00fasica que me gusta">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Crear H\u00e1bito</button>
        </form>
    `;

    showModal('Nuevo H\u00e1bito', formHtml);
    document.getElementById('habit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const habit = {
            id: generateId(),
            name: document.getElementById('habit-name').value.trim(),
            category: document.getElementById('habit-category').value,
            frequency: document.getElementById('habit-frequency').value,
            stackAfter: document.getElementById('habit-stack').value || null,
            cue: document.getElementById('habit-cue').value.trim(),
            reward: document.getElementById('habit-reward').value.trim(),
            createdAt: new Date().toISOString(),
            archived: false
        };
        const items = store.get('habits.items') || [];
        items.push(habit);
        store.set('habits.items', items);
        closeModal();
        showToast('\u00a1H\u00e1bito creado! Cada repetici\u00f3n fortalece la conexi\u00f3n neuronal.');
        render();
    });
}

function editHabit(habitId) {
    const habits = store.get('habits.items') || [];
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const formHtml = `
        <form id="edit-habit-form" class="form">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="edit-habit-name" value="${habit.name}" required>
            </div>
            <div class="form-group">
                <label>Categor\u00eda</label>
                <select id="edit-habit-category">
                    ${Object.entries(CATEGORIES).map(([key, cat]) =>
                        `<option value="${key}" ${key === habit.category ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Se\u00f1al</label>
                <input type="text" id="edit-habit-cue" value="${habit.cue || ''}">
            </div>
            <div class="form-group">
                <label>Recompensa</label>
                <input type="text" id="edit-habit-reward" value="${habit.reward || ''}">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar</button>
        </form>
    `;

    showModal('Editar H\u00e1bito', formHtml);
    document.getElementById('edit-habit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        habit.name = document.getElementById('edit-habit-name').value.trim();
        habit.category = document.getElementById('edit-habit-category').value;
        habit.cue = document.getElementById('edit-habit-cue').value.trim();
        habit.reward = document.getElementById('edit-habit-reward').value.trim();
        store.set('habits.items', habits);
        closeModal();
        showToast('H\u00e1bito actualizado');
        render();
    });
}

function deleteHabit(habitId) {
    if (!confirm('\u00bfEliminar este h\u00e1bito? Perder\u00e1s el historial de rachas.')) return;
    const habits = store.get('habits.items') || [];
    store.set('habits.items', habits.filter(h => h.id !== habitId));
    showToast('H\u00e1bito eliminado');
    render();
}

window.habitsToggleView = function () {
    currentView = currentView === 'list' ? 'heatmap' : 'list';
    render();
};

export function init() {}
export function destroy() {}
