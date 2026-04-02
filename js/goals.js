// goals.js - Goals System module
import { store } from './store.js';
import { generateId, formatDateDisplay, today, showToast, showModal, closeModal, playSound, CATEGORIES, getDaysBetween, escapeHtml } from './ui.js';

let currentView = 'list';
let editingGoalId = null;

function isSimpleMode() {
    const settings = store.get('settings') || {};
    return settings.simpleMode !== false;
}

export function render() {
    const container = document.getElementById('main-content');
    const goals = store.get('goals.items') || [];
    if (editingGoalId && !goals.some((g) => g.id === editingGoalId)) editingGoalId = null;
    const activeGoals = goals.filter((g) => g.status === 'active');
    const completedGoals = goals.filter((g) => g.status === 'completed');
    const simpleMode = isSimpleMode();

    if (simpleMode) currentView = 'list';

    container.innerHTML = `
        <div class="goals-page">
            <div class="page-header">
                <h1>Metas</h1>
                <div class="header-actions">
                    ${!simpleMode ? `<button class="btn btn-sm btn-ghost" onclick="window.goalsToggleView()">${currentView === 'list' ? 'Vista visual' : 'Vista lista'}</button>` : ''}
                    <button class="btn btn-primary btn-sm" id="add-goal-btn">Nueva meta</button>
                </div>
            </div>
            ${simpleMode ? '<p class="text-secondary" style="margin-bottom:14px;font-size:0.85rem">Define pocas metas activas para mantener foco y constancia.</p>' : ''}
            ${currentView === 'list' ? renderListView(activeGoals, completedGoals) : renderVisionBoard(activeGoals)}
        </div>
    `;

    document.getElementById('add-goal-btn')?.addEventListener('click', showAddGoalForm);

    document.querySelectorAll('.goal-card').forEach((card) => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button, input, textarea, select, .goal-inline-edit')) return;
            showGoalDetail(card.dataset.id);
        });
    });

    document.querySelectorAll('.goal-delete').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteGoal(btn.dataset.id);
        });
    });
    document.querySelectorAll('.goal-edit').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineEdit(btn.dataset.id);
        });
    });
    document.querySelectorAll('.goal-inline-save').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            saveInlineEdit(btn.dataset.id);
        });
    });
    document.querySelectorAll('.goal-inline-cancel').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelInlineEdit();
        });
    });
    document.querySelectorAll('.goal-inline-form .range-slider').forEach((slider) => {
        slider.addEventListener('input', () => {
            const value = document.getElementById(`inline-goal-progress-value-${slider.dataset.goalId || slider.id.replace('inline-goal-progress-', '')}`);
            if (value) value.textContent = `${slider.value}%`;
        });
    });
}

function renderListView(activeGoals, completedGoals) {
    const grouped = {};
    for (const cat of Object.keys(CATEGORIES)) {
        const catGoals = activeGoals.filter((g) => g.category === cat);
        if (catGoals.length) grouped[cat] = catGoals;
    }

    if (!activeGoals.length && !completedGoals.length) {
        return `
            <div class="empty-state glass-card">
                <p class="empty-state-kicker">Metas</p>
                <h3>Elige un objetivo principal</h3>
                <p>Un objetivo claro mejora la atención y facilita sostener hábitos consistentes.</p>
                <button class="btn btn-primary" id="add-goal-empty" onclick="document.getElementById('add-goal-btn').click()">Crear primera meta</button>
            </div>
        `;
    }

    let html = '';
    for (const [cat, catGoals] of Object.entries(grouped)) {
        const catInfo = CATEGORIES[cat];
        html += `
            <div class="goal-category">
                <h3 class="category-header">
                    <span class="category-dot" style="background:${catInfo.color};"></span>
                    ${catInfo.name}
                </h3>
                <div class="goals-list">
                    ${catGoals.map((g) => renderGoalCard(g, catInfo)).join('')}
                </div>
            </div>
        `;
    }

    if (completedGoals.length) {
        html += `
            <div class="goal-category">
                <h3 class="category-header"><span class="category-dot" style="background:var(--accent-success);"></span>Completadas (${completedGoals.length})</h3>
                <div class="goals-list">
                    ${completedGoals.map((g) => renderGoalCard(g, CATEGORIES[g.category] || {})).join('')}
                </div>
            </div>
        `;
    }

    return html;
}

function renderGoalCard(goal, catInfo) {
    const daysLeft = goal.timeBound ? getDaysBetween(today(), goal.timeBound) : null;
    const isOverdue = goal.timeBound && goal.timeBound < today() && goal.status === 'active';
    const isInlineEditing = editingGoalId === goal.id;

    if (isInlineEditing) {
        return `
            <div class="goal-card glass-card goal-inline-edit ${goal.status === 'completed' ? 'goal-completed' : ''}" data-id="${goal.id}">
                <div class="goal-card-header">
                    <h4>Editando meta</h4>
                    <div class="goal-card-actions">
                        <button class="btn-icon goal-inline-cancel" data-id="${goal.id}" title="Cancelar" aria-label="Cancelar edicion">&times;</button>
                    </div>
                </div>
                <div class="goal-inline-form">
                    <div class="goal-inline-grid">
                        <div class="form-group">
                            <label for="inline-goal-title-${goal.id}">Titulo</label>
                            <input type="text" id="inline-goal-title-${goal.id}" value="${escapeHtml(goal.title || '')}" maxlength="90" required>
                        </div>
                        <div class="form-group">
                            <label for="inline-goal-category-${goal.id}">Categoria</label>
                            <select id="inline-goal-category-${goal.id}">
                                ${Object.entries(CATEGORIES).map(([key, cat]) => `<option value="${key}" ${goal.category === key ? 'selected' : ''}>${cat.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="inline-goal-desc-${goal.id}">Descripcion</label>
                        <textarea id="inline-goal-desc-${goal.id}" rows="2" maxlength="220">${escapeHtml(goal.description || '')}</textarea>
                    </div>
                    <div class="goal-inline-grid">
                        <div class="form-group">
                            <label for="inline-goal-timebound-${goal.id}">Fecha limite</label>
                            <input type="date" id="inline-goal-timebound-${goal.id}" value="${goal.timeBound || ''}">
                        </div>
                        <div class="form-group">
                            <label for="inline-goal-progress-${goal.id}">Progreso</label>
                            <div class="goal-inline-slider-row">
                                <input type="range" id="inline-goal-progress-${goal.id}" data-goal-id="${goal.id}" min="0" max="100" value="${goal.progress}" class="range-slider">
                                <span class="goal-inline-slider-value" id="inline-goal-progress-value-${goal.id}">${goal.progress}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="goal-inline-actions">
                        <button type="button" class="btn btn-secondary btn-sm goal-inline-cancel" data-id="${goal.id}">Cancelar</button>
                        <button type="button" class="btn btn-primary btn-sm goal-inline-save" data-id="${goal.id}">Guardar</button>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="goal-card glass-card ${goal.status === 'completed' ? 'goal-completed' : ''}" data-id="${goal.id}">
            <div class="goal-card-header">
                <h4>${goal.title}</h4>
                <div class="goal-card-actions">
                    <button class="btn-icon goal-edit" data-id="${goal.id}" title="Editar" aria-label="Editar meta">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon goal-delete" data-id="${goal.id}" title="Eliminar" aria-label="Eliminar meta">&times;</button>
                </div>
            </div>
            <p class="text-secondary goal-desc">${goal.description || ''}</p>
            <div class="progress-stat">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${goal.progress}%; background: ${catInfo.color || 'var(--accent-primary)'}"></div>
                </div>
                <span class="stat-number">${goal.progress}%</span>
            </div>
            <div class="goal-meta">
                ${goal.milestones ? `<span>${goal.milestones.filter((m) => m.completed).length}/${goal.milestones.length} hitos</span>` : ''}
                ${daysLeft !== null ? `<span class="${isOverdue ? 'text-danger' : ''}">${isOverdue ? 'Vencida' : `${daysLeft} días restantes`}</span>` : ''}
            </div>
        </div>
    `;
}

function renderVisionBoard(goals) {
    if (!goals.length) {
        return '<div class="empty-state glass-card"><p>Crea metas para ver la vista visual.</p></div>';
    }
    return `
        <div class="vision-board">
            ${goals.map((goal) => {
                const catInfo = CATEGORIES[goal.category] || {};
                return `
                    <div class="vision-card glass-card goal-card" data-id="${goal.id}" style="border-left: 3px solid ${catInfo.color || 'var(--accent-primary)'}">
                        <h4>${goal.title}</h4>
                        <p class="text-secondary">${goal.description || ''}</p>
                        <div class="progress-bar" style="height:6px">
                            <div class="progress-fill" style="width:${goal.progress}%;background:${catInfo.color || 'var(--accent-primary)'}"></div>
                        </div>
                        <span class="stat-number">${goal.progress}%</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function showAddGoalForm() {
    const simpleMode = isSimpleMode();
    const formHtml = `
        <form id="goal-form" class="form">
            <div class="form-group">
                <label>Título de la meta</label>
                <input type="text" id="goal-title" placeholder="Ej: Correr 10 km" required>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="goal-category">
                    ${Object.entries(CATEGORIES).map(([key, cat]) => `<option value="${key}">${cat.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea id="goal-desc" rows="2" placeholder="Define el resultado esperado"></textarea>
            </div>
            <div class="form-group">
                <label>Fecha límite (opcional)</label>
                <input type="date" id="goal-timebound">
            </div>

            <div class="form-group">
                <label class="check-toggle check-toggle-advanced" for="goal-advanced-toggle">
                    <input type="checkbox" id="goal-advanced-toggle" ${simpleMode ? '' : 'checked'}>
                    <span>Mostrar opciones avanzadas</span>
                </label>
            </div>

            <div id="goal-advanced-fields" style="display:${simpleMode ? 'none' : 'block'}">
                <fieldset class="form-fieldset">
                    <legend>SMART</legend>
                    <div class="form-group">
                        <label>Específica</label>
                        <input type="text" id="goal-specific" placeholder="Qué exactamente quieres lograr">
                    </div>
                    <div class="form-group">
                        <label>Medible</label>
                        <input type="text" id="goal-measurable" placeholder="Cómo medirás el avance">
                    </div>
                    <div class="form-group">
                        <label>Alcanzable</label>
                        <input type="text" id="goal-achievable" placeholder="Recursos y límite realista">
                    </div>
                    <div class="form-group">
                        <label>Relevante</label>
                        <input type="text" id="goal-relevant" placeholder="Por qué es importante para ti">
                    </div>
                </fieldset>
                <div class="form-group">
                    <label>Hitos (uno por línea)</label>
                    <textarea id="goal-milestones" rows="3" placeholder="Semana 1: ...&#10;Semana 2: ..."></textarea>
                </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block">Crear meta</button>
        </form>
    `;

    showModal('Nueva meta', formHtml);

    const advancedToggle = document.getElementById('goal-advanced-toggle');
    const advancedFields = document.getElementById('goal-advanced-fields');
    advancedToggle?.addEventListener('change', () => {
        if (!advancedFields) return;
        advancedFields.style.display = advancedToggle.checked ? 'block' : 'none';
    });

    document.getElementById('goal-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const showAdvanced = document.getElementById('goal-advanced-toggle')?.checked;
        const milestonesText = showAdvanced ? document.getElementById('goal-milestones').value.trim() : '';
        const milestones = milestonesText
            ? milestonesText.split('\n').filter((m) => m.trim()).map((m) => ({
                id: generateId(),
                title: m.trim(),
                completed: false,
                completedAt: null
            }))
            : [];

        const goal = {
            id: generateId(),
            title: document.getElementById('goal-title').value.trim(),
            category: document.getElementById('goal-category').value,
            description: document.getElementById('goal-desc').value.trim(),
            specific: showAdvanced ? document.getElementById('goal-specific').value.trim() : '',
            measurable: showAdvanced ? document.getElementById('goal-measurable').value.trim() : '',
            achievable: showAdvanced ? document.getElementById('goal-achievable').value.trim() : '',
            relevant: showAdvanced ? document.getElementById('goal-relevant').value.trim() : '',
            timeBound: document.getElementById('goal-timebound').value || null,
            milestones,
            progress: 0,
            status: 'active',
            createdAt: new Date().toISOString()
        };

        if (!goal.title) return;
        const goals = store.get('goals.items') || [];
        goals.push(goal);
        store.set('goals.items', goals);
        closeModal();
        showToast('Meta creada');
        playSound('complete');
        render();
    });
}

function showGoalDetail(goalId) {
    const goals = store.get('goals.items') || [];
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const detailHtml = `
        <div class="goal-detail">
            <div class="goal-smart">
                ${goal.specific ? `<div class="smart-item"><strong>Específica:</strong> ${goal.specific}</div>` : ''}
                ${goal.measurable ? `<div class="smart-item"><strong>Medible:</strong> ${goal.measurable}</div>` : ''}
                ${goal.achievable ? `<div class="smart-item"><strong>Alcanzable:</strong> ${goal.achievable}</div>` : ''}
                ${goal.relevant ? `<div class="smart-item"><strong>Relevante:</strong> ${goal.relevant}</div>` : ''}
                ${goal.timeBound ? `<div class="smart-item"><strong>Fecha límite:</strong> ${formatDateDisplay(goal.timeBound)}</div>` : ''}
            </div>

            <div class="form-group" style="margin-top:16px">
                <label>Progreso: <span id="progress-val">${goal.progress}%</span></label>
                <input type="range" id="goal-progress-slider" min="0" max="100" value="${goal.progress}" class="range-slider">
            </div>

            ${goal.milestones?.length ? `
                <div class="milestones-section">
                    <h4>Hitos</h4>
                    <div class="milestone-timeline">
                        ${goal.milestones.map((milestone) => `
                            <div class="milestone-item ${milestone.completed ? 'milestone-done' : ''}">
                                <button class="milestone-check ${milestone.completed ? 'checked' : ''}" data-mid="${milestone.id}">
                                    ${milestone.completed ? '&#10003;' : ''}
                                </button>
                                <span>${milestone.title}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="goal-detail-actions" style="margin-top:16px;display:flex;gap:8px">
                <button class="btn btn-secondary btn-sm" id="edit-goal-btn">Editar meta</button>
                ${goal.status === 'active' ? '<button class="btn btn-success btn-sm" id="complete-goal-btn">Marcar completada</button>' : ''}
                <button class="btn btn-secondary btn-sm" id="close-detail-btn">Cerrar</button>
            </div>
        </div>
    `;

    showModal(goal.title, detailHtml);

    const slider = document.getElementById('goal-progress-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            document.getElementById('progress-val').textContent = `${e.target.value}%`;
        });
        slider.addEventListener('change', (e) => {
            goal.progress = parseInt(e.target.value, 10);
            store.set('goals.items', goals);
            if (goal.progress === 100) {
                showToast('Meta al 100%. Puedes marcarla como completada.');
            }
            render();
        });
    }

    document.querySelectorAll('.milestone-check').forEach((btn) => {
        btn.addEventListener('click', () => {
            const mid = btn.dataset.mid;
            const milestone = goal.milestones.find((m) => m.id === mid);
            if (!milestone) return;
            milestone.completed = !milestone.completed;
            milestone.completedAt = milestone.completed ? new Date().toISOString() : null;
            const completedCount = goal.milestones.filter((m) => m.completed).length;
            goal.progress = Math.round((completedCount / goal.milestones.length) * 100);
            store.set('goals.items', goals);
            playSound('complete');
            showGoalDetail(goalId);
            render();
        });
    });

    document.getElementById('complete-goal-btn')?.addEventListener('click', () => {
        goal.status = 'completed';
        goal.progress = 100;
        store.set('goals.items', goals);
        closeModal();
        showToast('Meta completada');
        playSound('streak');
        render();
    });
    document.getElementById('edit-goal-btn')?.addEventListener('click', () => {
        closeModal();
        startInlineEdit(goalId);
    });

    document.getElementById('close-detail-btn')?.addEventListener('click', () => {
        closeModal();
        render();
    });
}

function deleteGoal(goalId) {
    if (!confirm('¿Eliminar esta meta?')) return;
    const goals = store.get('goals.items') || [];
    store.set('goals.items', goals.filter((g) => g.id !== goalId));
    showToast('Meta eliminada');
    render();
}

function showEditGoalForm(goalId) {
    const goals = store.get('goals.items') || [];
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const milestonesText = (goal.milestones || []).map((m) => m.title).filter(Boolean).join('\n');
    const formHtml = `
        <form id="edit-goal-form" class="form">
            <div class="form-group">
                <label>Título de la meta</label>
                <input type="text" id="edit-goal-title" value="${escapeHtml(goal.title || '')}" required>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="edit-goal-category">
                    ${Object.entries(CATEGORIES).map(([key, cat]) => `<option value="${key}" ${goal.category === key ? 'selected' : ''}>${cat.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea id="edit-goal-desc" rows="2">${escapeHtml(goal.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Fecha límite (opcional)</label>
                <input type="date" id="edit-goal-timebound" value="${goal.timeBound || ''}">
            </div>
            <div class="form-group">
                <label>Específica</label>
                <input type="text" id="edit-goal-specific" value="${escapeHtml(goal.specific || '')}">
            </div>
            <div class="form-group">
                <label>Medible</label>
                <input type="text" id="edit-goal-measurable" value="${escapeHtml(goal.measurable || '')}">
            </div>
            <div class="form-group">
                <label>Alcanzable</label>
                <input type="text" id="edit-goal-achievable" value="${escapeHtml(goal.achievable || '')}">
            </div>
            <div class="form-group">
                <label>Relevante</label>
                <input type="text" id="edit-goal-relevant" value="${escapeHtml(goal.relevant || '')}">
            </div>
            <div class="form-group">
                <label>Hitos (uno por línea)</label>
                <textarea id="edit-goal-milestones" rows="3">${escapeHtml(milestonesText)}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar cambios</button>
        </form>
    `;

    showModal('Editar meta', formHtml);
    document.getElementById('edit-goal-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTitle = document.getElementById('edit-goal-title').value.trim();
        if (!newTitle) return;

        goal.title = newTitle;
        goal.category = document.getElementById('edit-goal-category').value;
        goal.description = document.getElementById('edit-goal-desc').value.trim();
        goal.timeBound = document.getElementById('edit-goal-timebound').value || null;
        goal.specific = document.getElementById('edit-goal-specific').value.trim();
        goal.measurable = document.getElementById('edit-goal-measurable').value.trim();
        goal.achievable = document.getElementById('edit-goal-achievable').value.trim();
        goal.relevant = document.getElementById('edit-goal-relevant').value.trim();

        const milestoneLines = document.getElementById('edit-goal-milestones').value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        goal.milestones = milestoneLines.map((title, index) => {
            const existing = (goal.milestones || [])[index];
            return {
                id: existing?.id || generateId(),
                title,
                completed: existing?.completed || false,
                completedAt: existing?.completedAt || null
            };
        });
        if (!goal.milestones.length) goal.progress = Math.min(goal.progress || 0, 100);

        store.set('goals.items', goals);
        closeModal();
        showToast('Meta actualizada');
        render();
    });
}

function startInlineEdit(goalId) {
    editingGoalId = goalId;
    render();
    requestAnimationFrame(() => {
        const input = document.getElementById(`inline-goal-title-${goalId}`);
        if (input) input.focus();
    });
}

function cancelInlineEdit() {
    editingGoalId = null;
    render();
}

function saveInlineEdit(goalId) {
    const goals = store.get('goals.items') || [];
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const titleInput = document.getElementById(`inline-goal-title-${goalId}`);
    const categoryInput = document.getElementById(`inline-goal-category-${goalId}`);
    const descInput = document.getElementById(`inline-goal-desc-${goalId}`);
    const dateInput = document.getElementById(`inline-goal-timebound-${goalId}`);
    const progressInput = document.getElementById(`inline-goal-progress-${goalId}`);
    if (!titleInput || !categoryInput || !descInput || !dateInput || !progressInput) return;

    const newTitle = titleInput.value.trim();
    if (!newTitle) {
        titleInput.focus();
        return;
    }

    goal.title = newTitle;
    goal.category = categoryInput.value;
    goal.description = descInput.value.trim();
    goal.timeBound = dateInput.value || null;
    goal.progress = parseInt(progressInput.value, 10) || 0;
    if (goal.progress === 100 && goal.status === 'active') {
        goal.status = 'completed';
    } else if (goal.progress < 100 && goal.status === 'completed') {
        goal.status = 'active';
    }

    store.set('goals.items', goals);
    editingGoalId = null;
    showToast('Meta actualizada');
    render();
}

window.goalsToggleView = function goalsToggleView() {
    currentView = currentView === 'list' ? 'vision' : 'list';
    render();
};

export function init() {}
export function destroy() {}
