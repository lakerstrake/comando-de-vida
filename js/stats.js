// stats.js - Clean minimal stats & analytics
import { store } from './store.js';
import { formatDate, getStreakForHabit, CATEGORIES } from './ui.js';

let timeRange = 30;

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
        const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
        const n = parseInt(full, 16);
        if (!isNaN(n)) return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;
    }
    if (color.startsWith('rgba(')) {
        const v = color.slice(5,-1).split(',').map(x => x.trim());
        if (v.length >= 3) return `rgba(${v[0]},${v[1]},${v[2]},${alpha})`;
    }
    if (color.startsWith('rgb(')) {
        const v = color.slice(4,-1).split(',').map(x => x.trim());
        if (v.length >= 3) return `rgba(${v[0]},${v[1]},${v[2]},${alpha})`;
    }
    return `rgba(79,70,229,${alpha})`;
}

export function render() {
    const container = document.getElementById('main-content');

    container.innerHTML = `
        <div class="st-page">
            <div class="st-header">
                <h1>Estadísticas</h1>
                <select id="st-range" class="btn btn-sm btn-ghost">
                    <option value="7" ${timeRange === 7 ? 'selected' : ''}>7 días</option>
                    <option value="30" ${timeRange === 30 ? 'selected' : ''}>30 días</option>
                    <option value="90" ${timeRange === 90 ? 'selected' : ''}>90 días</option>
                </select>
            </div>

            <div class="st-summary" id="st-summary"></div>

            <div class="st-chart-block">
                <p class="st-chart-label">Cumplimiento de hábitos</p>
                <canvas id="habits-chart" width="500" height="200"></canvas>
            </div>

            <div class="st-chart-block">
                <p class="st-chart-label">Tareas completadas</p>
                <canvas id="tasks-chart" width="500" height="200"></canvas>
            </div>

            <div class="st-chart-block">
                <p class="st-chart-label">Tendencia de ánimo</p>
                <canvas id="mood-chart" width="500" height="200"></canvas>
            </div>

            <div class="st-chart-block">
                <p class="st-chart-label">Top rachas</p>
                <canvas id="streaks-chart" width="500" height="200"></canvas>
            </div>

            <div class="st-insight-block" id="st-insights"></div>

            <div class="st-chart-block">
                <p class="st-chart-label">Por día de semana (últimos 28 días)</p>
                <canvas id="bestday-chart" width="500" height="160"></canvas>
            </div>
        </div>
    `;

    document.getElementById('st-range')?.addEventListener('change', e => {
        timeRange = parseInt(e.target.value, 10);
        render();
    });

    _renderSummary();
    _drawHabitsChart();
    _drawTasksChart();
    _drawMoodChart();
    _drawStreaksChart();
    _drawBestDayChart();
    _renderInsights();
}

function _getDates(range) {
    const dates = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
        const dt = new Date(now); dt.setDate(dt.getDate() - i);
        dates.push(formatDate(dt));
    }
    return dates;
}

function _setupCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.parentElement.clientWidth - 32) || 500;
    const h = 180;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
}

function _drawLine(ctx, w, h, dates, values, color, maxVal = null) {
    const pal = getPalette();
    const pad = { top: 16, right: 16, bottom: 32, left: 36 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const max = maxVal || Math.max(...values, 1);

    // Grid
    ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (ch / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
        ctx.fillStyle = pal.text; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(Math.round(max - (max / 4) * i), pad.left - 4, y + 3);
    }

    // X labels
    ctx.fillStyle = pal.text; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(dates.length / 6));
    dates.forEach((d, i) => {
        if (i % step === 0) {
            const x = pad.left + (i / (dates.length - 1 || 1)) * cw;
            ctx.fillText(d.slice(5), x, h - 4);
        }
    });

    if (values.length < 2) return;

    // Area
    ctx.beginPath();
    values.forEach((v, i) => {
        const x = pad.left + (i / (values.length - 1)) * cw;
        const y = pad.top + ch - (v / max) * ch;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(pad.left + cw, pad.top + ch);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = toTransparentColor(color, 0.1);
    ctx.fill();

    // Dots
    values.forEach((v, i) => {
        const x = pad.left + (i / (values.length - 1)) * cw;
        const y = pad.top + ch - (v / max) * ch;
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
    });
}

function _drawBars(ctx, w, h, labels, values, colors) {
    const pal = getPalette();
    const pad = { top: 16, right: 16, bottom: 44, left: 36 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;
    const max = Math.max(...values, 1);
    const bw = Math.min(36, (cw / values.length) * 0.65);
    const gap = (cw - bw * values.length) / (values.length + 1);

    values.forEach((v, i) => {
        const x = pad.left + gap + i * (bw + gap);
        const bh = (v / max) * ch;
        const y = pad.top + ch - bh;
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = pal.textStrong; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(v, x + bw / 2, y - 4);
        ctx.fillStyle = pal.text; ctx.font = '9px sans-serif';
        ctx.save(); ctx.translate(x + bw / 2, h - 4);
        ctx.rotate(-0.4); ctx.fillText(labels[i], 0, 0); ctx.restore();
    });
}

function _drawHabitsChart() {
    const s = _setupCanvas('habits-chart'); if (!s) return;
    const { ctx, w, h } = s;
    const dates = _getDates(timeRange);
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const values = dates.map(d => habits.length ? Math.round(((completions[d] || []).length / habits.length) * 100) : 0);
    _drawLine(ctx, w, h, dates, values, getPalette().accent, 100);
}

function _drawMoodChart() {
    const s = _setupCanvas('mood-chart'); if (!s) return;
    const { ctx, w, h } = s;
    const dates = _getDates(timeRange);
    const entries = store.get('journal.entries') || [];
    const map = {};
    entries.forEach(e => { map[e.date] = e; });
    const values = dates.map(d => map[d]?.mood || 0);
    _drawLine(ctx, w, h, dates, values, '#10b981', 5);
}

function _drawStreaksChart() {
    const s = _setupCanvas('streaks-chart'); if (!s) return;
    const { ctx, w, h } = s;
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const pal = getPalette();
    const data = habits.map(h => ({
        name: h.name.length > 14 ? h.name.slice(0, 14) + '…' : h.name,
        streak: getStreakForHabit(h.id, completions),
        color: CATEGORIES[h.category]?.color || pal.accent
    })).sort((a, b) => b.streak - a.streak).slice(0, 8);

    if (!data.length) {
        ctx.fillStyle = pal.text; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Sin rachas registradas', w / 2, h / 2);
        return;
    }
    _drawBars(ctx, w, h, data.map(d => d.name), data.map(d => d.streak), data.map(d => d.color));
}

function _drawTasksChart() {
    const s = _setupCanvas('tasks-chart'); if (!s) return;
    const { ctx, w, h } = s;
    const dates = _getDates(timeRange);
    const tasks = store.get('planner.tasks') || [];
    const values = dates.map(d => tasks.filter(t => t.date === d && t.completed).length);
    _drawLine(ctx, w, h, dates, values, getPalette().success);
}

function _renderSummary() {
    const el = document.getElementById('st-summary'); if (!el) return;
    const dates = _getDates(timeRange);
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const entries = store.get('journal.entries') || [];

    let hDone = 0, hTotal = 0, tDone = 0, tTotal = 0, jDays = 0, mSum = 0, mCount = 0;
    dates.forEach(d => {
        hDone += (completions[d] || []).length; hTotal += habits.length;
        const dt = tasks.filter(t => t.date === d);
        tTotal += dt.length; tDone += dt.filter(t => t.completed).length;
        const e = entries.find(e => e.date === d);
        if (e) { jDays++; if (e.mood) { mSum += e.mood; mCount++; } }
    });

    const hRate = hTotal ? Math.round((hDone / hTotal) * 100) : 0;
    const tRate = tTotal ? Math.round((tDone / tTotal) * 100) : 0;
    const avgMood = mCount ? (mSum / mCount).toFixed(1) : '—';

    el.innerHTML = `
        <div class="st-summary-grid">
            <div class="st-stat"><strong>${hRate}%</strong><span class="text-muted">Hábitos</span></div>
            <div class="st-stat"><strong>${tDone}/${tTotal}</strong><span class="text-muted">Tareas</span></div>
            <div class="st-stat"><strong>${jDays}/${timeRange}</strong><span class="text-muted">Días con diario</span></div>
            <div class="st-stat"><strong>${avgMood}</strong><span class="text-muted">Ánimo medio</span></div>
        </div>
        <p class="st-focus-hint text-secondary">
            ${hRate < 70 ? 'Simplifica tus hábitos — elige 1-3 esenciales y hazlos irrompibles.' :
              tRate < 70 ? 'Reduce tareas abiertas — prioriza 1-3 por día.' :
              'Buen ritmo. Mantén la consistencia.'}
        </p>
    `;
}

function _drawBestDayChart() {
    const s = _setupCanvas('bestday-chart'); if (!s) return;
    const { ctx, w, h } = s;
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    if (!habits.length) return;

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const sums = Array(7).fill(0), counts = Array(7).fill(0);
    for (let i = 1; i <= 28; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        const dow = d.getDay();
        const rate = (completions[ds] || []).filter(id => habits.some(h => h.id === id)).length / habits.length;
        sums[dow] += rate; counts[dow]++;
    }
    const avgs = sums.map((s, i) => counts[i] ? Math.round((s / counts[i]) * 100) : 0);
    const pal = getPalette();
    const maxAvg = Math.max(...avgs, 1);
    _drawBars(ctx, w, h, dayNames, avgs, avgs.map(v => v >= maxAvg * 0.9 ? pal.accent : `rgba(79,70,229,0.35)`));
}

function _renderInsights() {
    const el = document.getElementById('st-insights'); if (!el) return;
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const entries = store.get('journal.entries') || [];

    // Mood ↔ habit correlation (last 30 days with mood data)
    const pairs = [];
    for (let i = 1; i <= 30; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        const mood = entries.find(e => e.date === ds)?.mood;
        if (!mood || !habits.length) continue;
        const rate = (completions[ds] || []).filter(id => habits.some(h => h.id === id)).length / habits.length;
        pairs.push({ mood, rate });
    }

    let corrText = null;
    if (pairs.length >= 7) {
        const highHabitDays = pairs.filter(p => p.rate >= 0.7);
        const lowHabitDays  = pairs.filter(p => p.rate < 0.3);
        const avgMoodHigh = highHabitDays.length ? (highHabitDays.reduce((s, p) => s + p.mood, 0) / highHabitDays.length).toFixed(1) : null;
        const avgMoodLow  = lowHabitDays.length  ? (lowHabitDays.reduce((s, p) => s + p.mood, 0) / lowHabitDays.length).toFixed(1) : null;
        if (avgMoodHigh && avgMoodLow && parseFloat(avgMoodHigh) > parseFloat(avgMoodLow)) {
            corrText = `En días con ≥70% de hábitos tu ánimo es ${avgMoodHigh}/5 vs ${avgMoodLow}/5 en días bajos. Los hábitos predicen tu bienestar.`;
        } else if (avgMoodHigh && avgMoodLow) {
            corrText = `Correlación hábito-ánimo débil (${avgMoodHigh} vs ${avgMoodLow}/5). Puede que el sueño o el estrés importen más en tu caso.`;
        }
    }

    // Best consecutive streak across all habits
    const allStreaks = habits.map(h => ({ name: h.name, streak: getStreakForHabit(h.id, completions) })).filter(h => h.streak > 0).sort((a, b) => b.streak - a.streak);
    const top = allStreaks[0];

    const items = [];
    if (corrText) items.push({ emoji: '🧠', color: '#6366f1', text: corrText });
    if (top && top.streak >= 7) {
        const msg = top.streak >= 66 ? `hábito automatizado (umbral 66 días, Phillippa Lally 2010)` : top.streak >= 21 ? `en la zona de consolidación` : `racha activa`;
        items.push({ emoji: '🔥', color: '#f59e0b', text: `"${top.name}": ${top.streak} días — ${msg}.` });
    }

    if (!items.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
        <div class="st-insight-list">
            ${items.map(item => `
            <div class="st-insight-item" style="border-left-color:${item.color}">
                <span>${item.emoji}</span>
                <span>${item.text}</span>
            </div>`).join('')}
        </div>`;
}

export function init() {}
export function destroy() {}
