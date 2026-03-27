// goals.js - Goals System module
import { store } from './store.js';
import { generateId, formatDate, formatDateDisplay, today, showToast, showModal, closeModal, playSound, CATEGORIES, getDaysBetween } from './ui.js';

let currentView = 'list';

export function render() {
    const container = document.getElementById('main-content');
    const goals = store.get('goals.items') || [];
    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed');

    container.innerHTML = `
        <div class="goals-page">
            <div class="page-header">
                <h1>&#127919; Metas</h1>
                <div class="header-actions">
                    <button class="btn btn-sm btn-ghost" onclick="window.goalsToggleView()">${currentView === 'list' ? '&#9638; Vision Board' : '&#9776; Lista'}</button>
                    <button class="btn btn-primary btn-sm" id="add-goal-btn">+ Nueva Meta</button>
                </div>
            </div>

            ${currentView === 'list' ? renderListView(activeGoals, completedGoals) : renderVisionBoard(activeGoals)}
        </div>
    `;

    document.getElementById('add-goal-btn')?.addEventListener('click', showAddGoalForm);

    document.querySelectorAll('.goal-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            showGoalDetail(card.dataset.id);
        });
    });

    document.querySelectorAll('.goal-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGoal(btn.dataset.id);
        });
    });
}

function renderListView(activeGoals, completedGoals) {
    const grouped = {};
    for (const cat of Object.keys(CATEGORIES)) {
        const catGoals = activeGoals.filter(g => g.category === cat);
        if (catGoals.length) grouped[cat] = catGoals;
    }

    let html = '';
    if (!activeGoals.length && !completedGoals.length) {
        return `
            <div class="empty-state glass-card">
                <p class="empty-icon">&#127919;</p>
                <h3>Define tu destino</h3>
                <p>Sin metas claras, tu cerebro no puede activar el Sistema de Activaci\u00f3n Reticular (SAR), el filtro que te hace notar oportunidades alineadas con tus objetivos.</p>
                <button class="btn btn-primary" id="add-goal-empty" onclick="document.getElementById('add-goal-btn').click()">+ Crear primera meta</button>
            </div>
        `;
    }

    for (const [cat, goals] of Object.entries(grouped)) {
        const catInfo = CATEGORIES[cat];
        html += `
            <div class="goal-category">
                <h3 class="category-header" style="color: ${catInfo.color}">
                    <span>${catInfo.icon}</span> ${catInfo.name}
                </h3>
                <div class="goals-list">
                    ${goals.map(g => renderGoalCard(g, catInfo)).join('')}
                </div>
            </div>
        `;
    }

    if (completedGoals.length) {
        html += `
            <div class="goal-category">
                <h3 class="category-header" style="color: var(--accent-success)">&#10003; Completadas (${completedGoals.length})</h3>
                <div class="goals-list">
                    ${completedGoals.map(g => renderGoalCard(g, CATEGORIES[g.category] || {})).join('')}
                </div>
            </div>
        `;
    }

    return html;
}

function renderGoalCard(g, catInfo) {
    const daysLeft = g.timeBound ? getDaysBetween(today(), g.timeBound) : null;
    const isOverdue = g.timeBound && g.timeBound < today() && g.status === 'active';

    return `
        <div class="goal-card glass-card ${g.status === 'completed' ? 'goal-completed' : ''}" data-id="${g.id}">
            <div class="goal-card-header">
                <h4>${g.title}</h4>
                <button class="btn-icon goal-delete" data-id="${g.id}" title="Eliminar">&#128465;</button>
            </div>
            <p class="text-secondary goal-desc">${g.description || ''}</p>
            <div class="progress-stat">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${g.progress}%; background: ${catInfo.color || 'var(--accent-primary)'}"></div>
                </div>
                <span class="stat-number">${g.progress}%</span>
            </div>
            <div class="goal-meta">
                ${g.milestones ? `<span>${g.milestones.filter(m => m.completed).length}/${g.milestones.length} hitos</span>` : ''}
                ${daysLeft !== null ? `<span class="${isOverdue ? 'text-danger' : ''}">${isOverdue ? 'Vencida' : daysLeft + ' d\u00edas restantes'}</span>` : ''}
            </div>
        </div>
    `;
}

function renderVisionBoard(goals) {
    if (!goals.length) {
        return `<div class="empty-state glass-card"><p>Crea metas para ver tu Vision Board</p></div>`;
    }
    return `
        <div class="vision-board">
            ${goals.map(g => {
                const catInfo = CATEGORIES[g.category] || {};
                return `
                    <div class="vision-card glass-card goal-card" data-id="${g.id}" style="border-left: 3px solid ${catInfo.color || '#6c5ce7'}">
                        <h4>${g.title}</h4>
                        <p class="text-secondary">${g.description || ''}</p>
                        <div class="progress-bar" style="height:6px">
                            <div class="progress-fill" style="width:${g.progress}%;background:${catInfo.color || 'var(--accent-primary)'}"></div>
                        </div>
                        <span class="stat-number">${g.progress}%</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function showAddGoalForm() {
    const formHtml = `
        <form id="goal-form" class="form">
            <div class="form-group">
                <label>T\u00edtulo de la meta</label>
                <input type="text" id="goal-title" placeholder="Ej: Correr un marat\u00f3n" required>
            </div>
            <div class="form-group">
                <label>Categor\u00eda</label>
                <select id="goal-category">
                    ${Object.entries(CATEGORIES).map(([key, cat]) =>
                        `<option value="${key}">${cat.icon} ${cat.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Descripci\u00f3n</label>
                <textarea id="goal-desc" rows="2" placeholder="Describe tu meta con detalle..."></textarea>
            </div>
            <fieldset class="form-fieldset">
                <legend>Metodolog\u00eda SMART</legend>
                <div class="form-group">
                    <label>Espec\u00edfica (S)</label>
                    <input type="text" id="goal-specific" placeholder="\u00bfQu\u00e9 exactamente quieres lograr?">
                </div>
                <div class="form-group">
                    <label>Medible (M)</label>
                    <input type="text" id="goal-measurable" placeholder="\u00bfC\u00f3mo sabr\u00e1s que lo lograste?">
                </div>
                <div class="form-group">
                    <label>Alcanzable (A)</label>
                    <input type="text" id="goal-achievable" placeholder="\u00bfEs realista con tus recursos actuales?">
                </div>
                <div class="form-group">
                    <label>Relevante (R)</label>
                    <input type="text" id="goal-relevant" placeholder="\u00bfPor qu\u00e9 es importante para ti?">
                </div>
                <div class="form-group">
                    <label>Temporal (T) - Fecha l\u00edmite</label>
                    <input type="date" id="goal-timebound">
                </div>
            </fieldset>
            <div class="form-group">
                <label>Hitos (uno por l\u00ednea)</label>
                <textarea id="goal-milestones" rows="3" placeholder="Semana 1: Correr 5km\nMes 1: Correr 10km\nMes 3: Correr 21km"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Crear Meta</button>
        </form>
    `;

    showModal('Nueva Meta SMART', formHtml);
    document.getElementById('goal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const milestonesText = document.getElementById('goal-milestones').value.trim();
        const milestones = milestonesText ? milestonesText.split('\n').filter(m => m.trim()).map(m => ({
            id: generateId(),
            title: m.trim(),
            completed: false,
            completedAt: null
        })) : [];

        const goal = {
            id: generateId(),
            title: document.getElementById('goal-title').value.trim(),
            category: document.getElementById('goal-category').value,
            description: document.getElementById('goal-desc').value.trim(),
            specific: document.getElementById('goal-specific').value.trim(),
            measurable: document.getElementById('goal-measurable').value.trim(),
            achievable: document.getElementById('goal-achievable').value.trim(),
            relevant: document.getElementById('goal-relevant').value.trim(),
            timeBound: document.getElementById('goal-timebound').value || null,
            milestones,
            progress: 0,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        const goals = store.get('goals.items') || [];
        goals.push(goal);
        store.set('goals.items', goals);
        closeModal();
        showToast('&#127919; \u00a1Meta creada! Tu SAR ya est\u00e1 buscando oportunidades.');
        playSound('complete');
        render();
    });
}

function showGoalDetail(goalId) {
    const goals = store.get('goals.items') || [];
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    const catInfo = CATEGORIES[goal.category] || {};

    const detailHtml = `
        <div class="goal-detail">
            <div class="goal-smart">
                ${goal.specific ? `<div class="smart-item"><strong>S - Espec\u00edfica:</strong> ${goal.specific}</div>` : ''}
                ${goal.measurable ? `<div class="smart-item"><strong>M - Medible:</strong> ${goal.measurable}</div>` : ''}
                ${goal.achievable ? `<div class="smart-item"><strong>A - Alcanzable:</strong> ${goal.achievable}</div>` : ''}
                ${goal.relevant ? `<div class="smart-item"><strong>R - Relevante:</strong> ${goal.relevant}</div>` : ''}
                ${goal.timeBound ? `<div class="smart-item"><strong>T - Temporal:</strong> ${formatDateDisplay(goal.timeBound)}</div>` : ''}
            </div>

            <div class="form-group" style="margin-top:16px">
                <label>Progreso: <span id="progress-val">${goal.progress}%</span></label>
                <input type="range" id="goal-progress-slider" min="0" max="100" value="${goal.progress}" class="range-slider">
            </div>

            ${goal.milestones?.length ? `
                <div class="milestones-section">
                    <h4>Hitos</h4>
                    <div class="milestone-timeline">
                        ${goal.milestones.map(m => `
                            <div class="milestone-item ${m.completed ? 'milestone-done' : ''}">
                                <button class="milestone-check ${m.completed ? 'checked' : ''}" data-mid="${m.id}">
                                    ${m.completed ? '&#10003;' : ''}
                                </button>
                                <span>${m.title}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="goal-detail-actions" style="margin-top:16px;display:flex;gap:8px">
                ${goal.status === 'active' ? `<button class="btn btn-success btn-sm" id="complete-goal-btn">&#10003; Marcar Completada</button>` : ''}
                <button class="btn btn-secondary btn-sm" id="close-detail-btn">Cerrar</button>
            </div>
        </div>
    `;

    showModal(goal.title, detailHtml);

    // Progress slider
    const slider = document.getElementById('goal-progress-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            document.getElementById('progress-val').textContent = e.target.value + '%';
        });
        slider.addEventListener('change', (e) => {
            goal.progress = parseInt(e.target.value);
            store.set('goals.items', goals);
            if (goal.progress === 100) {
                showToast('&#127881; \u00a1Meta al 100%! \u00bfLa marcas como completada?');
            }
        });
    }

    // Milestone toggles
    document.querySelectorAll('.milestone-check').forEach(btn => {
        btn.addEventListener('click', () => {
            const mid = btn.dataset.mid;
            const milestone = goal.milestones.find(m => m.id === mid);
            if (milestone) {
                milestone.completed = !milestone.completed;
                milestone.completedAt = milestone.completed ? new Date().toISOString() : null;
                // Auto-update progress
                const completedCount = goal.milestones.filter(m => m.completed).length;
                goal.progress = Math.round((completedCount / goal.milestones.length) * 100);
                store.set('goals.items', goals);
                playSound('complete');
                showGoalDetail(goalId); // Re-render detail
                render(); // Update list behind modal
            }
        });
    });

    // Complete goal
    document.getElementById('complete-goal-btn')?.addEventListener('click', () => {
        goal.status = 'completed';
        goal.progress = 100;
        store.set('goals.items', goals);
        closeModal();
        showToast('&#127942; \u00a1Meta completada! Tu cerebro acaba de recibir una gran dosis de dopamina.');
        playSound('streak');
        render();
    });

    document.getElementById('close-detail-btn')?.addEventListener('click', () => {
        closeModal();
        render();
    });
}

function deleteGoal(goalId) {
    if (!confirm('\u00bfEliminar esta meta?')) return;
    const goals = store.get('goals.items') || [];
    store.set('goals.items', goals.filter(g => g.id !== goalId));
    showToast('Meta eliminada');
    render();
}

window.goalsToggleView = function () {
    currentView = currentView === 'list' ? 'vision' : 'list';
    render();
};

export function init() {}
export function destroy() {}
