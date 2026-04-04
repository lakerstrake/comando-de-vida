// daily-brief.js - Clean morning ritual module
import { store } from './store.js';
import { today, formatDate, getStreakForHabit, escapeHtml, QUOTES, CATEGORIES, icon, showToast, generateId } from './ui.js';
import { getLevelInfo, getLevelProgress, getNextLevel } from './gamification.js';

const SEEN_KEY = 'CV2_BRIEF_DATE';
const SLEEP_TARGET = 7.5 * 60; // minutes

function _pad(n) { return String(n).padStart(2, '0'); }
function _toMin(val) {
    if (!val || !val.includes(':')) return null;
    const [h, m] = val.split(':').map(Number);
    return (h >= 0 && h <= 23 && m >= 0 && m <= 59) ? h * 60 + m : null;
}
function _fromMin(min) {
    const d = ((min % 1440) + 1440) % 1440;
    return `${_pad(Math.floor(d / 60))}:${_pad(d % 60)}`;
}

export function wasSeenToday() {
    return localStorage.getItem(SEEN_KEY) === today();
}
export function markSeen() {
    localStorage.setItem(SEEN_KEY, today());
}

const MORNING_STEPS = [
    { id: 'wake',       emoji: '⏰', title: 'Levantarte sin posponer',   note: 'Activa la atención. Cada minuto sin snooze entrena tu fuerza de voluntad.' },
    { id: 'water',      emoji: '💧', title: 'Tomar agua al despertar',   note: 'Deshidratación leve reduce cognición un 30%. Un vaso grande te reactiva.' },
    { id: 'light',      emoji: '☀️', title: 'Luz natural 5-10 min',       note: 'Ancla tu ritmo circadiano y regula cortisol y melatonina.' },
    { id: 'move',       emoji: '🏃', title: 'Movimiento o ejercicio',    note: 'BDNF matutino mejora memoria y estado de ánimo toda la jornada.' },
    { id: 'meditate',   emoji: '🧘', title: 'Respirar / Meditar 5 min',  note: 'Baja reactividad y mejora el control atencional.' },
    { id: 'plan',       emoji: '📋', title: 'Definir top 3 del día',     note: 'La priorización reduce la fatiga de decisión y enfoca tu energía.' }
];

export function render() {
    const container = document.getElementById('main-content');
    const todayStr = today();
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const settings = store.get('settings') || {};
    const routineLog = store.get('planner.morningRoutineCompletions') || {};
    const todayDone = completions[todayStr] || [];
    const todayRoutine = new Set(routineLog[todayStr] || []);

    const gam = store.get('gamification') || { xp: 0 };
    const xp = gam.xp || 0;
    const level = getLevelInfo(xp);
    const xpPct = getLevelProgress(xp);
    const nextLvl = getNextLevel(xp);

    // Top 3 habits by streak (pending)
    const topHabits = habits
        .filter(h => !todayDone.includes(h.id))
        .map(h => ({ ...h, streak: getStreakForHabit(h.id, completions) }))
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 3);
    const allDoneToday = habits.length > 0 && habits.every(h => todayDone.includes(h.id));

    // MIT
    const mit = (tasks.filter(t => t.date === todayStr && !t.completed)
        .sort((a, b) => ((b.urgent && b.important ? 2 : b.important ? 1 : 0) - (a.urgent && a.important ? 2 : a.important ? 1 : 0))))[0] || null;

    // Sleep
    const bedtime = settings.targetBedtime || '23:00';
    const bedMin = _toMin(bedtime) ?? (23 * 60);
    const wakeRec = _fromMin(bedMin + SLEEP_TARGET);
    const wakeMin = _fromMin(bedMin + 7 * 60);
    const wakeMax = _fromMin(bedMin + 9 * 60);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const name = settings.userName || 'Tú';
    const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const quote = QUOTES[new Date().getDate() % QUOTES.length];
    const routineDone = MORNING_STEPS.filter(s => todayRoutine.has(s.id)).length;
    const savedIntention = store.get(`brief.intention.${todayStr}`) || '';
    const savedWin = store.get(`brief.win.${todayStr}`) || '';

    let appStreak = 0;
    const d = new Date();
    while (true) {
        const ds = formatDate(d);
        if ((completions[ds] || []).length > 0) { appStreak++; d.setDate(d.getDate() - 1); }
        else { if (appStreak === 0 && ds === todayStr) { d.setDate(d.getDate() - 1); continue; } break; }
    }

    container.innerHTML = `
        <div class="brief-clean">

            <!-- Header -->
            <div class="brief-top">
                <p class="brief-date">${dateStr}</p>
                <h1 class="brief-title">${greeting}, ${escapeHtml(name)}</h1>
                <div class="brief-meta-row">
                    <span class="brief-level-chip">${level.icon} Niv.${level.level} — ${level.name}</span>
                    ${appStreak > 0 ? `<span class="brief-streak-chip">${icon('flame', 13, 'streak-icon')} ${appStreak} día${appStreak !== 1 ? 's' : ''}</span>` : ''}
                </div>
                <div class="brief-xp-bar-wrap">
                    <div class="brief-xp-fill" style="width:${xpPct}%;background:${level.color}"></div>
                </div>
                ${nextLvl ? `<p class="text-muted" style="font-size:0.72rem;margin-top:4px">Nivel ${nextLvl.level} en ${nextLvl.min - xp} XP</p>` : ''}
            </div>

            <!-- Habits -->
            <div class="brief-block">
                <p class="brief-block-label">${allDoneToday ? '✓ Hábitos completados hoy' : 'Hábitos prioritarios hoy'}</p>
                ${allDoneToday ? `
                <div class="brief-all-done">
                    Completaste todos tus hábitos. Excelente consistencia.
                </div>` : topHabits.length ? `
                <div class="brief-habits">
                    ${topHabits.map(h => {
                        const cat = CATEGORIES[h.category] || {};
                        return `
                        <div class="brief-habit-row">
                            <span style="color:${cat.color || '#4b91ff'}">${cat.icon || '◆'}</span>
                            <div class="brief-habit-info">
                                <span class="brief-habit-name">${escapeHtml(h.name)}</span>
                                ${h.streak > 0 ? `<span class="brief-habit-streak">${icon('flame', 10, 'streak-icon')} ${h.streak} días — no la pierdas</span>` : '<span class="brief-habit-streak" style="color:var(--text-muted)">Nuevo hábito</span>'}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
                <a href="#/habits" class="brief-link">Ver todos los hábitos ${icon('arrowRight', 11, 'inline-arrow-icon')}</a>
                ` : habits.length === 0 ? `
                <a href="#/habits" class="brief-link">+ Crear tu primer hábito</a>
                ` : '<div class="brief-all-done">Todos los hábitos completados.</div>'}
            </div>

            <!-- MIT -->
            <div class="brief-block">
                <p class="brief-block-label">Tarea principal de hoy</p>
                ${mit ? `
                <div class="brief-mit">
                    <span class="brief-mit-dot ${mit.urgent && mit.important ? 'critical' : ''}"></span>
                    <span class="brief-mit-name">${escapeHtml(mit.title || mit.text || 'Sin título')}</span>
                    <a href="#/planner" class="brief-mit-go">${icon('arrowRight', 12, 'inline-arrow-icon')}</a>
                </div>` : `
                <a href="#/planner" class="brief-link">+ Planifica tu tarea principal de hoy</a>`}
            </div>

            <!-- Rutina matutina -->
            <div class="brief-block">
                <div class="brief-block-header">
                    <p class="brief-block-label">Rutina matutina</p>
                    <span class="brief-routine-count">${routineDone}/${MORNING_STEPS.length}</span>
                </div>
                <div class="brief-routine">
                    ${MORNING_STEPS.map(s => `
                        <button class="brief-step ${todayRoutine.has(s.id) ? 'done' : ''}" data-step="${s.id}" type="button">
                            <span class="brief-step-emoji">${s.emoji}</span>
                            <div class="brief-step-info">
                                <strong>${s.title}</strong>
                                <span class="text-muted">${s.note}</span>
                            </div>
                            ${todayRoutine.has(s.id) ? `<span class="brief-step-check">${icon('check', 12, '')}</span>` : ''}
                        </button>`).join('')}
                </div>
            </div>

            <!-- Sleep -->
            <div class="brief-block">
                <p class="brief-block-label">Plan de sueño</p>
                <div class="brief-sleep">
                    <div class="brief-sleep-row">
                        <label for="brief-bedtime" class="text-secondary" style="font-size:0.8rem">Hora de dormir</label>
                        <div class="brief-sleep-controls">
                            <input type="time" id="brief-bedtime" value="${bedtime}" style="width:110px">
                            <button type="button" class="btn btn-sm btn-ghost" id="save-bedtime">Guardar</button>
                        </div>
                    </div>
                    <div class="brief-sleep-info">
                        <span>Despertar ideal: <strong>${wakeRec}</strong> (7h30)</span>
                        <span class="text-muted">Rango: ${wakeMin}–${wakeMax}</span>
                    </div>
                </div>
            </div>

            <!-- Implementation Intention (Gollwitzer, 1999) -->
            <div class="brief-block">
                <p class="brief-block-label">Intención de hoy</p>
                <p class="brief-intent-hint">«Cuando [situación], haré [acción concreta].» Las intenciones específicas triplican la tasa de logro (Gollwitzer, 1999).</p>
                <textarea id="brief-intention" rows="2" placeholder="Cuando termine de desayunar, meditaré 10 minutos sin interrupciones.">${escapeHtml(savedIntention)}</textarea>
                <button type="button" class="btn btn-sm btn-ghost brief-save-btn" id="save-intention" style="margin-top:6px">Guardar</button>
            </div>

            <!-- Win definition -->
            <div class="brief-block">
                <p class="brief-block-label">¿Qué haría que hoy sea un gran día?</p>
                <p class="brief-intent-hint">Define un único resultado que, si lo logras, haría que el día valga la pena.</p>
                <textarea id="brief-win" rows="2" placeholder="Completar el informe antes de las 3 p.m. y llegar a casa a cenar.">${escapeHtml(savedWin)}</textarea>
                <button type="button" class="btn btn-sm btn-ghost brief-save-btn" id="save-win" style="margin-top:6px">Guardar</button>
            </div>

            <!-- Quote -->
            <div class="brief-quote-block">
                <p class="brief-quote">"${escapeHtml(quote)}"</p>
            </div>

            <!-- CTA -->
            <button class="btn btn-primary btn-block brief-start" id="brief-start">
                Empezar el día
            </button>
            <button class="btn btn-ghost btn-block brief-skip" id="brief-skip">
                Ir al dashboard
            </button>

        </div>
    `;

    // Listeners
    document.getElementById('brief-start')?.addEventListener('click', () => { markSeen(); window.location.hash = '#/habits'; });
    document.getElementById('brief-skip')?.addEventListener('click', () => { markSeen(); window.location.hash = '#/dashboard'; });

    document.querySelectorAll('.brief-step').forEach(btn => {
        btn.addEventListener('click', () => {
            const stepId = btn.dataset.step;
            const log = store.get('planner.morningRoutineCompletions') || {};
            const set = new Set(log[todayStr] || []);
            if (set.has(stepId)) set.delete(stepId); else set.add(stepId);
            log[todayStr] = Array.from(set);
            store.set('planner.morningRoutineCompletions', log);
            render();
        });
    });

    document.getElementById('save-intention')?.addEventListener('click', () => {
        const val = document.getElementById('brief-intention')?.value.trim();
        if (val) { store.set(`brief.intention.${todayStr}`, val); showToast('Intención guardada'); }
    });

    document.getElementById('save-win')?.addEventListener('click', () => {
        const val = document.getElementById('brief-win')?.value.trim();
        if (val) { store.set(`brief.win.${todayStr}`, val); showToast('Definición de victoria guardada'); }
    });

    document.getElementById('save-bedtime')?.addEventListener('click', () => {
        const val = document.getElementById('brief-bedtime')?.value;
        if (_toMin(val) === null) return;
        store.set('settings.targetBedtime', val);
        const wakeR = _fromMin((_toMin(val) ?? 23 * 60) + SLEEP_TARGET);
        showToast(`Horario guardado. Despertar recomendado: ${wakeR}`);
        render();
    });

    markSeen();
}

export function init() {}
export function destroy() {}
