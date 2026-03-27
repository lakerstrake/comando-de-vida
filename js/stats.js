// stats.js - Stats & Analytics module
import { store } from './store.js';
import { today, formatDate, getStreakForHabit, CATEGORIES, MOODS, LIFE_AREAS } from './ui.js';

let timeRange = 30; // days

export function render() {
    const container = document.getElementById('main-content');

    container.innerHTML = `
        <div class="stats-page">
            <div class="page-header">
                <h1>&#128202; Estad\u00edsticas</h1>
                <div class="header-actions">
                    <select id="time-range" class="btn btn-sm btn-ghost">
                        <option value="7" ${timeRange === 7 ? 'selected' : ''}>7 d\u00edas</option>
                        <option value="30" ${timeRange === 30 ? 'selected' : ''}>30 d\u00edas</option>
                        <option value="90" ${timeRange === 90 ? 'selected' : ''}>90 d\u00edas</option>
                    </select>
                </div>
            </div>

            <div class="stats-grid">
                <div class="glass-card stat-card">
                    <h3>&#128293; Tasa de H\u00e1bitos</h3>
                    <canvas id="habits-chart" width="500" height="250"></canvas>
                </div>

                <div class="glass-card stat-card">
                    <h3>&#127912; Tendencia de \u00c1nimo</h3>
                    <canvas id="mood-chart" width="500" height="250"></canvas>
                </div>

                <div class="glass-card stat-card">
                    <h3>&#128293; Top Rachas</h3>
                    <canvas id="streaks-chart" width="500" height="250"></canvas>
                </div>

                <div class="glass-card stat-card">
                    <h3>&#9745; Productividad (Tareas)</h3>
                    <canvas id="tasks-chart" width="500" height="250"></canvas>
                </div>
            </div>

            <div class="glass-card" style="margin-top:16px;padding:16px">
                <h3>&#128200; Resumen del Per\u00edodo</h3>
                <div id="period-summary" class="period-summary"></div>
            </div>
        </div>
    `;

    document.getElementById('time-range')?.addEventListener('change', (e) => {
        timeRange = parseInt(e.target.value);
        render();
    });

    drawHabitsChart();
    drawMoodChart();
    drawStreaksChart();
    drawTasksChart();
    renderPeriodSummary();
}

function getDates(range) {
    const dates = [];
    const d = new Date();
    for (let i = range - 1; i >= 0; i--) {
        const dt = new Date(d);
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
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
}

function drawLineChart(ctx, w, h, dates, values, color, label, maxVal = null) {
    const padding = { top: 20, right: 20, bottom: 35, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const max = maxVal || Math.max(...values, 1);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(w - padding.right, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(max - (max / 4) * i), padding.left - 5, y + 4);
    }

    // X labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(dates.length / 7));
    dates.forEach((d, i) => {
        if (i % step === 0) {
            const x = padding.left + (i / (dates.length - 1 || 1)) * chartW;
            ctx.fillText(d.slice(5), x, h - 5);
        }
    });

    // Line
    if (values.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    values.forEach((v, i) => {
        const x = padding.left + (i / (values.length - 1)) * chartW;
        const y = padding.top + chartH - (v / max) * chartH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Area
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba');
    ctx.fill();

    // Dots
    values.forEach((v, i) => {
        const x = padding.left + (i / (values.length - 1)) * chartW;
        const y = padding.top + chartH - (v / max) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

function drawBarChart(ctx, w, h, labels, values, colors) {
    const padding = { top: 20, right: 20, bottom: 50, left: 40 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;
    const max = Math.max(...values, 1);
    const barWidth = Math.min(40, (chartW / values.length) * 0.7);
    const gap = (chartW - barWidth * values.length) / (values.length + 1);

    values.forEach((v, i) => {
        const x = padding.left + gap + i * (barWidth + gap);
        const barH = (v / max) * chartH;
        const y = padding.top + chartH - barH;

        // Bar
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.roundRect?.(x, y, barWidth, barH, [4, 4, 0, 0]) || ctx.fillRect(x, y, barWidth, barH);
        ctx.fill();

        // Value
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v, x + barWidth / 2, y - 5);

        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px sans-serif';
        ctx.save();
        ctx.translate(x + barWidth / 2, h - 5);
        ctx.rotate(-0.4);
        ctx.fillText(labels[i], 0, 0);
        ctx.restore();
    });
}

function drawHabitsChart() {
    const setup = setupCanvas('habits-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const dates = getDates(timeRange);
    const habits = (store.get('habits.items') || []).filter(hab => !hab.archived);
    const completions = store.get('habits.completions') || {};

    const values = dates.map(d => {
        const dayDone = (completions[d] || []).length;
        return habits.length ? Math.round((dayDone / habits.length) * 100) : 0;
    });

    drawLineChart(ctx, w, h, dates, values, 'rgb(108, 92, 231)', 'Completion %', 100);
}

function drawMoodChart() {
    const setup = setupCanvas('mood-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const dates = getDates(timeRange);
    const entries = store.get('journal.entries') || [];
    const entryMap = {};
    entries.forEach(e => entryMap[e.date] = e);

    const values = dates.map(d => entryMap[d]?.mood || 0);
    // Draw colored background zones
    const padding = { top: 20, right: 20, bottom: 35, left: 40 };
    const chartH = h - padding.top - padding.bottom;
    const zoneColors = ['rgba(255,107,107,0.05)', 'rgba(225,112,85,0.05)', 'rgba(253,203,110,0.05)', 'rgba(0,206,201,0.05)', 'rgba(0,184,148,0.05)'];
    zoneColors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(padding.left, padding.top + (chartH / 5) * (4 - i), w - padding.left - padding.right, chartH / 5);
    });

    drawLineChart(ctx, w, h, dates, values, 'rgb(0, 206, 201)', 'Mood', 5);
}

function drawStreaksChart() {
    const setup = setupCanvas('streaks-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const habits = (store.get('habits.items') || []).filter(hab => !hab.archived);
    const completions = store.get('habits.completions') || {};

    const streakData = habits.map(hab => ({
        name: hab.name.length > 15 ? hab.name.slice(0, 15) + '...' : hab.name,
        streak: getStreakForHabit(hab.id, completions),
        color: CATEGORIES[hab.category]?.color || '#6c5ce7'
    })).sort((a, b) => b.streak - a.streak).slice(0, 8);

    if (!streakData.length) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No hay rachas a\u00fan', w / 2, h / 2);
        return;
    }

    drawBarChart(ctx, w, h, streakData.map(s => s.name), streakData.map(s => s.streak), streakData.map(s => s.color));
}

function drawTasksChart() {
    const setup = setupCanvas('tasks-chart');
    if (!setup) return;
    const { ctx, w, h } = setup;
    const dates = getDates(timeRange);
    const tasks = store.get('planner.tasks') || [];

    const values = dates.map(d => {
        const dayTasks = tasks.filter(t => t.date === d);
        const done = dayTasks.filter(t => t.completed).length;
        return done;
    });

    drawLineChart(ctx, w, h, dates, values, 'rgb(0, 184, 148)', 'Tasks done');
}

function renderPeriodSummary() {
    const el = document.getElementById('period-summary');
    if (!el) return;
    const dates = getDates(timeRange);
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
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

    dates.forEach(d => {
        const dayComp = (completions[d] || []).length;
        totalHabitChecks += dayComp;
        totalPossible += habits.length;

        const dayTasks = tasks.filter(t => t.date === d);
        totalTasks += dayTasks.length;
        totalTasksDone += dayTasks.filter(t => t.completed).length;

        const entry = entries.find(e => e.date === d);
        if (entry) {
            journalDays++;
            if (entry.mood) { moodSum += entry.mood; moodCount++; }
        }
    });

    const habitRate = totalPossible ? Math.round((totalHabitChecks / totalPossible) * 100) : 0;
    const taskRate = totalTasks ? Math.round((totalTasksDone / totalTasks) * 100) : 0;
    const avgMood = moodCount ? (moodSum / moodCount).toFixed(1) : '-';

    el.innerHTML = `
        <div class="summary-grid">
            <div class="summary-item">
                <span class="summary-value">${habitRate}%</span>
                <span class="summary-label">Cumplimiento de H\u00e1bitos</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${totalTasksDone}/${totalTasks}</span>
                <span class="summary-label">Tareas Completadas</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${journalDays}/${timeRange}</span>
                <span class="summary-label">D\u00edas con Diario</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${avgMood}</span>
                <span class="summary-label">\u00c1nimo Promedio (1-5)</span>
            </div>
        </div>
    `;
}

export function init() {}
export function destroy() {}
