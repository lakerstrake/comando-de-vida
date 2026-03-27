// lifewheel.js - Life Wheel with Canvas radar chart
import { store } from './store.js';
import { generateId, today, formatDateDisplay, showToast, playSound, LIFE_AREAS } from './ui.js';

export function render() {
    const container = document.getElementById('main-content');
    const assessments = store.get('lifeWheel.assessments') || [];
    const latest = assessments.length ? assessments[assessments.length - 1] : null;

    container.innerHTML = `
        <div class="lifewheel-page">
            <div class="page-header">
                <h1>&#9678; Rueda de la Vida</h1>
            </div>

            <div class="glass-card" style="padding:12px;margin-bottom:16px">
                <p class="text-secondary" style="font-size:0.85rem">
                    &#129504; <strong>Neurociencia:</strong> El equilibrio entre \u00e1reas de vida reduce el cortisol cr\u00f3nico y activa la red neuronal por defecto (DMN), responsable de la creatividad y la autoconciencia. Una vida desequilibrada genera estr\u00e9s que sabotea todas las \u00e1reas.
                </p>
            </div>

            <div class="lifewheel-layout">
                <div class="glass-card chart-container">
                    <canvas id="wheel-canvas" width="400" height="400"></canvas>
                    ${latest ? `<p class="text-secondary" style="text-align:center;margin-top:8px">
                        \u00daltima evaluaci\u00f3n: ${formatDateDisplay(latest.date)}
                        | Promedio: ${(Object.values(latest.scores).reduce((a, b) => a + b, 0) / 8).toFixed(1)}/10
                    </p>` : ''}
                </div>

                <div class="glass-card assessment-form">
                    <h3>Nueva Evaluaci\u00f3n</h3>
                    <form id="wheel-form" class="form">
                        ${Object.entries(LIFE_AREAS).map(([key, label]) => `
                            <div class="wheel-slider-group">
                                <div class="wheel-slider-header">
                                    <label>${label}</label>
                                    <span class="wheel-val" id="val-${key}">${latest?.scores?.[key] || 5}</span>
                                </div>
                                <input type="range" min="1" max="10" value="${latest?.scores?.[key] || 5}"
                                    class="range-slider wheel-range" data-area="${key}"
                                    id="range-${key}">
                            </div>
                        `).join('')}
                        <button type="submit" class="btn btn-primary btn-block">Guardar Evaluaci\u00f3n</button>
                    </form>
                </div>
            </div>

            ${assessments.length > 1 ? `
                <div class="glass-card" style="margin-top:16px;padding:16px">
                    <h3>Historial de Evaluaciones</h3>
                    <div class="assessments-list">
                        ${assessments.slice().reverse().map((a, i) => `
                            <div class="assessment-item ${i === 0 ? 'assessment-latest' : ''}">
                                <span>${formatDateDisplay(a.date)}</span>
                                <span>Promedio: ${(Object.values(a.scores).reduce((s, v) => s + v, 0) / 8).toFixed(1)}</span>
                                <button class="btn btn-sm btn-ghost compare-btn" data-idx="${assessments.length - 1 - i}">Ver</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Draw chart
    if (latest) {
        drawRadarChart(latest.scores);
    } else {
        drawRadarChart(Object.fromEntries(Object.keys(LIFE_AREAS).map(k => [k, 5])));
    }

    // Slider live update
    document.querySelectorAll('.wheel-range').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const area = e.target.dataset.area;
            document.getElementById(`val-${area}`).textContent = e.target.value;
            // Live preview
            const scores = {};
            document.querySelectorAll('.wheel-range').forEach(s => {
                scores[s.dataset.area] = parseInt(s.value);
            });
            drawRadarChart(scores);
        });
    });

    // Save assessment
    document.getElementById('wheel-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const scores = {};
        document.querySelectorAll('.wheel-range').forEach(s => {
            scores[s.dataset.area] = parseInt(s.value);
        });
        const assessment = { date: today(), scores };
        const all = store.get('lifeWheel.assessments') || [];
        // Replace if same day
        const existIdx = all.findIndex(a => a.date === today());
        if (existIdx >= 0) {
            all[existIdx] = assessment;
        } else {
            all.push(assessment);
        }
        store.set('lifeWheel.assessments', all);
        playSound('complete');
        showToast('&#9678; Evaluaci\u00f3n guardada. Revisa qu\u00e9 \u00e1reas necesitan atenci\u00f3n.');
        render();
    });

    // Compare buttons
    document.querySelectorAll('.compare-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const a = assessments[idx];
            if (a) drawRadarChart(a.scores);
        });
    });
}

function drawRadarChart(scores) {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const size = 400;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = 150;
    const areas = Object.keys(LIFE_AREAS);
    const labels = Object.values(LIFE_AREAS);
    const n = areas.length;
    const angleStep = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, size, size);

    // Draw concentric polygons
    for (let level = 2; level <= 10; level += 2) {
        const r = (level / 10) * radius;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Level number
        const labelAngle = -Math.PI / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '10px sans-serif';
        ctx.fillText(level, cx + r * Math.cos(labelAngle) + 4, cy + r * Math.sin(labelAngle) + 4);
    }

    // Draw axis lines
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Draw data polygon
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const val = scores[areas[i]] || 0;
        const r = (val / 10) * radius;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(108, 92, 231, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#6c5ce7';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw data points
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const val = scores[areas[i]] || 0;
        const r = (val / 10) * radius;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = val >= 7 ? '#00cec9' : val >= 4 ? '#fdcb6e' : '#ff6b6b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    // Draw labels
    ctx.fillStyle = '#e8e8f0';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const labelR = radius + 25;
        const x = cx + labelR * Math.cos(angle);
        const y = cy + labelR * Math.sin(angle);
        ctx.fillText(`${labels[i]} (${scores[areas[i]] || 0})`, x, y);
    }
}

export function init() {}
export function destroy() {}
