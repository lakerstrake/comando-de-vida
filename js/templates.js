// templates.js - Default starter data for new users
import { generateId, today } from './ui.js';

export function loadDefaultTemplates(store) {
    // Only load templates if user has no habits yet
    const existingHabits = store.get('habits.items') || [];
    if (existingHabits.length > 0) {
        return;
    }

    const now = new Date().toISOString();
    const todayStr = today();

    // Calculate deadline 30 days from now
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 30);
    const deadline = deadlineDate.toISOString().split('T')[0];

    // --- Default Habits (6, one per category) ---
    const exerciseId = generateId();
    const readingId = generateId();
    const socialId = generateId();
    const financeHabitId = generateId();
    const careerId = generateId();
    const meditationId = generateId();

    const defaultHabits = [
        {
            id: exerciseId,
            name: 'Ejercicio 30 min',
            category: 'health',
            cue: 'Al despertar',
            frequency: 'daily',
            archived: false,
            createdAt: now
        },
        {
            id: readingId,
            name: 'Leer 20 p\u00e1ginas',
            category: 'mind',
            cue: 'Despu\u00e9s de cenar',
            frequency: 'daily',
            archived: false,
            createdAt: now
        },
        {
            id: socialId,
            name: 'Conectar con alguien',
            category: 'social',
            cue: 'En la hora del almuerzo',
            frequency: 'daily',
            archived: false,
            createdAt: now
        },
        {
            id: financeHabitId,
            name: 'Revisar gastos',
            category: 'finance',
            cue: 'Antes de dormir',
            frequency: 'weekdays',
            archived: false,
            createdAt: now
        },
        {
            id: careerId,
            name: 'Aprender algo nuevo',
            category: 'career',
            cue: 'Despu\u00e9s de almorzar',
            frequency: 'daily',
            archived: false,
            createdAt: now
        },
        {
            id: meditationId,
            name: 'Meditar 10 min',
            category: 'spiritual',
            cue: 'Al despertar, despu\u00e9s del ejercicio',
            frequency: 'daily',
            stackAfter: exerciseId,
            archived: false,
            createdAt: now
        }
    ];

    store.set('habits.items', defaultHabits);

    // --- Default Goals (3) ---
    const defaultGoals = [
        {
            id: generateId(),
            title: 'Mejorar condici\u00f3n f\u00edsica',
            description: 'Alcanzar un nivel de condici\u00f3n f\u00edsica que me permita sentirme con energ\u00eda y vitalidad cada d\u00eda.',
            category: 'health',
            status: 'active',
            progress: 0,
            deadline: deadline,
            smart: {
                specific: 'Hacer ejercicio 30 minutos diarios, 5 d\u00edas a la semana',
                measurable: 'Completar al menos 20 sesiones de ejercicio al mes',
                achievable: 'Empezar con rutinas de 30 min e ir incrementando',
                relevant: 'La salud f\u00edsica impacta directamente mi energ\u00eda y productividad',
                temporal: '30 d\u00edas para establecer el h\u00e1bito de ejercicio constante'
            },
            milestones: [
                { id: generateId(), text: 'Completar primera semana de ejercicio diario', done: false },
                { id: generateId(), text: 'Lograr 15 sesiones en el mes', done: false },
                { id: generateId(), text: 'Sentir mejora notable en energ\u00eda', done: false }
            ],
            createdAt: now
        },
        {
            id: generateId(),
            title: 'Desarrollar h\u00e1bito de lectura',
            description: 'Leer de forma consistente para ampliar conocimientos y mejorar enfoque mental.',
            category: 'mind',
            status: 'active',
            progress: 0,
            deadline: deadline,
            smart: {
                specific: 'Leer 20 p\u00e1ginas cada d\u00eda despu\u00e9s de cenar',
                measurable: 'Completar al menos 1 libro al mes (aprox. 600 p\u00e1ginas)',
                achievable: '20 p\u00e1ginas son 15-20 minutos de lectura, muy alcanzable',
                relevant: 'La lectura mejora la concentraci\u00f3n y el conocimiento',
                temporal: '30 d\u00edas para consolidar el h\u00e1bito de lectura diaria'
            },
            milestones: [
                { id: generateId(), text: 'Leer 7 d\u00edas consecutivos', done: false },
                { id: generateId(), text: 'Completar 300 p\u00e1ginas', done: false },
                { id: generateId(), text: 'Terminar primer libro', done: false }
            ],
            createdAt: now
        },
        {
            id: generateId(),
            title: 'Construir fondo de emergencia',
            description: 'Ahorrar de forma disciplinada para tener seguridad financiera b\u00e1sica.',
            category: 'finance',
            status: 'active',
            progress: 0,
            deadline: deadline,
            smart: {
                specific: 'Revisar gastos diarios y apartar un porcentaje fijo de cada ingreso',
                measurable: 'Ahorrar el equivalente a 1 mes de gastos b\u00e1sicos',
                achievable: 'Empezar reduciendo gastos no esenciales y automatizar ahorro',
                relevant: 'Un fondo de emergencia reduce estr\u00e9s financiero significativamente',
                temporal: '30 d\u00edas para establecer el h\u00e1bito de ahorro y revisi\u00f3n'
            },
            milestones: [
                { id: generateId(), text: 'Hacer un presupuesto mensual detallado', done: false },
                { id: generateId(), text: 'Reducir 3 gastos innecesarios', done: false },
                { id: generateId(), text: 'Alcanzar el 50% del fondo objetivo', done: false }
            ],
            createdAt: now
        }
    ];

    store.set('goals.items', defaultGoals);

    // --- Default Tasks for today (5) ---
    const defaultTasks = [
        {
            id: generateId(),
            title: 'Planificar el d\u00eda',
            date: todayStr,
            time: '07:00',
            completed: false,
            important: true,
            urgent: true,
            pomos: 0
        },
        {
            id: generateId(),
            title: 'Sesi\u00f3n de ejercicio',
            date: todayStr,
            time: '08:00',
            completed: false,
            important: true,
            urgent: false,
            pomos: 2
        },
        {
            id: generateId(),
            title: 'Bloque de trabajo profundo',
            date: todayStr,
            time: '09:00',
            completed: false,
            important: true,
            urgent: true,
            pomos: 4
        },
        {
            id: generateId(),
            title: 'Revisar metas semanales',
            date: todayStr,
            time: '12:00',
            completed: false,
            important: true,
            urgent: false,
            pomos: 0
        },
        {
            id: generateId(),
            title: 'Reflexi\u00f3n y diario',
            date: todayStr,
            time: '21:00',
            completed: false,
            important: true,
            urgent: false,
            pomos: 0
        }
    ];

    store.set('planner.tasks', defaultTasks);

    // --- Default Life Wheel assessment (score 5 for all 8 areas) ---
    const defaultAssessment = {
        id: generateId(),
        date: todayStr,
        scores: {
            health: 5,
            career: 5,
            finance: 5,
            relationships: 5,
            romance: 5,
            personalGrowth: 5,
            funRecreation: 5,
            physicalEnvironment: 5
        },
        notes: 'Evaluaci\u00f3n inicial - punto de partida para medir el progreso.'
    };

    const assessments = store.get('lifeWheel.assessments') || [];
    assessments.push(defaultAssessment);
    store.set('lifeWheel.assessments', assessments);
}
