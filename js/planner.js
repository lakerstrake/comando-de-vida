// planner.js - Daily Planner module with Pomodoro & Eisenhower Matrix
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, showModal, closeModal, playSound } from './ui.js';
import { addXP, checkAchievements, XP } from './gamification.js';

let currentTab = 'tasks'; // tasks | matrix | pomodoro
let pomodoroState = { running: false, timeLeft: 0, mode: 'work', sessions: 0, interval: null, endTime: null, activeTaskId: null, activeDate: null };
let selectedDate = today();

function isSimpleMode() {
    const settings = store.get('settings') || {};
    return settings.simpleMode !== false;
}

function normalizeTask(task) {
    const normalized = { ...task };
    normalized.title = String(normalized.title || normalized.text || normalized.name || '').trim();
    normalized.timeStart = normalized.timeStart || normalized.time || null;
    normalized.timeEnd = normalized.timeEnd || normalized.endTime || null;
    normalized.pomodorosEstimated = Math.max(0, parseInt(normalized.pomodorosEstimated ?? normalized.pomos ?? 0, 10) || 0);
    normalized.pomodorosCompleted = Math.max(0, parseInt(normalized.pomodorosCompleted ?? normalized.pomosDone ?? 0, 10) || 0);
    normalized.completed = Boolean(normalized.completed ?? normalized.done);
    return normalized;
}

function getPlannerTasks() {
    const rawTasks = store.get('planner.tasks') || [];
    let changed = false;
    const tasks = rawTasks.map((task) => {
        const normalized = normalizeTask(task);
        if (
            task.title !== normalized.title ||
            task.timeStart !== normalized.timeStart ||
            task.timeEnd !== normalized.timeEnd ||
            task.pomodorosEstimated !== normalized.pomodorosEstimated ||
            task.pomodorosCompleted !== normalized.pomodorosCompleted ||
            task.completed !== normalized.completed
        ) {
            changed = true;
        }
        return normalized;
    });
    if (changed) store.set('planner.tasks', tasks);
    return tasks;
}

function getPomodoroFocusMap() {
    return store.get('planner.pomodoroFocusByDate') || {};
}

function getPomodoroFocusTaskId(date = selectedDate) {
    const focusByDate = getPomodoroFocusMap();
    return focusByDate[date] || null;
}

function setPomodoroFocusTaskId(taskId, date = selectedDate) {
    const focusByDate = getPomodoroFocusMap();
    if (taskId) focusByDate[date] = taskId;
    else delete focusByDate[date];
    store.set('planner.pomodoroFocusByDate', focusByDate);
}

export function render() {
    const container = document.getElementById('main-content');
    const tasks = getPlannerTasks();
    const dayTasks = tasks.filter((t) => t.date === selectedDate);
    let focusTaskId = getPomodoroFocusTaskId(selectedDate);
    if (focusTaskId && !dayTasks.some((t) => t.id === focusTaskId && !t.completed)) {
        setPomodoroFocusTaskId(null, selectedDate);
        focusTaskId = null;
    }
    const settings = store.get('planner.pomodoroSettings');
    const simpleMode = isSimpleMode();

    if (simpleMode && currentTab === 'matrix') currentTab = 'tasks';

    const tabs = simpleMode
        ? [
            { id: 'tasks', label: 'Tareas' },
            { id: 'pomodoro', label: 'Foco' }
        ]
        : [
            { id: 'tasks', label: 'Tareas' },
            { id: 'matrix', label: 'Matriz' },
            { id: 'pomodoro', label: 'Pomodoro' }
        ];

    container.innerHTML = `
        <div class="planner-page">
            <div class="page-header">
                <h1>Planificador</h1>
                <div class="date-nav">
                    <button class="btn btn-sm btn-ghost" id="prev-day" aria-label="Día anterior">&larr;</button>
                    <span class="current-date">${formatDateDisplay(selectedDate)} ${selectedDate === today() ? '(Hoy)' : ''}</span>
                    <button class="btn btn-sm btn-ghost" id="next-day" aria-label="Día siguiente">&rarr;</button>
                    <button class="btn btn-sm btn-ghost" id="today-btn">Hoy</button>
                </div>
            </div>

            <div class="planner-tabs">
                ${tabs.map((tab) => `
                    <button class="tab-btn ${currentTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">${tab.label}</button>
                `).join('')}
            </div>

            <div class="planner-content">
                ${currentTab === 'tasks' ? renderTasksView(dayTasks, simpleMode, focusTaskId) :
                    currentTab === 'matrix' ? renderMatrixView(dayTasks) :
                        renderPomodoroView(settings, dayTasks, focusTaskId)}
            </div>
        </div>
    `;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab;
            render();
        });
    });

    document.getElementById('prev-day')?.addEventListener('click', () => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        selectedDate = formatDate(d);
        render();
    });
    document.getElementById('next-day')?.addEventListener('click', () => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        selectedDate = formatDate(d);
        render();
    });
    document.getElementById('today-btn')?.addEventListener('click', () => {
        selectedDate = today();
        render();
    });

    document.getElementById('add-task-btn')?.addEventListener('click', () => showAddTaskForm(simpleMode));
    document.getElementById('add-task-empty')?.addEventListener('click', () => showAddTaskForm(simpleMode));

    document.querySelectorAll('.task-check').forEach((cb) => {
        cb.addEventListener('click', () => toggleTask(cb.dataset.id));
    });

    document.querySelectorAll('.task-delete').forEach((btn) => {
        btn.addEventListener('click', () => deleteTask(btn.dataset.id));
    });
    document.querySelectorAll('.task-edit').forEach((btn) => {
        btn.addEventListener('click', () => showEditTaskForm(btn.dataset.id));
    });
    document.querySelectorAll('.task-pomo-focus').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextFocusId = btn.dataset.id || null;
            const currentFocus = getPomodoroFocusTaskId(selectedDate);
            setPomodoroFocusTaskId(currentFocus === nextFocusId ? null : nextFocusId, selectedDate);
            render();
        });
    });

    document.getElementById('pomo-start')?.addEventListener('click', startPomodoro);
    document.getElementById('pomo-pause')?.addEventListener('click', pausePomodoro);
    document.getElementById('pomo-reset')?.addEventListener('click', resetPomodoro);
    document.getElementById('pomo-task-select')?.addEventListener('change', (e) => {
        setPomodoroFocusTaskId(e.target.value || null, selectedDate);
        render();
    });

    document.querySelectorAll('.task-check-sm').forEach((cb) => {
        cb.addEventListener('click', () => toggleTask(cb.dataset.id));
    });
}

function renderTasksView(tasks, simpleMode, focusTaskId) {
    const sorted = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (a.timeStart || '99:99').localeCompare(b.timeStart || '99:99');
    });

    return `
        <div class="tasks-view">
            <button class="btn btn-primary btn-sm" id="add-task-btn" style="margin-bottom:12px">Nueva tarea</button>
            ${simpleMode ? '<p class="text-secondary" style="margin-bottom:12px;font-size:0.85rem">Menos opciones, más ejecución: define lo esencial y empieza.</p>' : ''}
            ${!tasks.length ? `
                <div class="empty-state glass-card">
                    <p class="empty-state-kicker">Planifica tu día</p>
                    <h3>Define tu siguiente acción</h3>
                    <p>Las tareas claras reducen la fatiga de decisión y facilitan la ejecución.</p>
                    <button class="btn btn-primary" id="add-task-empty">Crear tarea</button>
                </div>
            ` : ''}
            <div class="tasks-list">
                ${sorted.map((t) => `
                    <div class="task-item glass-card ${t.completed ? 'task-done' : ''} ${t.urgent && t.important ? 'task-critical' : ''}">
                        <button class="task-check ${t.completed ? 'checked' : ''}" data-id="${t.id}" aria-label="Completar tarea">
                            ${t.completed ? '&#10003;' : ''}
                        </button>
                        <div class="task-info">
                            <span class="task-title">${t.title}</span>
                            <div class="task-tags">
                                ${t.timeStart ? `<span class="task-time">${t.timeStart}${t.timeEnd ? ' - ' + t.timeEnd : ''}</span>` : ''}
                                ${t.important ? '<span class="tag tag-important">Importante</span>' : ''}
                                ${t.urgent ? '<span class="tag tag-urgent">Urgente</span>' : ''}
                                ${t.pomodorosEstimated ? `<span class="tag tag-pomo">Pomos ${t.pomodorosCompleted || 0}/${t.pomodorosEstimated}</span>` : ''}
                                ${focusTaskId === t.id ? '<span class="tag tag-focus">En foco</span>' : ''}
                            </div>
                            ${t.pomodorosEstimated ? `
                                <div class="task-pomo-progress">
                                    <div class="task-pomo-track">
                                        <div class="task-pomo-fill" style="width:${Math.min(100, Math.round(((t.pomodorosCompleted || 0) / t.pomodorosEstimated) * 100))}%"></div>
                                    </div>
                                    <span class="task-pomo-text">${Math.min(100, Math.round(((t.pomodorosCompleted || 0) / t.pomodorosEstimated) * 100))}%</span>
                                </div>
                            ` : ''}
                        </div>
                        ${!t.completed ? `
                            <button class="btn-icon task-pomo-focus ${focusTaskId === t.id ? 'is-active' : ''}" data-id="${t.id}" aria-label="Poner tarea en foco" title="${focusTaskId === t.id ? 'Quitar foco' : 'Poner en foco'}">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                        ` : ''}
                        <button class="btn-icon task-edit" data-id="${t.id}" aria-label="Editar tarea" title="Editar tarea">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button class="btn-icon task-delete" data-id="${t.id}" aria-label="Eliminar tarea">&times;</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderMatrixView(tasks) {
    const q1 = tasks.filter((t) => t.urgent && t.important);
    const q2 = tasks.filter((t) => !t.urgent && t.important);
    const q3 = tasks.filter((t) => t.urgent && !t.important);
    const q4 = tasks.filter((t) => !t.urgent && !t.important);

    const renderQuadrant = (items) => items.map((t) => `
        <div class="matrix-task ${t.completed ? 'task-done' : ''}">
            <button class="task-check-sm ${t.completed ? 'checked' : ''}" data-id="${t.id}" aria-label="Completar tarea">${t.completed ? '&#10003;' : ''}</button>
            <span>${t.title}</span>
        </div>
    `).join('') || '<p class="text-secondary" style="font-size:0.8rem">Sin tareas</p>';

    return `
        <div class="eisenhower-matrix">
            <div class="matrix-labels-top">
                <span></span><span class="matrix-label">Urgente</span><span class="matrix-label">No urgente</span>
            </div>
            <div class="matrix-grid">
                <div class="matrix-label-side">Importante</div>
                <div class="matrix-quadrant q1 glass-card">
                    <h4>Hacer</h4>
                    ${renderQuadrant(q1)}
                </div>
                <div class="matrix-quadrant q2 glass-card">
                    <h4>Planificar</h4>
                    ${renderQuadrant(q2)}
                </div>
                <div class="matrix-label-side">No importante</div>
                <div class="matrix-quadrant q3 glass-card">
                    <h4>Delegar</h4>
                    ${renderQuadrant(q3)}
                </div>
                <div class="matrix-quadrant q4 glass-card">
                    <h4>Eliminar</h4>
                    ${renderQuadrant(q4)}
                </div>
            </div>
            <p class="matrix-tip text-secondary" style="margin-top:12px;font-size:0.85rem">
                Prioriza el cuadrante de planificación para reducir urgencias futuras.
            </p>
        </div>
    `;
}

function renderPomodoroView(settings, dayTasks, focusTaskId) {
    const focusCandidates = dayTasks.filter((task) => !task.completed);
    const focusedTask = focusCandidates.find((task) => task.id === focusTaskId) || null;
    const focusProgress = focusedTask && focusedTask.pomodorosEstimated
        ? Math.min(100, Math.round(((focusedTask.pomodorosCompleted || 0) / focusedTask.pomodorosEstimated) * 100))
        : 0;
    const totalSeconds = pomodoroState.running || pomodoroState.timeLeft > 0
        ? pomodoroState.timeLeft
        : settings.workMinutes * 60;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const maxSeconds = pomodoroState.mode === 'work' ? settings.workMinutes * 60 :
        pomodoroState.mode === 'shortBreak' ? settings.shortBreakMinutes * 60 :
            settings.longBreakMinutes * 60;
    const progress = maxSeconds > 0 ? ((maxSeconds - totalSeconds) / maxSeconds) : 0;
    const circumference = 2 * Math.PI * 140;
    const modeLabel = pomodoroState.mode === 'work'
        ? 'Trabajo'
        : pomodoroState.mode === 'shortBreak'
            ? 'Descanso corto'
            : 'Descanso largo';

    return `
        <div class="pomodoro-view">
            <div class="glass-card pomo-task-panel">
                <label for="pomo-task-select" class="pomo-task-label">Tarea foco de esta sesion</label>
                <select id="pomo-task-select" class="pomo-task-select">
                    <option value="">Sin vincular</option>
                    ${focusCandidates.map((task) => `
                        <option value="${task.id}" ${focusTaskId === task.id ? 'selected' : ''}>
                            ${task.title}${task.pomodorosEstimated ? ` (${task.pomodorosCompleted || 0}/${task.pomodorosEstimated})` : ''}
                        </option>
                    `).join('')}
                </select>
                ${focusedTask ? `
                    <div class="pomo-task-meta">
                        <span class="pomo-task-title">${focusedTask.title}</span>
                        ${focusedTask.pomodorosEstimated
                            ? `<span class="pomo-task-ratio">${focusedTask.pomodorosCompleted || 0}/${focusedTask.pomodorosEstimated} pomodoros</span>`
                            : '<span class="pomo-task-ratio">Sin estimacion definida</span>'
                        }
                    </div>
                    ${focusedTask.pomodorosEstimated ? `
                        <div class="pomo-task-progress">
                            <div class="pomo-task-progress-fill" style="width:${focusProgress}%"></div>
                        </div>
                    ` : ''}
                ` : '<p class="pomo-task-empty">Selecciona una tarea para registrar automaticamente cada sesion de trabajo.</p>'}
            </div>

            <div class="pomo-mode-label ${pomodoroState.mode === 'work' ? 'pomo-work' : 'pomo-break'}">${modeLabel}</div>
            <div class="pomo-timer">
                <svg viewBox="0 0 300 300" class="pomo-circle">
                    <circle cx="150" cy="150" r="140" fill="none" stroke="var(--bg-tertiary)" stroke-width="10"/>
                    <circle cx="150" cy="150" r="140" fill="none"
                        stroke="${pomodoroState.mode === 'work' ? 'var(--accent-primary)' : 'var(--accent-success)'}"
                        stroke-width="10" stroke-linecap="round"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${circumference * (1 - progress)}"
                        transform="rotate(-90 150 150)"/>
                </svg>
                <div class="pomo-time" id="pomo-display">${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</div>
            </div>
            <div class="pomo-controls">
                ${!pomodoroState.running ? `
                    <button class="btn btn-primary btn-lg" id="pomo-start">${pomodoroState.timeLeft > 0 ? 'Continuar' : 'Iniciar'}</button>
                ` : `
                    <button class="btn btn-warning btn-lg" id="pomo-pause">Pausar</button>
                `}
                <button class="btn btn-ghost btn-lg" id="pomo-reset">Reiniciar</button>
            </div>
            <div class="pomo-sessions">
                <span>Sesiones completadas: <strong>${pomodoroState.sessions}</strong></span>
            </div>
            <div class="pomo-science glass-card" style="margin-top:20px;padding:12px">
                <p class="text-secondary" style="font-size:0.85rem">
                    Intervalos cortos de enfoque sostienen energía mental y reducen saturación.
                </p>
            </div>
        </div>
    `;
}

function incrementPomodoroForActiveTask() {
    if (!pomodoroState.activeTaskId || !pomodoroState.activeDate) return;
    const tasks = getPlannerTasks();
    const task = tasks.find((item) => item.id === pomodoroState.activeTaskId && item.date === pomodoroState.activeDate);
    if (!task) return;

    task.pomodorosCompleted = Math.max(0, (task.pomodorosCompleted || 0) + 1);
    store.set('planner.tasks', tasks);

    if (task.pomodorosEstimated > 0 && task.pomodorosCompleted >= task.pomodorosEstimated) {
        showToast(`Pomodoros de "${task.title}" completados. Puedes marcar la tarea como hecha.`);
    } else {
        showToast(`+1 pomodoro en "${task.title}" (${task.pomodorosCompleted}/${task.pomodorosEstimated || '-'})`);
    }
}

function startPomodoro() {
    const settings = store.get('planner.pomodoroSettings');
    if (pomodoroState.timeLeft <= 0) {
        pomodoroState.timeLeft = settings.workMinutes * 60;
        pomodoroState.mode = 'work';
    }
    if (pomodoroState.mode === 'work' && !pomodoroState.activeTaskId) {
        pomodoroState.activeTaskId = getPomodoroFocusTaskId(selectedDate);
        pomodoroState.activeDate = selectedDate;
    }
    pomodoroState.running = true;
    pomodoroState.endTime = Date.now() + pomodoroState.timeLeft * 1000;

    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
    pomodoroState.interval = setInterval(() => {
        const remaining = Math.max(0, Math.round((pomodoroState.endTime - Date.now()) / 1000));
        pomodoroState.timeLeft = remaining;

        const display = document.getElementById('pomo-display');
        if (display) {
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }

        if (remaining <= 0) {
            clearInterval(pomodoroState.interval);
            pomodoroState.running = false;
            playSound('pomodoro');

            if (pomodoroState.mode === 'work') {
                incrementPomodoroForActiveTask();
                pomodoroState.sessions++;
                const isLongBreak = pomodoroState.sessions % settings.longBreakAfter === 0;
                pomodoroState.mode = isLongBreak ? 'longBreak' : 'shortBreak';
                pomodoroState.timeLeft = isLongBreak ? settings.longBreakMinutes * 60 : settings.shortBreakMinutes * 60;
                pomodoroState.activeTaskId = null;
                pomodoroState.activeDate = null;
                showToast(`Sesión ${pomodoroState.sessions} completada. ${isLongBreak ? 'Descanso largo.' : 'Descanso corto.'}`);
            } else {
                pomodoroState.mode = 'work';
                pomodoroState.timeLeft = settings.workMinutes * 60;
                pomodoroState.activeTaskId = null;
                pomodoroState.activeDate = null;
                showToast('Listo para la siguiente sesión de enfoque.');
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

function showAddTaskForm(simpleMode = isSimpleMode()) {
    const formHtml = `
        <form id="task-form" class="form">
            <div class="form-group">
                <label>Tarea</label>
                <input type="text" id="task-title" placeholder="Ej: Preparar presentación" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Hora inicio</label>
                    <input type="time" id="task-start">
                </div>
                <div class="form-group check-toggle-row">
                    <label class="check-toggle" for="task-important">
                        <input type="checkbox" id="task-important">
                        <span>Importante</span>
                    </label>
                </div>
            </div>

            <div class="form-group">
                <label class="check-toggle check-toggle-advanced" for="task-advanced-toggle">
                    <input type="checkbox" id="task-advanced-toggle" ${simpleMode ? '' : 'checked'}>
                    <span>Mostrar opciones avanzadas</span>
                </label>
            </div>

            <div id="task-advanced-fields" style="display:${simpleMode ? 'none' : 'block'}">
                <div class="form-row">
                    <div class="form-group">
                        <label>Hora fin</label>
                        <input type="time" id="task-end">
                    </div>
                    <div class="form-group check-toggle-row">
                        <label class="check-toggle" for="task-urgent">
                            <input type="checkbox" id="task-urgent">
                            <span>Urgente</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label>Pomodoros estimados</label>
                    <input type="number" id="task-pomos" min="0" max="20" value="0">
                </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block">Agregar tarea</button>
        </form>
    `;

    showModal('Nueva tarea', formHtml);

    const advancedToggle = document.getElementById('task-advanced-toggle');
    const advancedFields = document.getElementById('task-advanced-fields');
    advancedToggle?.addEventListener('change', () => {
        if (!advancedFields) return;
        advancedFields.style.display = advancedToggle.checked ? 'block' : 'none';
    });

    document.getElementById('task-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const showAdvanced = document.getElementById('task-advanced-toggle')?.checked;
        const task = {
            id: generateId(),
            date: selectedDate,
            title: document.getElementById('task-title').value.trim(),
            timeStart: document.getElementById('task-start').value || null,
            timeEnd: showAdvanced ? (document.getElementById('task-end').value || null) : null,
            important: document.getElementById('task-important').checked,
            urgent: showAdvanced ? document.getElementById('task-urgent').checked : false,
            pomodorosEstimated: showAdvanced ? (parseInt(document.getElementById('task-pomos').value, 10) || 0) : 0,
            pomodorosCompleted: 0,
            completed: false
        };

        if (!task.title) return;
        const tasks = getPlannerTasks();
        tasks.push(task);
        store.set('planner.tasks', tasks);
        closeModal();
        showToast('Tarea agregada');
        render();
    });
}

function showEditTaskForm(taskId) {
    const tasks = getPlannerTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const formHtml = `
        <form id="edit-task-form" class="form">
            <div class="form-group">
                <label>Tarea</label>
                <input type="text" id="edit-task-title" value="${task.title || ''}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Hora inicio</label>
                    <input type="time" id="edit-task-start" value="${task.timeStart || ''}">
                </div>
                <div class="form-group">
                    <label>Hora fin</label>
                    <input type="time" id="edit-task-end" value="${task.timeEnd || ''}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group check-toggle-row">
                    <label class="check-toggle" for="edit-task-important">
                        <input type="checkbox" id="edit-task-important" ${task.important ? 'checked' : ''}>
                        <span>Importante</span>
                    </label>
                </div>
                <div class="form-group check-toggle-row">
                    <label class="check-toggle" for="edit-task-urgent">
                        <input type="checkbox" id="edit-task-urgent" ${task.urgent ? 'checked' : ''}>
                        <span>Urgente</span>
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label>Pomodoros estimados</label>
                <input type="number" id="edit-task-pomos" min="0" max="20" value="${task.pomodorosEstimated || 0}">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Guardar cambios</button>
        </form>
    `;

    showModal('Editar tarea', formHtml);
    document.getElementById('edit-task-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        task.title = document.getElementById('edit-task-title').value.trim();
        if (!task.title) return;
        task.timeStart = document.getElementById('edit-task-start').value || null;
        task.timeEnd = document.getElementById('edit-task-end').value || null;
        task.important = document.getElementById('edit-task-important').checked;
        task.urgent = document.getElementById('edit-task-urgent').checked;
        task.pomodorosEstimated = parseInt(document.getElementById('edit-task-pomos').value, 10) || 0;
        if (task.pomodorosEstimated > 0) {
            task.pomodorosCompleted = Math.min(task.pomodorosCompleted || 0, task.pomodorosEstimated);
        }

        store.set('planner.tasks', tasks);
        closeModal();
        showToast('Tarea actualizada');
        render();
    });
}

function toggleTask(taskId) {
    const tasks = getPlannerTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    store.set('planner.tasks', tasks);
    if (task.completed) {
        playSound('complete');
        addXP(XP.TASK_COMPLETE);
        checkAchievements();
        if (getPomodoroFocusTaskId(selectedDate) === task.id) {
            setPomodoroFocusTaskId(null, selectedDate);
        }
    }
    render();
}

function deleteTask(taskId) {
    const tasks = getPlannerTasks();
    store.set('planner.tasks', tasks.filter((t) => t.id !== taskId));
    if (getPomodoroFocusTaskId(selectedDate) === taskId) {
        setPomodoroFocusTaskId(null, selectedDate);
    }
    render();
}

export function init() {}
export function destroy() {
    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
}
