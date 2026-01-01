/**
 * 文件历史管理模块 - IndexedDB + 内存双层存储
 * 提供可靠的版本回退能力
 */

const DB_NAME = 'ide-bridge-history';
const DB_VERSION = 1;
const STORE_NAME = 'file-history';
const MAX_HISTORY_PER_FILE = 10;

class FileHistory {
    constructor() {
        this.db = null;
        this.memoryCache = new Map(); // 内存缓存，快速访问
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

    /**
     * 保存文件版本（写入前调用）
     */
    async saveVersion(filePath, content) {
        const record = {
            filePath,
            content,
            timestamp: Date.now()
        };

        // 1. 存入内存缓存
        if (!this.memoryCache.has(filePath)) {
            this.memoryCache.set(filePath, []);
        }
        const memList = this.memoryCache.get(filePath);
        memList.push(record);
        if (memList.length > MAX_HISTORY_PER_FILE) {
            memList.shift();
        }

        // 2. 存入 IndexedDB
        try {
            const db = await this._ensureDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.add(record);
            
            // 清理旧版本
            await this._cleanOldVersions(filePath);
        } catch (err) {
            console.error('[History] 保存失败:', err);
        }
    }

    /**
     * 获取文件的历史版本列表
     */
    async getVersions(filePath) {
        // 优先从内存获取
        if (this.memoryCache.has(filePath)) {
            return [...this.memoryCache.get(filePath)].reverse();
        }

        // 从 IndexedDB 获取
        try {
            const db = await this._ensureDB();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const index = store.index('filePath');
                const request = index.getAll(filePath);
                
                request.onsuccess = () => {
                    const results = request.result || [];
                    // 按时间倒序
                    results.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(results);
                };
                request.onerror = () => resolve([]);
            });
        } catch (err) {
            return [];
        }
    }

    /**
     * 获取最近一个版本（用于快速撤销）
     */
    async getLastVersion(filePath) {
        const versions = await this.getVersions(filePath);
        return versions.length > 0 ? versions[0] : null;
    }

    /**
     * 清理超出限制的旧版本 (优化：使用 count 检查减少内存占用)
     */
    async _cleanOldVersions(filePath) {
        try {
            const db = await this._ensureDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('filePath');
            
            // 先统计数量，只有超出时才执行获取和删除
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

    /**
     * 删除某文件的所有历史
     */
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

    /**
     * 格式化时间戳
     */
    formatTime(timestamp) {
        const d = new Date(timestamp);
        const pad = n => n.toString().padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
}

export const history = new FileHistory();
