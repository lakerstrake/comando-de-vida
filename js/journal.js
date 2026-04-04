// journal.js - Simplified journal: gratitude + reflection + intention
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, playSound, MOODS } from './ui.js';
import { addXP, checkAchievements, XP } from './gamification.js';

let selectedDate = today();

export function render() {
    const container = document.getElementById('main-content');
    const entries = store.get('journal.entries') || [];
    const entry = entries.find(e => e.date === selectedDate);
    const isToday = selectedDate === today();

    container.innerHTML = `
        <div class="journal-clean">
            <div class="page-header">
                <h1>Diario</h1>
                <div class="date-nav">
                    <button class="btn btn-sm btn-ghost" id="j-prev-day">←</button>
                    <span class="current-date">${formatDateDisplay(selectedDate)}${isToday ? ' · Hoy' : ''}</span>
                    <button class="btn btn-sm btn-ghost" id="j-next-day">→</button>
                    ${!isToday ? `<button class="btn btn-sm btn-ghost" id="j-today-btn">Hoy</button>` : ''}
                </div>
            </div>

            <form id="journal-form">

                <!-- Mood -->
                <div class="journal-block">
                    <p class="journal-label">¿Cómo te sientes?</p>
                    <div class="mood-row">
                        ${[[1,'😔','Mal'],[2,'😕','Regular'],[3,'😐','Neutro'],[4,'🙂','Bien'],[5,'😄','Genial']].map(([v, e, l]) => `
                            <button type="button" class="mood-pill ${entry?.mood === v ? 'active' : ''}" data-mood="${v}">
                                <span class="mood-pill-emoji">${e}</span>
                                <span class="mood-pill-label">${l}</span>
                            </button>`).join('')}
                    </div>
                </div>

                <!-- Gratitude -->
                <div class="journal-block">
                    <p class="journal-label">3 cosas por las que estoy agradecido</p>
                    <p class="journal-sublabel">La gratitud activa la serotonina y recablea tu cerebro hacia el optimismo</p>
                    <div class="journal-inputs">
                        <div class="journal-input-row">
                            <span class="journal-num">1</span>
                            <input type="text" id="gratitude-1" placeholder="Soy agradecido por..." value="${entry?.gratitude?.[0] || ''}">
                        </div>
                        <div class="journal-input-row">
                            <span class="journal-num">2</span>
                            <input type="text" id="gratitude-2" placeholder="Soy agradecido por..." value="${entry?.gratitude?.[1] || ''}">
                        </div>
                        <div class="journal-input-row">
                            <span class="journal-num">3</span>
                            <input type="text" id="gratitude-3" placeholder="Soy agradecido por..." value="${entry?.gratitude?.[2] || ''}">
                        </div>
                    </div>
                </div>

                <!-- Victoria del día -->
                <div class="journal-block">
                    <p class="journal-label">Una victoria de hoy</p>
                    <p class="journal-sublabel">Reconocer logros, por pequeños que sean, activa el circuito de recompensa</p>
                    <input type="text" id="journal-win" placeholder="Hoy logré..." value="${entry?.win || entry?.wins?.[0] || ''}">
                </div>

                <!-- Reflection -->
                <div class="journal-block">
                    <p class="journal-label">Reflexión libre</p>
                    <textarea id="journal-reflection" rows="4" placeholder="¿Cómo fue tu día? ¿Qué aprendiste? ¿Qué sentiste?">${entry?.reflection || ''}</textarea>
                </div>

                <!-- Tomorrow -->
                <div class="journal-block">
                    <p class="journal-label">Intención para mañana</p>
                    <p class="journal-sublabel">Las intenciones aumentan un 300% la probabilidad de cumplir una meta (Gollwitzer)</p>
                    <input type="text" id="journal-intention" placeholder="Mañana voy a..." value="${entry?.tomorrowIntention || ''}">
                </div>

                <button type="submit" class="btn btn-primary btn-block" style="margin-top:4px">
                    Guardar entrada
                </button>

            </form>

            <!-- Calendar -->
            <div class="journal-block" style="margin-top:20px">
                <p class="journal-label">Historial</p>
                <div class="journal-calendar" id="journal-calendar"></div>
            </div>
        </div>
    `;

    _attachListeners(entry, entries);
    _renderCalendar(entries);
}

function _attachListeners(entry, entries) {
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

    let currentMood = entry?.mood || 0;
    document.querySelectorAll('.mood-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMood = parseInt(btn.dataset.mood);
            document.querySelectorAll('.mood-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    document.getElementById('journal-form')?.addEventListener('submit', e => {
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
            win: document.getElementById('journal-win').value.trim(),
            reflection: document.getElementById('journal-reflection').value.trim(),
            tomorrowIntention: document.getElementById('journal-intention').value.trim(),
            savedAt: new Date().toISOString()
        };

        const allEntries = store.get('journal.entries') || [];
        const idx = allEntries.findIndex(e => e.date === selectedDate);
        const isNew = idx < 0;
        if (isNew) allEntries.push(newEntry);
        else allEntries[idx] = { ...allEntries[idx], ...newEntry };

        store.set('journal.entries', allEntries);
        if (isNew) { addXP(XP.JOURNAL_ENTRY); checkAchievements(); }
        playSound('complete');
        showToast('Entrada guardada. La reflexión diaria construye claridad mental.', 'success');
    });
}

function _renderCalendar(entries) {
    const cal = document.getElementById('journal-calendar');
    if (!cal) return;

    const now = new Date(selectedDate + 'T12:00:00');
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const entryDates = new Set(entries.map(e => e.date));

    let html = `<div class="cal-month-name">${monthName}</div><div class="cal-grid">`;
    ['L','M','X','J','V','S','D'].forEach(d => { html += `<div class="cal-label">${d}</div>`; });
    for (let i = 0; i < firstDow; i++) html += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        html += `<div class="cal-day ${entryDates.has(ds) ? 'has-entry' : ''} ${ds === selectedDate ? 'selected' : ''} ${ds === today() ? 'is-today' : ''}" data-date="${ds}">${d}</div>`;
    }
    html += '</div>';
    cal.innerHTML = html;

    cal.querySelectorAll('.cal-day[data-date]').forEach(el => {
        el.addEventListener('click', () => { selectedDate = el.dataset.date; render(); });
    });
}

export function init() {}
export function destroy() {}
