// habits.js - Habit Tracker module
import { store } from './store.js';
import { generateId, today, formatDate, getStreakForHabit, showToast, showModal, closeModal, playSound, animateReward, createConfetti, CATEGORIES } from './ui.js';

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

    container.innerHTML = `
        <div class="habits-page">
            <div class="page-header">
                <h1>&#9876; H\u00e1bitos</h1>
                <div class="header-actions">
                    <button class="btn btn-sm btn-ghost" onclick="window.habitsToggleView()">${currentView === 'list' ? '&#9638; Heatmap' : '&#9776; Lista'}</button>
                    <button class="btn btn-primary btn-sm" id="add-habit-btn">+ Nuevo H\u00e1bito</button>
                </div>
            </div>

            <div class="glass-card habit-progress-card">
                <div class="habit-progress-info">
                    <span class="habit-progress-text">Progreso de hoy</span>
                    <span class="habit-progress-count">${totalDone}/${totalActive} (${pct}%)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${pct}%"></div>
                </div>
                ${pct === 100 && totalActive > 0 ? '<p class="all-done-msg">&#127881; \u00a1Todos los h\u00e1bitos completados! Tu cerebro te lo agradece.</p>' : ''}
            </div>

            ${currentView === 'list' ? renderListView(grouped, todayCompletions, completions) : renderHeatmapView(activeHabits, completions)}

            ${!activeHabits.length ? `
                <div class="empty-state glass-card">
                    <p class="empty-icon">&#9876;</p>
                    <h3>Empieza tu transformaci\u00f3n</h3>
                    <p>Los h\u00e1bitos son el pilar del \u00e9xito. La neurociencia muestra que repetir una acci\u00f3n 66 d\u00edas promedio crea una v\u00eda neuronal autom\u00e1tica.</p>
                    <button class="btn btn-primary" id="add-habit-empty">+ Crear primer h\u00e1bito</button>
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
                <h3 class="category-header" style="color: ${catInfo.color}">
                    <span>${catInfo.icon}</span> ${catInfo.name}
                </h3>
                <div class="habits-list">
                    ${habits.map(h => {
                        const done = todayCompletions.includes(h.id);
                        const streak = getStreakForHabit(h.id, completions);
                        return `
                            <div class="habit-item glass-card ${done ? 'habit-done' : ''}" ${h.stackAfter ? 'style="margin-left: 24px; border-left: 2px solid ' + catInfo.color + '"' : ''}>
                                <button class="habit-check ${done ? 'checked' : ''}" data-id="${h.id}" style="--cat-color: ${catInfo.color}">
                                    ${done ? '&#10003;' : ''}
                                </button>
                                <div class="habit-info">
                                    <span class="habit-name">${h.name}</span>
                                    ${h.cue ? `<span class="habit-cue">&#128279; ${h.cue}</span>` : ''}
                                </div>
                                <div class="habit-meta">
                                    ${streak > 0 ? `<span class="streak-badge ${streak >= 30 ? 'streak-fire' : streak >= 7 ? 'streak-hot' : ''}">${streak} &#128293;</span>` : ''}
                                    <button class="btn-icon habit-edit" data-id="${h.id}" title="Editar">&#9998;</button>
                                    <button class="btn-icon habit-delete" data-id="${h.id}" title="Eliminar">&#128465;</button>
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
    } else {
        completions[todayStr] = [...todayCompletions, habitId];
        const streak = getStreakForHabit(habitId, completions);

        // Variable reward (1 in 5 chance)
        if (Math.random() < 0.2) {
            showToast('&#10024; \u00a1Bonus! Tu cerebro acaba de liberar dopamina extra.', 'success');
        }

        if (streak === 7) {
            playSound('streak');
            showToast('&#128293; \u00a17 d\u00edas seguidos! La v\u00eda neuronal se est\u00e1 formando.', 'success');
            createConfetti(document.body);
        } else if (streak === 30) {
            playSound('streak');
            showToast('&#127942; \u00a130 d\u00edas! Este h\u00e1bito se est\u00e1 volviendo autom\u00e1tico.', 'success');
            createConfetti(document.body);
        } else if (streak === 66) {
            playSound('streak');
            showToast('&#128142; \u00a166 d\u00edas! Seg\u00fan la ciencia, ya es parte de ti.', 'success');
            createConfetti(document.body);
        } else {
            playSound('complete');
        }
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
