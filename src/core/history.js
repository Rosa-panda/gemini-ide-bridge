/**
 * 文件历史管理模块 - IndexedDB 单层存储
 * 
 * 移除了 memoryCache 层：
 * - IndexedDB 读取本就在 1ms 内，内存缓存收益极小
 * - memoryCache 会遮蔽刷新前存入 IndexedDB 的历史记录（致命 Bug）
 * - 使用 dbPromise 确保 _initDB 只执行一次，消除并发竞争
 */

const DB_NAME = 'ide-bridge-history';
const DB_VERSION = 1;
const STORE_NAME = 'file-history';
const MAX_HISTORY_PER_FILE = 10;

class FileHistory {
    constructor() {
        this.db = null;
        // 用 Promise 链确保 _initDB 只执行一次，消除并发竞争隐患
        this.dbPromise = this._initDB();
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
        // 若 db 已就绪直接返回，否则等待初始化 Promise（不重复初始化）
        if (this.db) return this.db;
        return this.dbPromise;
    }

    async saveVersion(filePath, content) {
        const record = {
            filePath,
            content,
            timestamp: Date.now()
        };

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
        // 直接从 IndexedDB 读取，不经过内存缓存，保证数据实时准确
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
                        
                        deleteTx.onerror = (e) => {
                            console.warn('[History] 事务清理失败:', e.target.error);
                        };
                    };
                }
            };
        } catch (err) {
            console.error('[History] 清理失败:', err);
        }
    }

    async clearFileHistory(filePath) {
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
