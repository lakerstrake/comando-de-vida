// review.js - Weekly Review module
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, playSound, CATEGORIES } from './ui.js';

function isSimpleMode() {
    const settings = store.get('settings') || {};
    return settings.simpleMode !== false;
}

export function render() {
    const container = document.getElementById('main-content');
    const reviews = store.get('weeklyReviews') || [];
    const simpleMode = isSimpleMode();

    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = formatDate(weekStart);
    const weekEndStr = formatDate(weekEnd);

    const existingReview = reviews.find((review) => review.weekStart === weekStartStr);

    const habits = (store.get('habits.items') || []).filter((habit) => !habit.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const entries = store.get('journal.entries') || [];

    const weekDates = [];
    const dayCursor = new Date(weekStart);
    while (dayCursor <= weekEnd && formatDate(dayCursor) <= today()) {
        weekDates.push(formatDate(dayCursor));
        dayCursor.setDate(dayCursor.getDate() + 1);
    }

    const catStats = {};
    for (const cat of Object.keys(CATEGORIES)) {
        const catHabits = habits.filter((habit) => habit.category === cat);
        if (!catHabits.length) continue;
        let done = 0;
        let total = 0;
        weekDates.forEach((date) => {
            const dayComp = completions[date] || [];
            catHabits.forEach((habit) => {
                total++;
                if (dayComp.includes(habit.id)) done++;
            });
        });
        catStats[cat] = { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
    }

    let weekTasksDone = 0;
    let weekTasksTotal = 0;
    weekDates.forEach((date) => {
        const dayTasks = tasks.filter((task) => task.date === date);
        weekTasksTotal += dayTasks.length;
        weekTasksDone += dayTasks.filter((task) => task.completed).length;
    });

    const weekJournalDays = weekDates.filter((date) => entries.find((entry) => entry.date === date)).length;

    container.innerHTML = `
        <div class="review-page">
            <div class="page-header">
                <h1>Revisión semanal</h1>
                <span class="text-secondary">${formatDateDisplay(weekStartStr)} - ${formatDateDisplay(weekEndStr)}</span>
            </div>

            <div class="glass-card review-section">
                <h3>Resumen automático</h3>
                <div class="review-stats-grid">
                    ${Object.entries(catStats).map(([cat, stat]) => `
                        <div class="review-stat-item">
                            <span>${CATEGORIES[cat].name}</span>
                            <div class="progress-bar" style="flex:1;margin:0 8px">
                                <div class="progress-fill" style="width:${stat.pct}%;background:${CATEGORIES[cat].color}"></div>
                            </div>
                            <span>${stat.pct}%</span>
                        </div>
                    `).join('')}
                    <div class="review-stat-item">
                        <span>Tareas</span>
                        <span>${weekTasksDone}/${weekTasksTotal} completadas</span>
                    </div>
                    <div class="review-stat-item">
                        <span>Diario</span>
                        <span>${weekJournalDays}/${weekDates.length} días</span>
                    </div>
                </div>
            </div>

            ${simpleMode ? renderSimpleReviewForm(existingReview) : renderFullReviewForm(existingReview)}

            ${reviews.length ? `
                <div class="glass-card review-section" style="margin-top:16px">
                    <h3>Revisiones anteriores</h3>
                    <div class="past-reviews">
                        ${reviews.slice().reverse().map((review) => `
                            <div class="past-review-item">
                                <span>${formatDateDisplay(review.weekStart)} - ${formatDateDisplay(review.weekEnd)}</span>
                                <span>${'★'.repeat(review.overallRating || 0)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    bindReviewForm({
        existingReview,
        weekStartStr,
        weekEndStr,
        simpleMode
    });
}

function renderSimpleReviewForm(existingReview) {
    return `
        <form id="review-form" class="form">
            <div class="glass-card review-section">
                <h3>Check-in breve</h3>
                <div class="form-group">
                    <label>Principal avance de la semana</label>
                    <textarea id="review-well" rows="2" placeholder="Qué salió bien">${existingReview?.wentWell || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Ajuste clave para mejorar</label>
                    <textarea id="review-improve" rows="2" placeholder="Qué cambiarás la próxima semana">${existingReview?.improve || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Foco único de la próxima semana</label>
                    <select id="review-focus-single">
                        <option value="">Selecciona un foco</option>
                        ${Object.entries(CATEGORIES).map(([key, cat]) => `
                            <option value="${key}" ${(existingReview?.nextWeekFocus || [])[0] === key ? 'selected' : ''}>${cat.name}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Calificación semanal</label>
                    <div class="star-rating">
                        ${[1, 2, 3, 4, 5].map((star) => `
                            <button type="button" class="star-btn ${(existingReview?.overallRating || 0) >= star ? 'star-active' : ''}" data-star="${star}">★</button>
                        `).join('')}
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-block btn-lg">Guardar revisión</button>
            </div>
        </form>
    `;
}

function renderFullReviewForm(existingReview) {
    return `
        <form id="review-form" class="form">
            <div class="glass-card review-section">
                <h3>Qué salió bien</h3>
                <textarea id="review-well" rows="3" placeholder="Reconoce tus logros">${existingReview?.wentWell || ''}</textarea>
            </div>

            <div class="glass-card review-section">
                <h3>Qué puedes mejorar</h3>
                <textarea id="review-improve" rows="3" placeholder="Ajustes concretos para la siguiente semana">${existingReview?.improve || ''}</textarea>
            </div>

            <div class="glass-card review-section">
                <h3>Foco para la próxima semana</h3>
                <div class="focus-categories">
                    ${Object.entries(CATEGORIES).map(([key, cat]) => `
                        <label class="focus-option">
                            <input type="checkbox" value="${key}" class="focus-check"
                                ${existingReview?.nextWeekFocus?.includes(key) ? 'checked' : ''}>
                            <span>${cat.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="glass-card review-section">
                <h3>Calificación semanal</h3>
                <div class="star-rating">
                    ${[1, 2, 3, 4, 5].map((star) => `
                        <button type="button" class="star-btn ${(existingReview?.overallRating || 0) >= star ? 'star-active' : ''}" data-star="${star}">★</button>
                    `).join('')}
                </div>
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg">Guardar revisión</button>
        </form>
    `;
}

function bindReviewForm({ existingReview, weekStartStr, weekEndStr, simpleMode }) {
    let currentRating = existingReview?.overallRating || 0;
    document.querySelectorAll('.star-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            currentRating = parseInt(btn.dataset.star, 10);
            document.querySelectorAll('.star-btn').forEach((starBtn, index) => {
                starBtn.classList.toggle('star-active', index < currentRating);
            });
        });
    });

    document.getElementById('review-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const focusAreas = [];

        if (simpleMode) {
            const focus = document.getElementById('review-focus-single')?.value;
            if (focus) focusAreas.push(focus);
        } else {
            document.querySelectorAll('.focus-check:checked').forEach((cb) => focusAreas.push(cb.value));
        }

        const review = {
            id: existingReview?.id || generateId(),
            weekStart: weekStartStr,
            weekEnd: weekEndStr,
            overallRating: currentRating,
            wentWell: document.getElementById('review-well').value.trim(),
            improve: document.getElementById('review-improve').value.trim(),
            nextWeekFocus: focusAreas,
            completedAt: new Date().toISOString()
        };

        const allReviews = store.get('weeklyReviews') || [];
        const idx = allReviews.findIndex((item) => item.weekStart === weekStartStr);
        if (idx >= 0) allReviews[idx] = review;
        else allReviews.push(review);

        store.set('weeklyReviews', allReviews);
        playSound('complete');
        showToast('Revisión guardada');
        render();
    });
}

export function init() {}
export function destroy() {}
