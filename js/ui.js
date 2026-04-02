// ui.js - Shared UI utilities
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const ICONS = {
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    flame: '<path d="M12 3c2.5 3 4 4.9 4 7.5a4 4 0 1 1-8 0C8 8.2 9.4 6.5 12 3z"/><path d="M12 10.5c1.2 1.2 1.8 2.2 1.8 3.2a1.8 1.8 0 1 1-3.6 0c0-1 .6-2 1.8-3.2z"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    sparkle: '<path d="M12 3l1.6 3.4L17 8l-3.4 1.6L12 13l-1.6-3.4L7 8l3.4-1.6L12 3z"/><path d="M5 15l.8 1.7L7.5 17l-1.7.8L5 19.5l-.8-1.7L2.5 17l1.7-.8L5 15z"/><path d="M19 14l.9 1.9L22 17l-2.1 1.1L19 20l-.9-1.9L16 17l2.1-1.1L19 14z"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7.1 7.1 0 0 0 9.8 9.8z"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.8"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
    categoryHealth: '<path d="M12 20s-7-4.2-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.8-7 9-7 9z"/>',
    categoryMind: '<circle cx="12" cy="12" r="8"/><path d="M9.5 10.5h5M9.5 13.5h5"/>',
    categorySocial: '<circle cx="8" cy="9" r="2"/><circle cx="16" cy="9" r="2"/><path d="M4.8 16a3.2 3.2 0 0 1 3.2-3.2h8A3.2 3.2 0 0 1 19.2 16"/>',
    categoryFinance: '<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 12h8"/><circle cx="12" cy="12" r="2.2"/>',
    categoryCareer: '<path d="M3 8h18v11H3z"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    categorySpiritual: '<path d="M12 3l2.4 4.8L20 10l-4 3.6L17 20l-5-2.8L7 20l1-6.4L4 10l5.6-2.2L12 3z"/>'
};

export function icon(name, size = 14, className = '') {
    const paths = ICONS[name] || ICONS.sparkle;
    return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

export function formatDate(date) {
    if (typeof date === 'string') date = new Date(date);
    return date.toISOString().split('T')[0];
}

export function formatDateDisplay(date) {
    if (typeof date === 'string') date = new Date(date + 'T12:00:00');
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options);
}

export function today() {
    return formatDate(new Date());
}

export function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '&#10003;' : type === 'error' ? '&#10007;' : type === 'warning' ? '&#9888;' : '&#8505;'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export function showModal(title, content, actions = []) {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal');
    modal.innerHTML = `
        <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
        ${actions.length ? `<div class="modal-actions">${actions.map(a =>
            `<button class="btn btn-${a.type || 'secondary'}" id="modal-action-${a.id}">${a.label}</button>`
        ).join('')}</div>` : ''}
    `;
    modal.scrollTop = 0;
    const modalBody = modal.querySelector('.modal-body');
    if (modalBody) modalBody.scrollTop = 0;
    overlay.classList.add('active');
    actions.forEach(a => {
        const btn = document.getElementById(`modal-action-${a.id}`);
        if (btn) btn.addEventListener('click', () => {
            a.handler();
            overlay.classList.remove('active');
        });
    });
}

export function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

export function playSound(type = 'complete') {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'complete') {
            osc.frequency.setValueAtTime(523, ctx.currentTime);
            osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'streak') {
            osc.frequency.setValueAtTime(523, ctx.currentTime);
            osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
            osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'pomodoro') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 1);
        }
    } catch (e) { /* Audio not supported */ }
}

export function animateReward(element) {
    if (!element) return;
    element.classList.add('reward-pop');
    setTimeout(() => element.classList.remove('reward-pop'), 600);
}

export function createConfetti(container) {
    const colors = ['#1f6feb', '#2f5ea8', '#3d4b66', '#14876d', '#7a8daa'];
    for (let i = 0; i < 24; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            left: ${Math.random() * 100}%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            animation-delay: ${Math.random() * 0.5}s;
            animation-duration: ${1.1 + Math.random() * 0.5}s;
        `;
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 1800);
    }
}

export function getStreakForHabit(habitId, completions) {
    let streak = 0;
    const d = new Date();
    while (true) {
        const dateStr = formatDate(d);
        const dayCompletions = completions[dateStr] || [];
        if (dayCompletions.includes(habitId)) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            // Allow today to be incomplete (day isn't over)
            if (streak === 0 && dateStr === today()) {
                d.setDate(d.getDate() - 1);
                continue;
            }
            break;
        }
    }
    return streak;
}

/** Best (all-time longest) streak for a habit across full history */
export function getBestStreakForHabit(habitId, completions) {
    const dates = Object.keys(completions)
        .filter(d => (completions[d] || []).includes(habitId))
        .sort();
    if (!dates.length) return 0;
    let best = 1, current = 1;
    for (let i = 1; i < dates.length; i++) {
        const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
        if (Math.round(diff) === 1) { current++; best = Math.max(best, current); }
        else current = 1;
    }
    return best;
}

/** Consecutive days the user has completed at least 1 habit (app-level streak) */
export function getAppStreak(completions) {
    let streak = 0;
    const d = new Date();
    while (true) {
        const dateStr = formatDate(d);
        if ((completions[dateStr] || []).length > 0) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else {
            if (streak === 0 && dateStr === today()) { d.setDate(d.getDate() - 1); continue; }
            break;
        }
    }
    return streak;
}

/** Returns CSS level class for a streak number */
export function streakLevel(n) {
    if (n >= 66) return 'legendary';
    if (n >= 30) return 'fire';
    if (n >= 7)  return 'hot';
    if (n >= 3)  return 'warm';
    return '';
}

/** Milestone message for a streak */
export function streakMilestoneMsg(streak) {
    const milestones = {
        1:   '¡Primer día! El viaje comienza ahora.',
        3:   '¡3 días! El patrón empieza a formarse.',
        7:   '¡7 días! Tu cerebro está creando nuevas conexiones neuronales.',
        14:  '¡2 semanas! La mielinización está en marcha.',
        21:  '¡21 días! A un tercio de automatizarlo para siempre.',
        30:  '¡Un mes! Este hábito está grabado en tu corteza prefrontal.',
        60:  '¡60 días! Ya forma parte de tu identidad.',
        66:  '¡66 días! La ciencia confirma: ya es automático.',
        100: '¡100 días! Eres una persona fundamentalmente diferente.',
        200: '¡200 días! Eres un maestro de la disciplina.',
        365: '¡Un año completo! Leyenda absoluta.'
    };
    return milestones[streak] || null;
}

export function getDaysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

export function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

export const CATEGORIES = {
    health: { name: 'Salud', icon: icon('categoryHealth', 14, 'category-icon-svg'), color: '#14876d' },
    mind: { name: 'Mente', icon: icon('categoryMind', 14, 'category-icon-svg'), color: '#2f5ea8' },
    social: { name: 'Social', icon: icon('categorySocial', 14, 'category-icon-svg'), color: '#2d7f8b' },
    finance: { name: 'Finanzas', icon: icon('categoryFinance', 14, 'category-icon-svg'), color: '#7b5d2a' },
    career: { name: 'Carrera', icon: icon('categoryCareer', 14, 'category-icon-svg'), color: '#8a4a37' },
    spiritual: { name: 'Espiritual', icon: icon('categorySpiritual', 14, 'category-icon-svg'), color: '#555692' }
};

export const LIFE_AREAS = {
    health: 'Salud',
    career: 'Carrera',
    finance: 'Finanzas',
    relationships: 'Relaciones',
    romance: 'Amor',
    personalGrowth: 'Crecimiento',
    funRecreation: 'Diversi\u00f3n',
    physicalEnvironment: 'Entorno'
};

export const MOODS = [
    { value: 1, label: 'Mal', color: '#ff6b6b' },
    { value: 2, label: 'Bajo', color: '#e17055' },
    { value: 3, label: 'Normal', color: '#fdcb6e' },
    { value: 4, label: 'Bien', color: '#00cec9' },
    { value: 5, label: 'Excelente', color: '#00b894' }
];

export const QUOTES = [
    "La disciplina es el puente entre metas y logros. - Jim Rohn",
    "No cuentes los d\u00edas, haz que los d\u00edas cuenten. - Muhammad Ali",
    "El \u00e9xito es la suma de peque\u00f1os esfuerzos repetidos d\u00eda tras d\u00eda. - Robert Collier",
    "Tu cerebro no distingue entre visualizar y hacer. Usa eso a tu favor.",
    "La neuroplasticidad demuestra que puedes recablear tu cerebro a cualquier edad.",
    "Cada h\u00e1bito completado fortalece las v\u00edas neuronales del \u00e9xito.",
    "La dopamina se libera al anticipar la recompensa. Celebra cada peque\u00f1o paso.",
    "El cortisol del estr\u00e9s se reduce con 5 minutos de respiraci\u00f3n consciente.",
    "La amigdala se calma cuando escribes tus preocupaciones. Usa tu diario.",
    "Somos lo que hacemos repetidamente. La excelencia no es un acto, es un h\u00e1bito. - Arist\u00f3teles",
    "La acci\u00f3n precede a la motivaci\u00f3n, no al rev\u00e9s. Solo empieza.",
    "Tu corteza prefrontal se fortalece con cada decisi\u00f3n consciente.",
    "El sue\u00f1o consolida la memoria. Dormir bien es parte del \u00e9xito.",
    "Las neuronas que se disparan juntas, se conectan juntas. - Donald Hebb",
    "Un 1% mejor cada d\u00eda = 37 veces mejor en un a\u00f1o."
];
