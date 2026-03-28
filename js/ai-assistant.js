// ai-assistant.js - AI Assistant Module with Real AI Integration
import { store } from './store.js';
import { showToast, showModal, closeModal, escapeHtml, getStreakForHabit, today, formatDate } from './ui.js';

class AIAssistant {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isLoading = false;
        this.apiKey = this._loadApiKey();
        this.useHuggingFace = localStorage.getItem('USE_HUGGINGFACE') === 'true';
        this.conversationHistory = [];
        this._lastRequestTime = 0;
        this._rateLimitMs = 3000;
        this.init();
    }

    // --- API Key obfuscation (base64) ---
    _loadApiKey() {
        try {
            const stored = localStorage.getItem('AI_API_KEY_B64');
            if (stored) return atob(stored);
        } catch (_) { /* corrupted key */ }
        // Migrate plain-text key if present
        const plain = localStorage.getItem('AI_API_KEY');
        if (plain) {
            localStorage.setItem('AI_API_KEY_B64', btoa(plain));
            localStorage.removeItem('AI_API_KEY');
            return plain;
        }
        return '';
    }

    _saveApiKey(key) {
        this.apiKey = key;
        if (key) {
            localStorage.setItem('AI_API_KEY_B64', btoa(key));
        } else {
            localStorage.removeItem('AI_API_KEY_B64');
        }
        localStorage.removeItem('AI_API_KEY'); // remove legacy
    }

    // --- Rate limiting ---
    _canMakeRequest() {
        const now = Date.now();
        if (now - this._lastRequestTime < this._rateLimitMs) {
            return false;
        }
        this._lastRequestTime = now;
        return true;
    }

    // --- Initialization ---
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createWidget());
        } else {
            this.createWidget();
        }
    }

    createWidget() {
        if (document.getElementById('ai-assistant')) return;

        const widget = document.createElement('div');
        widget.id = 'ai-assistant';
        widget.innerHTML = `
            <div class="ai-chat-widget">
                <div class="ai-chat-header">
                    <div class="ai-chat-title">
                        <span class="ai-icon">\u{1F916}</span>
                        <span>Asistente IA</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="ai-clear-btn" aria-label="Limpiar chat" title="Limpiar chat">\u{1F5D1}</button>
                        <button class="ai-settings-btn" aria-label="Configurar">\u2699\uFE0F</button>
                        <button class="ai-close-btn" aria-label="Cerrar">\u2715</button>
                    </div>
                </div>
                <div class="ai-chat-messages"></div>
                <div class="ai-chat-input-area">
                    <input
                        type="text"
                        class="ai-input"
                        placeholder="Preg\u00FAntame cualquier cosa..."
                        aria-label="Mensaje para el asistente"
                    >
                    <button class="ai-send-btn" aria-label="Enviar">\u27A4</button>
                </div>
            </div>
            <button class="ai-toggle-btn" aria-label="Asistente IA">\u{1F916}</button>
        `;
        document.body.appendChild(widget);
        this.attachEventListeners();
    }

    attachEventListeners() {
        const toggleBtn = document.querySelector('.ai-toggle-btn');
        const closeBtn = document.querySelector('.ai-close-btn');
        const settingsBtn = document.querySelector('.ai-settings-btn');
        const clearBtn = document.querySelector('.ai-clear-btn');
        const sendBtn = document.querySelector('.ai-send-btn');
        const input = document.querySelector('.ai-input');

        toggleBtn?.addEventListener('click', () => this.toggle());
        closeBtn?.addEventListener('click', () => this.close());
        settingsBtn?.addEventListener('click', () => this.showApiKeySettings());
        clearBtn?.addEventListener('click', () => this.clearChat());
        sendBtn?.addEventListener('click', () => this.sendMessage());
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isLoading) this.sendMessage();
        });
    }

    // --- Clear chat ---
    clearChat() {
        this.messages = [];
        this.conversationHistory = [];
        const messagesContainer = document.querySelector('.ai-chat-messages');
        if (messagesContainer) messagesContainer.innerHTML = '';
        // Show fresh greeting on next open
    }

    // --- Toggle / Open / Close ---
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        const widget = document.querySelector('.ai-chat-widget');
        if (widget) {
            widget.classList.add('open');
            document.querySelector('.ai-input')?.focus();

            if (this.messages.length === 0) {
                const ctx = this._getUserStats();
                const name = escapeHtml(ctx.userName);
                const greeting = `\u00A1Hola, ${name}! \u{1F44B}\n\nSoy tu asistente de productividad. Puedo ayudarte con:\n\u2713 H\u00E1bitos y rachas\n\u2713 Metas y objetivos\n\u2713 Tareas y enfoque\n\u2713 Motivaci\u00F3n y bienestar\n\u2713 An\u00E1lisis de tu progreso\n\n\u00BFEn qu\u00E9 quieres trabajar hoy?`;
                this.addMessage('assistant', greeting);
            }
        }
    }

    close() {
        this.isOpen = false;
        const widget = document.querySelector('.ai-chat-widget');
        if (widget) widget.classList.remove('open');
    }

    // --- Sending messages ---
    async sendMessage() {
        const input = document.querySelector('.ai-input');
        const message = input?.value?.trim();

        if (!message || this.isLoading) return;

        input.value = '';
        this.addMessage('user', message);

        // Rate limit check
        if (!this._canMakeRequest()) {
            this.addMessage('assistant', '\u23F3 Por favor espera unos segundos antes de enviar otro mensaje.');
            return;
        }

        this.setLoading(true);

        try {
            const response = await this.getAIResponse(message);
            this.addMessage('assistant', response);
        } catch (_) {
            this.addMessage('assistant', '\u26A0\uFE0F Ocurri\u00F3 un error al procesar tu mensaje. Int\u00E9ntalo de nuevo en unos segundos.');
        } finally {
            this.setLoading(false);
        }
    }

    // --- AI Response routing ---
    async getAIResponse(userMessage) {
        const context = this.buildUserContext();

        // Gemini > HuggingFace > Offline
        if (this.apiKey && !this.useHuggingFace) {
            const geminiResponse = await this.getGeminiResponse(userMessage, context);
            if (geminiResponse) return geminiResponse;
        }

        if (this.useHuggingFace) {
            const hfResponse = await this.getHuggingFaceResponse(userMessage, context);
            if (hfResponse) return hfResponse;
        }

        return this.getSmartOfflineResponse(userMessage);
    }

    // --- Build rich system prompt ---
    _buildSystemPrompt(context) {
        return `Eres un asistente experto en productividad personal, neurociencia aplicada y organizaci\u00F3n de vida.
Tu nombre es "Asistente Comando Vida".

DATOS ACTUALES DEL USUARIO:
${context}

INSTRUCCIONES ESTRICTAS:
- Responde SIEMPRE en espa\u00F1ol
- M\u00E1ximo 3-4 oraciones, claro y directo
- Personaliza CADA respuesta usando los datos del usuario mostrados arriba
- Si el usuario tiene rachas activas, menci\u00F3nalas para motivar
- Si el estado de \u00E1nimo reciente es bajo, s\u00E9 emp\u00E1tico
- S\u00E9 motivador pero realista
- Usa emojis estrat\u00E9gicamente (1-2 por respuesta)
- Proporciona consejos accionables basados en neurociencia
- Considera h\u00E1bitos, metas, tareas, rachas y \u00E1nimo en tu respuesta
- Si no tiene datos, ay\u00FAdalo a empezar
- Siempre ofrece sugerencias concretas y accionables. Menciona funciones espec\u00EDficas de la app (como el planificador, diario, rueda de vida, revisi\u00F3n semanal). Usa datos reales del usuario cuando est\u00E9n disponibles.`;
    }

    // --- Gemini API ---
    async getGeminiResponse(userMessage, context) {
        const systemPrompt = this._buildSystemPrompt(context);

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            ...this.conversationHistory.slice(-8).map(msg => ({
                                role: msg.role === 'user' ? 'user' : 'model',
                                parts: [{ text: msg.content }]
                            })),
                            {
                                role: 'user',
                                parts: [{ text: userMessage }]
                            }
                        ],
                        systemInstruction: {
                            parts: [{ text: systemPrompt }]
                        },
                        generationConfig: {
                            maxOutputTokens: 250,
                            temperature: 0.85,
                            topP: 0.95
                        }
                    })
                }
            );

            if (!response.ok) return null;

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                this._pushConversation(userMessage, text.trim());
                return text.trim();
            }
            return null;
        } catch (_) {
            return null;
        }
    }

    // --- HuggingFace API ---
    async getHuggingFaceResponse(userMessage, context) {
        const systemPrompt = `Eres un asistente experto en productividad personal. Contexto del usuario: ${context.substring(0, 500)}
Responde en espa\u00F1ol, m\u00E1ximo 3 oraciones. S\u00E9 motivador y espec\u00EDfico seg\u00FAn sus datos.`;

        try {
            const historyText = this.conversationHistory.length > 0
                ? this.conversationHistory.slice(-6).map(m =>
                    `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`
                ).join('\n\n')
                : '';

            const prompt = historyText
                ? `${systemPrompt}\n\n${historyText}\n\nUsuario: ${userMessage}\n\nAsistente:`
                : `${systemPrompt}\n\nUsuario: ${userMessage}\n\nAsistente:`;

            const response = await fetch(
                'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        inputs: prompt,
                        parameters: {
                            max_new_tokens: 150,
                            temperature: 0.8,
                            top_p: 0.9,
                            repetition_penalty: 1.1
                        }
                    })
                }
            );

            if (!response.ok) return null;

            const data = await response.json();
            let text = '';

            if (Array.isArray(data) && data[0]?.generated_text) {
                text = data[0].generated_text;
                // Extract only the assistant response (last "Asistente:" block)
                const parts = text.split('Asistente:');
                if (parts.length > 1) {
                    text = parts[parts.length - 1].trim();
                } else {
                    text = text.substring(prompt.length).trim();
                }
            } else if (data.error) {
                return null;
            }

            if (text && text.length > 10) {
                // Trim to reasonable length
                text = text.substring(0, 400).trim();
                // Clean: keep Unicode letters (including accented), digits, punctuation, emojis
                text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
                // Cut at last complete sentence if too long
                const lastSentenceEnd = Math.max(
                    text.lastIndexOf('.'),
                    text.lastIndexOf('!'),
                    text.lastIndexOf('?')
                );
                if (lastSentenceEnd > 30) {
                    text = text.substring(0, lastSentenceEnd + 1).trim();
                }

                if (text.length > 10) {
                    this._pushConversation(userMessage, text);
                    return text;
                }
            }
            return null;
        } catch (_) {
            return null;
        }
    }

    // --- Conversation history management (limit 20) ---
    _pushConversation(userMsg, assistantMsg) {
        this.conversationHistory.push(
            { role: 'user', content: userMsg },
            { role: 'assistant', content: assistantMsg }
        );
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    // --- Rich user stats gathering ---
    _getUserStats() {
        const habits = store.get('habits.items') || [];
        const completions = store.get('habits.completions') || {};
        const goals = store.get('goals.items') || [];
        const tasks = store.get('planner.tasks') || [];
        const entries = store.get('journal.entries') || [];
        const userName = store.get('settings.userName') || 'Usuario';
        const lifeScore = store.get('stats.lifeScore') || [];
        const lifeWheel = store.get('lifeWheel.assessments') || [];
        const weeklyReviews = store.get('weeklyReviews') || [];

        // Active habits and streaks
        const activeHabits = habits.filter(h => h.enabled !== false);
        const habitStreaks = activeHabits.map(h => ({
            name: h.name || h.title || 'Sin nombre',
            streak: getStreakForHabit(h.id, completions),
            category: h.category || 'general'
        }));
        const bestStreak = habitStreaks.reduce((best, h) => h.streak > best.streak ? h : best, { name: '', streak: 0 });
        const totalStreakDays = habitStreaks.reduce((sum, h) => sum + h.streak, 0);

        // Today's completions
        const todayStr = today();
        const todayCompletions = completions[todayStr] || [];
        const completedToday = todayCompletions.length;
        const completionRate = activeHabits.length > 0
            ? Math.round((completedToday / activeHabits.length) * 100)
            : 0;

        // Weekly completion rate (last 7 days)
        let weeklyCompleted = 0;
        let weeklyTotal = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const ds = formatDate(d);
            const dayComps = completions[ds] || [];
            weeklyCompleted += dayComps.length;
            weeklyTotal += activeHabits.length;
        }
        const weeklyRate = weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0;

        // Goals stats
        const activeGoals = goals.filter(g => g.status !== 'completed' && g.status !== 'abandoned');
        const completedGoals = goals.filter(g => g.status === 'completed');

        // Task stats
        const pendingTasks = tasks.filter(t => !t.completed);
        const completedTasks = tasks.filter(t => t.completed);
        const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high' || t.priority === 'alta');

        // Mood trends (from journal entries)
        const recentMoods = entries
            .slice(-7)
            .filter(e => e.mood != null)
            .map(e => e.mood);
        const avgMood = recentMoods.length > 0
            ? (recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length).toFixed(1)
            : null;
        const moodTrend = recentMoods.length >= 3
            ? (recentMoods[recentMoods.length - 1] > recentMoods[0] ? 'subiendo' : recentMoods[recentMoods.length - 1] < recentMoods[0] ? 'bajando' : 'estable')
            : null;

        // Life score
        const recentScore = lifeScore.length > 0 ? lifeScore[lifeScore.length - 1] : null;
        const avgScore = lifeScore.length > 0
            ? Math.round(lifeScore.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, lifeScore.length))
            : null;

        return {
            userName,
            activeHabits: activeHabits.length,
            totalHabits: habits.length,
            completedToday,
            completionRate,
            weeklyRate,
            bestStreak,
            totalStreakDays,
            habitStreaks,
            activeGoals: activeGoals.length,
            completedGoals: completedGoals.length,
            totalGoals: goals.length,
            pendingTasks: pendingTasks.length,
            completedTasks: completedTasks.length,
            highPriorityTasks: highPriorityTasks.length,
            journalEntries: entries.length,
            avgMood,
            moodTrend,
            recentScore,
            avgScore,
            weeklyReviews: weeklyReviews.length,
            lifeWheelAssessments: lifeWheel.length
        };
    }

    // --- Build context string for AI prompts ---
    buildUserContext() {
        const s = this._getUserStats();

        let context = `Usuario: ${s.userName}
H\u00E1bitos: ${s.totalHabits} totales, ${s.activeHabits} activos, ${s.completedToday} completados hoy (${s.completionRate}%)
Cumplimiento semanal: ${s.weeklyRate}%
Mejor racha actual: ${s.bestStreak.name} con ${s.bestStreak.streak} d\u00EDas
D\u00EDas totales de rachas activas: ${s.totalStreakDays}
Metas: ${s.totalGoals} totales, ${s.activeGoals} activas, ${s.completedGoals} completadas
Tareas: ${s.pendingTasks} pendientes, ${s.completedTasks} completadas, ${s.highPriorityTasks} de alta prioridad
Entradas de diario: ${s.journalEntries}`;

        if (s.avgMood) {
            context += `\n\u00C1nimo promedio (7 d\u00EDas): ${s.avgMood}/5 (tendencia: ${s.moodTrend || 'sin datos'})`;
        }
        if (s.recentScore) {
            context += `\nPuntuaci\u00F3n de vida: ${s.recentScore} (promedio 7d: ${s.avgScore || 'N/A'})`;
        }
        if (s.habitStreaks.length > 0) {
            const streakList = s.habitStreaks
                .filter(h => h.streak > 0)
                .sort((a, b) => b.streak - a.streak)
                .slice(0, 5)
                .map(h => `  - ${h.name}: ${h.streak} d\u00EDas`)
                .join('\n');
            if (streakList) {
                context += `\nRachas activas:\n${streakList}`;
            }
        }

        return context;
    }

    // --- Enhanced offline response engine ---
    getSmartOfflineResponse(userMessage) {
        const msg = userMessage.toLowerCase();
        const s = this._getUserStats();

        // Enhanced intent detection
        const intents = {
            greeting: ['hola', 'buenos d\u00EDas', 'buenas tardes', 'buenas noches', 'hey', 'qu\u00E9 tal', 'saludos'],
            productivity: ['productividad', 'eficiente', 'r\u00E1pido', 'optimizar', 'rendimiento', 'organizar', 'orden', 'tiempo', 'gesti\u00F3n'],
            motivation: ['motivaci\u00F3n', 'animar', 'inspiraci\u00F3n', 'fuerza', '\u00E1nimo', 'deprimido', 'cansado', 'no puedo', 'dif\u00EDcil', 'rendirme'],
            habits: ['h\u00E1bito', 'rutina', 'diario', 'consistencia', 'regularidad', 'disciplina', 'racha', 'streak'],
            focus: ['enfoque', 'concentraci\u00F3n', 'distra\u00EDdo', 'disperso', 'focus', 'atenci\u00F3n', 'pomodoro'],
            planning: ['planificar', 'organizar', 'priorizar', 'agenda', 'tiempo', 'productividad', 'eisenhower', 'pomodoro'],
            learning: ['aprender', 'estudiar', 'leer', 'libro', 'curso', 'conocimiento', 'crecer'],
            wellness: ['bienestar', 'equilibrio', 'balance', 'vida', 'salud mental', 'autocuidado', 'descanso'],
            stress: ['estr\u00E9s', 'ansiedad', 'presi\u00F3n', 'agobiado', 'saturado', 'ansied', 'nervio', 'angustia', 'calma'],
            goals: ['meta', 'objetivo', 'prop\u00F3sito', 'lograr', 'alcanzar', 'conseguir', 'sue\u00F1o', 'plan'],
            mood: ['\u00E1nimo', 'sentir', 'emoci\u00F3n', 'humor', 'triste', 'feliz', 'contento', 'mal'],
            sleep: ['sue\u00F1o', 'dormir', 'descanso', 'insomnio', 'madrugada', 'noche'],
            progress: ['progreso', 'avance', 'estad\u00EDsticas', 'datos', 'reporte', 'c\u00F3mo voy', 'resumen'],
            help: ['ayuda', 'qu\u00E9 puedes', 'funciones', 'opciones', 'c\u00F3mo funciona']
        };

        let intent = 'general';
        let matchCount = 0;

        for (const [key, words] of Object.entries(intents)) {
            const count = words.filter(w => msg.includes(w)).length;
            if (count > matchCount) {
                intent = key;
                matchCount = count;
            }
        }

        const name = s.userName;

        const responses = {
            greeting: [
                `\u00A1Hola, ${name}! \u{1F44B} Hoy llevas ${s.completedToday}/${s.activeHabits} h\u00E1bitos completados (${s.completionRate}%). ${s.pendingTasks > 0 ? `Tienes ${s.pendingTasks} tareas pendientes.` : '\u00A1No tienes tareas pendientes!'} \u00BFEn qu\u00E9 te ayudo?`,
                `\u00A1Qu\u00E9 tal, ${name}! \u{1F60A} Tu cumplimiento semanal es del ${s.weeklyRate}%. ${s.bestStreak.streak > 0 ? `Tu mejor racha es "${s.bestStreak.name}" con ${s.bestStreak.streak} d\u00EDas.` : 'Es buen momento para empezar una racha.'} \u00BFQu\u00E9 necesitas?`
            ],
            productivity: [
                s.pendingTasks > 5
                    ? `\u26A1 Tienes ${s.pendingTasks} tareas pendientes${s.highPriorityTasks > 0 ? ` (${s.highPriorityTasks} de alta prioridad)` : ''}. Enfoque: empieza por las importantes, usa Pomodoro de 25 min y elimina distracciones.`
                    : `\u26A1 Con ${s.pendingTasks} tareas pendientes est\u00E1s en buena posici\u00F3n. Prioriza las m\u00E1s importantes y trabaja en bloques de enfoque profundo.`,
                `\u26A1 La productividad real = hacer lo correcto primero. Tu cumplimiento semanal es ${s.weeklyRate}%. ${s.weeklyRate >= 70 ? '\u00A1Vas muy bien!' : 'Hay margen para mejorar: empieza con solo 2-3 tareas cr\u00EDticas al d\u00EDa.'}`
            ],
            motivation: [
                s.totalStreakDays > 0
                    ? `\u{1F4AA} ${name}, ya acumulaste ${s.totalStreakDays} d\u00EDas de rachas activas. Eso demuestra que PUEDES ser consistente. No te rindas ahora, cada d\u00EDa cuenta.`
                    : `\u{1F4AA} ${name}, el primer paso es siempre el m\u00E1s dif\u00EDcil. No necesitas motivaci\u00F3n, necesitas acci\u00F3n: empieza con algo tan peque\u00F1o que no puedas decir que no.`,
                `\u{1F4AA} La neurociencia dice: la dopamina se libera al ANTICIPAR el logro. Visualiza c\u00F3mo te sentir\u00E1s al completar tu pr\u00F3ximo h\u00E1bito. ${s.completedGoals > 0 ? `Ya completaste ${s.completedGoals} meta(s), puedes lograr m\u00E1s.` : '\u00A1Hoy es un gran d\u00EDa para empezar!'}`,
                `\u{1F4AA} Recuerda: no se trata de perfecci\u00F3n sino de progreso. ${s.completedToday > 0 ? `Hoy ya completaste ${s.completedToday} h\u00E1bito(s). \u00A1Sigue as\u00ED!` : 'A\u00FAn hay tiempo hoy para dar un paso adelante.'}`
            ],
            habits: [
                s.activeHabits > 0
                    ? `\u{1F504} Tienes ${s.activeHabits} h\u00E1bitos activos con ${s.completedToday} completados hoy (${s.completionRate}%). ${s.bestStreak.streak > 0 ? `Tu mejor racha: "${s.bestStreak.name}" con ${s.bestStreak.streak} d\u00EDas. \u00A1No la rompas!` : 'Empieza a construir tu racha completando uno m\u00E1s hoy.'}`
                    : `\u{1F504} A\u00FAn no tienes h\u00E1bitos activos. La ciencia recomienda empezar con UNO solo, tan f\u00E1cil que no puedas fallar (ej: 2 min de lectura). La consistencia construye el h\u00E1bito.`,
                `\u{1F504} Cumplimiento semanal: ${s.weeklyRate}%. ${s.weeklyRate >= 80 ? '\u00A1Excelente consistencia! Tu cerebro ya est\u00E1 formando esas v\u00EDas neuronales.' : s.weeklyRate >= 50 ? 'Buen progreso. Para mejorar: ancla cada h\u00E1bito a una acci\u00F3n que ya hagas (habit stacking).' : 'Tip: reduce la dificultad de tus h\u00E1bitos. Es mejor hacer 2 min diarios que 30 min nunca.'}`,
                `\u{1F504} Dato de neurociencia: 66 d\u00EDas promedio para automatizar un h\u00E1bito. ${s.bestStreak.streak > 0 ? `Con ${s.bestStreak.streak} d\u00EDas en "${s.bestStreak.name}" ya est\u00E1s en camino.` : 'Empieza hoy y en 2 meses ser\u00E1 autom\u00E1tico.'}`
            ],
            focus: [
                `\u{1F3AF} Tu cerebro necesita ~23 min para recuperar el enfoque tras una interrupci\u00F3n. Soluci\u00F3n: silencia el tel\u00E9fono, cierra pesta\u00F1as innecesarias y usa Pomodoro (25 min trabajo + 5 descanso).`,
                `\u{1F3AF} El enfoque es un m\u00FAsculo que se entrena. ${s.pendingTasks > 0 ? `Elige UNA de tus ${s.pendingTasks} tareas y dale 25 minutos de atenci\u00F3n total.` : 'Elige una tarea clara y d\u00E9dicale 25 min sin distracciones.'}`,
                `\u{1F3AF} T\u00E9cnica probada: antes de trabajar, escribe en papel las 3 cosas que har\u00E1s. Tu corteza prefrontal se activa mejor con objetivos claros.`
            ],
            planning: [
                s.completedTasks > 0
                    ? `\u{1F4CB} Ya completaste ${s.completedTasks} tarea(s) y tienes ${s.pendingTasks} pendiente(s). Usa la Matriz de Eisenhower en el planificador para clasificar por urgencia e importancia. Enfoca tu energ\u00EDa en lo importante, no solo lo urgente.`
                    : `\u{1F4CB} Empieza organizando tus tareas con la Matriz de Eisenhower: clasifica cada tarea como urgente/importante. Lo importante pero no urgente (Q2) es donde ocurre el crecimiento real.`,
                `\u{1F4CB} T\u00E9cnica Pomodoro: trabaja 25 min enfocado, descansa 5. ${s.pendingTasks > 3 ? `Con ${s.pendingTasks} tareas pendientes, prioriza las 3 m\u00E1s importantes y usa el planificador para asignarles tiempo espec\u00EDfico.` : 'Abre el planificador y asigna bloques de tiempo a cada tarea.'}`,
                `\u{1F4CB} La clave de la organizaci\u00F3n es la revisi\u00F3n semanal. ${s.weeklyReviews > 0 ? `Ya llevas ${s.weeklyReviews} revisiones semanales, eso fortalece tu autorregulaci\u00F3n.` : 'Prueba la secci\u00F3n de Revisi\u00F3n Semanal para evaluar y ajustar tu rumbo.'}`
            ],
            learning: [
                s.activeGoals > 0
                    ? `\u{1F4DA} Tienes ${s.activeGoals} meta(s) activa(s). Conecta tu aprendizaje con tus metas: cada libro, curso o habilidad nueva debe acercarte a un objetivo concreto. Registra tus lecturas como h\u00E1bito para ser consistente.`
                    : `\u{1F4DA} El aprendizaje continuo es clave para el crecimiento personal. Crea una meta en la app para lo que quieres aprender y a\u00F1ade "leer 15 min" como h\u00E1bito diario. La neuroplasticidad muestra que aprender algo nuevo cada d\u00EDa fortalece conexiones neuronales.`,
                `\u{1F4DA} La t\u00E9cnica de repetici\u00F3n espaciada es la forma m\u00E1s efectiva de retener conocimiento. Anota en tu diario lo que aprendes cada d\u00EDa y rev\u00EDsalo en tu revisi\u00F3n semanal.`,
                `\u{1F4DA} Consejo: no solo consumas informaci\u00F3n, apl\u00EDcala. ${s.journalEntries > 0 ? `Usa tu diario (ya tienes ${s.journalEntries} entradas) para reflexionar sobre lo aprendido.` : 'Empieza a usar el diario para registrar lecciones aprendidas cada d\u00EDa.'}`
            ],
            wellness: [
                s.lifeWheelAssessments > 0
                    ? `\u{2696}\u{FE0F} Ya tienes ${s.lifeWheelAssessments} evaluaci\u00F3n(es) en tu Rueda de la Vida. Rev\u00EDsala para identificar qu\u00E9 \u00E1reas necesitan m\u00E1s atenci\u00F3n. El equilibrio entre \u00E1reas reduce el cortisol y mejora tu bienestar general.`
                    : `\u{2696}\u{FE0F} El bienestar integral requiere equilibrio. Haz una evaluaci\u00F3n en la Rueda de la Vida para visualizar qu\u00E9 \u00E1reas est\u00E1n fuertes y cu\u00E1les necesitan atenci\u00F3n. Una vida desequilibrada genera estr\u00E9s cr\u00F3nico.`,
                `\u{2696}\u{FE0F} Los 4 pilares del bienestar seg\u00FAn la neurociencia: sue\u00F1o de calidad, ejercicio regular, conexiones sociales y prop\u00F3sito. ${s.avgMood ? `Tu \u00E1nimo promedio es ${s.avgMood}/5. ${parseFloat(s.avgMood) >= 3.5 ? 'Vas por buen camino.' : 'Enfocarte en estos pilares puede ayudarte a mejorar.'}` : 'Registra tu \u00E1nimo en el diario para hacer seguimiento.'}`,
                `\u{2696}\u{FE0F} El autocuidado no es ego\u00EDsmo, es necesidad. Tu cerebro necesita descanso para consolidar aprendizajes y h\u00E1bitos. ${s.weeklyRate >= 80 ? 'Tu consistencia es alta, aseg\u00FArate de incluir descanso activo.' : 'Empieza con peque\u00F1os momentos de pausa: 5 min de respiraci\u00F3n consciente entre tareas.'}`
            ],
            stress: [
                `\u{1F9D8} Respira con la t\u00E9cnica 4-7-8: inhala 4 seg, mant\u00E9n 7 seg, exhala 8 seg. Repite 3 veces. Esto activa tu sistema parasimptico y reduce el cortisol r\u00E1pidamente.`,
                `\u{1F9D8} El estr\u00E9s es una se\u00F1al, no un enemigo. ${s.pendingTasks > 5 ? `Con ${s.pendingTasks} tareas pendientes, prioriza solo 3 hoy y delega o pospone el resto.` : 'Identifica qu\u00E9 te genera m\u00E1s presi\u00F3n y divide eso en pasos peque\u00F1os.'}`,
                `\u{1F9D8} Escribe en tu diario lo que sientes (ya tienes ${s.journalEntries} entradas). La escritura expresiva reduce la actividad de la am\u00EDgdala seg\u00FAn estudios de neurociencia.`
            ],
            goals: [
                s.activeGoals > 0
                    ? `\u{1F3AF} Tienes ${s.activeGoals} meta(s) activa(s)${s.completedGoals > 0 ? ` y ya completaste ${s.completedGoals}` : ''}. Divide cada meta en hitos mensuales y revisa tu progreso cada semana.`
                    : `\u{1F3AF} Las metas SMART (Espec\u00EDficas, Medibles, Alcanzables, Relevantes, Temporales) tienen 42% m\u00E1s probabilidad de cumplirse. Crea tu primera meta hoy con un plazo claro.`,
                `\u{1F3AF} ${s.completedGoals > 0 ? `Ya lograste ${s.completedGoals} meta(s). Esa experiencia demuestra que puedes lograr m\u00E1s.` : 'Cada meta grande se conquista con peque\u00F1os pasos diarios.'} La clave es revisar tu progreso semanalmente.`
            ],
            mood: [
                s.avgMood
                    ? `\u{1F60A} Tu \u00E1nimo promedio de los \u00FAltimos 7 d\u00EDas es ${s.avgMood}/5 (tendencia: ${s.moodTrend || 'estable'}). ${parseFloat(s.avgMood) >= 3.5 ? '\u00A1Vas bien! Sigue haciendo lo que funciona.' : 'Para mejorar: ejercicio, sue\u00F1o y gratitud son los 3 pilares cient\u00EDficos del bienestar.'}`
                    : `\u{1F60A} No tienes registros de \u00E1nimo recientes. Registrar c\u00F3mo te sientes en el diario ayuda a tu metacognici\u00F3n: identificar patrones es el primer paso para mejorar.`,
                `\u{1F60A} La neurociencia muestra que el ejercicio de 20 min libera endorfinas equivalentes a una dosis baja de antidepresivo. ${s.avgMood && parseFloat(s.avgMood) < 3 ? 'Con tu \u00E1nimo reciente, esto podr\u00EDa ayudarte mucho.' : 'Incorp\u00F3ralo como h\u00E1bito para mantener tu bienestar.'}`
            ],
            sleep: [
                `\u{1F319} El sue\u00F1o consolida la memoria y las v\u00EDas neuronales de tus h\u00E1bitos. Recomendaci\u00F3n: 7-8 horas, sin pantallas 30 min antes, temperatura fresca y horario consistente.`,
                `\u{1F319} Tu ritmo circadiano se regula con luz solar matutina y oscuridad nocturna. Si duermes mal, prueba: 10 min de sol al despertar y reducir luz azul despu\u00E9s de las 8pm.`
            ],
            progress: [
                `\u{1F4CA} Resumen de ${name}:\n\u2022 H\u00E1bitos: ${s.completedToday}/${s.activeHabits} hoy (${s.completionRate}%), semanal: ${s.weeklyRate}%\n\u2022 Mejor racha: ${s.bestStreak.streak > 0 ? `"${s.bestStreak.name}" (${s.bestStreak.streak}d)` : 'ninguna a\u00FAn'}\n\u2022 Metas: ${s.activeGoals} activas, ${s.completedGoals} completadas\n\u2022 Tareas: ${s.pendingTasks} pendientes${s.avgMood ? `\n\u2022 \u00C1nimo: ${s.avgMood}/5 (${s.moodTrend || 'estable'})` : ''}`,
                `\u{1F4CA} Tu progreso esta semana: cumplimiento de h\u00E1bitos al ${s.weeklyRate}%.${s.bestStreak.streak > 0 ? ` Racha m\u00E1s fuerte: "${s.bestStreak.name}" con ${s.bestStreak.streak} d\u00EDas.` : ''} ${s.weeklyRate >= 70 ? '\u00A1Excelente ritmo!' : 'Enfoque: consistencia sobre perfecci\u00F3n.'}`
            ],
            help: [
                `\u{1F4A1} Puedo ayudarte con:\n\u2022 "progreso" - Ver tu resumen\n\u2022 "h\u00E1bitos" - Consejos de consistencia\n\u2022 "metas" - Estrategia de objetivos\n\u2022 "enfoque" - T\u00E9cnicas de concentraci\u00F3n\n\u2022 "motivaci\u00F3n" - Impulso y \u00E1nimo\n\u2022 "estr\u00E9s" - Manejo de presi\u00F3n\n\u2022 "\u00E1nimo" - Bienestar emocional\n\u2022 "sue\u00F1o" - Descanso y recuperaci\u00F3n`
            ],
            general: [
                `\u{1F4A1} \u00A1Hola ${name}! Tienes ${s.activeHabits} h\u00E1bito(s) activo(s) y ${s.pendingTasks} tarea(s) pendiente(s). ${s.completionRate > 0 ? `Hoy llevas ${s.completionRate}% de cumplimiento.` : ''} \u00BFNecesitas ayuda con h\u00E1bitos, metas, enfoque o motivaci\u00F3n?`,
                `\u{1F4A1} ${name}, estoy aqu\u00ED para ayudarte. Preg\u00FAntame sobre tus h\u00E1bitos, metas, productividad, enfoque o bienestar y te dar\u00E9 consejos personalizados basados en tu progreso.`,
                `\u{1F4A1} Cu\u00E9ntame en qu\u00E9 est\u00E1s trabajando. Puedo darte estrategias de neurociencia para h\u00E1bitos, enfoque, metas o manejo del estr\u00E9s. \u00A1T\u00FA dices!`
            ]
        };

        const intentResponses = responses[intent] || responses.general;
        return intentResponses[Math.floor(Math.random() * intentResponses.length)];
    }

    // --- Add message to chat UI ---
    addMessage(role, content) {
        const messagesContainer = document.querySelector('.ai-chat-messages');
        if (!messagesContainer) return;

        const messageEl = document.createElement('div');
        messageEl.className = `ai-message ai-message-${role}`;
        messageEl.textContent = content;
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        this.messages.push({ role, content });
    }

    // --- Loading animation with dots ---
    setLoading(loading) {
        this.isLoading = loading;
        const messagesContainer = document.querySelector('.ai-chat-messages');

        if (loading) {
            const loadingEl = document.createElement('div');
            loadingEl.className = 'ai-message ai-message-assistant ai-loading';
            loadingEl.innerHTML = '<span class="ai-typing">\u2022\u2022\u2022</span>';
            loadingEl.id = 'ai-loading';
            messagesContainer?.appendChild(loadingEl);
            if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            document.getElementById('ai-loading')?.remove();
        }
    }

    // --- API Key management ---
    setApiKey(key) {
        this._saveApiKey(key);
        this.useHuggingFace = false;
        localStorage.setItem('USE_HUGGINGFACE', 'false');
        showToast('API key de Gemini configurada correctamente', 'success');
    }

    setUseHuggingFace(use) {
        this.useHuggingFace = use;
        localStorage.setItem('USE_HUGGINGFACE', use ? 'true' : 'false');
        if (use) {
            showToast('Usando Hugging Face (sin API key requerida)', 'success');
        }
    }

    // --- Settings modal ---
    showApiKeySettings() {
        const currentKey = this.apiKey;
        const maskedKey = currentKey ? '\u2022'.repeat(8) + currentKey.slice(-4) : '';
        const html = `
            <form id="ai-settings-form" class="form">
                <div class="form-group">
                    <label>\u2699\uFE0F Configuraci\u00F3n del Asistente IA</label>
                    <p class="text-secondary" style="font-size: 0.9rem; margin-bottom: 12px;">
                        Elige c\u00F3mo quieres que funcione la IA
                    </p>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="ai-mode" value="offline" ${!currentKey && !this.useHuggingFace ? 'checked' : ''}>
                        <span><strong>\u{1F4A1} Modo offline (Sin conexi\u00F3n)</strong></span>
                    </label>
                    <p class="text-secondary" style="font-size: 0.8rem; margin-left: 24px;">Respuestas inteligentes basadas en tus datos, sin internet.</p>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="ai-mode" value="huggingface" ${this.useHuggingFace ? 'checked' : ''}>
                        <span><strong>\u{1F917} Hugging Face (Gratis)</strong></span>
                    </label>
                    <p class="text-secondary" style="font-size: 0.8rem; margin-left: 24px;">Gratis, sin API key. IA b\u00E1sica online.</p>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="ai-mode" value="gemini" ${currentKey && !this.useHuggingFace ? 'checked' : ''}>
                        <span><strong>\u{1F52E} Google Gemini</strong></span>
                    </label>
                    <p class="text-secondary" style="font-size: 0.8rem; margin-left: 24px;">Requiere API key. IA avanzada.</p>
                </div>

                <div id="gemini-key-section" style="display: ${currentKey && !this.useHuggingFace ? 'block' : 'none'}; margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm);">
                    <label>Google Gemini API Key</label>
                    <input type="password" id="gemini-key-input" placeholder="AIza..." value="${escapeHtml(currentKey)}" style="margin-bottom: 8px;">
                    ${maskedKey ? `<p class="text-secondary" style="font-size: 0.75rem; margin-bottom: 4px;">Actual: ${maskedKey}</p>` : ''}
                    <p class="text-secondary" style="font-size: 0.75rem; margin-bottom: 8px;">
                        Obt\u00E9n tu clave gratuita en: <a href="https://makersuite.google.com/app/apikey" target="_blank" style="color: var(--accent-primary);">makersuite.google.com</a>
                    </p>
                    <button type="button" class="btn btn-sm btn-ghost" id="test-gemini-btn">Probar conexi\u00F3n</button>
                </div>

                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">Guardar</button>
                    <button type="button" class="btn btn-secondary" id="ai-settings-cancel">Cancelar</button>
                </div>
            </form>
        `;

        showModal('Configurar Asistente IA', html);

        setTimeout(() => {
            const form = document.getElementById('ai-settings-form');
            const modeRadios = document.querySelectorAll('input[name="ai-mode"]');
            const geminiSection = document.getElementById('gemini-key-section');
            const geminiInput = document.getElementById('gemini-key-input');

            // Cancel button
            document.getElementById('ai-settings-cancel')?.addEventListener('click', () => closeModal());

            modeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    if (geminiSection) {
                        geminiSection.style.display = e.target.value === 'gemini' ? 'block' : 'none';
                    }
                });
            });

            const testBtn = document.getElementById('test-gemini-btn');
            if (testBtn) {
                testBtn.addEventListener('click', async () => {
                    const key = geminiInput?.value?.trim();
                    if (!key) {
                        showToast('Ingresa una API key primero', 'warning');
                        return;
                    }

                    testBtn.disabled = true;
                    testBtn.textContent = 'Probando...';

                    try {
                        const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ role: 'user', parts: [{ text: 'Hola' }] }],
                                    generationConfig: { maxOutputTokens: 10 }
                                })
                            }
                        );

                        if (response.ok) {
                            showToast('Conexi\u00F3n exitosa con Gemini', 'success');
                        } else {
                            showToast('API key inv\u00E1lida o error de conexi\u00F3n', 'error');
                        }
                    } catch (_) {
                        showToast('Error de conexi\u00F3n. Verifica tu internet.', 'error');
                    } finally {
                        testBtn.disabled = false;
                        testBtn.textContent = 'Probar conexi\u00F3n';
                    }
                });
            }

            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const mode = document.querySelector('input[name="ai-mode"]:checked')?.value;

                    if (mode === 'gemini') {
                        const key = geminiInput?.value?.trim();
                        if (!key) {
                            showToast('Ingresa una API key para usar Gemini', 'warning');
                            return;
                        }
                        this.setApiKey(key);
                    } else if (mode === 'huggingface') {
                        this._saveApiKey('');
                        this.setUseHuggingFace(true);
                    } else {
                        // offline mode
                        this._saveApiKey('');
                        this.useHuggingFace = false;
                        localStorage.setItem('USE_HUGGINGFACE', 'false');
                        showToast('Modo offline activado', 'success');
                    }

                    closeModal();
                });
            }
        }, 100);
    }
}

// Initialize on page load
export const aiAssistant = new AIAssistant();
