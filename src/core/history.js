/**
 * 文件历史管理模块 - IndexedDB + 内存双层存储
 */

const DB_NAME = 'ide-bridge-history';
const DB_VERSION = 1;
const STORE_NAME = 'file-history';
const MAX_HISTORY_PER_FILE = 10;

class FileHistory {
    constructor() {
        this.db = null;
        this.memoryCache = new Map();
        this._initDB();
    }

    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = () => {
                console.error('[History] IndexedDB 打开失败');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[History] IndexedDB 已连接');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('filePath', 'filePath', { unique: false });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    async _ensureDB() {
        if (!this.db) {
            await this._initDB();
        }
        return this.db;
    }

    async saveVersion(filePath, content) {
        const record = {
            filePath,
            content,
            timestamp: Date.now()
        };

        if (!this.memoryCache.has(filePath)) {
            this.memoryCache.set(filePath, []);
        }
        const memList = this.memoryCache.get(filePath);
        memList.push(record);
        if (memList.length > MAX_HISTORY_PER_FILE) {
            memList.shift();
        }

        try {
            const db = await this._ensureDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.add(record);
            
            await this._cleanOldVersions(filePath);
        } catch (err) {
            console.error('[History] 保存失败:', err);
        }
    }

    async getVersions(filePath) {
        if (this.memoryCache.has(filePath)) {
            return [...this.memoryCache.get(filePath)].reverse();
        }

        try {
            const db = await this._ensureDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const index = store.index('filePath');
                const request = index.getAll(filePath);
                
                request.onsuccess = () => {
                    const results = request.result || [];
                    results.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(results);
                };
                request.onerror = () => resolve([]);
            });
        } catch (err) {
            return [];
        }
    }

    async getLastVersion(filePath) {
        const versions = await this.getVersions(filePath);
        return versions.length > 0 ? versions[0] : null;
    }

    async _cleanOldVersions(filePath) {
        try {
            const db = await this._ensureDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('filePath');
            
            const countRequest = index.count(filePath);
            countRequest.onsuccess = () => {
                if (countRequest.result > MAX_HISTORY_PER_FILE) {
                    const getRequest = index.getAll(filePath);
                    getRequest.onsuccess = () => {
                        const records = getRequest.result || [];
                        records.sort((a, b) => a.timestamp - b.timestamp);
                        const toDelete = records.slice(0, records.length - MAX_HISTORY_PER_FILE);
                        const deleteTx = db.transaction(STORE_NAME, 'readwrite');
                        const deleteStore = deleteTx.objectStore(STORE_NAME);
                        toDelete.forEach(r => deleteStore.delete(r.id));
                    };
                }
            };
        } catch (err) {
            console.error('[History] 清理失败:', err);
        }
    }

    async clearFileHistory(filePath) {
        this.memoryCache.delete(filePath);
        
        try {
            const db = await this._ensureDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('filePath');
            
            const request = index.getAllKeys(filePath);
            request.onsuccess = () => {
                (request.result || []).forEach(key => store.delete(key));
            };
        } catch (err) {
            console.error('[History] 清理文件历史失败:', err);
        }
    }

    formatTime(timestamp) {
        const d = new Date(timestamp);
        const pad = n => n.toString().padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
}

export const history = new FileHistory();
