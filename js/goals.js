// goals.js - Clean minimal goals tracker
import { store } from './store.js';
import { generateId, formatDateDisplay, today, showToast, showModal, closeModal, playSound, CATEGORIES, getDaysBetween, escapeHtml } from './ui.js';

export function render() {
    const container = document.getElementById('main-content');
    const goals = store.get('goals.items') || [];
    const active = goals.filter(g => g.status === 'active');
    const completed = goals.filter(g => g.status === 'completed');

    container.innerHTML = `
        <div class="gl-page">
            <div class="gl-header">
                <h1>Metas</h1>
                <button class="btn btn-primary btn-sm" id="gl-add">+ Nueva meta</button>
            </div>

            ${!goals.length ? `
            <div class="gl-empty">
                <p class="gl-empty-icon">🎯</p>
                <h3>Define lo que quieres lograr</h3>
                <p class="text-secondary">Una meta clara activa el sistema reticular activador y filtra lo que importa.</p>
                <button class="btn btn-primary" id="gl-add-empty">Crear primera meta</button>
            </div>` : `

            ${active.length ? `
            <div class="gl-section">
                <p class="gl-section-label">En progreso (${active.length})</p>
                <div class="gl-list">
                    ${active.map(g => _goalCard(g)).join('')}
                </div>
            </div>` : ''}

            ${completed.length ? `
            <div class="gl-section" style="margin-top:8px">
                <p class="gl-section-label">Completadas (${completed.length})</p>
                <div class="gl-list">
                    ${completed.map(g => _goalCard(g)).join('')}
                </div>
            </div>` : ''}
            `}
        </div>
    `;

    document.getElementById('gl-add')?.addEventListener('click', showAddForm);
    document.getElementById('gl-add-empty')?.addEventListener('click', showAddForm);

    document.querySelectorAll('.gl-card').forEach(card => {
        card.addEventListener('click', e => {
            if (e.target.closest('button')) return;
            showDetail(card.dataset.id);
        });
    });
    document.querySelectorAll('.gl-edit').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); showEditForm(btn.dataset.id); });
    });
    document.querySelectorAll('.gl-delete').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteGoal(btn.dataset.id); });
    });
}

function _goalCard(g) {
    const cat = CATEGORIES[g.category] || {};
    const daysLeft = g.timeBound ? getDaysBetween(today(), g.timeBound) : null;
    const overdue = g.timeBound && g.timeBound < today() && g.status === 'active';
    const milestoneDone = (g.milestones || []).filter(m => m.completed).length;
    const milestoneTotal = (g.milestones || []).length;
    return `
        <div class="gl-card ${g.status === 'completed' ? 'gl-card-done' : ''}" data-id="${g.id}">
            <div class="gl-card-top">
                <div class="gl-cat-dot" style="background:${cat.color || 'var(--accent-primary)'}"></div>
                <span class="gl-title">${escapeHtml(g.title || '')}</span>
                <div class="gl-actions">
                    <button class="gl-edit btn-icon" data-id="${g.id}" title="Editar">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="gl-delete btn-icon" data-id="${g.id}" title="Eliminar">&times;</button>
                </div>
            </div>
            ${g.description ? `<p class="gl-desc">${escapeHtml(g.description)}</p>` : ''}
            <div class="gl-progress-row">
                <div class="gl-bar">
                    <div class="gl-bar-fill" style="width:${g.progress || 0}%;background:${cat.color || 'var(--accent-primary)'}"></div>
                </div>
                <span class="gl-pct">${g.progress || 0}%</span>
            </div>
            <div class="gl-meta">
                ${milestoneTotal ? `<span class="gl-meta-item">${milestoneDone}/${milestoneTotal} hitos</span>` : ''}
                ${daysLeft !== null ? `<span class="gl-meta-item ${overdue ? 'text-danger' : 'text-muted'}">${overdue ? 'Vencida' : `${daysLeft}d restantes`}</span>` : ''}
                ${g.status === 'completed' ? '<span class="gl-meta-item text-success">✓ Completada</span>' : ''}
            </div>
        </div>`;
}

function showAddForm() {
    showModal('Nueva meta', `
        <form id="gl-form" class="form">
            <div class="form-group">
                <label>Título</label>
                <input type="text" id="gl-title" placeholder="Ej: Correr 10 km" required autofocus>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="gl-category">
                    ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Descripción <span class="text-muted">(opcional)</span></label>
                <textarea id="gl-desc" rows="2" placeholder="Define el resultado esperado"></textarea>
            </div>
            <div class="form-group">
                <label>Fecha límite <span class="text-muted">(opcional)</span></label>
                <input type="date" id="gl-timebound">
            </div>
            <div class="form-group">
                <label>¿Por qué es importante? <span class="text-muted">(opcional)</span></label>
                <input type="text" id="gl-why" placeholder="Tu motivación profunda">
            </div>
            <div class="form-group">
                <label>Hitos <span class="text-muted">(uno por línea, opcional)</span></label>
                <textarea id="gl-milestones" rows="3" placeholder="Semana 1: ...&#10;Semana 2: ..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Crear meta</button>
        </form>
    `);
    document.getElementById('gl-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('gl-title').value.trim();
        if (!title) return;
        const milestoneLines = document.getElementById('gl-milestones').value.split('\n').map(l => l.trim()).filter(Boolean);
        const goals = store.get('goals.items') || [];
        goals.push({
            id: generateId(),
            title,
            category: document.getElementById('gl-category').value,
            description: document.getElementById('gl-desc').value.trim(),
            relevant: document.getElementById('gl-why').value.trim(),
            timeBound: document.getElementById('gl-timebound').value || null,
            milestones: milestoneLines.map(t => ({ id: generateId(), title: t, completed: false, completedAt: null })),
            progress: 0,
            status: 'active',
            createdAt: new Date().toISOString()
        });
        store.set('goals.items', goals);
        closeModal();
        showToast('Meta creada.');
        playSound('complete');
        render();
    });
}

function showEditForm(goalId) {
    const goals = store.get('goals.items') || [];
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    const milestonesText = (g.milestones || []).map(m => m.title).join('\n');
    showModal('Editar meta', `
        <form id="gl-edit-form" class="form">
            <div class="form-group">
                <label>Título</label>
                <input type="text" id="gl-edit-title" value="${escapeHtml(g.title || '')}" required>
            </div>
            <div class="form-group">
                <label>Categoría</label>
                <select id="gl-edit-category">
                    ${Object.entries(CATEGORIES).map(([k, c]) => `<option value="${k}" ${k === g.category ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Descripción</label>
                <textarea id="gl-edit-desc" rows="2">${escapeHtml(g.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Fecha límite</label>
                <input type="date" id="gl-edit-timebound" value="${g.timeBound || ''}">
            </div>
            <div class="form-group">
                <label>Progreso: <span id="gl-edit-pct-label">${g.progress || 0}%</span></label>
                <input type="range" id="gl-edit-progress" min="0" max="100" value="${g.progress || 0}" class="range-slider">
            </div>
            <div class="form-group">
                <label>Hitos (uno por línea)</label>
                <textarea id="gl-edit-milestones" rows="3">${escapeHtml(milestonesText)}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar</button>
        </form>
    `);
    document.getElementById('gl-edit-progress')?.addEventListener('input', e => {
        document.getElementById('gl-edit-pct-label').textContent = e.target.value + '%';
    });
    document.getElementById('gl-edit-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('gl-edit-title').value.trim();
        if (!title) return;
        g.title = title;
        g.category = document.getElementById('gl-edit-category').value;
        g.description = document.getElementById('gl-edit-desc').value.trim();
        g.timeBound = document.getElementById('gl-edit-timebound').value || null;
        g.progress = parseInt(document.getElementById('gl-edit-progress').value, 10) || 0;
        if (g.progress === 100) g.status = 'completed';
        else if (g.status === 'completed' && g.progress < 100) g.status = 'active';
        const lines = document.getElementById('gl-edit-milestones').value.split('\n').map(l => l.trim()).filter(Boolean);
        g.milestones = lines.map((title, i) => {
            const ex = (g.milestones || [])[i];
            return { id: ex?.id || generateId(), title, completed: ex?.completed || false, completedAt: ex?.completedAt || null };
        });
        store.set('goals.items', goals);
        closeModal();
        showToast('Meta actualizada');
        render();
    });
}

function showDetail(goalId) {
    const goals = store.get('goals.items') || [];
    const g = goals.find(x => x.id === goalId);
    if (!g) return;
    showModal(g.title, `
        <div class="gl-detail">
            ${g.relevant ? `<p class="gl-detail-why"><strong>Por qué:</strong> ${escapeHtml(g.relevant)}</p>` : ''}
            ${g.timeBound ? `<p class="text-secondary" style="font-size:0.85rem">Fecha límite: ${formatDateDisplay(g.timeBound)}</p>` : ''}

            <div class="form-group" style="margin-top:12px">
                <label>Progreso: <span id="gl-detail-pct">${g.progress || 0}%</span></label>
                <input type="range" id="gl-detail-progress" min="0" max="100" value="${g.progress || 0}" class="range-slider">
            </div>

            ${(g.milestones || []).length ? `
            <div style="margin-top:12px">
                <p class="gl-section-label" style="margin-bottom:8px">Hitos</p>
                ${g.milestones.map(m => `
                    <div class="gl-milestone ${m.completed ? 'done' : ''}">
                        <button class="gl-ms-check ${m.completed ? 'checked' : ''}" data-mid="${m.id}" type="button">
                            ${m.completed ? '✓' : ''}
                        </button>
                        <span>${escapeHtml(m.title)}</span>
                    </div>`).join('')}
            </div>` : ''}

            <div style="display:flex;gap:8px;margin-top:16px">
                ${g.status === 'active' ? `<button class="btn btn-primary btn-sm" id="gl-complete-btn">Marcar completada</button>` : ''}
                <button class="btn btn-ghost btn-sm" id="gl-close-btn">Cerrar</button>
            </div>
        </div>
    `);
    document.getElementById('gl-detail-progress')?.addEventListener('input', e => {
        document.getElementById('gl-detail-pct').textContent = e.target.value + '%';
    });
    document.getElementById('gl-detail-progress')?.addEventListener('change', e => {
        g.progress = parseInt(e.target.value, 10) || 0;
        store.set('goals.items', goals);
        render();
    });
    document.querySelectorAll('.gl-ms-check').forEach(btn => {
        btn.addEventListener('click', () => {
            const m = (g.milestones || []).find(x => x.id === btn.dataset.mid);
            if (!m) return;
            m.completed = !m.completed;
            m.completedAt = m.completed ? new Date().toISOString() : null;
            const done = g.milestones.filter(x => x.completed).length;
            g.progress = Math.round((done / g.milestones.length) * 100);
            store.set('goals.items', goals);
            playSound('complete');
            showDetail(goalId);
            render();
        });
    });
    document.getElementById('gl-complete-btn')?.addEventListener('click', () => {
        g.status = 'completed'; g.progress = 100;
        store.set('goals.items', goals);
        closeModal();
        showToast('¡Meta completada!');
        playSound('streak');
        render();
    });
    document.getElementById('gl-close-btn')?.addEventListener('click', () => closeModal());
}

function deleteGoal(goalId) {
    if (!confirm('¿Eliminar esta meta?')) return;
    store.set('goals.items', (store.get('goals.items') || []).filter(g => g.id !== goalId));
    showToast('Meta eliminada');
    render();
}

export function init() {}
export function destroy() {}
