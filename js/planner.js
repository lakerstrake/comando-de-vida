// planner.js - Clean minimal daily planner with Pomodoro
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, showModal, closeModal, playSound } from './ui.js';
import { addXP, checkAchievements, XP } from './gamification.js';

let currentTab = 'tasks'; // tasks | pomodoro
let pomodoroState = { running: false, timeLeft: 0, mode: 'work', sessions: 0, interval: null, endTime: null, activeTaskId: null, activeDate: null };
let selectedDate = today();

function getSettings() {
    return store.get('planner.pomodoroSettings') || { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakAfter: 4 };
}

function getTasks() {
    const raw = store.get('planner.tasks') || [];
    return raw.map(t => ({
        ...t,
        title: String(t.title || t.text || '').trim(),
        completed: Boolean(t.completed ?? t.done),
        pomodorosEstimated: Math.max(0, parseInt(t.pomodorosEstimated ?? t.pomos ?? 0, 10) || 0),
        pomodorosCompleted: Math.max(0, parseInt(t.pomodorosCompleted ?? t.pomosDone ?? 0, 10) || 0),
    }));
}

function getFocusTaskId() {
    const m = store.get('planner.pomodoroFocusByDate') || {};
    return m[selectedDate] || null;
}

function setFocusTaskId(id) {
    const m = store.get('planner.pomodoroFocusByDate') || {};
    if (id) m[selectedDate] = id; else delete m[selectedDate];
    store.set('planner.pomodoroFocusByDate', m);
}

export function render() {
    const container = document.getElementById('main-content');
    const allTasks = getTasks();
    const dayTasks = allTasks.filter(t => t.date === selectedDate);
    let focusId = getFocusTaskId();
    if (focusId && !dayTasks.some(t => t.id === focusId && !t.completed)) { setFocusTaskId(null); focusId = null; }

    const donePct = dayTasks.length ? Math.round((dayTasks.filter(t => t.completed).length / dayTasks.length) * 100) : 0;
    const isToday = selectedDate === today();

    container.innerHTML = `
        <div class="pln-page">
            <div class="pln-header">
                <h1>Planificador</h1>
                <div class="pln-date-nav">
                    <button class="btn btn-sm btn-ghost" id="pln-prev">←</button>
                    <span class="pln-date-label">${formatDateDisplay(selectedDate)}${isToday ? ' · Hoy' : ''}</span>
                    <button class="btn btn-sm btn-ghost" id="pln-next">→</button>
                    ${!isToday ? `<button class="btn btn-sm btn-ghost" id="pln-today">Hoy</button>` : ''}
                </div>
            </div>

            <div class="pln-tabs">
                <button class="pln-tab ${currentTab === 'tasks' ? 'active' : ''}" data-tab="tasks">Tareas</button>
                <button class="pln-tab ${currentTab === 'pomodoro' ? 'active' : ''}" data-tab="pomodoro">Foco</button>
            </div>

            <div class="pln-content">
                ${currentTab === 'tasks' ? _renderTasks(dayTasks, focusId, donePct) : _renderPomodoro(dayTasks, focusId)}
            </div>
        </div>
    `;

    // Nav listeners
    document.getElementById('pln-prev')?.addEventListener('click', () => {
        const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() - 1);
        selectedDate = formatDate(d); render();
    });
    document.getElementById('pln-next')?.addEventListener('click', () => {
        const d = new Date(selectedDate + 'T12:00:00'); d.setDate(d.getDate() + 1);
        selectedDate = formatDate(d); render();
    });
    document.getElementById('pln-today')?.addEventListener('click', () => { selectedDate = today(); render(); });

    // Tab listeners
    document.querySelectorAll('.pln-tab').forEach(btn => {
        btn.addEventListener('click', () => { currentTab = btn.dataset.tab; render(); });
    });

    // Task listeners
    document.getElementById('pln-add-task')?.addEventListener('click', showAddTaskForm);
    document.getElementById('pln-add-task-empty')?.addEventListener('click', showAddTaskForm);
    document.querySelectorAll('.pln-task-check').forEach(btn => {
        btn.addEventListener('click', () => toggleTask(btn.dataset.id));
    });
    document.querySelectorAll('.pln-task-edit').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); showEditTaskForm(btn.dataset.id); });
    });
    document.querySelectorAll('.pln-task-delete').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteTask(btn.dataset.id); });
    });
    document.querySelectorAll('.pln-focus-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            setFocusTaskId(getFocusTaskId() === id ? null : id);
            render();
        });
    });

    // Pomodoro listeners
    document.getElementById('pomo-start')?.addEventListener('click', startPomodoro);
    document.getElementById('pomo-pause')?.addEventListener('click', pausePomodoro);
    document.getElementById('pomo-reset')?.addEventListener('click', resetPomodoro);
    document.getElementById('pomo-task-select')?.addEventListener('change', e => {
        setFocusTaskId(e.target.value || null); render();
    });
}

function _renderTasks(tasks, focusId, donePct) {
    const pending = tasks.filter(t => !t.completed).sort((a, b) => {
        const score = t => (t.urgent && t.important ? 2 : t.important ? 1 : 0);
        return score(b) - score(a);
    });
    const done = tasks.filter(t => t.completed);

    return `
        <div class="pln-tasks">
            <div class="pln-tasks-header">
                ${tasks.length ? `
                <div class="pln-task-progress">
                    <div class="pln-task-bar-fill" style="width:${donePct}%"></div>
                </div>
                <span class="text-muted" style="font-size:0.8rem">${done.length}/${tasks.length}</span>` : ''}
                <button class="btn btn-primary btn-sm" id="pln-add-task">+ Nueva tarea</button>
            </div>

            ${!tasks.length ? `
            <div class="pln-empty">
                <p class="text-secondary">Define tu siguiente acción clara. Las tareas concretas eliminan la parálisis.</p>
                <button class="btn btn-primary" id="pln-add-task-empty">+ Añadir tarea</button>
            </div>` : ''}

            <div class="pln-task-list">
                ${pending.map(t => _taskRow(t, focusId)).join('')}
                ${done.length && pending.length ? '<div class="hb-divider"></div>' : ''}
                ${done.map(t => _taskRow(t, focusId)).join('')}
            </div>
        </div>
    `;
}

function _taskRow(t, focusId) {
    const isFocus = focusId === t.id;
    const pomoPct = t.pomodorosEstimated ? Math.min(100, Math.round(((t.pomodorosCompleted || 0) / t.pomodorosEstimated) * 100)) : 0;
    return `
        <div class="pln-task-row ${t.completed ? 'done' : ''} ${t.urgent && t.important ? 'critical' : ''}">
            <button class="pln-task-check ${t.completed ? 'checked' : ''}" data-id="${t.id}" aria-label="Completar">
                ${t.completed ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
            <div class="pln-task-info">
                <span class="pln-task-title">${t.title}</span>
                <div class="pln-task-tags">
                    ${t.timeStart ? `<span class="pln-tag">${t.timeStart}${t.timeEnd ? '–' + t.timeEnd : ''}</span>` : ''}
                    ${t.urgent && t.important ? '<span class="pln-tag pln-tag-critical">Crítico</span>' : t.important ? '<span class="pln-tag pln-tag-important">Importante</span>' : ''}
                    ${t.pomodorosEstimated ? `<span class="pln-tag">${t.pomodorosCompleted || 0}/${t.pomodorosEstimated} 🍅</span>` : ''}
                    ${isFocus ? '<span class="pln-tag pln-tag-focus">En foco</span>' : ''}
                </div>
                ${t.pomodorosEstimated ? `
                <div class="pln-pomo-bar">
                    <div class="pln-pomo-bar-fill" style="width:${pomoPct}%"></div>
                </div>` : ''}
            </div>
            <div class="pln-task-actions">
                ${!t.completed ? `
                <button class="pln-focus-btn btn-icon ${isFocus ? 'active' : ''}" data-id="${t.id}" title="${isFocus ? 'Quitar foco' : 'Enfocar'}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>
                </button>` : ''}
                <button class="pln-task-edit btn-icon" data-id="${t.id}" title="Editar">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="pln-task-delete btn-icon" data-id="${t.id}" title="Eliminar">&times;</button>
            </div>
        </div>`;
}

function _renderPomodoro(dayTasks, focusId) {
    const settings = getSettings();
    const candidates = dayTasks.filter(t => !t.completed);
    const focusedTask = candidates.find(t => t.id === focusId) || null;
    const totalSecs = pomodoroState.running || pomodoroState.timeLeft > 0
        ? pomodoroState.timeLeft
        : settings.workMinutes * 60;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const maxSecs = pomodoroState.mode === 'work' ? settings.workMinutes * 60
        : pomodoroState.mode === 'shortBreak' ? settings.shortBreakMinutes * 60
        : settings.longBreakMinutes * 60;
    const progress = maxSecs > 0 ? (maxSecs - totalSecs) / maxSecs : 0;
    const circ = 2 * Math.PI * 54;
    const modeLabel = pomodoroState.mode === 'work' ? 'Trabajo' : pomodoroState.mode === 'shortBreak' ? 'Descanso' : 'Descanso largo';
    const isWork = pomodoroState.mode === 'work';

    return `
        <div class="pln-pomodoro">
            <div class="pln-pomo-task-select">
                <label class="text-secondary" style="font-size:0.8rem">Tarea de enfoque</label>
                <select id="pomo-task-select">
                    <option value="">Sin vincular</option>
                    ${candidates.map(t => `<option value="${t.id}" ${focusId === t.id ? 'selected' : ''}>${t.title}${t.pomodorosEstimated ? ` (${t.pomodorosCompleted||0}/${t.pomodorosEstimated})` : ''}</option>`).join('')}
                </select>
            </div>

            <div class="pln-pomo-mode ${isWork ? '' : 'break'}">${modeLabel}</div>

            <div class="pln-pomo-timer">
                <svg viewBox="0 0 120 120" class="pln-pomo-ring">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="var(--bg-tertiary)" stroke-width="6"/>
                    <circle cx="60" cy="60" r="54" fill="none"
                        stroke="${isWork ? 'var(--accent-primary)' : 'var(--accent-success)'}"
                        stroke-width="6" stroke-linecap="round"
                        stroke-dasharray="${circ}"
                        stroke-dashoffset="${circ * (1 - progress)}"
                        transform="rotate(-90 60 60)"/>
                </svg>
                <span class="pln-pomo-time" id="pomo-display">${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}</span>
            </div>

            <div class="pln-pomo-controls">
                ${!pomodoroState.running
                    ? `<button class="btn btn-primary" id="pomo-start">${pomodoroState.timeLeft > 0 ? 'Continuar' : 'Iniciar'}</button>`
                    : `<button class="btn btn-secondary" id="pomo-pause">Pausar</button>`}
                <button class="btn btn-ghost" id="pomo-reset">Reiniciar</button>
            </div>

            <p class="pln-pomo-sessions text-muted">Sesiones: <strong>${pomodoroState.sessions}</strong></p>

            ${focusedTask ? `
            <div class="pln-pomo-focus-info">
                <span class="text-secondary" style="font-size:0.85rem">Trabajando en:</span>
                <span style="font-weight:500">${focusedTask.title}</span>
            </div>` : ''}

            <p class="text-muted" style="font-size:0.78rem;margin-top:16px;text-align:center">
                Intervalos cortos de enfoque reducen la fatiga mental y mejoran la retención.
            </p>
        </div>
    `;
}

function startPomodoro() {
    const settings = getSettings();
    if (pomodoroState.timeLeft <= 0) {
        pomodoroState.timeLeft = settings.workMinutes * 60;
        pomodoroState.mode = 'work';
    }
    if (pomodoroState.mode === 'work' && !pomodoroState.activeTaskId) {
        pomodoroState.activeTaskId = getFocusTaskId();
        pomodoroState.activeDate = selectedDate;
    }
    pomodoroState.running = true;
    pomodoroState.endTime = Date.now() + pomodoroState.timeLeft * 1000;
    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
    pomodoroState.interval = setInterval(() => {
        const remaining = Math.max(0, Math.round((pomodoroState.endTime - Date.now()) / 1000));
        pomodoroState.timeLeft = remaining;
        const display = document.getElementById('pomo-display');
        if (display) display.textContent = `${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
        if (remaining <= 0) {
            clearInterval(pomodoroState.interval);
            pomodoroState.running = false;
            playSound('pomodoro');
            if (pomodoroState.mode === 'work') {
                _incrementPomoForTask();
                pomodoroState.sessions++;
                const longBreak = pomodoroState.sessions % settings.longBreakAfter === 0;
                pomodoroState.mode = longBreak ? 'longBreak' : 'shortBreak';
                pomodoroState.timeLeft = longBreak ? settings.longBreakMinutes * 60 : settings.shortBreakMinutes * 60;
                pomodoroState.activeTaskId = null;
                pomodoroState.activeDate = null;
                showToast(`Sesión ${pomodoroState.sessions} completada. ${longBreak ? 'Descanso largo.' : 'Descanso.'}`);
            } else {
                pomodoroState.mode = 'work';
                pomodoroState.timeLeft = settings.workMinutes * 60;
                pomodoroState.activeTaskId = null;
                pomodoroState.activeDate = null;
                showToast('Listo para la siguiente sesión.');
            }
            render();
        }
    }, 250);
    render();
}

function pausePomodoro() {
    pomodoroState.running = false;
    pomodoroState.timeLeft = Math.max(0, Math.round((pomodoroState.endTime - Date.now()) / 1000));
    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
    render();
}

function resetPomodoro() {
    pomodoroState.running = false;
    pomodoroState.timeLeft = 0;
    pomodoroState.mode = 'work';
    pomodoroState.activeTaskId = null;
    pomodoroState.activeDate = null;
    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
    render();
}

function _incrementPomoForTask() {
    if (!pomodoroState.activeTaskId) return;
    const tasks = getTasks();
    const t = tasks.find(x => x.id === pomodoroState.activeTaskId);
    if (!t) return;
    t.pomodorosCompleted = (t.pomodorosCompleted || 0) + 1;
    store.set('planner.tasks', tasks);
}

function showAddTaskForm() {
    showModal('Nueva tarea', `
        <form id="pln-task-form" class="form">
            <div class="form-group">
                <label>Tarea</label>
                <input type="text" id="pln-task-title" placeholder="Ej: Preparar presentación" required autofocus>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Hora inicio</label>
                    <input type="time" id="pln-task-start">
                </div>
                <div class="form-group check-toggle-row">
                    <label class="check-toggle" for="pln-task-important">
                        <input type="checkbox" id="pln-task-important">
                        <span>Importante</span>
                    </label>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group check-toggle-row">
                    <label class="check-toggle" for="pln-task-urgent">
                        <input type="checkbox" id="pln-task-urgent">
                        <span>Urgente</span>
                    </label>
                </div>
                <div class="form-group">
                    <label>Pomodoros</label>
                    <input type="number" id="pln-task-pomos" min="0" max="20" value="0">
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Agregar</button>
        </form>
    `);
    document.getElementById('pln-task-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('pln-task-title').value.trim();
        if (!title) return;
        const tasks = getTasks();
        tasks.push({
            id: generateId(),
            date: selectedDate,
            title,
            timeStart: document.getElementById('pln-task-start').value || null,
            timeEnd: null,
            important: document.getElementById('pln-task-important').checked,
            urgent: document.getElementById('pln-task-urgent').checked,
            pomodorosEstimated: parseInt(document.getElementById('pln-task-pomos').value, 10) || 0,
            pomodorosCompleted: 0,
            completed: false
        });
        store.set('planner.tasks', tasks);
        closeModal();
        showToast('Tarea añadida');
        render();
    });
}

function showEditTaskForm(taskId) {
    const tasks = getTasks();
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    showModal('Editar tarea', `
        <form id="pln-edit-form" class="form">
            <div class="form-group">
                <label>Tarea</label>
                <input type="text" id="pln-edit-title" value="${t.title || ''}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Inicio</label>
                    <input type="time" id="pln-edit-start" value="${t.timeStart || ''}">
                </div>
                <div class="form-group">
                    <label>Fin</label>
                    <input type="time" id="pln-edit-end" value="${t.timeEnd || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group check-toggle-row">
                    <label class="check-toggle" for="pln-edit-important">
                        <input type="checkbox" id="pln-edit-important" ${t.important ? 'checked' : ''}>
                        <span>Importante</span>
                    </label>
                </div>
                <div class="form-group check-toggle-row">
                    <label class="check-toggle" for="pln-edit-urgent">
                        <input type="checkbox" id="pln-edit-urgent" ${t.urgent ? 'checked' : ''}>
                        <span>Urgente</span>
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label>Pomodoros estimados</label>
                <input type="number" id="pln-edit-pomos" min="0" max="20" value="${t.pomodorosEstimated || 0}">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar</button>
        </form>
    `);
    document.getElementById('pln-edit-form')?.addEventListener('submit', e => {
        e.preventDefault();
        const title = document.getElementById('pln-edit-title').value.trim();
        if (!title) return;
        t.title = title;
        t.timeStart = document.getElementById('pln-edit-start').value || null;
        t.timeEnd = document.getElementById('pln-edit-end').value || null;
        t.important = document.getElementById('pln-edit-important').checked;
        t.urgent = document.getElementById('pln-edit-urgent').checked;
        t.pomodorosEstimated = parseInt(document.getElementById('pln-edit-pomos').value, 10) || 0;
        t.pomodorosCompleted = Math.min(t.pomodorosCompleted || 0, t.pomodorosEstimated);
        store.set('planner.tasks', tasks);
        closeModal();
        showToast('Tarea actualizada');
        render();
    });
}

function toggleTask(taskId) {
    const tasks = getTasks();
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    t.completed = !t.completed;
    t.completedAt = t.completed ? new Date().toISOString() : null;
    store.set('planner.tasks', tasks);
    if (t.completed) {
        playSound('complete');
        addXP(XP.TASK_COMPLETE);
        checkAchievements();
        if (getFocusTaskId() === t.id) setFocusTaskId(null);
        showToast('Tarea completada. +' + XP.TASK_COMPLETE + ' XP', 'success');
    }
    render();
}

function deleteTask(taskId) {
    store.set('planner.tasks', getTasks().filter(t => t.id !== taskId));
    if (getFocusTaskId() === taskId) setFocusTaskId(null);
    render();
}

export function init() {}
export function destroy() {
    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
}
