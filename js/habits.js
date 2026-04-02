// habits.js - Habit Tracker module
import { store } from './store.js';
import { generateId, today, formatDate, getStreakForHabit, getBestStreakForHabit, streakLevel, streakMilestoneMsg, showToast, showModal, closeModal, playSound, animateReward, createConfetti, CATEGORIES, icon } from './ui.js';
import { addXP, checkAchievements, XP } from './gamification.js';

let currentView = 'list'; // list | heatmap

function cleanHabitText(value, fallback = '') {
    if (value == null) return fallback;
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') return fallback;
    return text;
}

export function render() {
    const container = document.getElementById('main-content');
    const habits = store.get('habits.items') || [];
    const completions = store.get('habits.completions') || {};
    const todayStr = today();
    const todayCompletions = completions[todayStr] || [];
    const activeHabits = habits.filter((habit) => !habit.archived);

    const grouped = {};
    for (const category of Object.keys(CATEGORIES)) {
        const categoryHabits = activeHabits.filter((habit) => habit.category === category);
        if (categoryHabits.length) grouped[category] = categoryHabits;
    }
    const uncategorizedHabits = activeHabits.filter((habit) => !CATEGORIES[habit.category]);
    if (uncategorizedHabits.length) grouped.misc = uncategorizedHabits;

    const totalDone = activeHabits.filter((habit) => todayCompletions.includes(habit.id)).length;
    const totalActive = activeHabits.length;
    const pct = totalActive ? Math.round((totalDone / totalActive) * 100) : 0;
    const pending = totalActive - totalDone;

    const hour = new Date().getHours();
    const riskBanner = (hour >= 19 && pending > 0 && totalActive > 0) ? `
        <div class="streak-risk-banner">
            <span class="streak-risk-icon">${icon('bolt', 14, 'risk-icon')}</span>
            <div>
                <strong>Rachas en riesgo</strong>
                <span>Tienes ${pending} habito${pending > 1 ? 's' : ''} sin completar hoy. Protege tu consistencia.</span>
            </div>
        </div>` : '';

    container.innerHTML = `
        <div class="habits-page">
            <div class="page-header">
                <h1>Habitos</h1>
                <div class="header-actions">
                    <button class="btn btn-sm btn-ghost" id="toggle-view-btn">${currentView === 'list' ? `${icon('target', 12, 'inline-icon')} Heatmap` : `${icon('sparkle', 12, 'inline-icon')} Lista`}</button>
                    <button class="btn btn-primary btn-sm" id="add-habit-btn">+ Nuevo habito</button>
                </div>
            </div>

            ${riskBanner}

            <div class="glass-card habit-progress-card">
                <div class="habit-progress-info">
                    <span class="habit-progress-text">Progreso de hoy</span>
                    <span class="habit-progress-count">${totalDone}/${totalActive} - ${pct}%</span>
                </div>
                <div class="progress-bar" style="margin:10px 0 4px">
                    <div class="progress-fill" style="width:${pct}%;transition:width 0.6s ease"></div>
                </div>
                ${pct === 100 && totalActive > 0 ? `<p class="all-done-msg">${icon('check', 13, 'inline-icon')} Todos completados. Excelente disciplina.</p>` : ''}
            </div>

            ${currentView === 'list' ? renderListView(grouped, todayCompletions, completions) : renderHeatmapView(activeHabits, completions)}

            ${!activeHabits.length ? `
                <div class="empty-state glass-card">
                    <p class="empty-icon">${icon('target', 22, 'empty-icon-svg')}</p>
                    <h3>Empieza tu transformacion</h3>
                    <p>Repetir una accion de forma consistente acelera la automatizacion del habito. Comienza con uno.</p>
                    <button class="btn btn-primary" id="add-habit-empty">+ Crear primer habito</button>
                </div>
            ` : ''}
        </div>
    `;

    document.getElementById('toggle-view-btn')?.addEventListener('click', () => {
        currentView = currentView === 'list' ? 'heatmap' : 'list';
        render();
    });
    document.getElementById('add-habit-btn')?.addEventListener('click', showAddHabitForm);
    document.getElementById('add-habit-empty')?.addEventListener('click', showAddHabitForm);

    document.querySelectorAll('.habit-check').forEach((checkbox) => {
        checkbox.addEventListener('click', (event) => {
            const habitId = event.currentTarget.dataset.id;
            toggleHabit(habitId);
        });
    });

    document.querySelectorAll('.habit-delete').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteHabit(event.currentTarget.dataset.id);
        });
    });

    document.querySelectorAll('.habit-edit').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            editHabit(event.currentTarget.dataset.id);
        });
    });
}

function renderListView(grouped, todayCompletions, completions) {
    let html = '';
    for (const [category, habits] of Object.entries(grouped)) {
        const categoryInfo = CATEGORIES[category] || {
            name: cleanHabitText(category, 'Sin categoria'),
            icon: icon('sparkle', 14, 'category-icon-svg'),
            color: 'var(--accent-primary)'
        };
        const categoryIcon = cleanHabitText(categoryInfo.icon, icon('sparkle', 14, 'category-icon-svg'));
        const categoryName = cleanHabitText(categoryInfo.name, 'Sin categoria');
        const categoryColor = cleanHabitText(categoryInfo.color, 'var(--accent-primary)');
        html += `
            <div class="habit-category">
                <h3 class="category-header" style="color:${categoryColor}">
                    <span>${categoryIcon}</span> ${categoryName}
                </h3>
                <div class="habits-list">
                    ${habits.map((habit) => {
                        const done = todayCompletions.includes(habit.id);
                        const streak = getStreakForHabit(habit.id, completions);
                        const best = getBestStreakForHabit(habit.id, completions);
                        const lvl = streakLevel(streak);
                        const habitName = cleanHabitText(habit.name, 'Habito sin nombre');
                        const cueText = cleanHabitText(habit.cue, '');
                        const streakHtml = streak > 0 ? `
                            <div class="streak-pill streak-${lvl}">
                                <span class="streak-flame">${streak >= 66 ? icon('shield', 11, 'streak-icon') : icon('flame', 11, 'streak-icon')}</span>
                                <span class="streak-num">${streak}</span>
                                ${best > streak ? `<span class="streak-rec">/ ${best}</span>` : ''}
                            </div>` : '<div class="streak-pill streak-zero">-</div>';
                        return `
                            <div class="habit-item glass-card ${done ? 'habit-done' : ''}" ${habit.stackAfter ? `style="margin-left:20px;border-left:3px solid ${categoryColor}"` : ''}>
                                <button class="habit-check ${done ? 'checked' : ''}" data-id="${habit.id}" style="--cat-color:${categoryColor}" aria-label="Completar habito">
                                    ${done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                                </button>
                                <div class="habit-info">
                                    <span class="habit-name">${habitName}</span>
                                    ${cueText ? `<span class="habit-cue">${icon('arrowRight', 10, 'inline-arrow-icon')} ${cueText}</span>` : ''}
                                </div>
                                <div class="habit-meta">
                                    ${streakHtml}
                                    <button class="btn-icon habit-edit" data-id="${habit.id}" title="Editar">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button class="btn-icon habit-delete" data-id="${habit.id}" title="Eliminar">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
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
    for (const habit of habits) {
        const days = [];
        const d = new Date();
        for (let i = 89; i >= 0; i--) {
            const dt = new Date(d);
            dt.setDate(dt.getDate() - i);
            const dateStr = formatDate(dt);
            const done = (completions[dateStr] || []).includes(habit.id);
            days.push({ date: dateStr, done });
        }
        const categoryColor = CATEGORIES[habit.category]?.color || '#4b91ff';
        const habitName = cleanHabitText(habit.name, 'Habito sin nombre');
        html += `
            <div class="heatmap-habit glass-card">
                <div class="heatmap-label">${habitName}</div>
                <div class="heatmap-grid">
                    ${days.map((day) => `<div class="heatmap-cell ${day.done ? 'heatmap-done' : ''}" title="${day.date}" style="--done-color:${categoryColor}"></div>`).join('')}
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
        completions[todayStr] = todayCompletions.filter((id) => id !== habitId);
        store.set('habits.completions', completions);
        render();
        return;
    }

    completions[todayStr] = [...todayCompletions, habitId];
    const streak = getStreakForHabit(habitId, completions);

    const records = store.get('stats.streakRecords') || {};
    if (!records[habitId] || streak > records[habitId]) {
        records[habitId] = streak;
        store.set('stats.streakRecords', records);
    }

    const streakBonus = Math.min(streak * XP.HABIT_STREAK_BONUS, 30);
    addXP(XP.HABIT_COMPLETE + streakBonus);

    const activeHabits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const todayDone = completions[todayStr] || [];
    if (activeHabits.every((habit) => todayDone.includes(habit.id))) {
        addXP(XP.ALL_HABITS_DONE);
    }

    checkAchievements();

    const milestoneMsg = streakMilestoneMsg(streak);
    const milestoneStreaks = [1, 3, 7, 14, 21, 30, 60, 66, 100, 200, 365];
    if (milestoneStreaks.includes(streak) && milestoneMsg) {
        playSound('streak');
        showToast(milestoneMsg, 'success');
        if (streak >= 7) {
            createConfetti(document.body);
            animateReward(document.querySelector(`[data-id="${habitId}"]`));
        }
    } else if (Math.random() < 0.12) {
        const bonusMessages = [
            'Racha activa. Cada repeticion fortalece el patron.',
            'Constancia en marcha. Tu sistema responde mejor.',
            'Habito registrado. Sigue con la misma precision.',
            'Cada dia cuenta. Mantienes una base solida.'
        ];
        showToast(bonusMessages[Math.floor(Math.random() * bonusMessages.length)], 'success');
        playSound('complete');
    } else {
        playSound('complete');
    }

    store.set('habits.completions', completions);
    render();
}

function showAddHabitForm() {
    const habits = store.get('habits.items') || [];
    const activeHabits = habits.filter((habit) => !habit.archived);

    const formHtml = `
        <form id="habit-form" class="form">
            <div class="form-group">
                <label>Nombre del habito</label>
                <input type="text" id="habit-name" placeholder="Ej: Meditar 10 minutos" required>
            </div>
            <div class="form-group">
                <label>Categoria</label>
                <select id="habit-category">
                    ${Object.entries(CATEGORIES).map(([key, category]) => `<option value="${key}">${category.name}</option>`).join('')}
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
                <label>Apilar despues de</label>
                <select id="habit-stack">
                    <option value="">Ninguno</option>
                    ${activeHabits.map((habit) => `<option value="${habit.id}">${cleanHabitText(habit.name, 'Habito sin nombre')}</option>`).join('')}
                </select>
                <small class="form-hint">Conecta este habito a uno existente para iniciar con menos friccion.</small>
            </div>
            <div class="form-group">
                <label>Senal / Disparador</label>
                <input type="text" id="habit-cue" placeholder="Ej: Despues de servir mi cafe...">
                <small class="form-hint">Loop de habitos: Senal -> Rutina -> Recompensa</small>
            </div>
            <div class="form-group">
                <label>Recompensa</label>
                <input type="text" id="habit-reward" placeholder="Ej: 5 min de musica">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Crear habito</button>
        </form>
    `;

    showModal('Nuevo habito', formHtml);
    document.getElementById('habit-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const habit = {
            id: generateId(),
            name: cleanHabitText(document.getElementById('habit-name').value, 'Habito sin nombre'),
            category: document.getElementById('habit-category').value,
            frequency: document.getElementById('habit-frequency').value,
            stackAfter: document.getElementById('habit-stack').value || null,
            cue: cleanHabitText(document.getElementById('habit-cue').value, ''),
            reward: cleanHabitText(document.getElementById('habit-reward').value, ''),
            createdAt: new Date().toISOString(),
            archived: false
        };
        const items = store.get('habits.items') || [];
        items.push(habit);
        store.set('habits.items', items);
        closeModal();
        showToast('Habito creado. Cada repeticion construye consistencia.');
        render();
    });
}

function editHabit(habitId) {
    const habits = store.get('habits.items') || [];
    const habit = habits.find((item) => item.id === habitId);
    if (!habit) return;

    const formHtml = `
        <form id="edit-habit-form" class="form">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" id="edit-habit-name" value="${cleanHabitText(habit.name, 'Habito sin nombre')}" required>
            </div>
            <div class="form-group">
                <label>Categoria</label>
                <select id="edit-habit-category">
                    ${Object.entries(CATEGORIES).map(([key, category]) =>
                        `<option value="${key}" ${key === habit.category ? 'selected' : ''}>${category.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Senal</label>
                <input type="text" id="edit-habit-cue" value="${cleanHabitText(habit.cue, '')}">
            </div>
            <div class="form-group">
                <label>Recompensa</label>
                <input type="text" id="edit-habit-reward" value="${cleanHabitText(habit.reward, '')}">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar</button>
        </form>
    `;

    showModal('Editar habito', formHtml);
    document.getElementById('edit-habit-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        habit.name = cleanHabitText(document.getElementById('edit-habit-name').value, 'Habito sin nombre');
        habit.category = document.getElementById('edit-habit-category').value;
        habit.cue = cleanHabitText(document.getElementById('edit-habit-cue').value, '');
        habit.reward = cleanHabitText(document.getElementById('edit-habit-reward').value, '');
        store.set('habits.items', habits);
        closeModal();
        showToast('Habito actualizado');
        render();
    });
}

function deleteHabit(habitId) {
    if (!confirm('Eliminar este habito? Perderas su historial de rachas.')) return;
    const habits = store.get('habits.items') || [];
    store.set('habits.items', habits.filter((habit) => habit.id !== habitId));
    showToast('Habito eliminado');
    render();
}

export function init() {}
export function destroy() {}
