// journal.js - Journal module (gratitude, reflection, mood)
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, playSound, MOODS } from './ui.js';

let selectedDate = today();

export function render() {
    const container = document.getElementById('main-content');
    const entries = store.get('journal.entries') || [];
    const entry = entries.find(e => e.date === selectedDate);

    container.innerHTML = `
        <div class="journal-page">
            <div class="page-header">
                <h1>Diario</h1>
                <div class="date-nav">
                    <button class="btn btn-sm btn-ghost" id="j-prev-day">&larr;</button>
                    <span class="current-date">${formatDateDisplay(selectedDate)} ${selectedDate === today() ? '(Hoy)' : ''}</span>
                    <button class="btn btn-sm btn-ghost" id="j-next-day">&rarr;</button>
                    <button class="btn btn-sm btn-ghost" id="j-today-btn">Hoy</button>
                </div>
            </div>

            <div class="journal-science glass-card" style="padding:12px;margin-bottom:16px">
                <p class="text-secondary" style="font-size:0.85rem">
                    &#129504; <strong>Neurociencia:</strong> Escribir a mano o en diario activa la corteza prefrontal y reduce la actividad de la am\u00edgdala (centro del miedo). La gratitud libera serotonina y dopamina, los mismos neurotransmisores que buscan los antidepresivos.
                </p>
            </div>

            <form id="journal-form" class="form">
                <!-- Mood -->
                <div class="glass-card journal-section">
                    <h3>&#127912; Estado de \u00e1nimo</h3>
                    <div class="mood-selector">
                        ${MOODS.map(m => `
                            <button type="button" class="mood-btn ${entry?.mood === m.value ? 'mood-active' : ''}"
                                data-mood="${m.value}" style="--mood-color: ${m.color}">
                                <span class="mood-face">${m.value === 1 ? '&#128542;' : m.value === 2 ? '&#128533;' : m.value === 3 ? '&#128528;' : m.value === 4 ? '&#128578;' : '&#128513;'}</span>
                                <span class="mood-label">${m.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Gratitude -->
                <div class="glass-card journal-section">
                    <h3>&#128591; Gratitud (3 cosas)</h3>
                    <p class="text-secondary" style="font-size:0.8rem;margin-bottom:8px">La gratitud recablea las v\u00edas neuronales hacia el optimismo. S\u00e9 espec\u00edfico.</p>
                    <input type="text" class="journal-input" id="gratitude-1" placeholder="1. Estoy agradecido/a por..." value="${entry?.gratitude?.[0] || ''}">
                    <input type="text" class="journal-input" id="gratitude-2" placeholder="2. Estoy agradecido/a por..." value="${entry?.gratitude?.[1] || ''}">
                    <input type="text" class="journal-input" id="gratitude-3" placeholder="3. Estoy agradecido/a por..." value="${entry?.gratitude?.[2] || ''}">
                </div>

                <!-- Wins -->
                <div class="glass-card journal-section">
                    <h3>&#127942; Victorias del d\u00eda</h3>
                    <p class="text-secondary" style="font-size:0.8rem;margin-bottom:8px">Reconocer logros, por peque\u00f1os que sean, activa el circuito de recompensa.</p>
                    <div id="wins-container">
                        ${(entry?.wins || []).map((w, i) => `
                            <div class="tag-input-item">
                                <span>${w}</span>
                                <button type="button" class="tag-remove" data-type="win" data-idx="${i}">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="tag-input-row">
                        <input type="text" id="win-input" placeholder="Escribe una victoria y presiona Enter">
                        <button type="button" class="btn btn-sm btn-ghost" id="add-win-btn">+</button>
                    </div>
                </div>

                <!-- Reflection -->
                <div class="glass-card journal-section">
                    <h3>&#128173; Reflexi\u00f3n</h3>
                    <textarea id="journal-reflection" rows="4" placeholder="\u00bfC\u00f3mo fue tu d\u00eda? \u00bfQu\u00e9 aprendiste? \u00bfQu\u00e9 sentiste?">${entry?.reflection || ''}</textarea>
                </div>

                <!-- Lessons -->
                <div class="glass-card journal-section">
                    <h3>&#128218; Lecciones aprendidas</h3>
                    <div id="lessons-container">
                        ${(entry?.lessons || []).map((l, i) => `
                            <div class="tag-input-item">
                                <span>${l}</span>
                                <button type="button" class="tag-remove" data-type="lesson" data-idx="${i}">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="tag-input-row">
                        <input type="text" id="lesson-input" placeholder="Escribe una lecci\u00f3n y presiona Enter">
                        <button type="button" class="btn btn-sm btn-ghost" id="add-lesson-btn">+</button>
                    </div>
                </div>

                <!-- Tomorrow's Intention -->
                <div class="glass-card journal-section">
                    <h3>&#127775; Intenci\u00f3n para ma\u00f1ana</h3>
                    <p class="text-secondary" style="font-size:0.8rem;margin-bottom:8px">Las intenciones de implementaci\u00f3n aumentan un 300% la probabilidad de cumplir una meta (Gollwitzer, 1999).</p>
                    <input type="text" id="journal-intention" placeholder="Ma\u00f1ana voy a..." value="${entry?.tomorrowIntention || ''}">
                </div>

                <button type="submit" class="btn btn-primary btn-block btn-lg">&#128190; Guardar Entrada</button>
            </form>

            <!-- Calendar mini -->
            <div class="glass-card journal-section" style="margin-top:16px">
                <h3>&#128197; Historial</h3>
                <div class="journal-calendar" id="journal-calendar"></div>
            </div>
        </div>
    `;

    attachListeners(entry, entries);
    renderMiniCalendar(entries);
}

function attachListeners(entry, entries) {
    // Date nav
    document.getElementById('j-prev-day')?.addEventListener('click', () => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        selectedDate = formatDate(d);
        render();
    });
    document.getElementById('j-next-day')?.addEventListener('click', () => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        selectedDate = formatDate(d);
        render();
    });
    document.getElementById('j-today-btn')?.addEventListener('click', () => {
        selectedDate = today();
        render();
    });

    // Mood selection
    let currentMood = entry?.mood || 0;
    document.querySelectorAll('.mood-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMood = parseInt(btn.dataset.mood);
            document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('mood-active'));
            btn.classList.add('mood-active');
        });
    });

    // Wins
    let wins = [...(entry?.wins || [])];
    const addWin = () => {
        const input = document.getElementById('win-input');
        const val = input.value.trim();
        if (val) {
            wins.push(val);
            input.value = '';
            updateTagList('wins-container', wins, 'win');
        }
    };
    document.getElementById('add-win-btn')?.addEventListener('click', addWin);
    document.getElementById('win-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addWin(); }
    });

    // Lessons
    let lessons = [...(entry?.lessons || [])];
    const addLesson = () => {
        const input = document.getElementById('lesson-input');
        const val = input.value.trim();
        if (val) {
            lessons.push(val);
            input.value = '';
            updateTagList('lessons-container', lessons, 'lesson');
        }
    };
    document.getElementById('add-lesson-btn')?.addEventListener('click', addLesson);
    document.getElementById('lesson-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addLesson(); }
    });

    // Tag remove delegation
    document.addEventListener('click', function tagRemoveHandler(e) {
        const btn = e.target.closest('.tag-remove');
        if (!btn) return;
        const type = btn.dataset.type;
        const idx = parseInt(btn.dataset.idx);
        if (type === 'win') {
            wins.splice(idx, 1);
            updateTagList('wins-container', wins, 'win');
        } else if (type === 'lesson') {
            lessons.splice(idx, 1);
            updateTagList('lessons-container', lessons, 'lesson');
        }
    }, { once: false });

    // Save form
    document.getElementById('journal-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const newEntry = {
            id: entry?.id || generateId(),
            date: selectedDate,
            mood: currentMood,
            gratitude: [
                document.getElementById('gratitude-1').value.trim(),
                document.getElementById('gratitude-2').value.trim(),
                document.getElementById('gratitude-3').value.trim()
            ],
            reflection: document.getElementById('journal-reflection').value.trim(),
            wins,
            lessons,
            tomorrowIntention: document.getElementById('journal-intention').value.trim()
        };

        const allEntries = store.get('journal.entries') || [];
        const idx = allEntries.findIndex(e => e.date === selectedDate);
        if (idx >= 0) {
            allEntries[idx] = newEntry;
        } else {
            allEntries.push(newEntry);
        }
        store.set('journal.entries', allEntries);
        playSound('complete');
        showToast('Entrada guardada. Tu cerebro te agradece la reflexi\u00f3n.');
    });
}

function updateTagList(containerId, items, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = items.map((item, i) => `
        <div class="tag-input-item">
            <span>${item}</span>
            <button type="button" class="tag-remove" data-type="${type}" data-idx="${i}">&times;</button>
        </div>
    `).join('');
}

function renderMiniCalendar(entries) {
    const cal = document.getElementById('journal-calendar');
    if (!cal) return;

    const now = new Date(selectedDate + 'T12:00:00');
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const entryDates = new Set(entries.map(e => e.date));

    let html = `<div class="mini-cal-header">${monthName}</div>`;
    html += '<div class="mini-cal-grid">';
    ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(d => {
        html += `<div class="mini-cal-day-label">${d}</div>`;
    });

    const adjustedFirstDay = (firstDay + 6) % 7;
    for (let i = 0; i < adjustedFirstDay; i++) {
        html += '<div class="mini-cal-empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hasEntry = entryDates.has(dateStr);
        const isSelected = dateStr === selectedDate;
        const isToday = dateStr === today();
        html += `<div class="mini-cal-day ${hasEntry ? 'has-entry' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}"
            data-date="${dateStr}">${d}</div>`;
    }
    html += '</div>';
    cal.innerHTML = html;

    cal.querySelectorAll('.mini-cal-day[data-date]').forEach(el => {
        el.addEventListener('click', () => {
            selectedDate = el.dataset.date;
            render();
        });
    });
}

export function init() {}
export function destroy() {}
