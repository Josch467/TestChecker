// Storage Module - Handles localStorage and IndexedDB operations

// Answer Key Storage (localStorage)
const ANSWER_KEYS_STORAGE = 'bubble_sheet_answer_keys';

export const storage = {
    // Answer Key Operations
    async getAnswerKeys() {
        const keys = localStorage.getItem(ANSWER_KEYS_STORAGE);
        return keys ? JSON.parse(keys) : [];
    },

    async saveAnswerKey(key) {
        const keys = await this.getAnswerKeys();
        const existingIndex = keys.findIndex(k => k.id === key.id);
        
        if (existingIndex >= 0) {
            keys[existingIndex] = key;
        } else {
            keys.push(key);
        }
        
        localStorage.setItem(ANSWER_KEYS_STORAGE, JSON.stringify(keys));
        return key;
    },

    async deleteAnswerKey(id) {
        const keys = await this.getAnswerKeys();
        const filtered = keys.filter(k => k.id !== id);
        localStorage.setItem(ANSWER_KEYS_STORAGE, JSON.stringify(filtered));
    },

    async getAnswerKey(id) {
        const keys = await this.getAnswerKeys();
        return keys.find(k => k.id === id);
    },

    // IndexedDB for Grading Results
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('BubbleSheetGraderDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('results')) {
                    const store = db.createObjectStore('results', { keyPath: 'id' });
                    store.createIndex('keyId', 'keyId', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('subject', 'subject', { unique: false });
                }
            };
        });
    },

    async saveResult(result) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['results'], 'readwrite');
            const store = transaction.objectStore('results');
            const request = store.add(result);
            
            request.onsuccess = () => resolve(result);
            request.onerror = () => reject(request.error);
        });
    },

    async getResults() {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['results'], 'readonly');
            const store = transaction.objectStore('results');
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getResultsByKeyId(keyId) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['results'], 'readonly');
            const store = transaction.objectStore('results');
            const index = store.index('keyId');
            const request = index.getAll(keyId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteResult(id) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['results'], 'readwrite');
            const store = transaction.objectStore('results');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async clearAllResults() {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['results'], 'readwrite');
            const store = transaction.objectStore('results');
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async clearAllData() {
        localStorage.removeItem(ANSWER_KEYS_STORAGE);
        await this.clearAllResults();
    }
};

// Settings Storage
const SETTINGS_STORAGE = 'bubble_sheet_settings';

export const settings = {
    async get() {
        const settings = localStorage.getItem(SETTINGS_STORAGE);
        return settings ? JSON.parse(settings) : {
            threshold: 128,
            maxOptions: 5,
            darkMode: false
        };
    },

    async save(settings) {
        localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
    },

    async update(key, value) {
        const current = await this.get();
        current[key] = value;
        await this.save(current);
    }
};
