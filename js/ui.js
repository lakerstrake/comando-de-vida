// ui.js - Shared UI utilities
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
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
    const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#ff6b6b', '#74b9ff', '#a29bfe'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            left: ${Math.random() * 100}%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            animation-delay: ${Math.random() * 0.5}s;
            animation-duration: ${1 + Math.random()}s;
        `;
        container.appendChild(confetti);
        setTimeout(() => confetti.remove(), 2000);
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
    health: { name: 'Salud', icon: '&#9829;', color: '#00b894' },
    mind: { name: 'Mente', icon: '&#9733;', color: '#6c5ce7' },
    social: { name: 'Social', icon: '&#9822;', color: '#0984e3' },
    finance: { name: 'Finanzas', icon: '&#9670;', color: '#fdcb6e' },
    career: { name: 'Carrera', icon: '&#9650;', color: '#e17055' },
    spiritual: { name: 'Espiritual', icon: '&#10047;', color: '#00cec9' }
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
