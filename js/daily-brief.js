// daily-brief.js - Morning ritual & Daily Brief module
import { store } from './store.js';
import { today, formatDate, getStreakForHabit, escapeHtml, QUOTES, CATEGORIES, icon, showToast, generateId } from './ui.js';
import { getLevelInfo, getLevelProgress, getNextLevel } from './gamification.js';

const SEEN_KEY = 'CV2_BRIEF_DATE';
const MORNING_SLEEP_TARGET_MINUTES = 7.5 * 60;
const MORNING_SLEEP_MINUTES = 7 * 60;
const MORNING_SLEEP_MAX_MINUTES = 9 * 60;
const MORNING_ROUTINE_STEPS = [
    { id: 'wake_up', title: 'Levantarte sin posponer alarma', note: 'Reduce inercia del sueño y activa la atención rápido.', minutes: 2, taskTitle: 'Levantarte sin snooze' },
    { id: 'hydrate', title: 'Tomar 1 vaso grande de agua', note: 'Mejora hidratación y claridad mental al despertar.', minutes: 3, taskTitle: 'Tomar agua al despertar' },
    { id: 'sunlight', title: 'Recibir luz natural 5-10 min', note: 'Ancla el ritmo circadiano y regula cortisol matutino.', minutes: 10, taskTitle: 'Luz solar de mañana' },
    { id: 'bed', title: 'Tender la cama', note: 'Primer logro conductual para entrar en modo ejecución.', minutes: 4, taskTitle: 'Tender la cama' },
    { id: 'hygiene', title: 'Higiene personal y cepillado', note: 'Señal de inicio de jornada y autocuidado básico.', minutes: 8, taskTitle: 'Cepillarme y aseo personal' },
    { id: 'tidy', title: 'Orden rápido (barrer/organizar)', note: 'Menos ruido visual, mejor foco cognitivo.', minutes: 8, taskTitle: 'Barrer y ordenar espacio' },
    { id: 'movement', title: 'Movilidad o ejercicio corto', note: 'Activa sistema nervioso y energía sostenida.', minutes: 12, taskTitle: 'Activación física matutina' },
    { id: 'meditation', title: 'Respiración/meditación 5-10 min', note: 'Baja reactividad y mejora control atencional.', minutes: 8, taskTitle: 'Meditar 8 min' },
    { id: 'breakfast', title: 'Desayuno con proteína y fibra', note: 'Mejor estabilidad energética y menos picos de hambre.', minutes: 15, taskTitle: 'Preparar desayuno saludable' },
    { id: 'plan_day', title: 'Definir top 3 del día', note: 'Priorizar reduce fatiga de decisión durante la mañana.', minutes: 6, taskTitle: 'Planificar top 3 del día' }
];

function timeToMinutes(value) {
    if (!value || typeof value !== 'string' || !value.includes(':')) return null;
    const [hh, mm] = value.split(':').map((part) => parseInt(part, 10));
    if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
}

function minutesToTime(minutes) {
    const inDay = ((minutes % 1440) + 1440) % 1440;
    const hh = Math.floor(inDay / 60);
    const mm = inDay % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getBedtimeOrDefault(rawValue) {
    return timeToMinutes(rawValue) === null ? '23:00' : rawValue;
}

function getWakePlan(bedtime) {
    const bedtimeMinutes = timeToMinutes(getBedtimeOrDefault(bedtime)) ?? (23 * 60);
    return {
        recommended: minutesToTime(Math.round(bedtimeMinutes + MORNING_SLEEP_TARGET_MINUTES)),
        minHealthy: minutesToTime(Math.round(bedtimeMinutes + MORNING_SLEEP_MINUTES)),
        maxHealthy: minutesToTime(Math.round(bedtimeMinutes + MORNING_SLEEP_MAX_MINUTES))
    };
}

export function wasSeenToday() {
    return localStorage.getItem(SEEN_KEY) === today();
}

export function markSeen() {
    localStorage.setItem(SEEN_KEY, today());
}

export function render() {
    const container = document.getElementById('main-content');
    const habits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = (store.get('planner.tasks') || []).map((task) => ({
        ...task,
        title: String(task.title || task.text || '').trim(),
        pomodorosEstimated: Math.max(0, parseInt(task.pomodorosEstimated ?? task.pomos ?? 0, 10) || 0),
        pomodorosCompleted: Math.max(0, parseInt(task.pomodorosCompleted ?? task.pomosDone ?? 0, 10) || 0),
        completed: Boolean(task.completed ?? task.done)
    }));
    const gam = store.get('gamification') || { xp: 0 };
    const settings = store.get('settings') || {};
    const routineCompletions = store.get('planner.morningRoutineCompletions') || {};
    const todayStr = today();
    const todayDone = completions[todayStr] || [];
    const bedtime = getBedtimeOrDefault(settings.targetBedtime);
    const wakePlan = getWakePlan(bedtime);
    const recommendedWakeMinutes = timeToMinutes(wakePlan.recommended) ?? (6 * 60 + 30);
    const todayRoutineDone = new Set(routineCompletions[todayStr] || []);
    const routineDoneCount = MORNING_ROUTINE_STEPS.filter((step) => todayRoutineDone.has(step.id)).length;
    let elapsed = 0;
    const routineTimeline = MORNING_ROUTINE_STEPS.map((step, idx) => {
        const start = minutesToTime(recommendedWakeMinutes + elapsed);
        elapsed += step.minutes;
        return {
            ...step,
            order: idx + 1,
            start
        };
    });

    const xp = gam.xp || 0;
    const level = getLevelInfo(xp);
    const nextLvl = getNextLevel(xp);
    const xpPct = getLevelProgress(xp);
    const xpToNext = nextLvl ? nextLvl.min - xp : 0;

    const habitsWithStreak = habits
        .filter((habit) => !todayDone.includes(habit.id))
        .map((habit) => ({ ...habit, streak: getStreakForHabit(habit.id, completions) }))
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 3);

    const allDoneToday = habits.length > 0 && habits.every((habit) => todayDone.includes(habit.id));
    const todayTasks = tasks
        .filter((task) => task.date === todayStr && !task.completed)
        .sort((a, b) => (b.urgent && b.important ? 1 : 0) - (a.urgent && a.important ? 1 : 0));
    const mit = todayTasks[0] || null;

    let appStreak = 0;
    const d = new Date();
    while (true) {
        const dateStr = formatDate(d);
        if ((completions[dateStr] || []).length > 0) {
            appStreak++;
            d.setDate(d.getDate() - 1);
        } else {
            if (appStreak === 0 && dateStr === todayStr) {
                d.setDate(d.getDate() - 1);
                continue;
            }
            break;
        }
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos dias' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const name = settings.userName || 'Usuario';
    const dateDisplay = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    container.innerHTML = `
        <div class="brief-page">
            <div class="brief-header">
                <div class="brief-date">${dateDisplay}</div>
                <h1 class="brief-greeting">${greeting}, ${escapeHtml(name)}</h1>
                <p class="brief-subtitle">Aqui esta tu panorama del dia</p>
            </div>

            <div class="glass-card brief-xp-card">
                <div class="brief-xp-left">
                    <span class="brief-level-icon">${level.icon}</span>
                    <div>
                        <div class="brief-level-name">Nivel ${level.level} - ${level.name}</div>
                        <div class="brief-xp-label">${xp} XP${nextLvl ? ` - ${xpToNext} para Nivel ${nextLvl.level}` : ' - Maximo nivel'}</div>
                    </div>
                </div>
                <div class="brief-xp-bar-wrap">
                    <div class="brief-xp-bar">
                        <div class="brief-xp-fill" style="width:${xpPct}%;background:${level.color}"></div>
                    </div>
                    ${appStreak > 0 ? `<div class="brief-app-streak">${icon('flame', 12, 'streak-icon')} ${appStreak} dia${appStreak !== 1 ? 's' : ''} activo${appStreak !== 1 ? 's' : ''}</div>` : ''}
                </div>
            </div>

            <div class="glass-card brief-section">
                <h3 class="brief-section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    ${allDoneToday ? 'Habitos completados' : 'Habitos prioritarios hoy'}
                </h3>
                ${allDoneToday ? `
                    <div class="brief-all-done">
                        <span>${icon('check', 16, 'brief-status-icon')}</span>
                        <p>Completaste todos tus habitos de hoy. Excelente consistencia.</p>
                    </div>` :
                habitsWithStreak.length > 0 ? `
                    <div class="brief-habits-list">
                        ${habitsWithStreak.map((habit) => {
                            const catInfo = CATEGORIES[habit.category] || {};
                            const streakText = habit.streak > 0
                                ? `<span class="brief-streak">${icon('flame', 11, 'streak-icon')} ${habit.streak} dia${habit.streak !== 1 ? 's' : ''} - protege esta racha</span>`
                                : '<span class="brief-streak-new">Nuevo habito</span>';
                            return `
                                <div class="brief-habit-row">
                                    <span class="brief-habit-icon" style="color:${catInfo.color || '#4b91ff'}">${catInfo.icon || icon('sparkle', 13, 'category-icon-svg')}</span>
                                    <div class="brief-habit-info">
                                        <span class="brief-habit-name">${escapeHtml(habit.name)}</span>
                                        ${streakText}
                                    </div>
                                    <a href="#/habits" class="brief-habit-go">${icon('arrowRight', 12, 'inline-arrow-icon')}</a>
                                </div>`;
                        }).join('')}
                    </div>` :
                habits.length === 0 ? `
                    <p class="text-secondary" style="font-size:0.8125rem">Aun no tienes habitos. <a href="#/habits" style="color:var(--accent-primary)">Crea tu primer habito ${icon('arrowRight', 12, 'inline-arrow-icon')}</a></p>` :
                `<div class="brief-all-done"><span>${icon('check', 16, 'brief-status-icon')}</span><p>Todos los habitos completados hoy.</p></div>`
                }
            </div>

            <div class="glass-card brief-section">
                <h3 class="brief-section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Tarea mas importante hoy
                </h3>
                ${mit ? `
                    <div class="brief-mit">
                        <span class="brief-mit-dot ${mit.urgent && mit.important ? 'critical' : ''}"></span>
                        <span class="brief-mit-text">${escapeHtml(mit.title || mit.text || 'Sin titulo')}</span>
                        <a href="#/planner" class="brief-habit-go">${icon('arrowRight', 12, 'inline-arrow-icon')}</a>
                    </div>` :
                `<p class="text-secondary" style="font-size:0.8125rem">
                    ${tasks.filter((task) => task.date === todayStr && task.completed).length > 0 ? 'Todas las tareas estan completadas.' : ''}
                    <a href="#/planner" style="color:var(--accent-primary)">Planifica tu dia ${icon('arrowRight', 12, 'inline-arrow-icon')}</a>
                </p>`}
            </div>

            <div class="glass-card brief-section">
                <h3 class="brief-section-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M4.93 4.93l2.83 2.83"></path><path d="M16.24 16.24l2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="M4.93 19.07l2.83-2.83"></path><path d="M16.24 7.76l2.83-2.83"></path></svg>
                    Rutina de mañana paso a paso
                </h3>

                <div class="brief-sleep-plan">
                    <div class="brief-sleep-row">
                        <label for="brief-bedtime">Hora objetivo para dormir</label>
                        <input type="time" id="brief-bedtime" value="${bedtime}">
                        <button type="button" class="btn btn-sm btn-ghost" id="brief-save-bedtime">Guardar</button>
                    </div>
                    <div class="brief-sleep-tips">
                        <span>Despertar recomendado: <strong>${wakePlan.recommended}</strong> (7h30)</span>
                        <span>Rango saludable: ${wakePlan.minHealthy} a ${wakePlan.maxHealthy}</span>
                    </div>
                </div>

                <div class="brief-routine-summary">
                    <strong>${routineDoneCount}/${MORNING_ROUTINE_STEPS.length}</strong> pasos completados hoy
                    <button type="button" class="btn btn-sm btn-ghost" id="brief-routine-to-planner">Pasar rutina al plan de hoy</button>
                </div>

                <div class="brief-routine-list">
                    ${routineTimeline.map((step) => `
                        <button class="brief-routine-step ${todayRoutineDone.has(step.id) ? 'done' : ''}" data-step-id="${step.id}" type="button">
                            <span class="brief-routine-order">${step.order}</span>
                            <span class="brief-routine-time">${step.start}</span>
                            <span class="brief-routine-content">
                                <strong>${step.title}</strong>
                                <small>${step.note}</small>
                            </span>
                            <span class="brief-routine-check">${todayRoutineDone.has(step.id) ? icon('check', 12, 'brief-status-icon') : ''}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="brief-quote">
                <p class="brief-quote-text">"${escapeHtml(quote)}"</p>
            </div>

            <button class="btn brief-cta" id="brief-start-btn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Empezar el dia
            </button>

            <button class="brief-skip" id="brief-skip-btn">Ir al dashboard</button>
        </div>
    `;

    document.getElementById('brief-start-btn')?.addEventListener('click', () => {
        markSeen();
        window.location.hash = '#/habits';
    });

    document.getElementById('brief-skip-btn')?.addEventListener('click', () => {
        markSeen();
        window.location.hash = '#/dashboard';
    });

    document.querySelectorAll('.brief-routine-step').forEach((btn) => {
        btn.addEventListener('click', () => {
            const stepId = btn.dataset.stepId;
            const doneSet = new Set(routineCompletions[todayStr] || []);
            if (doneSet.has(stepId)) doneSet.delete(stepId);
            else doneSet.add(stepId);
            routineCompletions[todayStr] = Array.from(doneSet);
            store.set('planner.morningRoutineCompletions', routineCompletions);
            render();
        });
    });

    document.getElementById('brief-save-bedtime')?.addEventListener('click', () => {
        const bedtimeInput = document.getElementById('brief-bedtime');
        const nextBedtime = getBedtimeOrDefault(bedtimeInput?.value);
        store.set('settings.targetBedtime', nextBedtime);
        const nextWake = getWakePlan(nextBedtime);
        showToast(`Horario guardado. Despertar recomendado: ${nextWake.recommended}.`);
        render();
    });

    document.getElementById('brief-routine-to-planner')?.addEventListener('click', () => {
        const bedtimeInput = document.getElementById('brief-bedtime');
        const currentBedtime = getBedtimeOrDefault(bedtimeInput?.value || bedtime);
        const wake = getWakePlan(currentBedtime);
        const startWakeMinutes = timeToMinutes(wake.recommended) ?? recommendedWakeMinutes;
        const plannerTasks = store.get('planner.tasks') || [];
        let added = 0;
        let offset = 0;

        for (const step of MORNING_ROUTINE_STEPS) {
            const startMinutes = startWakeMinutes + offset;
            const endMinutes = startMinutes + step.minutes;
            offset += step.minutes;

            const exists = plannerTasks.some(
                (task) => task.date === todayStr && String(task.title || task.text || '').trim().toLowerCase() === step.taskTitle.toLowerCase()
            );
            if (exists) continue;

            plannerTasks.push({
                id: generateId(),
                date: todayStr,
                title: step.taskTitle,
                timeStart: minutesToTime(startMinutes),
                timeEnd: minutesToTime(endMinutes),
                important: ['wake_up', 'sunlight', 'movement', 'plan_day'].includes(step.id),
                urgent: false,
                pomodorosEstimated: step.id === 'plan_day' ? 1 : 0,
                pomodorosCompleted: 0,
                completed: false
            });
            added++;
        }

        store.set('planner.tasks', plannerTasks);
        showToast(added > 0 ? `Rutina agregada al plan de hoy (${added} tareas).` : 'La rutina ya estaba en tu plan de hoy.');
        render();
    });

    markSeen();
}

export function init() {}
export function destroy() {}
