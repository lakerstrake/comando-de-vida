// stats.js - Stats & Analytics module
import { store } from './store.js';
import { formatDate, getStreakForHabit, CATEGORIES } from './ui.js';

let timeRange = 30; // days

function isSimpleMode() {
    const settings = store.get('settings') || {};
    return settings.simpleMode !== false;
}

function getPalette() {
    const style = getComputedStyle(document.documentElement);
    return {
        text: style.getPropertyValue('--text-secondary').trim() || '#475569',
        textStrong: style.getPropertyValue('--text-primary').trim() || '#0f172a',
        grid: style.getPropertyValue('--border').trim() || 'rgba(0,0,0,0.1)',
        accent: style.getPropertyValue('--accent-primary').trim() || '#4f46e5',
        success: style.getPropertyValue('--accent-success').trim() || '#059669'
    };
}

function toTransparentColor(color, alpha = 0.12) {
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const fullHex = hex.length === 3
            ? hex.split('').map((c) => c + c).join('')
            : hex;
        const intValue = Number.parseInt(fullHex, 16);
        if (!Number.isNaN(intValue)) {
            const r = (intValue >> 16) & 255;
            const g = (intValue >> 8) & 255;
            const b = intValue & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    }

    if (color.startsWith('rgba(')) {
        const values = color.slice(5, -1).split(',').map((v) => v.trim());
        if (values.length >= 3) {
            return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${alpha})`;
        }
    }

    if (color.startsWith('rgb(')) {
        const values = color.slice(4, -1).split(',').map((v) => v.trim());
        if (values.length >= 3) {
            return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${alpha})`;
        }
    }

    return `rgba(79, 70, 229, ${alpha})`;
}

export function render() {
    const container = document.getElementById('main-content');
    const simpleMode = isSimpleMode();

    container.innerHTML = `
        <div class="stats-page">
            <div class="page-header">
                <h1>Estadísticas</h1>
                <div class="header-actions">
                    <select id="time-range" class="btn btn-sm btn-ghost">
                        <option value="7" ${timeRange === 7 ? 'selected' : ''}>7 días</option>
                        <option value="30" ${timeRange === 30 ? 'selected' : ''}>30 días</option>
                        <option value="90" ${timeRange === 90 ? 'selected' : ''}>90 días</option>
                    </select>
                </div>
            </div>

            <div class="stats-grid ${simpleMode ? 'stats-grid-simple' : ''}">
                <div class="glass-card stat-card">
                    <h3>Cumplimiento de hábitos</h3>
                    <canvas id="habits-chart" width="500" height="250"></canvas>
                </div>

                <div class="glass-card stat-card">
                    <h3>Tareas completadas</h3>
                    <canvas id="tasks-chart" width="500" height="250"></canvas>
                </div>

                ${simpleMode ? '' : `
                    <div class="glass-card stat-card">
                        <h3>Tendencia de ánimo</h3>
                        <canvas id="mood-chart" width="500" height="250"></canvas>
                    </div>

                    <div class="glass-card stat-card">
                        <h3>Top rachas</h3>
                        <canvas id="streaks-chart" width="500" height="250"></canvas>
                    </div>
                `}
            </div>

            <div class="glass-card" style="margin-top:16px;padding:16px">
                <h3>${simpleMode ? 'Resumen esencial' : 'Resumen del período'}</h3>
                <div id="period-summary" class="period-summary"></div>
            </div>
        </div>
    `;

    document.getElementById('time-range')?.addEventListener('change', (e) => {
        timeRange = parseInt(e.target.value, 10);
        render();
    });

    drawHabitsChart();
    drawTasksChart();
    if (!simpleMode) {
        drawMoodChart();
        drawStreaksChart();
    }
    renderPeriodSummary(simpleMode);
}

function getDates(range) {
    const dates = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
        const dt = new Date(now);
        dt.setDate(dt.getDate() - i);
        dates.push(formatDate(dt));
    }
    return dates;
}

function setupCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth - 32 || 500;
    const h = 220;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
}

function drawLineChart(ctx, w, h, dates, values, color, maxVal = null) {
    const palette = getPalette();
    const padding = { top: 20, right: 20, bottom: 35, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const max = maxVal || Math.max(...values, 1);

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.fillStyle = palette.text;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max - (max / 4) * i), padding.left - 5, y + 4);
    }

    ctx.fillStyle = palette.text;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(dates.length / 7));
    dates.forEach((date, index) => {
        if (index % step === 0) {
            const x = padding.left + (index / (dates.length - 1 || 1)) * chartW;
            ctx.fillText(date.slice(5), x, h - 5);
        }
    });

    if (values.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    values.forEach((value, index) => {
        const x = padding.left + (index / (values.length - 1)) * chartW;
        const y = padding.top + chartH - (value / max) * chartH;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = toTransparentColor(color, 0.12);
    ctx.fill();

    values.forEach((value, index) => {
        const x = padding.left + (index / (values.length - 1)) * chartW;
        const y = padding.top + chartH - (value / max) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

function drawBarChart(ctx, w, h, labels, values, colors) {
    const palette = getPalette();
    const padding = { top: 20, right: 20, bottom: 50, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const max = Math.max(...values, 1);
    const barWidth = Math.min(40, (chartW / values.length) * 0.7);
    const gap = (chartW - barWidth * values.length) / (values.length + 1);

    values.forEach((value, index) => {
        const x = padding.left + gap + index * (barWidth + gap);
        const barH = (value / max) * chartH;
        const y = padding.top + chartH - barH;

        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x, y, barWidth, barH);

        ctx.fillStyle = palette.textStrong;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(value, x + barWidth / 2, y - 5);

        ctx.fillStyle = palette.text;
        ctx.font = '10px sans-serif';
        ctx.save();
        ctx.translate(x + barWidth / 2, h - 5);
        ctx.rotate(-0.4);
        ctx.fillText(labels[index], 0, 0);
        ctx.restore();
    });
}

function drawHabitsChart() {
    const setup = setupCanvas('habits-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const dates = getDates(timeRange);
    const habits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const completions = store.get('habits.completions') || {};

    const values = dates.map((date) => {
        const dayDone = (completions[date] || []).length;
        return habits.length ? Math.round((dayDone / habits.length) * 100) : 0;
    });

    drawLineChart(ctx, w, h, dates, values, getPalette().accent, 100);
}

function drawMoodChart() {
    const setup = setupCanvas('mood-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const dates = getDates(timeRange);
    const entries = store.get('journal.entries') || [];
    const entryMap = {};
    entries.forEach((entry) => {
        entryMap[entry.date] = entry;
    });

    const values = dates.map((date) => entryMap[date]?.mood || 0);
    drawLineChart(ctx, w, h, dates, values, 'rgb(0, 170, 140)', 5);
}

function drawStreaksChart() {
    const setup = setupCanvas('streaks-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const habits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const completions = store.get('habits.completions') || {};
    const palette = getPalette();

    const streakData = habits.map((habit) => ({
        name: habit.name.length > 15 ? `${habit.name.slice(0, 15)}...` : habit.name,
        streak: getStreakForHabit(habit.id, completions),
        color: CATEGORIES[habit.category]?.color || palette.accent
    })).sort((a, b) => b.streak - a.streak).slice(0, 8);

    if (!streakData.length) {
        ctx.fillStyle = palette.text;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No hay rachas registradas', w / 2, h / 2);
        return;
    }

    drawBarChart(
        ctx,
        w,
        h,
        streakData.map((streak) => streak.name),
        streakData.map((streak) => streak.streak),
        streakData.map((streak) => streak.color)
    );
}

function drawTasksChart() {
    const setup = setupCanvas('tasks-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const dates = getDates(timeRange);
    const tasks = store.get('planner.tasks') || [];

    const values = dates.map((date) => {
        const dayTasks = tasks.filter((task) => task.date === date);
        return dayTasks.filter((task) => task.completed).length;
    });

    drawLineChart(ctx, w, h, dates, values, getPalette().success);
}

function renderPeriodSummary(simpleMode) {
    const el = document.getElementById('period-summary');
    if (!el) return;

    const dates = getDates(timeRange);
    const habits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const entries = store.get('journal.entries') || [];

    let totalHabitChecks = 0;
    let totalPossible = 0;
    let totalTasksDone = 0;
    let totalTasks = 0;
    let journalDays = 0;
    let moodSum = 0;
    let moodCount = 0;

    dates.forEach((date) => {
        const dayComp = (completions[date] || []).length;
        totalHabitChecks += dayComp;
        totalPossible += habits.length;

        const dayTasks = tasks.filter((task) => task.date === date);
        totalTasks += dayTasks.length;
        totalTasksDone += dayTasks.filter((task) => task.completed).length;

        const entry = entries.find((journalEntry) => journalEntry.date === date);
        if (entry) {
            journalDays++;
            if (entry.mood) {
                moodSum += entry.mood;
                moodCount++;
            }
        }
    });

    const habitRate = totalPossible ? Math.round((totalHabitChecks / totalPossible) * 100) : 0;
    const taskRate = totalTasks ? Math.round((totalTasksDone / totalTasks) * 100) : 0;
    const avgMood = moodCount ? (moodSum / moodCount).toFixed(1) : '-';
    const focusHint = habitRate < 70
        ? 'Enfoque sugerido: simplificar hábitos diarios y sostener una rutina base.'
        : taskRate < 70
            ? 'Enfoque sugerido: reducir tareas abiertas y priorizar 1 a 3 tareas clave por día.'
            : 'Buen ritmo: mantén el mismo nivel de constancia.';

    el.innerHTML = `
        <div class="summary-grid">
            <div class="summary-item">
                <span class="summary-value">${habitRate}%</span>
                <span class="summary-label">Cumplimiento de hábitos</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${totalTasksDone}/${totalTasks}</span>
                <span class="summary-label">Tareas completadas</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${journalDays}/${timeRange}</span>
                <span class="summary-label">Días con diario</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${avgMood}</span>
                <span class="summary-label">Ánimo promedio (1-5)</span>
            </div>
        </div>
        ${simpleMode ? `<p class="text-secondary" style="margin-top:12px">${focusHint}</p>` : ''}
    `;
}

export function init() {}
export function destroy() {}
