// store.js - localStorage abstraction layer
const STORAGE_KEY = 'CV2_DATA';

const DEFAULT_DATA = {
    version: 1,
    settings: {
        theme: 'dark',
        soundEnabled: true,
        userName: '',
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

    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
        } catch (e) {
            console.error('Store save error:', e);
        }
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
