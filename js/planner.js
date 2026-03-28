// planner.js - Daily Planner module with Pomodoro & Eisenhower Matrix
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, showModal, closeModal, playSound } from './ui.js';

let currentTab = 'tasks'; // tasks | matrix | pomodoro
let pomodoroState = { running: false, timeLeft: 0, mode: 'work', sessions: 0, interval: null, endTime: null };
let selectedDate = today();

export function render() {
    const container = document.getElementById('main-content');
    const tasks = store.get('planner.tasks') || [];
    const dayTasks = tasks.filter(t => t.date === selectedDate);
    const settings = store.get('planner.pomodoroSettings');

    container.innerHTML = `
        <div class="planner-page">
            <div class="page-header">
                <h1>&#128197; Planificador</h1>
                <div class="date-nav">
                    <button class="btn btn-sm btn-ghost" id="prev-day">&larr;</button>
                    <span class="current-date">${formatDateDisplay(selectedDate)} ${selectedDate === today() ? '(Hoy)' : ''}</span>
                    <button class="btn btn-sm btn-ghost" id="next-day">&rarr;</button>
                    <button class="btn btn-sm btn-ghost" id="today-btn">Hoy</button>
                </div>
            </div>

            <div class="planner-tabs">
                <button class="tab-btn ${currentTab === 'tasks' ? 'active' : ''}" data-tab="tasks">&#9776; Tareas</button>
                <button class="tab-btn ${currentTab === 'matrix' ? 'active' : ''}" data-tab="matrix">&#9638; Eisenhower</button>
                <button class="tab-btn ${currentTab === 'pomodoro' ? 'active' : ''}" data-tab="pomodoro">&#9200; Pomodoro</button>
            </div>

            <div class="planner-content">
                ${currentTab === 'tasks' ? renderTasksView(dayTasks) :
                  currentTab === 'matrix' ? renderMatrixView(dayTasks) :
                  renderPomodoroView(settings)}
            </div>
        </div>
    `;

    // Tab listeners
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab;
            render();
        });
    });

    // Date nav
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

    // Add task
    document.getElementById('add-task-btn')?.addEventListener('click', showAddTaskForm);
    document.getElementById('add-task-empty')?.addEventListener('click', showAddTaskForm);

    // Task checkboxes
    document.querySelectorAll('.task-check').forEach(cb => {
        cb.addEventListener('click', () => toggleTask(cb.dataset.id));
    });

    // Task delete
    document.querySelectorAll('.task-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteTask(btn.dataset.id));
    });

    // Pomodoro controls
    document.getElementById('pomo-start')?.addEventListener('click', startPomodoro);
    document.getElementById('pomo-pause')?.addEventListener('click', pausePomodoro);
    document.getElementById('pomo-reset')?.addEventListener('click', resetPomodoro);

    // Eisenhower matrix task checks
    document.querySelectorAll('.task-check-sm').forEach(cb => {
        cb.addEventListener('click', () => toggleTask(cb.dataset.id));
    });
}

function renderTasksView(tasks) {
    const sorted = [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return (a.timeStart || '99:99').localeCompare(b.timeStart || '99:99');
    });

    return `
        <div class="tasks-view">
            <button class="btn btn-primary btn-sm" id="add-task-btn" style="margin-bottom:12px">+ Nueva Tarea</button>
            ${!tasks.length ? `
                <div class="empty-state glass-card">
                    <p class="empty-icon">&#128197;</p>
                    <h3>Planifica tu d\u00eda</h3>
                    <p>La corteza prefrontal funciona mejor con estructura. Asigna tiempo espec\u00edfico a cada tarea para activar la intenci\u00f3n de implementaci\u00f3n.</p>
                    <button class="btn btn-primary" id="add-task-empty">+ Crear tarea</button>
                </div>
            ` : ''}
            <div class="tasks-list">
                ${sorted.map(t => `
                    <div class="task-item glass-card ${t.completed ? 'task-done' : ''} ${t.urgent && t.important ? 'task-critical' : ''}">
                        <button class="task-check ${t.completed ? 'checked' : ''}" data-id="${t.id}">
                            ${t.completed ? '&#10003;' : ''}
                        </button>
                        <div class="task-info">
                            <span class="task-title">${t.title}</span>
                            <div class="task-tags">
                                ${t.timeStart ? `<span class="task-time">${t.timeStart}${t.timeEnd ? ' - ' + t.timeEnd : ''}</span>` : ''}
                                ${t.important ? '<span class="tag tag-important">Importante</span>' : ''}
                                ${t.urgent ? '<span class="tag tag-urgent">Urgente</span>' : ''}
                                ${t.pomodorosEstimated ? `<span class="tag tag-pomo">&#127813; ${t.pomodorosCompleted || 0}/${t.pomodorosEstimated}</span>` : ''}
                            </div>
                        </div>
                        <button class="btn-icon task-delete" data-id="${t.id}">&#128465;</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderMatrixView(tasks) {
    const q1 = tasks.filter(t => t.urgent && t.important);
    const q2 = tasks.filter(t => !t.urgent && t.important);
    const q3 = tasks.filter(t => t.urgent && !t.important);
    const q4 = tasks.filter(t => !t.urgent && !t.important);

    const renderQuadrant = (items) => items.map(t => `
        <div class="matrix-task ${t.completed ? 'task-done' : ''}">
            <button class="task-check-sm ${t.completed ? 'checked' : ''}" data-id="${t.id}">${t.completed ? '&#10003;' : ''}</button>
            <span>${t.title}</span>
        </div>
    `).join('') || '<p class="text-secondary" style="font-size:0.8rem">Sin tareas</p>';

    return `
        <div class="eisenhower-matrix">
            <div class="matrix-labels-top">
                <span></span><span class="matrix-label">Urgente</span><span class="matrix-label">No Urgente</span>
            </div>
            <div class="matrix-grid">
                <div class="matrix-label-side">Importante</div>
                <div class="matrix-quadrant q1 glass-card">
                    <h4>&#128308; HACER</h4>
                    ${renderQuadrant(q1)}
                </div>
                <div class="matrix-quadrant q2 glass-card">
                    <h4>&#128309; PLANIFICAR</h4>
                    ${renderQuadrant(q2)}
                </div>
                <div class="matrix-label-side">No Importante</div>
                <div class="matrix-quadrant q3 glass-card">
                    <h4>&#128992; DELEGAR</h4>
                    ${renderQuadrant(q3)}
                </div>
                <div class="matrix-quadrant q4 glass-card">
                    <h4>&#9899; ELIMINAR</h4>
                    ${renderQuadrant(q4)}
                </div>
            </div>
            <p class="matrix-tip text-secondary" style="margin-top:12px;font-size:0.85rem">
                &#128161; Consejo: Invierte la mayor\u00eda del tiempo en Q2 (Planificar). Es donde ocurre el crecimiento real. - Stephen Covey
            </p>
        </div>
    `;
}

function renderPomodoroView(settings) {
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

    return `
        <div class="pomodoro-view">
            <div class="pomo-mode-label ${pomodoroState.mode === 'work' ? 'pomo-work' : 'pomo-break'}">
                ${pomodoroState.mode === 'work' ? '&#128293; Trabajo' : pomodoroState.mode === 'shortBreak' ? '&#9749; Descanso Corto' : '&#127796; Descanso Largo'}
            </div>
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
                    <button class="btn btn-primary btn-lg" id="pomo-start">&#9654; ${pomodoroState.timeLeft > 0 ? 'Continuar' : 'Iniciar'}</button>
                ` : `
                    <button class="btn btn-warning btn-lg" id="pomo-pause">&#10074;&#10074; Pausar</button>
                `}
                <button class="btn btn-ghost btn-lg" id="pomo-reset">&#8634; Reiniciar</button>
            </div>
            <div class="pomo-sessions">
                <span>Sesiones completadas: <strong>${pomodoroState.sessions}</strong></span>
            </div>
            <div class="pomo-science glass-card" style="margin-top:20px;padding:12px">
                <p class="text-secondary" style="font-size:0.85rem">
                    &#129504; <strong>Neurociencia:</strong> Tu corteza prefrontal tiene energ\u00eda limitada. Los intervalos de 25 min con descansos mantienen el rendimiento cognitivo \u00f3ptimo y previenen la fatiga de decisi\u00f3n.
                </p>
            </div>
        </div>
    `;
}

function startPomodoro() {
    const settings = store.get('planner.pomodoroSettings');
    if (pomodoroState.timeLeft <= 0) {
        pomodoroState.timeLeft = settings.workMinutes * 60;
        pomodoroState.mode = 'work';
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
                pomodoroState.sessions++;
                const isLongBreak = pomodoroState.sessions % settings.longBreakAfter === 0;
                pomodoroState.mode = isLongBreak ? 'longBreak' : 'shortBreak';
                pomodoroState.timeLeft = isLongBreak ? settings.longBreakMinutes * 60 : settings.shortBreakMinutes * 60;
                showToast(`&#127942; \u00a1Sesi\u00f3n ${pomodoroState.sessions} completada! ${isLongBreak ? 'Toma un descanso largo.' : 'Descanso corto.'}`);
            } else {
                pomodoroState.mode = 'work';
                pomodoroState.timeLeft = settings.workMinutes * 60;
                showToast('&#128293; \u00a1De vuelta al trabajo! Tu cerebro est\u00e1 recargado.');
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
    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
    render();
}

function showAddTaskForm() {
    const formHtml = `
        <form id="task-form" class="form">
            <div class="form-group">
                <label>Tarea</label>
                <input type="text" id="task-title" placeholder="Ej: Preparar presentaci\u00f3n" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Hora inicio</label>
                    <input type="time" id="task-start">
                </div>
                <div class="form-group">
                    <label>Hora fin</label>
                    <input type="time" id="task-end">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label><input type="checkbox" id="task-important"> Importante</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="task-urgent"> Urgente</label>
                </div>
            </div>
            <div class="form-group">
                <label>Pomodoros estimados</label>
                <input type="number" id="task-pomos" min="0" max="20" value="0">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Agregar Tarea</button>
        </form>
    `;

    showModal('Nueva Tarea', formHtml);
    document.getElementById('task-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const task = {
            id: generateId(),
            date: selectedDate,
            title: document.getElementById('task-title').value.trim(),
            timeStart: document.getElementById('task-start').value || null,
            timeEnd: document.getElementById('task-end').value || null,
            important: document.getElementById('task-important').checked,
            urgent: document.getElementById('task-urgent').checked,
            pomodorosEstimated: parseInt(document.getElementById('task-pomos').value) || 0,
            pomodorosCompleted: 0,
            completed: false
        };
        const tasks = store.get('planner.tasks') || [];
        tasks.push(task);
        store.set('planner.tasks', tasks);
        closeModal();
        showToast('Tarea agregada');
        render();
    });
}

function toggleTask(taskId) {
    const tasks = store.get('planner.tasks') || [];
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        store.set('planner.tasks', tasks);
        if (task.completed) playSound('complete');
        render();
    }
}

function deleteTask(taskId) {
    const tasks = store.get('planner.tasks') || [];
    store.set('planner.tasks', tasks.filter(t => t.id !== taskId));
    render();
}

export function init() {}
export function destroy() {
    if (pomodoroState.interval) clearInterval(pomodoroState.interval);
}
