// wellbeing.js - Centro de Bienestar: Science-based wellbeing toolkit
import { store } from './store.js';
import { today, formatDate, showToast, playSound, generateId } from './ui.js';
import { addXP } from './gamification.js';

// ============================================================
// Data
// ============================================================

const BREATHING_TECHNIQUES = [
    {
        id: 'box',
        name: 'Respiración en Caja',
        subtitle: 'Para foco y control del estrés',
        science: 'Activa el sistema nervioso parasimpático reduciendo la frecuencia cardíaca. Utilizada por Navy SEALs y atletas de élite para mantener la calma bajo presión intensa.',
        color: '#4f46e5',
        phases: [
            { label: 'Inhala', duration: 4, scale: 1.35 },
            { label: 'Retén', duration: 4, scale: 1.35 },
            { label: 'Exhala', duration: 4, scale: 0.85 },
            { label: 'Retén', duration: 4, scale: 0.85 }
        ],
        cycles: 4,
        totalMinutes: 2
    },
    {
        id: 'physio_sigh',
        name: 'Suspiro Fisiológico',
        subtitle: 'Técnica más rápida contra el estrés agudo',
        science: 'Investigada por el Dr. Andrew Huberman (Stanford). Un doble inhale seguido de una larga exhalación activa el nervio vago y reduce el cortisol en segundos, más rápido que cualquier otra técnica.',
        color: '#059669',
        phases: [
            { label: 'Inhala (nariz)', duration: 2, scale: 1.25 },
            { label: 'Inhala más', duration: 1, scale: 1.4 },
            { label: 'Exhala largo', duration: 6, scale: 0.75 }
        ],
        cycles: 5,
        totalMinutes: 1
    },
    {
        id: 'sleep_478',
        name: '4-7-8 Relajación',
        subtitle: 'Para reducir ansiedad y mejorar el sueño',
        science: 'Basada en pranayama yóguico y desarrollada por el Dr. Andrew Weil. La retención prolongada satura los receptores de oxígeno y activa la respuesta de relajación profunda del sistema nervioso.',
        color: '#7c3aed',
        phases: [
            { label: 'Inhala', duration: 4, scale: 1.3 },
            { label: 'Retén', duration: 7, scale: 1.3 },
            { label: 'Exhala', duration: 8, scale: 0.8 }
        ],
        cycles: 4,
        totalMinutes: 3
    }
];

const NEUROSCIENCE_TIPS = [
    {
        neurotransmitter: 'Dopamina',
        color: '#f59e0b',
        emoji: '⚡',
        tips: [
            'Completa la tarea MÁS difícil primero — genera el mayor pico de dopamina sin costo artificial.',
            'Celebra los pequeños logros en el momento. El cerebro no distingue tamaño del éxito para liberar dopamina.',
            'Ducha fría 30-90 segundos en la mañana → +250% dopamina sostenida por horas (Huberman, 2021).',
            'Evita revisar redes sociales antes de trabajar. Agotan la dopamina sin producir nada.',
            'Vincular recompensas a esfuerzo (no al resultado) maximiza la dopamina sostenida.'
        ]
    },
    {
        neurotransmitter: 'Serotonina',
        color: '#10b981',
        emoji: '☀️',
        tips: [
            '10 minutos de luz solar antes de las 10am ancla el ritmo circadiano y eleva la serotonina base.',
            'El ejercicio aeróbico produce más serotonina que la mayoría de antidepresivos, sin efectos secundarios.',
            'Caminar en naturaleza 20 minutos reduce la actividad de la amígdala (centro del miedo) un 16%.',
            'Alimentos ricos en triptófano: huevos, nueces, plátano, pavo, legumbres.',
            'El contacto físico positivo (abrazo de 20s) libera oxitocina y serotonina simultáneamente.'
        ]
    },
    {
        neurotransmitter: 'BDNF — Neuroprotección',
        color: '#6366f1',
        emoji: '🧠',
        tips: [
            'El ejercicio aeróbico es el mayor estimulador de BDNF conocido — 2x el efecto de los antidepresivos.',
            'Aprender algo nuevo cada día activa la neurogénesis en el hipocampo y aumenta la reserva cognitiva.',
            'El sueño profundo consolida lo aprendido y elimina toxinas cerebrales (sistema glinfático).',
            'El ayuno intermitente moderado (16h) activa el BDNF como mecanismo de supervivencia.',
            'Retos mentales fuera de tu zona de confort generan nuevas sinapsis — el aburrimiento las deteriora.'
        ]
    },
    {
        neurotransmitter: 'Cortisol — Control',
        color: '#ef4444',
        emoji: '🛡️',
        tips: [
            'La meditación reduce el volumen de la amígdala después de solo 8 semanas de práctica.',
            'La gratitud activa la corteza prefrontal y regula hacia abajo la respuesta al estrés del hipotálamo.',
            'Mantener rutinas diarias fijas reduce la carga cognitiva y el cortisol crónico hasta un 28%.',
            'El cortisol alto por estrés crónico impide la recuperación muscular, el sueño y la memoria.',
            'Exhalar lentamente (más largo que inhalar) activa el freno parasimpático en tiempo real.'
        ]
    },
    {
        neurotransmitter: 'Flujo (Flow State)',
        color: '#0891b2',
        emoji: '🌊',
        tips: [
            'El flujo ocurre cuando el reto es ~4% más difícil que tu habilidad actual — ni aburrido ni ansioso.',
            'Elimina interrupciones 90 minutos para trabajar en bloque — el flujo requiere ~15 min para entrar.',
            'El flujo reduce actividad en la corteza prefrontal (ego quieto) y eleva dopamina y norepinefrina.',
            'Música sin letra a 60-80 BPM facilita la entrada en estado de flujo para trabajo cognitivo.',
            'Definir tu MIT (tarea más importante) la noche anterior te permite entrar en flujo más rápido.'
        ]
    }
];

const MINDFULNESS_INSTRUCTIONS = [
    'Respira naturalmente. Solo observa.',
    'Si la mente divaga, regresa al aliento suavemente.',
    'No intentes vaciar la mente. Solo observa los pensamientos.',
    'Cada pensamiento que llega, déjalo pasar como nubes.',
    'Siente el peso de tu cuerpo. Relájate más con cada exhalación.',
    'Observa los sonidos sin juzgarlos.',
    'Nota las sensaciones físicas sin reaccionar.',
    'Tu tarea es solo estar presente. No hay nada que lograr.'
];

// Module state
let breathingTimer = null;
let mindfulnessIntervalId = null;
let coldIntervalId = null;
let currentTipCategory = 0;

// ============================================================
// Render
// ============================================================

export function render() {
    const container = document.getElementById('main-content');
    const todayStr = today();
    const stressLog = store.get('wellbeing.stressLog') || {};
    const socialLog = store.get('wellbeing.socialLog') || {};
    const breathLog = store.get('wellbeing.breathLog') || {};
    const todayStress = stressLog[todayStr] !== undefined ? stressLog[todayStr] : null;
    const todayConnections = socialLog[todayStr] || [];
    const todayBreaths = breathLog[todayStr] || [];

    currentTipCategory = store.get('wellbeing.tipIndex') || 0;

    // Stress trend (7 days)
    const stressHistory = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        if (stressLog[ds] !== undefined) stressHistory.push(stressLog[ds]);
    }
    const avgStress = stressHistory.length >= 3
        ? (stressHistory.reduce((a, b) => a + b, 0) / stressHistory.length).toFixed(1)
        : null;

    const tipCat = NEUROSCIENCE_TIPS[currentTipCategory % NEUROSCIENCE_TIPS.length];
    const tipText = tipCat.tips[new Date().getDate() % tipCat.tips.length];

    // Breathing done today
    const breathsDone = BREATHING_TECHNIQUES.filter(t => todayBreaths.includes(t.id)).length;

    container.innerHTML = `
        <div class="wellbeing-page">
            <div class="page-header">
                <h1>Bienestar</h1>
                <p class="text-secondary" style="font-size:0.8rem;margin-top:2px">Herramientas basadas en neurociencia para regular tu estado interno</p>
            </div>

            <!-- Stress Check-In -->
            <div class="glass-card wb-section">
                <div class="wb-section-header">
                    <div>
                        <h3>🌡️ Nivel de estrés ahora</h3>
                        <p class="text-secondary" style="font-size:0.8rem;margin-top:2px">Monitorear el estrés es el primer paso para regularlo</p>
                    </div>
                    ${todayStress !== null ? `<span class="wb-badge wb-badge-${todayStress >= 7 ? 'danger' : todayStress >= 4 ? 'warning' : 'ok'}">${todayStress}/10</span>` : ''}
                </div>
                <div class="stress-meter" id="stress-meter">
                    ${[1,2,3,4,5,6,7,8,9,10].map(v => `
                        <button type="button" class="stress-dot ${v <= (todayStress || 0) ? 'active' : ''} stress-${v <= 3 ? 'low' : v <= 6 ? 'mid' : 'high'}"
                            data-val="${v}">${v}</button>`).join('')}
                </div>
                <div class="stress-labels">
                    <span>Tranquilo</span>
                    <span>Muy estresado</span>
                </div>
                ${avgStress ? `<p class="text-secondary" style="font-size:0.8rem;margin-top:10px">Promedio últimos 7 días: <strong>${avgStress}/10</strong></p>` : ''}
                ${todayStress !== null && todayStress >= 7 ? `
                    <div class="wb-alert">
                        <span>⚠️</span>
                        <p>Estrés alto. Prueba el <strong>Suspiro Fisiológico</strong> — reduce cortisol en menos de 30 segundos.</p>
                    </div>` : ''}
            </div>

            <!-- Breathing Exercises -->
            <div class="glass-card wb-section">
                <div class="wb-section-header">
                    <div>
                        <h3>💨 Ejercicios de Respiración</h3>
                        <p class="text-secondary" style="font-size:0.8rem;margin-top:2px">La respiración es el único mecanismo del sistema nervioso autónomo bajo control voluntario</p>
                    </div>
                    ${breathsDone > 0 ? `<span class="wb-badge wb-badge-ok">${breathsDone}/3 hoy</span>` : ''}
                </div>
                <div class="breathing-cards">
                    ${BREATHING_TECHNIQUES.map(tech => `
                        <button class="breathing-card-btn" data-technique="${tech.id}" style="--tech-color:${tech.color}">
                            <div class="breathing-card-header">
                                <strong>${tech.name}</strong>
                                ${todayBreaths.includes(tech.id) ? '<span class="wb-done-badge">✓</span>' : ''}
                            </div>
                            <p class="text-secondary" style="font-size:0.775rem;margin-top:3px">${tech.subtitle}</p>
                            <p class="breathing-time">~${tech.totalMinutes} min · ${tech.cycles} ciclos</p>
                        </button>`).join('')}
                </div>
            </div>

            <!-- Mindfulness Timer -->
            <div class="glass-card wb-section">
                <h3>🧘 Temporizador de Mindfulness</h3>
                <p class="text-secondary" style="font-size:0.8rem;margin:6px 0 12px">5 minutos diarios de meditación reduce el volumen de la amígdala después de 8 semanas (Harvard, 2011)</p>
                <div class="wb-time-options" id="mindfulness-options">
                    ${[2, 5, 10, 20].map(m => `<button class="wb-time-btn" data-minutes="${m}">${m} min</button>`).join('')}
                </div>
                <div class="mindfulness-display" id="mindfulness-display" style="display:none">
                    <div class="mindfulness-ring" id="mindfulness-ring">
                        <span id="mindfulness-countdown" class="mindfulness-count">00:00</span>
                    </div>
                    <p id="mindfulness-instruction" class="mindfulness-instruction">Respira naturalmente. Solo observa.</p>
                    <button class="btn btn-sm btn-ghost" id="mindfulness-stop" style="margin-top:12px">Detener</button>
                </div>
            </div>

            <!-- Social Connections -->
            <div class="glass-card wb-section">
                <div class="wb-section-header">
                    <div>
                        <h3>❤️ Conexiones Significativas</h3>
                        <p class="text-secondary" style="font-size:0.8rem;margin-top:2px">La calidad de las relaciones es el predictor #1 de felicidad (Harvard Study, 85 años)</p>
                    </div>
                    <span class="wb-badge ${todayConnections.length >= 2 ? 'wb-badge-ok' : ''}">${todayConnections.length} hoy</span>
                </div>
                <div id="connections-list">
                    ${todayConnections.map((c, i) => `
                        <div class="connection-item">
                            <span class="connection-emoji">${c.type === 'deep' ? '💬' : c.type === 'quality' ? '😊' : '👋'}</span>
                            <div class="connection-info">
                                <span class="connection-person">${c.person}</span>
                                <span class="connection-type-label text-secondary">${c.type === 'deep' ? 'Conexión profunda' : c.type === 'quality' ? 'Conversación de calidad' : 'Saludo / check-in'}</span>
                            </div>
                            <button class="btn-icon connection-remove" data-idx="${i}">×</button>
                        </div>`).join('')}
                </div>
                <div class="connection-add">
                    <input type="text" id="connection-person" placeholder="¿Con quién conectaste hoy?" class="connection-input">
                    <select id="connection-type" class="connection-select">
                        <option value="quick">Saludo</option>
                        <option value="quality">Conversación</option>
                        <option value="deep">Profunda</option>
                    </select>
                    <button class="btn btn-primary btn-sm" id="add-connection-btn">+</button>
                </div>
                ${todayConnections.length === 0 ? `
                    <div class="wb-nudge">
                        💡 Hoy aún no registraste ninguna conexión social. Considera llamar o escribir a alguien importante para ti.
                    </div>` : todayConnections.length >= 3 ? `
                    <div class="wb-nudge wb-nudge-ok">
                        ✨ ${todayConnections.length} conexiones hoy. Excelente para tu bienestar emocional.
                    </div>` : ''}
            </div>

            <!-- Neuroscience Tip -->
            <div class="glass-card wb-section wb-tip-card" style="border-left:3px solid ${tipCat.color}">
                <div class="wb-tip-header">
                    <span class="wb-tip-label" style="color:${tipCat.color}">${tipCat.emoji} ${tipCat.neurotransmitter}</span>
                    <button class="btn btn-sm btn-ghost" id="next-tip-btn">Siguiente →</button>
                </div>
                <p class="wb-tip-text">${tipText}</p>
            </div>

            <!-- Cold Exposure Timer -->
            <div class="glass-card wb-section">
                <h3>🧊 Exposición al Frío</h3>
                <p class="text-secondary" style="font-size:0.8rem;margin:6px 0 12px">11 minutos semanales de frío elevan dopamina y norepinefrina hasta 250% de forma sostenida (Huberman Lab)</p>
                <div class="wb-time-options" id="cold-options">
                    ${[30, 60, 120, 180].map(s => `
                        <button class="wb-time-btn wb-time-btn-cold" data-seconds="${s}">
                            ${s < 60 ? s + 's' : (s / 60) + ' min'}
                        </button>`).join('')}
                </div>
                <div class="cold-display" id="cold-display" style="display:none">
                    <div class="cold-ring">
                        <span id="cold-countdown" class="cold-count">0</span>
                        <span style="font-size:0.8rem;color:#0891b2;display:block">segundos</span>
                    </div>
                    <p style="color:#0891b2;font-size:0.875rem;font-weight:600;margin-top:10px;text-align:center">
                        ¡El discomfort es la señal de que está funcionando!
                    </p>
                    <button class="btn btn-sm btn-ghost" id="cold-stop" style="display:block;margin:10px auto 0">Detener</button>
                </div>
            </div>

            <!-- Acts of Kindness -->
            <div class="glass-card wb-section">
                <h3>🎁 Acto de Bondad de Hoy</h3>
                <p class="text-secondary" style="font-size:0.8rem;margin:6px 0 12px">Realizar actos de bondad aumenta la serotonina tanto en quien da como en quien recibe (y en testigos). Incrementa tu bienestar un 24% en promedio (Lyubomirsky, 2005).</p>
                ${_renderKindness()}
            </div>
        </div>
    `;

    _attachListeners();
}

// ============================================================
// Kindness section
// ============================================================

function _renderKindness() {
    const todayStr = today();
    const log = store.get('wellbeing.kindnessLog') || {};
    const todayAct = log[todayStr];
    if (todayAct) {
        return `<div class="connection-item"><span class="connection-emoji">✅</span><span>${todayAct}</span></div>`;
    }
    const suggestions = [
        'Enviar un mensaje de agradecimiento a alguien que te ha ayudado',
        'Escuchar activamente a alguien sin interrumpir ni dar consejos',
        'Dar un cumplido genuino y específico a alguien hoy',
        'Ofrecerte a ayudar con algo sin que te lo pidan',
        'Compartir algo útil o inspirador con alguien que lo necesite'
    ];
    const suggestion = suggestions[new Date().getDay() % suggestions.length];
    return `
        <p class="text-secondary" style="font-size:0.85rem;margin-bottom:10px">
            <strong>Sugerencia de hoy:</strong> ${suggestion}
        </p>
        <div style="display:flex;gap:8px">
            <input type="text" id="kindness-input" placeholder="¿Qué hiciste?" style="flex:1">
            <button class="btn btn-primary btn-sm" id="log-kindness-btn">Registrar</button>
        </div>
    `;
}

// ============================================================
// Event listeners
// ============================================================

function _attachListeners() {
    const todayStr = today();

    // Stress meter
    document.querySelectorAll('.stress-dot').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.val);
            const stressLog = store.get('wellbeing.stressLog') || {};
            stressLog[todayStr] = val;
            store.set('wellbeing.stressLog', stressLog);
            if (val >= 7) {
                showToast('Estrés alto. Te recomendamos el Suspiro Fisiológico ahora.', 'warning', 4000);
            } else if (val <= 3) {
                showToast('Excelente estado. Aprovecha para trabajar en lo más importante.', 'success');
            } else {
                showToast(`Estrés ${val}/10 registrado.`, 'info');
            }
            render();
        });
    });

    // Breathing
    document.querySelectorAll('.breathing-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tech = BREATHING_TECHNIQUES.find(t => t.id === btn.dataset.technique);
            if (tech) _startBreathing(tech);
        });
    });

    // Mindfulness
    document.querySelectorAll('.wb-time-btn[data-minutes]').forEach(btn => {
        btn.addEventListener('click', () => _startMindfulness(parseInt(btn.dataset.minutes)));
    });
    document.getElementById('mindfulness-stop')?.addEventListener('click', _stopMindfulness);

    // Social connections
    document.getElementById('add-connection-btn')?.addEventListener('click', _addConnection);
    document.getElementById('connection-person')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') _addConnection();
    });
    document.querySelectorAll('.connection-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const log = store.get('wellbeing.socialLog') || {};
            const arr = [...(log[todayStr] || [])];
            arr.splice(idx, 1);
            log[todayStr] = arr;
            store.set('wellbeing.socialLog', log);
            render();
        });
    });

    // Neuroscience tip
    document.getElementById('next-tip-btn')?.addEventListener('click', () => {
        currentTipCategory = (currentTipCategory + 1) % NEUROSCIENCE_TIPS.length;
        store.set('wellbeing.tipIndex', currentTipCategory);
        render();
    });

    // Cold timer
    document.querySelectorAll('.wb-time-btn-cold').forEach(btn => {
        btn.addEventListener('click', () => _startCold(parseInt(btn.dataset.seconds)));
    });
    document.getElementById('cold-stop')?.addEventListener('click', _stopCold);

    // Kindness
    document.getElementById('log-kindness-btn')?.addEventListener('click', () => {
        const input = document.getElementById('kindness-input');
        const val = input?.value.trim();
        if (!val) return;
        const log = store.get('wellbeing.kindnessLog') || {};
        log[todayStr] = val;
        store.set('wellbeing.kindnessLog', log);
        addXP(10);
        showToast('Acto de bondad registrado. +10 XP — ¡El bien se multiplica!', 'success');
        render();
    });
}

function _addConnection() {
    const todayStr = today();
    const personInput = document.getElementById('connection-person');
    const typeInput = document.getElementById('connection-type');
    const person = personInput?.value.trim();
    if (!person) return;

    const log = store.get('wellbeing.socialLog') || {};
    const arr = [...(log[todayStr] || [])];
    const type = typeInput?.value || 'quality';
    arr.push({ person, type });
    log[todayStr] = arr;
    store.set('wellbeing.socialLog', log);

    addXP(type === 'deep' ? 15 : type === 'quality' ? 10 : 5);
    const msgs = {
        deep: 'Conexión profunda registrada. Este es el tipo de vínculo que predice bienestar a largo plazo.',
        quality: 'Conversación de calidad registrada. Las relaciones se construyen momento a momento.',
        quick: 'Contacto social registrado. Incluso los saludos rápidos tienen impacto en el bienestar.'
    };
    showToast(msgs[type] || 'Conexión registrada.', 'success');
    render();
}

// ============================================================
// Breathing Engine
// ============================================================

function _startBreathing(technique) {
    if (document.getElementById('breathing-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'breathing-overlay';
    overlay.className = 'breathing-overlay';
    overlay.innerHTML = `
        <div class="breathing-modal">
            <button class="breathing-close" id="breathing-close">×</button>
            <div class="breathing-modal-header">
                <h3>${technique.name}</h3>
                <p class="text-secondary" style="font-size:0.8rem;margin-top:4px">${technique.subtitle}</p>
            </div>

            <div class="breathing-science-note">
                <p>${technique.science}</p>
            </div>

            <div class="breathing-visual">
                <div class="breathing-circle" id="breathing-circle" style="border-color:${technique.color}">
                    <div class="breathing-circle-inner">
                        <span class="breathing-phase-label" id="breathing-phase-label">Prepárate</span>
                        <span class="breathing-phase-count" id="breathing-phase-count" style="color:${technique.color}"></span>
                    </div>
                </div>
            </div>

            <div class="breathing-status">
                <span id="breathing-cycle-info" style="color:${technique.color}">Ciclo 0 de ${technique.cycles}</span>
            </div>

            <button class="btn btn-primary" id="breathing-start-btn" style="width:100%;margin-top:16px">
                Comenzar
            </button>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    document.getElementById('breathing-close')?.addEventListener('click', _stopBreathing);
    document.getElementById('breathing-start-btn')?.addEventListener('click', () => {
        document.getElementById('breathing-start-btn').style.display = 'none';
        _runCycles(technique, 0, 0);
    });
}

function _stopBreathing() {
    if (breathingTimer) { clearTimeout(breathingTimer); breathingTimer = null; }
    const overlay = document.getElementById('breathing-overlay');
    if (overlay) overlay.remove();
}

function _runCycles(technique, cycleIndex, phaseIndex) {
    if (!document.getElementById('breathing-overlay')) return;

    if (cycleIndex >= technique.cycles) {
        // Completed
        const circle = document.getElementById('breathing-circle');
        if (circle) {
            circle.style.transform = 'scale(1)';
            circle.style.borderColor = '#10b981';
        }
        const label = document.getElementById('breathing-phase-label');
        const count = document.getElementById('breathing-phase-count');
        const cycleInfo = document.getElementById('breathing-cycle-info');
        if (label) label.textContent = '¡Completado!';
        if (count) count.textContent = '';
        if (cycleInfo) cycleInfo.textContent = `${technique.cycles} ciclos completados`;

        // XP and logging
        const todayStr = today();
        const breathLog = store.get('wellbeing.breathLog') || {};
        const arr = breathLog[todayStr] || [];
        if (!arr.includes(technique.id)) {
            arr.push(technique.id);
            breathLog[todayStr] = arr;
            store.set('wellbeing.breathLog', breathLog);
            addXP(10);
        }
        playSound('complete');

        const modal = document.querySelector('.breathing-modal');
        if (modal) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn btn-primary';
            closeBtn.style.cssText = 'width:100%;margin-top:16px';
            closeBtn.textContent = 'Cerrar (+10 XP)';
            closeBtn.addEventListener('click', () => { _stopBreathing(); render(); });
            modal.appendChild(closeBtn);
        }
        return;
    }

    const phase = technique.phases[phaseIndex];
    const circle = document.getElementById('breathing-circle');
    const label = document.getElementById('breathing-phase-label');
    const count = document.getElementById('breathing-phase-count');
    const cycleInfo = document.getElementById('breathing-cycle-info');

    if (!circle || !label) return;

    label.textContent = phase.label;
    cycleInfo.textContent = `Ciclo ${cycleIndex + 1} de ${technique.cycles}`;
    circle.style.borderColor = technique.color;
    circle.style.transition = `transform ${phase.duration}s ${phase.scale > 1 ? 'ease-in' : 'ease-out'}`;
    circle.style.transform = `scale(${phase.scale})`;

    let remaining = phase.duration;
    count.textContent = remaining;
    const countdownId = setInterval(() => {
        remaining--;
        if (count && remaining > 0) count.textContent = remaining;
        if (remaining <= 0) {
            clearInterval(countdownId);
            if (count) count.textContent = '';
        }
    }, 1000);

    breathingTimer = setTimeout(() => {
        clearInterval(countdownId);
        const nextPhase = phaseIndex + 1;
        if (nextPhase >= technique.phases.length) {
            _runCycles(technique, cycleIndex + 1, 0);
        } else {
            _runCycles(technique, cycleIndex, nextPhase);
        }
    }, phase.duration * 1000);
}

// ============================================================
// Mindfulness Timer
// ============================================================

function _startMindfulness(minutes) {
    if (mindfulnessIntervalId) return;

    const optionsEl = document.getElementById('mindfulness-options');
    const displayEl = document.getElementById('mindfulness-display');
    if (!optionsEl || !displayEl) return;

    optionsEl.style.display = 'none';
    displayEl.style.display = 'flex';

    const totalSeconds = minutes * 60;
    let remaining = totalSeconds;
    let instructionIdx = 0;

    function tick() {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        const countEl = document.getElementById('mindfulness-countdown');
        const instrEl = document.getElementById('mindfulness-instruction');
        const ringEl = document.getElementById('mindfulness-ring');

        if (countEl) countEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        const newIdx = Math.floor((totalSeconds - remaining) / 30) % MINDFULNESS_INSTRUCTIONS.length;
        if (newIdx !== instructionIdx && instrEl) {
            instructionIdx = newIdx;
            instrEl.textContent = MINDFULNESS_INSTRUCTIONS[instructionIdx];
        }

        if (ringEl) {
            const pct = ((totalSeconds - remaining) / totalSeconds) * 100;
            ringEl.style.setProperty('--progress-pct', pct);
        }

        remaining--;
        if (remaining < 0) {
            clearInterval(mindfulnessIntervalId);
            mindfulnessIntervalId = null;
            addXP(15);
            playSound('streak');
            showToast(`Meditación de ${minutes} minutos completada. +15 XP`, 'success');
            const optEl = document.getElementById('mindfulness-options');
            const dispEl = document.getElementById('mindfulness-display');
            if (optEl) optEl.style.display = '';
            if (dispEl) dispEl.style.display = 'none';
        }
    }

    tick();
    mindfulnessIntervalId = setInterval(tick, 1000);
}

function _stopMindfulness() {
    if (mindfulnessIntervalId) { clearInterval(mindfulnessIntervalId); mindfulnessIntervalId = null; }
    const optEl = document.getElementById('mindfulness-options');
    const dispEl = document.getElementById('mindfulness-display');
    if (optEl) optEl.style.display = '';
    if (dispEl) dispEl.style.display = 'none';
}

// ============================================================
// Cold Exposure Timer
// ============================================================

function _startCold(seconds) {
    if (coldIntervalId) return;

    const optEl = document.getElementById('cold-options');
    const dispEl = document.getElementById('cold-display');
    if (!optEl || !dispEl) return;

    optEl.style.display = 'none';
    dispEl.style.display = 'flex';

    let remaining = seconds;

    function tick() {
        const countEl = document.getElementById('cold-countdown');
        if (countEl) {
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            countEl.textContent = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : secs;
        }

        remaining--;
        if (remaining < 0) {
            clearInterval(coldIntervalId);
            coldIntervalId = null;
            const totalMin = Math.round(seconds / 60);
            addXP(totalMin >= 2 ? 20 : 10);
            playSound('streak');
            showToast('¡Exposición al frío completada! Tu dopamina se elevará en los próximos 20 minutos.', 'success', 5000);
            const optionsEl = document.getElementById('cold-options');
            const displayEl = document.getElementById('cold-display');
            if (optionsEl) optionsEl.style.display = '';
            if (displayEl) displayEl.style.display = 'none';
        }
    }

    tick();
    coldIntervalId = setInterval(tick, 1000);
}

function _stopCold() {
    if (coldIntervalId) { clearInterval(coldIntervalId); coldIntervalId = null; }
    const optEl = document.getElementById('cold-options');
    const dispEl = document.getElementById('cold-display');
    if (optEl) optEl.style.display = '';
    if (dispEl) dispEl.style.display = 'none';
}

// ============================================================
// Module lifecycle
// ============================================================

export function init() {}

export function destroy() {
    _stopMindfulness();
    _stopCold();
    if (breathingTimer) { clearTimeout(breathingTimer); breathingTimer = null; }
    const overlay = document.getElementById('breathing-overlay');
    if (overlay) overlay.remove();
}
