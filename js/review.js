// review.js - Weekly Review module
import { store } from './store.js';
import { generateId, today, formatDate, formatDateDisplay, showToast, playSound, CATEGORIES, getStreakForHabit } from './ui.js';

export function render() {
    const container = document.getElementById('main-content');
    const reviews = store.get('weeklyReviews') || [];

    // Get current week bounds (Monday-Sunday)
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = formatDate(weekStart);
    const weekEndStr = formatDate(weekEnd);

    const existingReview = reviews.find(r => r.weekStart === weekStartStr);

    // Compute weekly stats
    const habits = (store.get('habits.items') || []).filter(h => !h.archived);
    const completions = store.get('habits.completions') || {};
    const tasks = store.get('planner.tasks') || [];
    const entries = store.get('journal.entries') || [];

    const weekDates = [];
    const d = new Date(weekStart);
    while (d <= weekEnd && formatDate(d) <= today()) {
        weekDates.push(formatDate(d));
        d.setDate(d.getDate() + 1);
    }

    // Habit stats by category
    const catStats = {};
    for (const cat of Object.keys(CATEGORIES)) {
        const catHabits = habits.filter(h => h.category === cat);
        if (!catHabits.length) continue;
        let done = 0, total = 0;
        weekDates.forEach(date => {
            const dayComp = completions[date] || [];
            catHabits.forEach(h => {
                total++;
                if (dayComp.includes(h.id)) done++;
            });
        });
        catStats[cat] = { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
    }

    // Task stats
    let weekTasksDone = 0, weekTasksTotal = 0;
    weekDates.forEach(date => {
        const dayTasks = tasks.filter(t => t.date === date);
        weekTasksTotal += dayTasks.length;
        weekTasksDone += dayTasks.filter(t => t.completed).length;
    });

    // Journal stats
    const weekJournalDays = weekDates.filter(date => entries.find(e => e.date === date)).length;

    container.innerHTML = `
        <div class="review-page">
            <div class="page-header">
                <h1>&#128221; Revisi\u00f3n Semanal</h1>
                <span class="text-secondary">${formatDateDisplay(weekStartStr)} - ${formatDateDisplay(weekEndStr)}</span>
            </div>

            <div class="glass-card" style="padding:12px;margin-bottom:16px">
                <p class="text-secondary" style="font-size:0.85rem">
                    &#129504; <strong>Neurociencia:</strong> La metacognici\u00f3n (pensar sobre c\u00f3mo piensas y act\u00faas) activa la corteza prefrontal dorsolateral, responsable de la autorregulaci\u00f3n. Revisar tu semana fortalece esta \u00e1rea y mejora la toma de decisiones futuras.
                </p>
            </div>

            <!-- Auto Stats -->
            <div class="glass-card review-section">
                <h3>&#128202; Resumen Autom\u00e1tico</h3>
                <div class="review-stats-grid">
                    ${Object.entries(catStats).map(([cat, stat]) => `
                        <div class="review-stat-item">
                            <span style="color:${CATEGORIES[cat].color}">${CATEGORIES[cat].icon} ${CATEGORIES[cat].name}</span>
                            <div class="progress-bar" style="flex:1;margin:0 8px">
                                <div class="progress-fill" style="width:${stat.pct}%;background:${CATEGORIES[cat].color}"></div>
                            </div>
                            <span>${stat.pct}%</span>
                        </div>
                    `).join('')}
                    <div class="review-stat-item">
                        <span>&#9745; Tareas</span>
                        <span>${weekTasksDone}/${weekTasksTotal} completadas</span>
                    </div>
                    <div class="review-stat-item">
                        <span>&#9997; Diario</span>
                        <span>${weekJournalDays}/${weekDates.length} d\u00edas</span>
                    </div>
                </div>
            </div>

            <!-- Review Form -->
            <form id="review-form" class="form">
                <div class="glass-card review-section">
                    <h3>&#10024; \u00bfQu\u00e9 sali\u00f3 bien?</h3>
                    <textarea id="review-well" rows="3" placeholder="Reconoce tus logros, por peque\u00f1os que sean...">${existingReview?.wentWell || ''}</textarea>
                </div>

                <div class="glass-card review-section">
                    <h3>&#128736; \u00bfQu\u00e9 puedo mejorar?</h3>
                    <textarea id="review-improve" rows="3" placeholder="S\u00e9 espec\u00edfico y compasivo contigo mismo...">${existingReview?.improve || ''}</textarea>
                </div>

                <div class="glass-card review-section">
                    <h3>&#127919; Foco para la pr\u00f3xima semana</h3>
                    <div class="focus-categories">
                        ${Object.entries(CATEGORIES).map(([key, cat]) => `
                            <label class="focus-option">
                                <input type="checkbox" value="${key}" class="focus-check"
                                    ${existingReview?.nextWeekFocus?.includes(key) ? 'checked' : ''}>
                                <span style="color:${cat.color}">${cat.icon} ${cat.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="glass-card review-section">
                    <h3>&#11088; Calificaci\u00f3n de la Semana</h3>
                    <div class="star-rating">
                        ${[1, 2, 3, 4, 5].map(s => `
                            <button type="button" class="star-btn ${(existingReview?.overallRating || 0) >= s ? 'star-active' : ''}" data-star="${s}">&#9733;</button>
                        `).join('')}
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-block btn-lg">&#128190; Guardar Revisi\u00f3n</button>
            </form>

            <!-- Past Reviews -->
            ${reviews.length ? `
                <div class="glass-card review-section" style="margin-top:16px">
                    <h3>&#128197; Revisiones Anteriores</h3>
                    <div class="past-reviews">
                        ${reviews.slice().reverse().map(r => `
                            <div class="past-review-item">
                                <span>${formatDateDisplay(r.weekStart)} - ${formatDateDisplay(r.weekEnd)}</span>
                                <span>${'&#9733;'.repeat(r.overallRating || 0)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;

    // Star rating
    let currentRating = existingReview?.overallRating || 0;
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentRating = parseInt(btn.dataset.star);
            document.querySelectorAll('.star-btn').forEach((b, i) => {
                b.classList.toggle('star-active', i < currentRating);
            });
        });
    });

    // Save review
    document.getElementById('review-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const focusAreas = [];
        document.querySelectorAll('.focus-check:checked').forEach(cb => focusAreas.push(cb.value));

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
        const idx = allReviews.findIndex(r => r.weekStart === weekStartStr);
        if (idx >= 0) {
            allReviews[idx] = review;
        } else {
            allReviews.push(review);
        }
        store.set('weeklyReviews', allReviews);
        playSound('complete');
        showToast('&#128221; Revisi\u00f3n guardada. La metacognici\u00f3n fortalece tu corteza prefrontal.');
        render();
    });
}

export function init() {}
export function destroy() {}
