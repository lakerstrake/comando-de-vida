// store.js - localStorage abstraction layer
const STORAGE_KEY = 'CV2_DATA';

const DEFAULT_DATA = {
    version: 1,
    settings: {
        theme: 'dark',
        soundEnabled: true,
        userName: '',
        profileAvatar: '',
        simpleMode: true,
        targetBedtime: '23:00',
        createdAt: new Date().toISOString(),
        language: 'es'
    },
    habits: {
        items: [],
        completions: {}
    },
    goals: {
        items: []
    },
    planner: {
        tasks: [],
        pomodoroFocusByDate: {},
        morningRoutineCompletions: {},
        pomodoroSettings: {
            workMinutes: 25,
            shortBreakMinutes: 5,
            longBreakMinutes: 15,
            longBreakAfter: 4
        }
    },
    lifeWheel: {
        assessments: []
    },
    journal: {
        entries: []
    },
    weeklyReviews: [],
    stats: {
        lifeScore: [],
        streakRecords: {}
    },
    gamification: {
        xp: 0,
        level: 1,
        achievements: [],
        totalXPEarned: 0,
        achievementDates: {}
    }
};

class Store {
    constructor() {
        this._data = null;
        this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this._data = JSON.parse(raw);
                const before = JSON.stringify(this._data);
                this._migrateData();
                if (JSON.stringify(this._data) !== before) {
                    this._save();
                }
            } else {
                this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
                this._save();
            }
        } catch (e) {
            console.error('Store load error:', e);
            this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
            this._save();
        }
    }

    _migrateData() {
        if (!this._data || typeof this._data !== 'object') {
            this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
            return;
        }

        this._data.settings = {
            ...DEFAULT_DATA.settings,
            ...(this._data.settings || {})
        };

        this._data.habits = this._data.habits || JSON.parse(JSON.stringify(DEFAULT_DATA.habits));
        this._data.goals = this._data.goals || JSON.parse(JSON.stringify(DEFAULT_DATA.goals));
        this._data.planner = this._data.planner || JSON.parse(JSON.stringify(DEFAULT_DATA.planner));
        this._data.planner.pomodoroFocusByDate = this._data.planner.pomodoroFocusByDate || {};
        this._data.planner.morningRoutineCompletions = this._data.planner.morningRoutineCompletions || {};
        this._data.planner.pomodoroSettings = {
            ...DEFAULT_DATA.planner.pomodoroSettings,
            ...(this._data.planner.pomodoroSettings || {})
        };
        this._data.lifeWheel = this._data.lifeWheel || JSON.parse(JSON.stringify(DEFAULT_DATA.lifeWheel));
        this._data.journal = this._data.journal || JSON.parse(JSON.stringify(DEFAULT_DATA.journal));
        this._data.weeklyReviews = this._data.weeklyReviews || [];
        this._data.stats = this._data.stats || JSON.parse(JSON.stringify(DEFAULT_DATA.stats));
        this._data.gamification = this._data.gamification || JSON.parse(JSON.stringify(DEFAULT_DATA.gamification));
    }

    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
            this._showAutosave();
        } catch (e) {
            console.error('Store save error:', e);
        }
    }

    _showAutosave() {
        let indicator = document.getElementById('autosave-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'autosave-indicator';
            indicator.className = 'autosave-indicator';
            indicator.textContent = 'Guardado';
            document.body.appendChild(indicator);
        }
        indicator.classList.add('show');
        clearTimeout(this._autosaveTimeout);
        this._autosaveTimeout = setTimeout(() => indicator.classList.remove('show'), 1500);
    }

    get(path) {
        const keys = path.split('.');
        let obj = this._data;
        for (const key of keys) {
            if (obj == null) return undefined;
            obj = obj[key];
        }
        return obj;
    }

    set(path, value) {
        const keys = path.split('.');
        let obj = this._data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (obj[keys[i]] == null) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        this._save();
    }

    delete(path) {
        const keys = path.split('.');
        let obj = this._data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (obj[keys[i]] == null) return;
            obj = obj[keys[i]];
        }
        delete obj[keys[keys.length - 1]];
        this._save();
    }

    getAll() {
        return this._data;
    }

    exportData() {
        return JSON.stringify(this._data, null, 2);
    }

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            // Validate that parsed data is a non-null object (not array, not primitive)
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                console.error('Import error: data is not a valid object');
                return false;
            }

            // Validate that it contains at least one known top-level key
            const knownKeys = ['habits', 'goals', 'planner', 'journal', 'lifeWheel', 'settings', 'weeklyReviews', 'stats', 'version'];
            const hasKnownKey = Object.keys(data).some(key => knownKeys.includes(key));
            if (!hasKnownKey) {
                console.error('Import error: data does not contain any recognized keys');
                return false;
            }

            // Validate structure of known keys if they exist
            if (data.habits !== undefined && (typeof data.habits !== 'object' || data.habits === null)) {
                console.error('Import error: habits has invalid structure');
                return false;
            }
            if (data.settings !== undefined && (typeof data.settings !== 'object' || data.settings === null)) {
                console.error('Import error: settings has invalid structure');
                return false;
            }
            if (data.goals !== undefined && (typeof data.goals !== 'object' || data.goals === null)) {
                console.error('Import error: goals has invalid structure');
                return false;
            }

            this._data = data;
            this._save();
            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }

    getStorageUsage() {
        const bytes = new Blob([JSON.stringify(this._data)]).size;
        return {
            bytes,
            kb: (bytes / 1024).toFixed(1),
            mb: (bytes / (1024 * 1024)).toFixed(2),
            percentage: ((bytes / (5 * 1024 * 1024)) * 100).toFixed(1)
        };
    }
}

export const store = new Store();
