/**
 * 文件监听模块 - 智能检测文件变化
 * 
 * 由于 File System Access API 没有原生 watch 能力，
 * 采用轮询 + 多重优化策略：
 * 1. 页面可见性检测 - 隐藏时暂停
 * 2. requestIdleCallback - 空闲时检测
 * 3. 增量检测 - 只检查展开的目录
 * 4. 防抖合并 - 避免频繁刷新
 * 
 * 灵感来源：
 * - Linux 内核 read_poll_timeout 模式
 * - requestAnimationFrame 的 start/stop 控制模式
 * - LRU 缓存 + TTL 过期机制
 */

class FileWatcher {
    constructor(options = {}) {
        // 配置
        this.interval = options.interval || 3000;      // 检查间隔 (ms)
        this.debounceDelay = options.debounce || 300;  // 防抖延迟 (ms)
        this.idleTimeout = options.idleTimeout || 5000; // requestIdleCallback 超时
        
        // 状态
        this.fileCache = new Map();      // path -> { lastModified, size }
        this.watchedDirs = new Map();    // path -> dirHandle
        this.expandedPaths = new Set();  // 当前展开的目录路径
        this.callbacks = new Set();
        this.isRunning = false;
        this.isPaused = false;           // 页面隐藏时暂停
        this.timerId = null;
        this.idleCallbackId = null;
        this.pendingChanges = [];
        this.debounceTimer = null;
        
        // 绑定方法
        this._onVisibilityChange = this._onVisibilityChange.bind(this);
        this._checkLoop = this._checkLoop.bind(this);
    }

    /**
     * 添加目录到监听列表
     * @param {FileSystemDirectoryHandle} dirHandle 
     * @param {string} path 
     */
    watch(dirHandle, path = '') {
        this.watchedDirs.set(path, dirHandle);
        console.log('[Watcher] 开始监听:', path || '(root)');
    }

    /**
     * 移除目录监听
     * @param {string} path 
     */
    unwatch(path) {
        this.watchedDirs.delete(path);
        // 清理该目录下的文件缓存
        for (const [filePath] of this.fileCache) {
            if (filePath === path || filePath.startsWith(path + '/')) {
                this.fileCache.delete(filePath);
            }
        }
        this.expandedPaths.delete(path);
        console.log('[Watcher] 停止监听:', path || '(root)');
    }

    /**
     * 标记目录为展开状态（优先检查）
     * @param {string} path 
     */
    markExpanded(path) {
        this.expandedPaths.add(path);
    }

    /**
     * 标记目录为折叠状态
     * @param {string} path 
     */
    markCollapsed(path) {
        this.expandedPaths.delete(path);
    }

    /**
     * 注册变化回调
     * @param {Function} callback - (changes: Array<{path, type}>) => void
     */
    onChange(callback) {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * 启动监听
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.isPaused = document.hidden;
        this._isWarmingUp = true; // 预热模式：首次扫描只建立缓存，不报告变化
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', this._onVisibilityChange);
        
        console.log('[Watcher] 启动监听循环 (预热模式)');
        this._scheduleNextCheck();
    }

    /**
     * 停止监听
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        
        // 清理定时器
        if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.idleCallbackId) {
            cancelIdleCallback(this.idleCallbackId);
            this.idleCallbackId = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        console.log('[Watcher] 停止监听循环');
    }

    /**
     * 页面可见性变化处理
     */
    _onVisibilityChange() {
        const wasHidden = this.isPaused;
        this.isPaused = document.hidden;
        
        if (wasHidden && !this.isPaused) {
            // 页面从隐藏变为可见，立即执行一次检查
            console.log('[Watcher] 页面可见，立即检查');
            this._scheduleNextCheck(0);
        } else if (!wasHidden && this.isPaused) {
            console.log('[Watcher] 页面隐藏，暂停检查');
        }
    }

    /**
     * 调度下一次检查
     * @param {number} delay - 延迟时间，默认使用 interval
     */
    _scheduleNextCheck(delay = this.interval) {
        if (!this.isRunning) return;
        
        // 清理之前的定时器
        if (this.timerId) {
            clearTimeout(this.timerId);
        }
        
        this.timerId = setTimeout(() => {
            if (!this.isRunning || this.isPaused) {
                // 暂停时继续调度，但不执行检查
                this._scheduleNextCheck();
                return;
            }
            
            // 使用 requestIdleCallback 在浏览器空闲时执行
            if (typeof requestIdleCallback !== 'undefined') {
                this.idleCallbackId = requestIdleCallback(
                    this._checkLoop,
                    { timeout: this.idleTimeout }
                );
            } else {
                // 降级方案：直接执行
                this._checkLoop();
            }
        }, delay);
    }

    /**
     * 检查循环主逻辑
     */
    async _checkLoop() {
        if (!this.isRunning || this.isPaused) {
            this._scheduleNextCheck();
            return;
        }
        
        try {
            const changes = [];
            
            // 检查所有已注册的目录（包括根目录和所有子目录）
            const pathsToCheck = Array.from(this.watchedDirs.keys());
            
            for (const path of pathsToCheck) {
                const dirHandle = this.watchedDirs.get(path);
                if (!dirHandle) continue;
                
                const dirChanges = await this._checkDirectory(dirHandle, path);
                changes.push(...dirChanges);
            }
            
            // 如果有变化，通知回调（带防抖）
            if (changes.length > 0) {
                this._queueChanges(changes);
            }
        } catch (err) {
            console.error('[Watcher] 检查出错:', err);
        }
        
        // 调度下一次检查
        this._scheduleNextCheck();
    }

    /**
     * 检查单个目录的变化
     * @param {FileSystemDirectoryHandle} dirHandle 
     * @param {string} basePath 
     * @returns {Array<{path, type}>}
     */
    async _checkDirectory(dirHandle, basePath) {
        const changes = [];
        const currentEntries = new Set();
        
        try {
            for await (const entry of dirHandle.values()) {
                const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
                currentEntries.add(entryPath);
                
                if (entry.kind === 'file') {
                    try {
                        const file = await entry.getFile();
                        const cached = this.fileCache.get(entryPath);
                        
                        if (!cached) {
                            // 新文件
                            this.fileCache.set(entryPath, {
                                lastModified: file.lastModified,
                                size: file.size
                            });
                            changes.push({ path: entryPath, type: 'add' });
                        } else if (cached.lastModified !== file.lastModified || 
                                   cached.size !== file.size) {
                            // 文件已修改
                            this.fileCache.set(entryPath, {
                                lastModified: file.lastModified,
                                size: file.size
                            });
                            changes.push({ path: entryPath, type: 'modify' });
                        }
                    } catch (e) {
                        // 文件可能被删除或无法访问
                        console.warn('[Watcher] 无法读取文件:', entryPath, e.message);
                    }
                } else if (entry.kind === 'directory') {
                    // 检查目录是否是新增的
                    if (!this.fileCache.has(entryPath)) {
                        this.fileCache.set(entryPath, { isDir: true });
                        changes.push({ path: entryPath, type: 'add', isDir: true });
                    }
                }
            }
            
            // 检查删除的文件/目录
            for (const [cachedPath, meta] of this.fileCache) {
                // 只检查当前目录下的直接子项
                if (this._getParentPath(cachedPath) === basePath) {
                    if (!currentEntries.has(cachedPath)) {
                        this.fileCache.delete(cachedPath);
                        changes.push({ 
                            path: cachedPath, 
                            type: 'delete',
                            isDir: meta.isDir 
                        });
                    }
                }
            }
        } catch (err) {
            console.error('[Watcher] 检查目录失败:', basePath, err);
        }
        
        return changes;
    }

    /**
     * 获取父目录路径
     * @param {string} path 
     * @returns {string}
     */
    _getParentPath(path) {
        const lastSlash = path.lastIndexOf('/');
        return lastSlash > 0 ? path.substring(0, lastSlash) : '';
    }

    /**
     * 将变化加入队列（带防抖）
     * @param {Array} changes 
     */
    _queueChanges(changes) {
        this.pendingChanges.push(...changes);
        
        // 防抖：合并短时间内的多次变化
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            this._notifyChanges();
        }, this.debounceDelay);
    }

    /**
     * 通知所有回调
     */
    _notifyChanges() {
        if (this.pendingChanges.length === 0) return;
        
        // 预热模式：首次扫描只建立缓存，不报告变化
        if (this._isWarmingUp) {
            console.log('[Watcher] 预热完成，缓存了', this.fileCache.size, '个条目');
            this.pendingChanges = [];
            this._isWarmingUp = false;
            return;
        }
        
        // 去重：同一路径只保留最后一个变化
        const changeMap = new Map();
        for (const change of this.pendingChanges) {
            changeMap.set(change.path, change);
        }
        const uniqueChanges = Array.from(changeMap.values());
        
        console.log('[Watcher] 检测到变化:', uniqueChanges);
        
        // 清空队列
        this.pendingChanges = [];
        
        // 通知所有回调
        for (const callback of this.callbacks) {
            try {
                callback(uniqueChanges);
            } catch (err) {
                console.error('[Watcher] 回调执行出错:', err);
            }
        }
    }

    /**
     * 清空缓存（用于强制刷新）
     */
    clearCache() {
        this.fileCache.clear();
        console.log('[Watcher] 缓存已清空');
    }

    /**
     * 获取当前监听状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            watchedDirs: this.watchedDirs.size,
            expandedPaths: this.expandedPaths.size,
            cachedFiles: this.fileCache.size,
            pendingChanges: this.pendingChanges.length
        };
    }
}

export const watcher = new FileWatcher();