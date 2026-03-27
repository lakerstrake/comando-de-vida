// ai-assistant.js - AI Assistant Module with Real AI Integration
import { store } from './store.js';
import { showToast, showModal, closeModal } from './ui.js';

class AIAssistant {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isLoading = false;
        this.apiKey = localStorage.getItem('AI_API_KEY') || '';
        this.useHuggingFace = localStorage.getItem('USE_HUGGINGFACE') === 'true';
        this.conversationHistory = [];
        this.init();
    }

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
                        <span class="ai-icon">🤖</span>
                        <span>Asistente IA</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="ai-settings-btn" aria-label="Configurar">⚙️</button>
                        <button class="ai-close-btn" aria-label="Cerrar">✕</button>
                    </div>
                </div>
                <div class="ai-chat-messages"></div>
                <div class="ai-chat-input-area">
                    <input 
                        type="text" 
                        class="ai-input" 
                        placeholder="Pregúntame cualquier cosa..."
                        aria-label="Mensaje para el asistente"
                    >
                    <button class="ai-send-btn" aria-label="Enviar">➤</button>
                </div>
            </div>
            <button class="ai-toggle-btn" aria-label="Asistente IA">🤖</button>
        `;
        document.body.appendChild(widget);
        this.attachEventListeners();
    }

    attachEventListeners() {
        const toggleBtn = document.querySelector('.ai-toggle-btn');
        const closeBtn = document.querySelector('.ai-close-btn');
        const settingsBtn = document.querySelector('.ai-settings-btn');
        const sendBtn = document.querySelector('.ai-send-btn');
        const input = document.querySelector('.ai-input');

        toggleBtn?.addEventListener('click', () => this.toggle());
        closeBtn?.addEventListener('click', () => this.close());
        settingsBtn?.addEventListener('click', () => {
            this.showApiKeySettings();
        });
        sendBtn?.addEventListener('click', () => this.sendMessage());
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isLoading) this.sendMessage();
        });
    }

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
                const context = this.buildUserContext();
                const userName = context.match(/Usuario: (.+?)(?:\n|$)/)?.[1] || 'amigo';
                const greeting = `¡Hola, ${userName}! 👋\n\nSoy tu asistente de productividad. Puedo ayudarte con:\n✓ Hábitos y rutinas\n✓ Metas y objetivos\n✓ Tareas y enfoque\n✓ Motivación y focus\n\n¿En qué quieres trabajar hoy?`;
                this.addMessage('assistant', greeting);
            }
        }
    }

    close() {
        this.isOpen = false;
        const widget = document.querySelector('.ai-chat-widget');
        if (widget) widget.classList.remove('open');
    }

    async sendMessage() {
        const input = document.querySelector('.ai-input');
        const message = input?.value?.trim();

        if (!message || this.isLoading) return;

        input.value = '';
        this.addMessage('user', message);
        this.setLoading(true);

        try {
            const response = await this.getAIResponse(message);
            this.addMessage('assistant', response);
        } catch (error) {
            console.error('AI Error:', error);
            this.addMessage('assistant', '⚠️ Error al procesar tu pregunta. Intenta de nuevo.');
        } finally {
            this.setLoading(false);
        }
    }

    async getAIResponse(userMessage) {
        const context = this.buildUserContext();

        // Preferencia del usuario: Gemini > HuggingFace > Offline
        if (this.apiKey && !this.useHuggingFace) {
            const geminiResponse = await this.getGeminiResponse(userMessage, context);
            if (geminiResponse) return geminiResponse;
        }

        if (this.useHuggingFace) {
            const hfResponse = await this.getHuggingFaceResponse(userMessage, context);
            if (hfResponse) return hfResponse;
        }

        // Fallback a respuesta inteligente offline
        return this.getSmartOfflineResponse(userMessage, context);
    }

    async getGeminiResponse(userMessage, context) {
        const systemPrompt = `Eres un asistente experto en productividad personal y organización de la vida.

CONTEXTO DO USUARIO:
${context}

INSTRUCCIONES:
- Responde SIEMPRE en español
- Máximo 3 oraciones, claro y directo
- Dale respuestas PERSONALIZADAS basadas en los datos del usuario
- Sé motivador pero realista
- Usa emojis estratégicamente
- Proporciona consejos accionables y prácticos
- Considera sus hábitos, metas y tareas en tu respuesta
- Si no tiene datos, ayuda de todos modos
- Base tus sugerencias en neurociencia y productividad`;

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [
                            ...this.conversationHistory.slice(-4).map(msg => ({
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
                            maxOutputTokens: 200,
                            temperature: 0.9,
                            topP: 0.95
                        }
                    })
                }
            );

            if (!response.ok) {
                console.log('Gemini API error:', response.status);
                return null;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (text) {
                this.conversationHistory.push(
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: text }
                );
                // Mantener historial limitado
                if (this.conversationHistory.length > 10) {
                    this.conversationHistory = this.conversationHistory.slice(-10);
                }
                return text.trim();
            }
            return null;
        } catch (error) {
            console.log('Gemini API error:', error);
            return null;
        }
    }

    async getHuggingFaceResponse(userMessage, context) {
        const systemPrompt = `You are an expert personal productivity assistant. 
User context: ${context.substring(0, 300)}
Answer in Spanish, max 3 sentences. Be encouraging and specific based on their data.`;

        try {
            const response = await fetch(
                'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // Token sin restricciones (modelo público)
                    },
                    body: JSON.stringify({
                        inputs: this.conversationHistory.length > 0 
                            ? `${systemPrompt}\n\n${this.conversationHistory.map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n\n')}\n\nUsuario: ${userMessage}\n\nAsistente:`
                            : `${systemPrompt}\n\nUsuario: ${userMessage}\n\nAsistente:`,
                        parameters: {
                            max_new_tokens: 150,
                            temperature: 0.8,
                            top_p: 0.9,
                            repetition_penalty: 1.1
                        }
                    })
                }
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            let text = '';

            if (Array.isArray(data) && data[0]?.generated_text) {
                text = data[0].generated_text;
                // Extraer solo la respuesta del asistente
                const assistantStart = text.indexOf('Asistente:');
                if (assistantStart !== -1) {
                    text = text.substring(assistantStart + 10).trim();
                } else {
                    text = text.substring(userMessage.length).trim();
                }
            } else if (data.error) {
                return null;
            }

            if (text && text.length > 20) {
                text = text.substring(0, 300).trim();
                // Limpiar caracteres extraños
                text = text.replace(/[^a-záéíóúñ\s.,!?¿¡\-()'"0-9]/gi, '').trim();
                
                if (text.length > 20) {
                    this.conversationHistory.push(
                        { role: 'user', content: userMessage },
                        { role: 'assistant', content: text }
                    );
                    // Mantener historial limitado
                    if (this.conversationHistory.length > 10) {
                        this.conversationHistory = this.conversationHistory.slice(-10);
                    }
                    return text;
                }
            }
            return null;
        } catch (error) {
            console.log('Hugging Face error:', error);
            return null;
        }
    }

    getSmartOfflineResponse(userMessage, context) {
        const msg = userMessage.toLowerCase();
        
        // Detección mejorada de intenciones basada en palabras clave
        const intents = {
            productivity: ['productividad', 'eficiente', 'rápido', 'optimizar', 'rendimiento', 'organizar', 'orden'],
            motivation: ['motivación', 'animar', 'inspiración', 'fuerza', 'ánimo', 'deprimido', 'cansado'],
            habits: ['hábito', 'rutina', 'diario', 'consistencia', 'regularidad', 'disciplina'],
            focus: ['enfoque', 'concentración', 'distraído', 'disperso', 'focus', 'atención'],
            stress: ['estrés', 'ansiedad', 'presión', 'agobiado', 'saturado', 'ansied', 'nervio'],
            goals: ['meta', 'objetivo', 'propósito', 'lograr', 'alcanzar', 'conseguir']
        };

        let intent = 'general';
        let matchCount = 0;
        
        // Buscar intent con más coincidencias
        for (const [key, words] of Object.entries(intents)) {
            const count = words.filter(w => msg.includes(w)).length;
            if (count > matchCount) {
                intent = key;
                matchCount = count;
            }
        }

        // Extraer estadísticas del contexto para personalización
        const habitMatch = context.match(/Hábitos:.*?(\d+) activos/);
        const goalsMatch = context.match(/Metas:.*?(\d+) activas/);
        const tasksMatch = context.match(/Tareas:.*?(\d+) pendientes/);
        const userMatch = context.match(/Usuario: (.+?)(?:\n|$)/);
        
        const habitsActive = habitMatch ? parseInt(habitMatch[1]) : 0;
        const goalsActive = goalsMatch ? parseInt(goalsMatch[1]) : 0;
        const tasksPending = tasksMatch ? parseInt(tasksMatch[1]) : 0;
        const userName = userMatch ? userMatch[1] : 'Usuario';

        // Respuestas personalizadas basadas en intención y contexto
        const responses = {
            productivity: [
                tasksPending > 5 
                    ? `⚡ Con ${tasksPending} tareas pendientes, el método Pomodoro será perfecto para ti. Haz bloques de 25 min y verás cómo avanzas rápido.`
                    : `⚡ Para optimizar: 1) Una tarea a la vez, 2) Bloquea distracciones, 3) Pomodoro (25 min). ¿Cuál es tu prioridad ahora?`,
                `⚡ La productividad real no es hacer más, sino hacer lo correcto primero. ¿Cuáles son tus 3 tareas más importantes hoy?`,
                `⚡ Productividad = Claridad + Acción. Define qué es éxito hoy y trabaja hacia ese objetivo específico.`
            ],
            motivation: [
                `💪 ${userName}, cada día que cumplas tus hábitos (tienes ${habitsActive} activos) estás construyendo tu mejor versión. ¡Sigue adelante!`,
                `💪 Recuerda: No se trata de ser perfecto, se trata de avanzar. Pequeños pasos consistentes vencen al perfeccionismo.`,
                `💪 Tu perseverancia es tu súper poder. Hoy es una oportunidad perfecta para acercarte a tus metas. ¡Vamos!`
            ],
            habits: [
                habitsActive > 0
                    ? `🔄 Tienes ${habitsActive} hábitos activos. Para que peguen: empieza muy pequeño (2 min), hazlo a la misma hora, celebra cada día.`
                    : `🔄 Los hábitos se construyen lentamente pero duran para siempre. Comienza con UNO, tan fácil que no puedas fallar. ¿Cuál será?`,
                `🔄 Recuerda: 66 días promedio para formar un hábito. Ya viste progreso, ¡sigue! Consistencia > Perfección.`
            ],
            focus: [
                `🎯 Distracciones = Realidad del trabajo moderno. Solución: apaga notificaciones, bloquea redes por 2 horas, trabaja en bloques de 25 min.`,
                `🎯 Tu cerebro necesita 20 min para enfocarse. Elimina interrupciones primero, luego trabaja sin culpa.`,
                `🎯 Focus es un músculo: entrénalo con Pomodoros. Yo puedo ayudarte a temporizar sesiones productivas.`
            ],
            stress: [
                `🧘 Estrés = Señal de alerta. Respira (técnica 4-7-8: inhala 4, mantén 7, exhala 8), camina 5 min. Tu cuerpo primero.`,
                `🧘 Cuando sientas presión: delega, elimina, o pospón. No tienes que hacerlo todo hoy.`,
                `🧘 La meditación de 5 minutos reduce cortisol. ¿Necesitas que te guíe una sesión rápida?`
            ],
            goals: [
                goalsActive > 0
                    ? `🎪 Tienes ${goalsActive} metas activas. Divídelas EN HITOS MENSUALES. Lo imposible se vuelve posible en pasos pequeños.`
                    : `🎪 Las metas grandes asustan. Solución: desglósalas en hitos de 30 días. ¿Cuál es tu meta #1?`,
                `🎪 Metas específicas (SMART) + acción consistente = Logro seguro. Crea una meta mensurable hoy.`
            ],
            general: [
                `💡 Hola ${userName}! 👋 Me encantaría ayudarte. Tengo ${habitsActive} hábito(s) activo(s), ${goalsActive} meta(s) y veo tu progreso. ¿En qué aspecto quieres enfocarte?`,
                `💡 ¿Necesitas ayuda con hábitos, metas, tareas, focus o motivación? Cuéntame y te doy un plan específico.`
            ]
        };

        // Seleccionar respuesta aleatoria de la intención detectada
        const intentResponses = responses[intent] || responses.general;
        return intentResponses[Math.floor(Math.random() * intentResponses.length)];
    }

    buildUserContext() {
        const habits = store.get('habits.items') || [];
        const goals = store.get('goals.items') || [];
        const tasks = store.get('planner.tasks') || [];
        const entries = store.get('journal.entries') || [];
        const userName = store.get('settings.userName') || 'Usuario';
        const lifeScore = store.get('stats.lifeScore') || [];

        const habitStats = {
            total: habits.length,
            active: habits.filter(h => h.enabled !== false).length,
            completedToday: Object.values(store.get('habits.completions') || {}).filter(
                c => new Date(c).toDateString() === new Date().toDateString()
            ).length
        };

        const goalStats = {
            total: goals.length,
            active: goals.filter(g => g.status !== 'completed').length,
            completed: goals.filter(g => g.status === 'completed').length
        };

        const taskStats = {
            total: tasks.length,
            completed: tasks.filter(t => t.completed).length,
            pending: tasks.filter(t => !t.completed).length
        };

        const recentScore = lifeScore.length > 0 ? lifeScore[lifeScore.length - 1] : null;
        const avgScore = lifeScore.length > 0 
            ? Math.round(lifeScore.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, lifeScore.length))
            : null;

        return `Usuario: ${userName}
Hábitos: ${habitStats.total} totales, ${habitStats.active} activos, ${habitStats.completedToday} completados hoy
Metas: ${goalStats.total} totales, ${goalStats.active} activas, ${goalStats.completed} completadas
Tareas: ${taskStats.total} totales, ${taskStats.completed} completadas, ${taskStats.pending} pendientes
Entradas de diario: ${entries.length}
Puntuación de vida: ${recentScore || 'Sin datos'} (promedio últimos 7 días: ${avgScore || 'N/A'})`;
    }

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

    setLoading(loading) {
        this.isLoading = loading;
        const messagesContainer = document.querySelector('.ai-chat-messages');
        
        if (loading) {
            const loadingEl = document.createElement('div');
            loadingEl.className = 'ai-message ai-message-assistant ai-loading';
            loadingEl.innerHTML = '<span class="ai-typing">●●●</span>';
            loadingEl.id = 'ai-loading';
            messagesContainer?.appendChild(loadingEl);
            if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            const loadingEl = document.getElementById('ai-loading');
            loadingEl?.remove();
        }
    }

    getOrCreateApiKey() {
        let key = localStorage.getItem('AI_API_KEY');
        if (!key) {
            key = '';
        }
        return key;
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('AI_API_KEY', key);
        this.useHuggingFace = false;
        localStorage.setItem('USE_HUGGINGFACE', 'false');
        showToast('✓ API key de Gemini configurada correctamente', 'success');
    }

    setUseHuggingFace(use) {
        this.useHuggingFace = use;
        localStorage.setItem('USE_HUGGINGFACE', use ? 'true' : 'false');
        if (use) {
            showToast('✓ Usando Hugging Face (sin API key requerida)', 'success');
        }
    }

    showApiKeySettings() {
        const currentKey = this.apiKey;
        const html = `
            <form id="ai-settings-form" class="form">
                <div class="form-group">
                    <label>⚙️ Configuración del Asistente IA</label>
                    <p class="text-secondary" style="font-size: 0.9rem; margin-bottom: 12px;">
                        Elige cómo quieres que acceda a IA inteligente
                    </p>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="ai-mode" value="huggingface" ${!currentKey ? 'checked' : ''}>
                        <span><strong>🤗 Hugging Face (Recomendado)</strong></span>
                    </label>
                    <p class="text-secondary" style="font-size: 0.8rem; margin-left: 24px;">Gratis, sin API key. IA sin restricciones.</p>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="ai-mode" value="gemini" ${currentKey ? 'checked' : ''}>
                        <span><strong>🔮 Google Gemini</strong></span>
                    </label>
                    <p class="text-secondary" style="font-size: 0.8rem; margin-left: 24px;">Requiere API key. Muy poderoso.</p>
                </div>

                <div id="gemini-key-section" style="display: ${currentKey ? 'block' : 'none'}; margin-top: 16px; padding: 12px; background: var(--bg-tertiary); border-radius: var(--radius-sm);">
                    <label>Google Gemini API Key</label>
                    <input type="password" id="gemini-key-input" placeholder="sk-..." value="${currentKey}" style="margin-bottom: 8px;">
                    <p class="text-secondary" style="font-size: 0.75rem; margin-bottom: 8px;">
                        📝 Obtén tu clave gratuita en: <a href="https://makersuite.google.com/app/apikey" target="_blank" style="color: var(--accent-primary);">makersuite.google.com</a>
                    </p>
                    <button type="button" class="btn btn-sm btn-ghost" id="test-gemini-btn">🧪 Probar</button>
                </div>

                <div style="margin-top: 16px; display: flex; gap: 8px;">
                    <button type="submit" class="btn btn-primary" style="flex: 1;">Guardar</button>
                    <button type="button" class="btn btn-secondary" onclick="window.closeModal?.()">Cancelar</button>
                </div>
            </form>
        `;

        showModal('Configurar Asistente IA', html);

        setTimeout(() => {
            const form = document.getElementById('ai-settings-form');
            const modeRadios = document.querySelectorAll('input[name="ai-mode"]');
            const geminiSection = document.getElementById('gemini-key-section');
            const geminiInput = document.getElementById('gemini-key-input');

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
                    const key = geminiInput.value.trim();
                    if (!key) {
                        showToast('⚠️ Ingresa una API key', 'warning');
                        return;
                    }
                    
                    testBtn.disabled = true;
                    testBtn.textContent = '⏳ Probando...';

                    try {
                        const response = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{
                                        role: 'user',
                                        parts: [{ text: 'Hola' }]
                                    }],
                                    generationConfig: { maxOutputTokens: 10 }
                                })
                            }
                        );

                        if (response.ok) {
                            showToast('✅ ¡Conexión exitosa!', 'success');
                        } else {
                            showToast('❌ API key inválida', 'error');
                        }
                    } catch (error) {
                        showToast('❌ Error de conexión', 'error');
                    } finally {
                        testBtn.disabled = false;
                        testBtn.textContent = '🧪 Probar';
                    }
                });
            }

            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const mode = document.querySelector('input[name="ai-mode"]:checked').value;
                    
                    if (mode === 'gemini') {
                        const key = geminiInput.value.trim();
                        if (!key) {
                            showToast('⚠️ Ingresa una API key', 'warning');
                            return;
                        }
                        this.setApiKey(key);
                    } else {
                        this.setUseHuggingFace(true);
                        this.apiKey = '';
                        localStorage.removeItem('AI_API_KEY');
                    }

                    closeModal();
                });
            }
        }, 100);
    }
}

// Initialize on page load
export const aiAssistant = new AIAssistant();
