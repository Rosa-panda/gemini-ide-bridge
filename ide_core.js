/**
 * Gemini IDE Bridge Core (V0.0.5)
 * 自动构建于 2026-01-12T04:18:16.254Z
 */
var IDE_BRIDGE = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/main.js
  var main_exports = {};
  __export(main_exports, {
    fs: () => fs,
    gemini: () => gemini,
    ui: () => ui
  });

  // src/core/history.js
  var DB_NAME = "ide-bridge-history";
  var DB_VERSION = 1;
  var STORE_NAME = "file-history";
  var MAX_HISTORY_PER_FILE = 10;
  var FileHistory = class {
    constructor() {
      this.db = null;
      this.memoryCache = /* @__PURE__ */ new Map();
      this._initDB();
    }
    async _initDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => {
          console.error("[History] IndexedDB \u6253\u5F00\u5931\u8D25");
          reject(request.error);
        };
        request.onsuccess = () => {
          this.db = request.result;
          console.log("[History] IndexedDB \u5DF2\u8FDE\u63A5");
          resolve(this.db);
        };
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            store.createIndex("filePath", "filePath", { unique: false });
            store.createIndex("timestamp", "timestamp", { unique: false });
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
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.add(record);
        await this._cleanOldVersions(filePath);
      } catch (err) {
        console.error("[History] \u4FDD\u5B58\u5931\u8D25:", err);
      }
    }
    async getVersions(filePath) {
      if (this.memoryCache.has(filePath)) {
        return [...this.memoryCache.get(filePath)].reverse();
      }
      try {
        const db = await this._ensureDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const index = store.index("filePath");
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
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("filePath");
        const countRequest = index.count(filePath);
        countRequest.onsuccess = () => {
          if (countRequest.result > MAX_HISTORY_PER_FILE) {
            const getRequest = index.getAll(filePath);
            getRequest.onsuccess = () => {
              const records = getRequest.result || [];
              records.sort((a, b) => a.timestamp - b.timestamp);
              const toDelete = records.slice(0, records.length - MAX_HISTORY_PER_FILE);
              const deleteTx = db.transaction(STORE_NAME, "readwrite");
              const deleteStore = deleteTx.objectStore(STORE_NAME);
              toDelete.forEach((r) => deleteStore.delete(r.id));
              deleteTx.onerror = (e) => {
                console.warn("[History] \u4E8B\u52A1\u6E05\u7406\u5931\u8D25:", e.target.error);
              };
            };
          }
        };
      } catch (err) {
        console.error("[History] \u6E05\u7406\u5931\u8D25:", err);
      }
    }
    async clearFileHistory(filePath) {
      this.memoryCache.delete(filePath);
      try {
        const db = await this._ensureDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("filePath");
        const request = index.getAllKeys(filePath);
        request.onsuccess = () => {
          (request.result || []).forEach((key) => store.delete(key));
        };
      } catch (err) {
        console.error("[History] \u6E05\u7406\u6587\u4EF6\u5386\u53F2\u5931\u8D25:", err);
      }
    }
    formatTime(timestamp) {
      const d = new Date(timestamp);
      const pad = (n) => n.toString().padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  };
  var history = new FileHistory();

  // src/core/watcher.js
  var FileWatcher = class {
    constructor(options = {}) {
      this.interval = options.interval || 3e3;
      this.debounceDelay = options.debounce || 300;
      this.idleTimeout = options.idleTimeout || 5e3;
      this.fileCache = /* @__PURE__ */ new Map();
      this.watchedDirs = /* @__PURE__ */ new Map();
      this.expandedPaths = /* @__PURE__ */ new Set();
      this.callbacks = /* @__PURE__ */ new Set();
      this.isRunning = false;
      this.isPaused = false;
      this.timerId = null;
      this.idleCallbackId = null;
      this.pendingChanges = [];
      this.debounceTimer = null;
      this._onVisibilityChange = this._onVisibilityChange.bind(this);
      this._checkLoop = this._checkLoop.bind(this);
    }
    /**
     * 添加目录到监听列表
     * @param {FileSystemDirectoryHandle} dirHandle 
     * @param {string} path 
     */
    watch(dirHandle, path = "") {
      this.watchedDirs.set(path, dirHandle);
      console.log("[Watcher] \u5F00\u59CB\u76D1\u542C:", path || "(root)");
    }
    /**
     * 移除目录监听
     * @param {string} path 
     */
    unwatch(path) {
      this.watchedDirs.delete(path);
      for (const [filePath] of this.fileCache) {
        if (filePath === path || filePath.startsWith(path + "/")) {
          this.fileCache.delete(filePath);
        }
      }
      this.expandedPaths.delete(path);
      console.log("[Watcher] \u505C\u6B62\u76D1\u542C:", path || "(root)");
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
      this._isWarmingUp = true;
      document.addEventListener("visibilitychange", this._onVisibilityChange);
      console.log("[Watcher] \u542F\u52A8\u76D1\u542C\u5FAA\u73AF (\u9884\u70ED\u6A21\u5F0F)");
      this._scheduleNextCheck();
    }
    /**
     * 停止监听
     */
    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
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
      console.log("[Watcher] \u505C\u6B62\u76D1\u542C\u5FAA\u73AF");
    }
    /**
     * 页面可见性变化处理
     */
    _onVisibilityChange() {
      const wasHidden = this.isPaused;
      this.isPaused = document.hidden;
      if (wasHidden && !this.isPaused) {
        console.log("[Watcher] \u9875\u9762\u53EF\u89C1\uFF0C\u7ACB\u5373\u68C0\u67E5");
        this._scheduleNextCheck(0);
      } else if (!wasHidden && this.isPaused) {
        console.log("[Watcher] \u9875\u9762\u9690\u85CF\uFF0C\u6682\u505C\u68C0\u67E5");
      }
    }
    /**
     * 调度下一次检查
     * @param {number} delay - 延迟时间，默认使用 interval
     */
    _scheduleNextCheck(delay = this.interval) {
      if (!this.isRunning) return;
      if (this.timerId) {
        clearTimeout(this.timerId);
      }
      this.timerId = setTimeout(() => {
        if (!this.isRunning || this.isPaused) {
          this._scheduleNextCheck();
          return;
        }
        if (typeof requestIdleCallback !== "undefined") {
          this.idleCallbackId = requestIdleCallback(
            this._checkLoop,
            { timeout: this.idleTimeout }
          );
        } else {
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
        const pathsToCheck = Array.from(this.watchedDirs.keys());
        for (const path of pathsToCheck) {
          const dirHandle = this.watchedDirs.get(path);
          if (!dirHandle) continue;
          const dirChanges = await this._checkDirectory(dirHandle, path);
          changes.push(...dirChanges);
        }
        if (changes.length > 0) {
          this._queueChanges(changes);
        }
      } catch (err) {
        console.error("[Watcher] \u68C0\u67E5\u51FA\u9519:", err);
      }
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
      const currentEntries = /* @__PURE__ */ new Set();
      try {
        for await (const entry of dirHandle.values()) {
          const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
          currentEntries.add(entryPath);
          if (entry.kind === "file") {
            try {
              const file = await entry.getFile();
              const cached = this.fileCache.get(entryPath);
              if (!cached) {
                this.fileCache.set(entryPath, {
                  lastModified: file.lastModified,
                  size: file.size
                });
                changes.push({ path: entryPath, type: "add" });
              } else if (cached.lastModified !== file.lastModified || cached.size !== file.size) {
                this.fileCache.set(entryPath, {
                  lastModified: file.lastModified,
                  size: file.size
                });
                changes.push({ path: entryPath, type: "modify" });
              }
            } catch (e) {
              console.warn("[Watcher] \u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6:", entryPath, e.message);
            }
          } else if (entry.kind === "directory") {
            if (!this.fileCache.has(entryPath)) {
              this.fileCache.set(entryPath, { isDir: true });
              changes.push({ path: entryPath, type: "add", isDir: true });
            }
          }
        }
        for (const [cachedPath, meta] of this.fileCache) {
          if (this._getParentPath(cachedPath) === basePath) {
            if (!currentEntries.has(cachedPath)) {
              this.fileCache.delete(cachedPath);
              changes.push({
                path: cachedPath,
                type: "delete",
                isDir: meta.isDir
              });
            }
          }
        }
      } catch (err) {
        console.error("[Watcher] \u68C0\u67E5\u76EE\u5F55\u5931\u8D25:", basePath, err);
      }
      return changes;
    }
    /**
     * 获取父目录路径
     * @param {string} path 
     * @returns {string}
     */
    _getParentPath(path) {
      const lastSlash = path.lastIndexOf("/");
      return lastSlash > 0 ? path.substring(0, lastSlash) : "";
    }
    /**
     * 将变化加入队列（带防抖）
     * @param {Array} changes 
     */
    _queueChanges(changes) {
      this.pendingChanges.push(...changes);
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
      if (this._isWarmingUp) {
        console.log("[Watcher] \u9884\u70ED\u5B8C\u6210\uFF0C\u7F13\u5B58\u4E86", this.fileCache.size, "\u4E2A\u6761\u76EE");
        this.pendingChanges = [];
        this._isWarmingUp = false;
        return;
      }
      const changeMap = /* @__PURE__ */ new Map();
      for (const change of this.pendingChanges) {
        changeMap.set(change.path, change);
      }
      const uniqueChanges = Array.from(changeMap.values());
      console.log("[Watcher] \u68C0\u6D4B\u5230\u53D8\u5316:", uniqueChanges);
      this.pendingChanges = [];
      for (const callback of this.callbacks) {
        try {
          callback(uniqueChanges);
        } catch (err) {
          console.error("[Watcher] \u56DE\u8C03\u6267\u884C\u51FA\u9519:", err);
        }
      }
    }
    /**
     * 清空缓存（用于强制刷新）
     */
    clearCache() {
      this.fileCache.clear();
      console.log("[Watcher] \u7F13\u5B58\u5DF2\u6E05\u7A7A");
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
  };
  var watcher = new FileWatcher();

  // src/core/fs.js
  var IGNORE_DIRS = /* @__PURE__ */ new Set([
    "node_modules",
    ".git",
    "dist",
    ".DS_Store",
    ".idea",
    ".vscode",
    "__pycache__",
    ".next",
    "build",
    ".cache",
    "coverage",
    ".env",
    ".gitkeep"
  ]);
  var FileSystem = class {
    constructor() {
      this.rootHandle = null;
      this.fileHandles = /* @__PURE__ */ new Map();
      this.dirHandles = /* @__PURE__ */ new Map();
      this.projectName = "";
    }
    async openProject() {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
        this.rootHandle = dirHandle;
        this.projectName = dirHandle.name;
        watcher.watch(dirHandle, "");
        watcher.start();
        return await this.refreshProject();
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    async refreshProject() {
      if (!this.rootHandle) return { success: false, error: "\u672A\u8FDE\u63A5\u9879\u76EE" };
      try {
        this.fileHandles.clear();
        this.dirHandles.clear();
        watcher.clearCache();
        const tree = await this._scanDir(this.rootHandle, "", true);
        return { success: true, rootName: this.rootHandle.name, tree };
      } catch (err) {
        console.error("[FS] \u5237\u65B0\u5931\u8D25:", err);
        return { success: false, error: err.message };
      }
    }
    async readDirectory(path) {
      const handle = this.dirHandles.get(path);
      if (!handle) return null;
      return await this._scanDir(handle, path, false);
    }
    async _scanDir(dirHandle, path = "", recursive = true) {
      const entries = [];
      this.dirHandles.set(path || ".", dirHandle);
      const PARALLEL_LIMIT = 6;
      const pendingDirs = [];
      for await (const entry of dirHandle.values()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const relPath = path ? `${path}/${entry.name}` : entry.name;
        if (entry.kind === "file") {
          this.fileHandles.set(relPath, entry);
          entries.push({ name: entry.name, kind: "file", path: relPath });
        } else if (entry.kind === "directory") {
          this.dirHandles.set(relPath, entry);
          const dirEntry = {
            name: entry.name,
            kind: "directory",
            path: relPath,
            children: []
          };
          entries.push(dirEntry);
          if (recursive) {
            pendingDirs.push({ handle: entry, path: relPath, entry: dirEntry });
          }
        }
      }
      for (let i = 0; i < pendingDirs.length; i += PARALLEL_LIMIT) {
        const batch = pendingDirs.slice(i, i + PARALLEL_LIMIT);
        const results = await Promise.all(
          batch.map((dir) => this._scanDir(dir.handle, dir.path, true))
        );
        batch.forEach((dir, idx) => {
          dir.entry.children = results[idx];
        });
        if (i + PARALLEL_LIMIT < pendingDirs.length) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      return entries.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === "directory" ? -1 : 1;
      });
    }
    async readFile(filePath) {
      const handle = this.fileHandles.get(filePath);
      if (!handle) return null;
      try {
        const file = await handle.getFile();
        const content = await file.text();
        this._lineEndings = this._lineEndings || /* @__PURE__ */ new Map();
        this._lineEndings.set(filePath, content.includes("\r\n") ? "\r\n" : "\n");
        return content;
      } catch (err) {
        console.error("[FS] \u8BFB\u53D6\u5931\u8D25:", filePath, err);
        return null;
      }
    }
    getLineEnding(filePath) {
      var _a;
      return ((_a = this._lineEndings) == null ? void 0 : _a.get(filePath)) || "\n";
    }
    async writeFile(filePath, content, saveHistory = true) {
      const handle = this.fileHandles.get(filePath);
      if (!handle) {
        console.error("[FS] \u6587\u4EF6\u4E0D\u5B58\u5728:", filePath);
        return false;
      }
      try {
        if (saveHistory) {
          const oldContent = await this.readFile(filePath);
          if (oldContent !== null && oldContent !== content) {
            await history.saveVersion(filePath, oldContent);
          }
        }
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err) {
        console.error("[FS] \u5199\u5165\u5931\u8D25:", filePath, err);
        return false;
      }
    }
    async revertFile(filePath) {
      const lastVersion = await history.getLastVersion(filePath);
      if (!lastVersion) {
        return { success: false, error: "\u6CA1\u6709\u53EF\u56DE\u9000\u7684\u7248\u672C" };
      }
      const success = await this.writeFile(filePath, lastVersion.content, true);
      return { success, content: lastVersion.content, timestamp: lastVersion.timestamp };
    }
    async revertToVersion(filePath, timestamp) {
      const versions = await history.getVersions(filePath);
      const target = versions.find((v) => v.timestamp === timestamp);
      if (!target) {
        return { success: false, error: "\u7248\u672C\u4E0D\u5B58\u5728" };
      }
      const success = await this.writeFile(filePath, target.content, true);
      return { success, content: target.content };
    }
    async getFileHistory(filePath) {
      return await history.getVersions(filePath);
    }
    async createFile(filePath, content = "") {
      if (!this.rootHandle) return false;
      try {
        const parts = filePath.split("/");
        const fileName = parts.pop();
        let currentHandle = this.rootHandle;
        for (const part of parts) {
          currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }
        const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
        this.fileHandles.set(filePath, fileHandle);
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err) {
        console.error("[FS] \u521B\u5EFA\u6587\u4EF6\u5931\u8D25:", filePath, err);
        return false;
      }
    }
    async deleteFile(filePath) {
      if (!this.rootHandle) return false;
      try {
        const parts = filePath.split("/");
        const fileName = parts.pop();
        let parentHandle = this.rootHandle;
        for (const part of parts) {
          parentHandle = await parentHandle.getDirectoryHandle(part);
        }
        await parentHandle.removeEntry(fileName);
        this.fileHandles.delete(filePath);
        await history.clearFileHistory(filePath);
        return true;
      } catch (err) {
        console.error("[FS] \u5220\u9664\u6587\u4EF6\u5931\u8D25:", filePath, err);
        return false;
      }
    }
    async deleteDirectory(dirPath) {
      if (!this.rootHandle) return false;
      try {
        const parts = dirPath.split("/");
        const dirName = parts.pop();
        let parentHandle = this.rootHandle;
        for (const part of parts) {
          parentHandle = await parentHandle.getDirectoryHandle(part);
        }
        await parentHandle.removeEntry(dirName, { recursive: true });
        const pathsToDelete = [];
        for (const [path] of this.fileHandles) {
          if (path === dirPath || path.startsWith(dirPath + "/")) {
            pathsToDelete.push(path);
          }
        }
        for (const path of pathsToDelete) {
          this.fileHandles.delete(path);
          await history.clearFileHistory(path);
        }
        const dirsToDelete = [];
        for (const [path] of this.dirHandles) {
          if (path === dirPath || path.startsWith(dirPath + "/")) {
            dirsToDelete.push(path);
          }
        }
        for (const path of dirsToDelete) {
          this.dirHandles.delete(path);
        }
        return true;
      } catch (err) {
        console.error("[FS] \u5220\u9664\u76EE\u5F55\u5931\u8D25:", dirPath, err);
        return false;
      }
    }
    hasFile(filePath) {
      return this.fileHandles.has(filePath);
    }
    getAllFilePaths() {
      return Array.from(this.fileHandles.keys());
    }
    generateStructure(node, indent = "", isLast = true) {
      let result = "";
      const marker = isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 ";
      const icon = node.kind === "directory" ? "\u{1F4C2}" : "\u{1F4C4}";
      result += indent + marker + icon + node.name + "\n";
      if (node.kind === "directory" && node.children) {
        const nextIndent = indent + (isLast ? "    " : "\u2502   ");
        node.children.forEach((child, index) => {
          const lastChild = index === node.children.length - 1;
          result += this.generateStructure(child, nextIndent, lastChild);
        });
      }
      return result;
    }
    generateFullStructure(tree) {
      return tree.map((node, index) => {
        const isLast = index === tree.length - 1;
        return this.generateStructure(node, "", isLast);
      }).join("");
    }
    /**
     * 标记目录展开状态（供 watcher 优化检测）
     * @param {string} path 
     */
    markDirExpanded(path) {
      watcher.markExpanded(path);
      const dirHandle = this.dirHandles.get(path);
      if (dirHandle) {
        watcher.watch(dirHandle, path);
      }
    }
    /**
     * 标记目录折叠状态
     * @param {string} path 
     */
    markDirCollapsed(path) {
      watcher.markCollapsed(path);
    }
    /**
     * 注册文件变化回调
     * @param {Function} callback - (changes) => void
     * @returns {Function} 取消注册的函数
     */
    onFileChange(callback) {
      return watcher.onChange(callback);
    }
    /**
     * 获取 watcher 状态
     */
    getWatcherStatus() {
      return watcher.getStatus();
    }
    /**
     * 停止文件监听（关闭项目时调用）
     */
    stopWatching() {
      watcher.stop();
      watcher.clearCache();
    }
  };
  var fs = new FileSystem();

  // src/core/parser.js
  function extractFilePath(text) {
    const patterns = [
      /^\/\/\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*$/m,
      /^#\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*$/m,
      /^\/\*\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*\*\/$/m,
      /^<!--\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*-->$/m
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }
  function parseDelete(text) {
    const deletes = [];
    const regex = /^<{6,10}\s*DELETE\s*\[([^\]]+)\]\s*[\s\S]*?^>{6,10}\s*END\s*$/gm;
    let match;
    while ((match = regex.exec(text)) !== null) {
      deletes.push({
        file: match[1].trim()
      });
    }
    return deletes;
  }
  function parseRead(text) {
    const reads = [];
    const regex = /<{6,10}\s*READ\s*\[([^\]]+)\](?:\s+(\d+)-(\d+))?/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      reads.push({
        file: match[1].trim(),
        startLine: match[2] ? parseInt(match[2]) : null,
        endLine: match[3] ? parseInt(match[3]) : null
      });
    }
    return reads;
  }
  function parseSearchReplace(text) {
    var _a;
    const patches = [];
    const regex = /^<{6,10} SEARCH(?:\s*\[([^\]]+)\]|\s+([^\s\n]+))?(?:\s+\d+-\d+)?\s*?\n([\s\S]*?)\n^={6,10}\s*?\n([\s\S]*?)\n?^>{6,10} REPLACE\s*$/gm;
    let match;
    while ((match = regex.exec(text)) !== null) {
      patches.push({
        file: (_a = match[1] || match[2] || null) == null ? void 0 : _a.trim(),
        search: match[3],
        // 移除末尾可能存在的换行符，保持内容纯净
        replace: match[4].replace(/\n$/, ""),
        isDelete: match[4].trim() === ""
      });
    }
    return patches;
  }
  function parseMultipleFiles(text) {
    const files = [];
    const filePattern = /(?:\/\/|#|\/\*)\s*FILE:\s*\[?(.+?)\]?(?:\s*\[OVERWRITE\])?\s*(?:\*\/|-->)?$/gm;
    const matches = [];
    let match;
    while ((match = filePattern.exec(text)) !== null) {
      matches.push({
        index: match.index,
        path: match[1].trim(),
        isOverwrite: match[0].includes("[OVERWRITE]")
      });
    }
    if (matches.length === 0) return files;
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
      let blockText = text.substring(current.index, nextIndex);
      blockText = blockText.replace(/^(?:\/\/|#|\/\*)\s*FILE:.*(?:\r?\n|$)/m, "").trim();
      if (current.path && blockText) {
        files.push({
          path: current.path,
          content: blockText,
          isOverwrite: current.isOverwrite
        });
      }
    }
    return files;
  }

  // src/gemini/watcher.js
  function processCodeBlock(block, processedBlocks) {
    if (processedBlocks.has(block)) return null;
    processedBlocks.add(block);
    const container = block.closest("code-block") || block.closest("pre") || block;
    if (container.querySelector(".ide-action-bar")) return null;
    const text = block.textContent || "";
    if (text.includes("IGNORE_IDE_ACTION")) return null;
    const fileMatch = extractFilePath(text);
    const hasSearchReplace = /^<{6,10} SEARCH/m.test(text) && /^>{6,10} REPLACE/m.test(text);
    const hasDelete = /^<{6,10} DELETE/m.test(text) && /^>{6,10} END/m.test(text);
    const hasRead = /^<{6,10}\s*READ\s*\[/m.test(text);
    if (fileMatch || hasSearchReplace || hasDelete || hasRead) {
      return { container, text, fileMatch };
    }
    return null;
  }
  function createWatcher(onCodeBlock) {
    let timeout = null;
    return new MutationObserver(() => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        const codeBlocks = document.querySelectorAll("code-block, pre > code, .code-block");
        codeBlocks.forEach((block) => onCodeBlock(block));
      }, 500);
    });
  }

  // src/core/patcher/matcher.js
  var RE_CRLF = /\r\n/g;
  var RE_CR = /\r/g;
  var RE_ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
  var RE_LEADING_SPACE = /^(\s*)/;
  var RE_TAB = /\t/g;
  function getLogicSignature(code) {
    return code.replace(RE_CRLF, "\n").replace(RE_CR, "\n").split("\n").map((line, index) => {
      const cleanLine = line.replace(RE_ZERO_WIDTH, "").replace(/\s+$/, "");
      const trimmed = cleanLine.trim();
      const indentMatch = cleanLine.match(RE_LEADING_SPACE);
      const indentStr = indentMatch ? indentMatch[1].replace(RE_TAB, "    ") : "";
      return {
        content: trimmed,
        indent: indentStr.length,
        originalIndex: index
      };
    }).filter((item) => item.content.length > 0);
  }
  function countMatches(content, search, isStrictIndent = false) {
    const contentSigs = typeof content === "string" ? getLogicSignature(content) : content;
    const searchSigs = typeof search === "string" ? getLogicSignature(search) : search;
    if (searchSigs.length === 0) return 0;
    let count = 0;
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
      if (checkMatchAt2(contentSigs, searchSigs, i, isStrictIndent)) {
        count++;
      }
    }
    return count;
  }
  function checkMatchAt2(contentSigs, searchSigs, startIdx, isStrictIndent) {
    for (let j = 0; j < searchSigs.length; j++) {
      if (contentSigs[startIdx + j].content !== searchSigs[j].content) {
        return false;
      }
    }
    if (isStrictIndent && searchSigs.length > 1) {
      const fileBaseIndent = contentSigs[startIdx].indent;
      const searchBaseIndent = searchSigs[0].indent;
      let indentRatio = null;
      for (let j = 1; j < searchSigs.length; j++) {
        const fileRel = contentSigs[startIdx + j].indent - fileBaseIndent;
        const searchRel = searchSigs[j].indent - searchBaseIndent;
        if (fileRel === 0 && searchRel === 0) continue;
        if (fileRel * searchRel <= 0) return false;
        if (indentRatio === null) {
          indentRatio = fileRel / searchRel;
        } else if (Math.abs(fileRel / searchRel - indentRatio) > 0.01) {
          return false;
        }
      }
    }
    return true;
  }
  function isAlreadyApplied(content, search, replace) {
    const contentSigs = getLogicSignature(content);
    const searchSigs = getLogicSignature(search);
    const replaceSigs = getLogicSignature(replace);
    const searchContent = searchSigs.map((s) => s.content).join("\n");
    const replaceContent = replaceSigs.map((s) => s.content).join("\n");
    if (searchContent === replaceContent) return false;
    const replaceMatchCount = countMatches(contentSigs, replaceSigs);
    const searchMatchCount = countMatches(contentSigs, searchSigs);
    if (replaceMatchCount > 0 && searchMatchCount === 0) return true;
    if (replaceMatchCount > 0 && replaceMatchCount >= searchMatchCount && replaceContent.includes(searchContent)) {
      return true;
    }
    return false;
  }
  function findMatchPosition(contentSigs, searchSigs, isStrictIndent = false) {
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
      if (checkMatchAt2(contentSigs, searchSigs, i, isStrictIndent)) {
        return contentSigs[i].originalIndex;
      }
    }
    return -1;
  }

  // src/core/patcher/indent.js
  function alignIndent(fileLines, matchStart, searchLines, replace) {
    const targetUnit = detectIndentUnit(fileLines);
    const baseLevel = detectBaseLevel(fileLines, matchStart, targetUnit);
    const replaceLines = replace.split("\n");
    return normalizeIndent(replaceLines, targetUnit, baseLevel);
  }
  function detectIndentUnit(lines) {
    const indentCounts = { 2: 0, 4: 0, tab: 0 };
    for (const line of lines) {
      if (!line.trim()) continue;
      const match = line.match(/^(\s+)/);
      if (!match) continue;
      const indent = match[1];
      if (indent.includes("	")) {
        indentCounts.tab++;
      } else {
        const len = indent.length;
        if (len % 4 === 0) indentCounts[4]++;
        else if (len % 2 === 0) indentCounts[2]++;
      }
    }
    if (indentCounts.tab > indentCounts[4] && indentCounts.tab > indentCounts[2]) {
      return "	";
    }
    return indentCounts[2] > indentCounts[4] ? "  " : "    ";
  }
  function detectBaseLevel(lines, matchStart, unit) {
    const line = lines[matchStart] || "";
    const match = line.match(/^(\s*)/);
    if (!match || !match[1]) return 0;
    const indent = match[1];
    if (unit === "	") {
      return (indent.match(/\t/g) || []).length;
    }
    return Math.floor(indent.length / unit.length);
  }
  function normalizeIndent(lines, targetUnit, baseLevel) {
    const levels = analyzeIndentLevels(lines);
    return lines.map((line, i) => {
      const cleanLine = line.replace(/[\u200B-\u200D\uFEFF]/g, "");
      if (!cleanLine.trim()) return cleanLine;
      if (cleanLine.trim().match(/^__LITERAL_\d+__$/)) {
        const level2 = levels[i];
        const totalLevel2 = baseLevel + level2;
        return targetUnit.repeat(totalLevel2) + cleanLine.trim();
      }
      const level = levels[i];
      const totalLevel = Math.max(0, baseLevel + level);
      const trimmed = cleanLine.trimStart();
      if (/^\*(\s|\/|$)/.test(trimmed) && totalLevel > 0) {
        const isLikelyMath = /^\*\s+[a-zA-Z_]/.test(trimmed) && !trimmed.includes("@");
        if (!isLikelyMath) {
          return targetUnit.repeat(totalLevel) + " " + trimmed;
        }
      }
      return targetUnit.repeat(totalLevel) + trimmed;
    });
  }
  function analyzeIndentLevels(lines) {
    const indents = lines.map((line) => {
      if (!line.trim()) return -1;
      const match = line.match(/^(\s*)/);
      return match ? match[1].replace(/\t/g, "    ").length : 0;
    });
    const firstValidIdx = indents.findIndex((n) => n >= 0);
    if (firstValidIdx === -1) return lines.map(() => 0);
    const anchorIndent = indents[firstValidIdx];
    const steps = [];
    for (let i = 0; i < indents.length - 1; i++) {
      if (indents[i] >= 0 && indents[i + 1] >= 0) {
        const diff = Math.abs(indents[i + 1] - indents[i]);
        if (diff >= 2) steps.push(diff);
      }
    }
    let sourceUnit = 4;
    if (steps.length > 0) {
      const counts = {};
      steps.forEach((s) => counts[s] = (counts[s] || 0) + 1);
      const mostFrequent = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
      sourceUnit = Math.max(2, parseInt(mostFrequent));
    } else {
      const diffs = indents.filter((n) => n > anchorIndent).map((n) => n - anchorIndent);
      if (diffs.length > 0) {
        const minDiff = Math.min(...diffs);
        sourceUnit = Math.max(2, minDiff);
      }
    }
    return indents.map((indent) => {
      if (indent < 0) return 0;
      const diff = indent - anchorIndent;
      return Math.round(diff / sourceUnit);
    });
  }

  // src/core/patcher/literals.js
  function extractLiterals(code) {
    const literals = /* @__PURE__ */ new Map();
    let counter = 0;
    let result = "";
    let i = 0;
    const len = code.length;
    while (i < len) {
      if (code.slice(i, i + 3) === '"""' || code.slice(i, i + 3) === "'''") {
        const quote = code.slice(i, i + 3);
        const start = i;
        i += 3;
        while (i < len - 2) {
          if (code.slice(i, i + 3) === quote) {
            i += 3;
            break;
          }
          if (code[i] === "\\") i++;
          i++;
        }
        const literal = code.slice(start, i);
        const placeholder = "__LITERAL_" + counter++ + "__";
        literals.set(placeholder, literal);
        result += placeholder;
        continue;
      }
      if (code[i] === "`") {
        const start = i;
        i++;
        let hasNewline = false;
        let depth = 1;
        while (i < len && depth > 0) {
          if (code[i] === "\n") hasNewline = true;
          if (code[i] === "\\") {
            i += 2;
            continue;
          }
          if (code[i] === "$" && code[i + 1] === "{") {
            depth++;
            i += 2;
            continue;
          }
          if (code[i] === "{" && depth > 1) {
            depth++;
            i++;
            continue;
          }
          if (code[i] === "}" && depth > 1) {
            depth--;
            i++;
            continue;
          }
          if (code[i] === "`") {
            depth--;
            if (depth === 0) {
              i++;
              break;
            }
          }
          i++;
        }
        const literal = code.slice(start, i);
        if (hasNewline) {
          const placeholder = "__LITERAL_" + counter++ + "__";
          literals.set(placeholder, literal);
          result += placeholder;
        } else {
          result += literal;
        }
        continue;
      }
      result += code[i];
      i++;
    }
    return { masked: result, literals };
  }
  function restoreLiterals(code, literals) {
    let result = code;
    for (const [placeholder, original] of literals) {
      result = result.split(placeholder).join(original);
    }
    return result;
  }

  // src/core/patcher/lineEnding.js
  function detectLineEnding(content) {
    if (content.includes("\r\n")) return "\r\n";
    return "\n";
  }
  function normalizeLineEnding(content) {
    return content.replace(/\r\n/g, "\n");
  }
  function restoreLineEnding(content, originalEnding) {
    if (originalEnding === "\r\n") {
      return content.replace(/\n/g, "\r\n");
    }
    return content;
  }

  // src/core/patcher/syntax.js
  function checkJsSyntax(code, filePath = "") {
    var _a;
    const ext = ((_a = filePath.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
    const jsExts = ["js", "jsx", "ts", "tsx", "mjs"];
    if (filePath && !jsExts.includes(ext)) {
      return { valid: true };
    }
    const { result, finalStack } = stripCommentsAndStrings(code);
    if (finalStack.length > 1) {
      const lastMode = finalStack[finalStack.length - 1];
      return {
        valid: false,
        error: lastMode === "T" ? "\u672A\u95ED\u5408\u7684\u6A21\u677F\u5B57\u7B26\u4E32" : "\u63D2\u503C\u8868\u8FBE\u5F0F (${}) \u672A\u5B8C\u6210"
      };
    }
    return checkBrackets(result);
  }
  function stripCommentsAndStrings(code) {
    let result = "";
    let i = 0;
    const len = code.length;
    const stack = ["I"];
    const DOLLAR = String.fromCharCode(36);
    const canBeRegex = () => {
      let j = result.length - 1;
      while (j >= 0 && /\s/.test(result[j])) j--;
      if (j < 0) return true;
      const lastChar = result[j];
      return /[=(:,;\[!&|?{}<>+\-*%^~()]/.test(lastChar) || result.slice(Math.max(0, j - 6), j + 1).match(/(?:return|yield|await|typeof|void|delete|throw|case|in)$/);
    };
    while (i < len) {
      const char = code[i];
      const next = code[i + 1];
      const currentMode = stack[stack.length - 1];
      if (currentMode === "T") {
        if (char === "`") {
          stack.pop();
          i++;
        } else if (char === DOLLAR && next === "{") {
          stack.push("I");
          result += "{";
          i += 2;
        } else if (char === "\\") {
          if (next === "\n") result += "\n";
          i += 2;
        } else {
          if (char === "\n") result += "\n";
          i++;
        }
        continue;
      }
      if (char === "/" && next === "/") {
        i += 2;
        while (i < len && code[i] !== "\n") i++;
        continue;
      }
      if (char === "/" && next === "*") {
        i += 2;
        while (i < len - 1 && !(code[i] === "*" && code[i + 1] === "/")) {
          if (code[i] === "\n") result += "\n";
          i++;
        }
        i += 2;
        continue;
      }
      if (char === '"' || char === "'") {
        const quote = char;
        i++;
        while (i < len && code[i] !== quote) {
          if (code[i] === "\\") {
            i++;
            if (i < len && code[i] === "\n") result += "\n";
          } else if (code[i] === "\n") {
            result += "\n";
          }
          i++;
        }
        i++;
        continue;
      }
      if (char === "/" && next !== "/" && next !== "*" && canBeRegex()) {
        i++;
        let inClass = false;
        while (i < len) {
          if (code[i] === "/" && !inClass) break;
          if (code[i] === "\\") {
            i++;
          } else if (code[i] === "[") {
            inClass = true;
          } else if (code[i] === "]") {
            inClass = false;
          }
          i++;
        }
        i++;
        while (i < len && /[gimsuy]/.test(code[i])) i++;
        continue;
      }
      if (char === "{") {
        stack.push("I");
        result += "{";
        i++;
      } else if (char === "}") {
        if (stack.length > 1 && currentMode === "I") {
          stack.pop();
        }
        result += "}";
        i++;
      } else if (char === "`") {
        stack.push("T");
        i++;
      } else {
        result += char;
        i++;
      }
    }
    return { result, finalStack: stack };
  }
  function checkBrackets(code) {
    const stack = [];
    const pairs = { ")": "(", "]": "[", "}": "{" };
    const opens = /* @__PURE__ */ new Set(["(", "[", "{"]);
    const closes = /* @__PURE__ */ new Set([")", "]", "}"]);
    let line = 1;
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      if (ch === "\n") line++;
      if (opens.has(ch)) {
        stack.push({ char: ch, line });
      } else if (closes.has(ch)) {
        if (stack.length === 0) {
          return { valid: false, error: `\u7B2C ${line} \u884C: \u591A\u4F59\u7684 '${ch}'` };
        }
        const last = stack.pop();
        if (last.char !== pairs[ch]) {
          return { valid: false, error: `\u7B2C ${line} \u884C: '${ch}' \u4E0E '${last.char}' (\u7B2C ${last.line} \u884C) \u4E0D\u5339\u914D` };
        }
      }
    }
    if (stack.length > 0) {
      const unclosed = stack[stack.length - 1];
      return { valid: false, error: `\u7B2C ${unclosed.line} \u884C: '${unclosed.char}' \u672A\u95ED\u5408` };
    }
    return { valid: true };
  }

  // src/core/patcher/index.js
  function tryReplace(content, search, replace, filePath = "") {
    const originalEnding = detectLineEnding(content);
    const normalizedContent = normalizeLineEnding(content);
    const normalizedSearch = normalizeLineEnding(search);
    const normalizedReplace = normalizeLineEnding(replace);
    const alreadyApplied = isAlreadyApplied(normalizedContent, normalizedSearch, normalizedReplace);
    console.log("[Patcher] isAlreadyApplied:", alreadyApplied);
    if (alreadyApplied) {
      return {
        success: false,
        reason: "\u8865\u4E01\u5DF2\u5E94\u7528\u8FC7\uFF0C\u65E0\u9700\u91CD\u590D\u64CD\u4F5C",
        alreadyApplied: true
      };
    }
    const isPython = filePath.endsWith(".py");
    const matchCount = countMatches(normalizedContent, normalizedSearch, isPython);
    console.log("[Patcher] matchCount:", matchCount);
    if (matchCount === 0) {
      return { success: false, reason: "\u672A\u627E\u5230\u5339\u914D" };
    }
    if (matchCount > 1) {
      console.log("[Patcher] \u62E6\u622A\uFF1A\u5B58\u5728\u591A\u5904\u5339\u914D");
      return {
        success: false,
        reason: `\u5B58\u5728 ${matchCount} \u5904\u76F8\u540C\u4EE3\u7801\u5757\uFF0C\u8BF7\u63D0\u4F9B\u66F4\u591A\u4E0A\u4E0B\u6587\u4EE5\u786E\u4FDD\u552F\u4E00\u5339\u914D`,
        matchCount
      };
    }
    const { masked: maskedReplace, literals } = extractLiterals(normalizedReplace);
    const contentSigs = getLogicSignature(normalizedContent);
    const searchSigs = getLogicSignature(normalizedSearch);
    const lines = normalizedContent.split("\n");
    const matchPhysicalStart = findMatchPosition(contentSigs, searchSigs, isPython);
    if (matchPhysicalStart !== -1) {
      const startIdx = contentSigs.findIndex((s) => s.originalIndex === matchPhysicalStart);
      const searchSigsInFile = contentSigs.slice(startIdx, startIdx + searchSigs.length);
      const matchPhysicalEnd = searchSigsInFile[searchSigsInFile.length - 1].originalIndex;
      const physicalLineCount = matchPhysicalEnd - matchPhysicalStart + 1;
      const alignedReplace = alignIndent(lines, matchPhysicalStart, normalizedSearch.split("\n"), maskedReplace);
      const restoredReplace = alignedReplace.map((line) => restoreLiterals(line, literals));
      const before = lines.slice(0, matchPhysicalStart);
      const after = lines.slice(matchPhysicalEnd + 1);
      const result = [...before, ...restoredReplace, ...after].join("\n");
      const finalContent = restoreLineEnding(result, originalEnding);
      const syntax = checkJsSyntax(finalContent, filePath);
      if (!syntax.valid) {
        return {
          success: false,
          reason: `\u8865\u4E01\u5E94\u7528\u540E\u5C06\u5BFC\u81F4\u8BED\u6CD5\u9519\u8BEF\uFF1A${syntax.error}`,
          isSyntaxError: true,
          errorDetails: syntax.error
        };
      }
      return {
        success: true,
        content: finalContent,
        matchLine: matchPhysicalStart + 1,
        lineCount: physicalLineCount
      };
    }
    const fuzzyResult = fuzzyReplace(normalizedContent, normalizedSearch, maskedReplace, literals, isPython);
    if (fuzzyResult) {
      if (fuzzyResult.ambiguity) {
        console.log("[Patcher] \u62E6\u622A\uFF1A\u6A21\u7CCA\u5339\u914D\u5B58\u5728\u591A\u5904");
        return {
          success: false,
          reason: `\u6A21\u7CCA\u5339\u914D\u5230 ${fuzzyResult.matchCount} \u5904\u76F8\u4F3C\u4EE3\u7801\u5757\uFF0C\u8BF7\u63D0\u4F9B\u66F4\u591A\u4E0A\u4E0B\u6587\uFF08\u5982\u51FD\u6570\u540D\u6216\u6CE8\u91CA\uFF09\u4EE5\u786E\u4FDD\u552F\u4E00\u5339\u914D`,
          matchCount: fuzzyResult.matchCount
        };
      }
      const finalContent = restoreLineEnding(fuzzyResult.content, originalEnding);
      const syntax = checkJsSyntax(finalContent, filePath);
      if (!syntax.valid) {
        return {
          success: false,
          reason: `\u8865\u4E01\u5E94\u7528\u540E\u5C06\u5BFC\u81F4\u8BED\u6CD5\u9519\u8BEF\uFF1A${syntax.error}`,
          isSyntaxError: true,
          errorDetails: syntax.error
        };
      }
      return {
        success: true,
        content: finalContent,
        matchLine: fuzzyResult.matchLine,
        lineCount: fuzzyResult.lineCount
      };
    }
    return { success: false, reason: "\u672A\u627E\u5230\u5339\u914D" };
  }
  function fuzzyReplace(content, search, maskedReplace, literals, isStrictIndent = false) {
    if (!search || !search.trim()) return null;
    const lines = content.split("\n");
    const searchLines = search.replace(/\r\n/g, "\n").split("\n");
    const matches = [];
    const searchSigs = isStrictIndent ? getLogicSignature(search) : null;
    for (let i = 0; i <= lines.length - searchLines.length; i++) {
      let match = true;
      for (let j = 0; j < searchLines.length; j++) {
        const lineTrim = lines[i + j].trim();
        const searchTrim = searchLines[j].trim();
        if (searchTrim === "") {
          if (lineTrim !== "") {
            match = false;
            break;
          }
        } else if (lineTrim !== searchTrim) {
          match = false;
          break;
        }
      }
      if (match && isStrictIndent && searchSigs) {
        const segment = lines.slice(i, i + searchLines.length).join("\n");
        const contentSigs = getLogicSignature(segment);
        if (!checkMatchAt(contentSigs, searchSigs, 0, true)) {
          match = false;
        }
      }
      if (match) {
        matches.push(i);
      }
    }
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      return { ambiguity: true, matchCount: matches.length };
    }
    const matchIndex = matches[0];
    const before = lines.slice(0, matchIndex);
    const after = lines.slice(matchIndex + searchLines.length);
    const alignedReplace = alignIndent(lines, matchIndex, searchLines, maskedReplace);
    const restoredReplace = alignedReplace.map((line) => restoreLiterals(line, literals));
    return {
      content: [...before, ...restoredReplace, ...after].join("\n"),
      matchLine: matchIndex + 1,
      lineCount: searchLines.length
    };
  }

  // src/core/state.js
  var STORAGE_KEY = "ide-applied-patches";
  function getPatchKey(file, search) {
    const content = file + ":" + search.slice(0, 100);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash = hash & hash;
    }
    return "patch_" + Math.abs(hash).toString(36);
  }
  function markAsApplied(file, search) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const key = getPatchKey(file, search);
      data[key] = { file, timestamp: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[IDE] \u4FDD\u5B58\u5E94\u7528\u8BB0\u5F55\u5931\u8D25", e);
    }
  }
  function unmarkAsApplied(file, search) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const key = getPatchKey(file, search);
      delete data[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[IDE] \u79FB\u9664\u5E94\u7528\u8BB0\u5F55\u5931\u8D25", e);
    }
  }
  async function checkIfApplied(file, search, replace, fsModule) {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const key = getPatchKey(file, search);
      const hasRecord = !!data[key];
      if (fsModule.hasFile(file)) {
        const content = await fsModule.readFile(file);
        if (content !== null) {
          const normalize = (s) => s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
          const normalizedContent = normalize(content);
          const normalizedSearch = normalize(search);
          const normalizedReplace = normalize(replace);
          const searchExists = normalizedContent.includes(normalizedSearch);
          const replaceExists = normalizedContent.includes(normalizedReplace);
          if (searchExists) {
            if (hasRecord) {
              unmarkAsApplied(file, search);
            }
            return { applied: false, confident: true };
          }
          if (replaceExists) {
            if (!hasRecord) {
              markAsApplied(file, search);
            }
            return { applied: true, confident: true };
          }
          if (hasRecord) {
            unmarkAsApplied(file, search);
          }
        }
      }
      return { applied: false, confident: false };
    } catch (e) {
      return { applied: false, confident: false };
    }
  }

  // src/shared/theme.js
  function detectTheme() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      const brightness = (r * 299 + g * 587 + b * 114) / 1e3;
      return brightness < 128 ? "dark" : "light";
    }
    return "dark";
  }
  function getThemeCSS(theme) {
    const common = `
        .ide-glass { backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
        .ide-tree-item { transition: background 0.1s ease; border-radius: 4px; }
        .ide-tree-item:hover { background: var(--ide-hover) !important; }
        #ide-tree-container::-webkit-scrollbar { width: 4px; }
        #ide-tree-container::-webkit-scrollbar-track { background: transparent; }
        #ide-tree-container::-webkit-scrollbar-thumb { background: var(--ide-border); border-radius: 2px; }
        .ide-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        
        @keyframes ideFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ideScaleIn { from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

        .ide-highlight {
            background: rgba(255, 255, 0, 0.3);
            color: inherit;
            border-radius: 2px;
            font-weight: bold;
        }

        .ide-btn {
            background: transparent;
            color: var(--ide-text);
            border: 1px solid var(--ide-border);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            flex: 1;
        }
        .ide-btn:hover {
            background: var(--ide-hover);
            border-color: var(--ide-text-secondary);
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .ide-btn:active { transform: translateY(0); }
        
        .ide-btn.primary {
            color: var(--ide-accent);
            border-color: var(--ide-accent);
        }
        .ide-btn.primary:hover {
            background: var(--ide-accent);
            color: #fff !important;
        }
    `;
    if (theme === "light") {
      return `
            :root { 
                --ide-bg: #f0f4f9;
                --ide-border: #dfe4ec;
                --ide-text: #1f1f1f;
                --ide-text-secondary: #444746;
                --ide-text-file: #1f1f1f;
                --ide-text-folder: #0b57d0;
                --ide-hover: rgba(0, 0, 0, 0.06);
                --ide-shadow: 0 4px 24px rgba(0,0,0,0.08);
                --ide-hint-bg: #e3e3e3; 
                --ide-hint-text: #0b57d0;
                --ide-accent: #0b57d0;
            }
            ${common}
        `;
    }
    return `
        :root { 
            --ide-bg: rgba(30, 31, 32, 0.88); 
            --ide-border: #444746; 
            --ide-text: #e3e3e3;
            --ide-text-secondary: #c4c7c5;
            --ide-text-file: #e3e3e3;
            --ide-text-folder: #a8c7fa;
            --ide-hover: rgba(255, 255, 255, 0.08);
            --ide-shadow: 0 4px 24px rgba(0,0,0,0.4);
            --ide-hint-bg: #363739;
            --ide-hint-text: #d3e3fd;
            --ide-accent: #a8c7fa;
        }
        ${common}
    `;
  }
  function updateTheme() {
    const style = document.getElementById("ide-theme-style");
    if (style) {
      const theme = detectTheme();
      const newCSS = getThemeCSS(theme);
      if (style.textContent !== newCSS) {
        style.textContent = newCSS;
      }
    }
  }
  function initThemeStyle() {
    const style = document.createElement("style");
    style.id = "ide-theme-style";
    style.textContent = getThemeCSS(detectTheme());
    return style;
  }
  function initThemeWatcher() {
    const observer = new MutationObserver(() => updateTheme());
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme"]
    });
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => updateTheme());
  }

  // src/dialog/preview.js
  var UndoStack = class {
    constructor(maxSize = 50) {
      this._stack = [];
      this._index = -1;
      this._maxSize = maxSize;
    }
    push(state) {
      this._stack = this._stack.slice(0, this._index + 1);
      this._stack.push(state);
      if (this._stack.length > this._maxSize) {
        this._stack.shift();
      } else {
        this._index++;
      }
    }
    undo() {
      if (!this.canUndo()) return null;
      this._index--;
      return this._stack[this._index];
    }
    redo() {
      if (!this.canRedo()) return null;
      this._index++;
      return this._stack[this._index];
    }
    canUndo() {
      return this._index > 0;
    }
    canRedo() {
      return this._index < this._stack.length - 1;
    }
    current() {
      return this._stack[this._index] || null;
    }
  };
  function getCaretPosition(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const prefix = range.cloneRange();
    prefix.selectNodeContents(el);
    prefix.setEnd(range.endContainer, range.endOffset);
    return prefix.toString().length;
  }
  function setCaretPosition(el, pos) {
    const sel = window.getSelection();
    let charCount = 0;
    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCount = charCount + node.length;
        if (pos <= nextCount) {
          const range = document.createRange();
          range.setStart(node, pos - charCount);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return true;
        }
        charCount = nextCount;
      } else {
        for (const child of node.childNodes) {
          if (traverse(child)) return true;
        }
      }
      return false;
    }
    traverse(el);
  }
  function getDiffColors() {
    const theme = detectTheme();
    if (theme === "light") {
      return {
        // 删除行
        deleteBg: "#ffd7d5",
        deleteText: "#82071e",
        deleteCharBg: "#ff8182",
        deleteCharText: "#ffffff",
        // 新增行
        insertBg: "#d1f4d1",
        insertText: "#055d20",
        insertCharBg: "#4fb04f",
        insertCharText: "#ffffff",
        // 修改行
        modifyBg: "#fff4ce",
        // 空白行
        emptyBg: "#f6f8fa",
        // 相同行透明度
        equalOpacity: "0.5"
      };
    } else {
      return {
        // 删除行
        deleteBg: "#4b1818",
        deleteText: "#ffa8a8",
        deleteCharBg: "#c44444",
        deleteCharText: "#ffffff",
        // 新增行
        insertBg: "#1a4d1a",
        insertText: "#a8ffa8",
        insertCharBg: "#44c444",
        insertCharText: "#ffffff",
        // 修改行
        modifyBg: "#3d2a1a",
        // 空白行
        emptyBg: "rgba(0, 0, 0, 0.1)",
        // 相同行透明度
        equalOpacity: "0.6"
      };
    }
  }
  function computeLineDiff(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    for (let i2 = 0; i2 <= m; i2++) dp[i2][0] = i2;
    for (let j2 = 0; j2 <= n; j2++) dp[0][j2] = j2;
    for (let i2 = 1; i2 <= m; i2++) {
      for (let j2 = 1; j2 <= n; j2++) {
        if (oldLines[i2 - 1] === newLines[j2 - 1]) {
          dp[i2][j2] = dp[i2 - 1][j2 - 1];
        } else {
          dp[i2][j2] = 1 + Math.min(
            dp[i2 - 1][j2],
            // 删除
            dp[i2][j2 - 1],
            // 插入
            dp[i2 - 1][j2 - 1]
            // 替换
          );
        }
      }
    }
    const diffs = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        diffs.unshift({ type: "equal", oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
        i--;
        j--;
      } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
        diffs.unshift({ type: "modify", oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
        i--;
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
        diffs.unshift({ type: "delete", oldLine: oldLines[i - 1] });
        i--;
      } else {
        diffs.unshift({ type: "insert", newLine: newLines[j - 1] });
        j--;
      }
    }
    return diffs;
  }
  function computeCharDiff(oldText, newText) {
    const oldChars = Array.from(oldText);
    const newChars = Array.from(newText);
    const m = oldChars.length;
    const n = newChars.length;
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    for (let i2 = 0; i2 <= m; i2++) dp[i2][0] = i2;
    for (let j2 = 0; j2 <= n; j2++) dp[0][j2] = j2;
    for (let i2 = 1; i2 <= m; i2++) {
      for (let j2 = 1; j2 <= n; j2++) {
        if (oldChars[i2 - 1] === newChars[j2 - 1]) {
          dp[i2][j2] = dp[i2 - 1][j2 - 1];
        } else {
          dp[i2][j2] = 1 + Math.min(dp[i2 - 1][j2], dp[i2][j2 - 1], dp[i2 - 1][j2 - 1]);
        }
      }
    }
    const diffs = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
        diffs.unshift({ type: "equal", value: oldChars[i - 1] });
        i--;
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
        diffs.unshift({ type: "delete", value: oldChars[i - 1] });
        i--;
      } else {
        diffs.unshift({ type: "insert", value: newChars[j - 1] });
        j--;
      }
    }
    return diffs;
  }
  function renderHighlightedLine(charDiffs, type, colors) {
    const span = document.createElement("span");
    charDiffs.forEach((diff) => {
      if (type === "old" && diff.type === "insert") return;
      if (type === "new" && diff.type === "delete") return;
      const part = document.createElement("span");
      part.textContent = diff.value;
      if (type === "old" && diff.type === "delete") {
        part.style.backgroundColor = colors.deleteCharBg;
        part.style.color = colors.deleteCharText;
        part.style.fontWeight = "700";
        part.style.padding = "0 1px";
        part.style.borderRadius = "2px";
      } else if (type === "new" && diff.type === "insert") {
        part.style.backgroundColor = colors.insertCharBg;
        part.style.color = colors.insertCharText;
        part.style.fontWeight = "700";
        part.style.padding = "0 1px";
        part.style.borderRadius = "2px";
      } else {
        part.style.color = type === "old" ? colors.deleteText : colors.insertText;
        part.style.opacity = colors.equalOpacity;
      }
      span.appendChild(part);
    });
    return span;
  }
  function showPreviewDialog(file, oldText, newText, startLine = 1, syntaxError = null) {
    return new Promise((resolve) => {
      let editedContent = newText;
      const undoStack = new UndoStack();
      undoStack.push({ content: newText, cursor: 0 });
      let updateUndoButtons = () => {
      };
      const backdrop = document.createElement("div");
      backdrop.id = "ide-modal-backdrop";
      Object.assign(backdrop.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: "2147483648",
        animation: "ideFadeIn 0.2s ease-out"
      });
      const dialog = document.createElement("div");
      dialog.id = "ide-preview-dialog";
      Object.assign(dialog.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "var(--ide-bg)",
        color: "var(--ide-text)",
        border: "1px solid var(--ide-border)",
        borderRadius: "12px",
        padding: "24px",
        zIndex: "2147483649",
        width: "90vw",
        maxWidth: "1400px",
        height: "85vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        animation: "ideScaleIn 0.2s ease-out"
      });
      const header = document.createElement("div");
      Object.assign(header.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: syntaxError ? "12px" : "20px",
        paddingBottom: "16px",
        borderBottom: "1px solid var(--ide-border)"
      });
      const titleGroup = document.createElement("div");
      const titleIcon = document.createElement("span");
      titleIcon.textContent = syntaxError ? "\u26A0\uFE0F" : "\u{1F4DD}";
      titleIcon.style.marginRight = "8px";
      const titleText = document.createElement("span");
      titleText.textContent = `${syntaxError ? "\u5F3A\u5236\u9884\u89C8" : "\u53D8\u66F4\u9884\u89C8"}: ${file}`;
      titleText.style.fontSize = "18px";
      titleText.style.fontWeight = "600";
      titleGroup.appendChild(titleIcon);
      titleGroup.appendChild(titleText);
      const modeGroup = document.createElement("div");
      Object.assign(modeGroup.style, { display: "flex", gap: "8px", alignItems: "center" });
      const diffModeBtn = document.createElement("button");
      diffModeBtn.textContent = "\u{1F4CA} Diff";
      const editModeBtn = document.createElement("button");
      editModeBtn.textContent = "\u270F\uFE0F \u7F16\u8F91";
      [diffModeBtn, editModeBtn].forEach((btn) => {
        Object.assign(btn.style, {
          padding: "4px 10px",
          borderRadius: "4px",
          cursor: "pointer",
          border: "1px solid var(--ide-border)",
          fontSize: "12px"
        });
      });
      diffModeBtn.style.background = "var(--ide-accent)";
      diffModeBtn.style.color = "#fff";
      editModeBtn.style.background = "transparent";
      editModeBtn.style.color = "var(--ide-text)";
      const undoBtn = document.createElement("button");
      undoBtn.textContent = "\u21A9\uFE0F";
      undoBtn.title = "Ctrl+Z \u64A4\u9500";
      const redoBtn = document.createElement("button");
      redoBtn.textContent = "\u21AA\uFE0F";
      redoBtn.title = "Ctrl+Y \u91CD\u505A";
      [undoBtn, redoBtn].forEach((btn) => {
        Object.assign(btn.style, {
          padding: "4px 8px",
          borderRadius: "4px",
          cursor: "pointer",
          border: "1px solid var(--ide-border)",
          fontSize: "12px",
          background: "transparent",
          color: "var(--ide-text)",
          opacity: "0.4",
          display: "none"
          // 默认隐藏，编辑模式显示
        });
      });
      updateUndoButtons = () => {
        undoBtn.style.opacity = undoStack.canUndo() ? "1" : "0.4";
        redoBtn.style.opacity = undoStack.canRedo() ? "1" : "0.4";
      };
      modeGroup.appendChild(diffModeBtn);
      modeGroup.appendChild(editModeBtn);
      modeGroup.appendChild(undoBtn);
      modeGroup.appendChild(redoBtn);
      header.appendChild(titleGroup);
      header.appendChild(modeGroup);
      dialog.appendChild(header);
      let currentMode = "diff";
      if (syntaxError) {
        const warningBanner = document.createElement("div");
        Object.assign(warningBanner.style, {
          padding: "12px 16px",
          marginBottom: "16px",
          background: "rgba(220, 38, 38, 0.15)",
          border: "1px solid #dc2626",
          borderRadius: "8px",
          color: "#ef4444",
          fontSize: "13px"
        });
        const strongEl = document.createElement("strong");
        strongEl.textContent = "\u{1F6A8} \u8BED\u6CD5\u6821\u9A8C\u8B66\u544A\uFF1A";
        warningBanner.appendChild(strongEl);
        const errorText = document.createTextNode(syntaxError);
        warningBanner.appendChild(errorText);
        warningBanner.appendChild(document.createElement("br"));
        const hintSpan = document.createElement("span");
        hintSpan.style.color = "var(--ide-text-secondary)";
        hintSpan.style.fontSize = "12px";
        hintSpan.textContent = "\u8BF7\u4ED4\u7EC6\u6838\u5BF9\u4EE3\u7801\u5B8C\u6574\u6027\u540E\u518D\u786E\u8BA4\u5E94\u7528\u3002";
        warningBanner.appendChild(hintSpan);
        dialog.appendChild(warningBanner);
      }
      const diffBody = document.createElement("div");
      Object.assign(diffBody.style, {
        flex: "1",
        display: "flex",
        gap: "0",
        overflow: "hidden",
        minHeight: "0",
        border: "1px solid var(--ide-border)",
        borderRadius: "8px"
      });
      const oldLines = oldText.split("\n");
      const newLines = newText.split("\n");
      const lineDiffs = computeLineDiff(oldLines, newLines);
      const colors = getDiffColors();
      const createSidePanel = (side, mode) => {
        const panel = document.createElement("div");
        Object.assign(panel.style, {
          flex: "1",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--ide-hint-bg)",
          borderRight: side === "left" ? "1px solid var(--ide-border)" : "none"
        });
        const panelHeader = document.createElement("div");
        if (mode === "diff") {
          panelHeader.textContent = side === "left" ? "\uFFFD \u539F\u59CB(\u4EE3\u7801 (SEARCH)" : "\u{1F7E2} \u4FEE\u6539\u540E\u4EE3\u7801 (REPLACE)";
        } else {
          panelHeader.textContent = side === "left" ? "\u{1F534} \u539F\u59CB\u4EE3\u7801 (\u53EA\u8BFB)" : "\u{1F7E2} \u4FEE\u6539\u540E\u4EE3\u7801 (\u53EF\u7F16\u8F91) \u270F\uFE0F";
        }
        Object.assign(panelHeader.style, {
          padding: "10px 16px",
          fontSize: "12px",
          fontWeight: "bold",
          background: side === "left" ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
          color: side === "left" ? "#ef4444" : "#22c55e",
          borderBottom: "1px solid var(--ide-border)"
        });
        const codeContainer = document.createElement("div");
        Object.assign(codeContainer.style, {
          flex: "1",
          display: "flex",
          overflow: "auto",
          fontFamily: '"JetBrains Mono", Consolas, monospace',
          fontSize: "13px",
          lineHeight: "1.6"
        });
        const lineNumbers = document.createElement("div");
        Object.assign(lineNumbers.style, {
          padding: "16px 12px 16px 16px",
          textAlign: "right",
          color: "var(--ide-text-secondary)",
          userSelect: "none",
          borderRight: "1px solid var(--ide-border)",
          background: "rgba(0, 0, 0, 0.1)",
          minWidth: "50px"
        });
        const codeArea = document.createElement("div");
        Object.assign(codeArea.style, {
          flex: "1",
          padding: "16px",
          overflow: "visible",
          color: "var(--ide-text)",
          whiteSpace: "pre"
        });
        if (mode === "edit" && side === "right") {
          codeArea.contentEditable = "plaintext-only";
          codeArea.style.outline = "none";
          codeArea.style.cursor = "text";
          codeArea.style.minHeight = "100%";
          let isComposing = false;
          let saveTimeout = null;
          const saveState = () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
              const cursor = getCaretPosition(codeArea);
              undoStack.push({ content: codeArea.textContent, cursor });
              updateUndoButtons();
            }, 300);
          };
          codeArea.addEventListener("compositionstart", () => {
            isComposing = true;
          });
          codeArea.addEventListener("compositionend", () => {
            isComposing = false;
            saveState();
            editedContent = codeArea.textContent;
            updateLineNumbers(lineNumbers, editedContent, startLine);
          });
          codeArea.addEventListener("input", () => {
            if (!isComposing) {
              saveState();
              editedContent = codeArea.textContent;
              updateLineNumbers(lineNumbers, editedContent, startLine);
            }
          });
          codeArea.addEventListener("keydown", (e) => {
            if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              document.execCommand("insertText", false, "    ");
            }
            if (e.key === "Tab" && e.shiftKey) {
              e.preventDefault();
              const sel = window.getSelection();
              if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                const text = codeArea.textContent;
                const pos = getCaretPosition(codeArea);
                let lineStart = text.lastIndexOf("\n", pos - 1) + 1;
                if (text.substring(lineStart, lineStart + 4) === "    ") {
                  codeArea.textContent = text.substring(0, lineStart) + text.substring(lineStart + 4);
                  setCaretPosition(codeArea, Math.max(lineStart, pos - 4));
                  editedContent = codeArea.textContent;
                  updateLineNumbers(lineNumbers, editedContent, startLine);
                  saveState();
                }
              }
            }
            if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
              e.preventDefault();
              const state = undoStack.undo();
              if (state) {
                codeArea.textContent = state.content;
                setCaretPosition(codeArea, state.cursor);
                editedContent = state.content;
                updateLineNumbers(lineNumbers, editedContent, startLine);
                updateUndoButtons();
              }
            }
            if (e.ctrlKey && e.key === "y" || e.ctrlKey && e.shiftKey && e.key === "z") {
              e.preventDefault();
              const state = undoStack.redo();
              if (state) {
                codeArea.textContent = state.content;
                setCaretPosition(codeArea, state.cursor);
                editedContent = state.content;
                updateLineNumbers(lineNumbers, editedContent, startLine);
                updateUndoButtons();
              }
            }
          });
        }
        panel.appendChild(panelHeader);
        codeContainer.appendChild(lineNumbers);
        codeContainer.appendChild(codeArea);
        panel.appendChild(codeContainer);
        return { panel, lineNumbers, codeArea };
      };
      const updateLineNumbers = (lineNumbersEl, content, baseLineNum) => {
        const lines = content.split("\n");
        while (lineNumbersEl.firstChild) {
          lineNumbersEl.removeChild(lineNumbersEl.firstChild);
        }
        lines.forEach((_, idx) => {
          const lineDiv = document.createElement("div");
          lineDiv.textContent = String(baseLineNum + idx);
          lineNumbersEl.appendChild(lineDiv);
        });
      };
      const renderContent = (mode) => {
        while (diffBody.firstChild) {
          diffBody.removeChild(diffBody.firstChild);
        }
        const leftPanel = createSidePanel("left", mode);
        const rightPanel = createSidePanel("right", mode);
        if (mode === "diff") {
          let leftLineNum = startLine;
          let rightLineNum = startLine;
          lineDiffs.forEach((diff) => {
            const leftLineDiv = document.createElement("div");
            const rightLineDiv = document.createElement("div");
            const leftCodeDiv = document.createElement("div");
            const rightCodeDiv = document.createElement("div");
            if (diff.type === "equal") {
              leftLineDiv.textContent = String(leftLineNum++);
              rightLineDiv.textContent = String(rightLineNum++);
              leftCodeDiv.textContent = diff.oldLine;
              rightCodeDiv.textContent = diff.newLine;
              leftCodeDiv.style.opacity = colors.equalOpacity;
              rightCodeDiv.style.opacity = colors.equalOpacity;
            } else if (diff.type === "delete") {
              leftLineDiv.textContent = String(leftLineNum++);
              rightLineDiv.textContent = "";
              leftCodeDiv.textContent = diff.oldLine;
              leftCodeDiv.style.backgroundColor = colors.deleteBg;
              leftCodeDiv.style.color = colors.deleteText;
              rightCodeDiv.style.backgroundColor = colors.emptyBg;
              rightCodeDiv.style.minHeight = "1.6em";
            } else if (diff.type === "insert") {
              leftLineDiv.textContent = "";
              rightLineDiv.textContent = String(rightLineNum++);
              leftCodeDiv.style.backgroundColor = colors.emptyBg;
              leftCodeDiv.style.minHeight = "1.6em";
              rightCodeDiv.textContent = diff.newLine;
              rightCodeDiv.style.backgroundColor = colors.insertBg;
              rightCodeDiv.style.color = colors.insertText;
            } else if (diff.type === "modify") {
              leftLineDiv.textContent = String(leftLineNum++);
              rightLineDiv.textContent = String(rightLineNum++);
              const charDiffs = computeCharDiff(diff.oldLine, diff.newLine);
              leftCodeDiv.appendChild(renderHighlightedLine(charDiffs, "old", colors));
              rightCodeDiv.appendChild(renderHighlightedLine(charDiffs, "new", colors));
              leftCodeDiv.style.backgroundColor = colors.deleteBg;
              rightCodeDiv.style.backgroundColor = colors.insertBg;
            }
            leftPanel.lineNumbers.appendChild(leftLineDiv);
            leftPanel.codeArea.appendChild(leftCodeDiv);
            rightPanel.lineNumbers.appendChild(rightLineDiv);
            rightPanel.codeArea.appendChild(rightCodeDiv);
          });
        } else {
          let leftLineNum = startLine;
          lineDiffs.forEach((diff) => {
            const leftLineDiv = document.createElement("div");
            const leftCodeDiv = document.createElement("div");
            if (diff.type === "equal") {
              leftLineDiv.textContent = String(leftLineNum++);
              leftCodeDiv.textContent = diff.oldLine;
              leftCodeDiv.style.opacity = colors.equalOpacity;
            } else if (diff.type === "delete") {
              leftLineDiv.textContent = String(leftLineNum++);
              leftCodeDiv.textContent = diff.oldLine;
              leftCodeDiv.style.backgroundColor = colors.deleteBg;
              leftCodeDiv.style.color = colors.deleteText;
            } else if (diff.type === "insert") {
              leftLineDiv.textContent = "";
              leftCodeDiv.style.backgroundColor = colors.emptyBg;
              leftCodeDiv.style.minHeight = "1.6em";
            } else if (diff.type === "modify") {
              leftLineDiv.textContent = String(leftLineNum++);
              const charDiffs = computeCharDiff(diff.oldLine, diff.newLine);
              leftCodeDiv.appendChild(renderHighlightedLine(charDiffs, "old", colors));
              leftCodeDiv.style.backgroundColor = colors.deleteBg;
            }
            leftPanel.lineNumbers.appendChild(leftLineDiv);
            leftPanel.codeArea.appendChild(leftCodeDiv);
          });
          rightPanel.codeArea.textContent = editedContent;
          updateLineNumbers(rightPanel.lineNumbers, editedContent, startLine);
        }
        diffBody.appendChild(leftPanel.panel);
        diffBody.appendChild(rightPanel.panel);
      };
      const switchMode = (mode) => {
        currentMode = mode;
        if (mode === "diff") {
          diffModeBtn.style.background = "var(--ide-accent)";
          diffModeBtn.style.color = "#fff";
          editModeBtn.style.background = "transparent";
          editModeBtn.style.color = "var(--ide-text)";
          undoBtn.style.display = "none";
          redoBtn.style.display = "none";
        } else {
          diffModeBtn.style.background = "transparent";
          diffModeBtn.style.color = "var(--ide-text)";
          editModeBtn.style.background = "var(--ide-accent)";
          editModeBtn.style.color = "#fff";
          undoBtn.style.display = "block";
          redoBtn.style.display = "block";
          updateUndoButtons();
        }
        renderContent(mode);
      };
      diffModeBtn.onclick = () => switchMode("diff");
      editModeBtn.onclick = () => switchMode("edit");
      renderContent("diff");
      const footer = document.createElement("div");
      Object.assign(footer.style, {
        display: "flex",
        justifyContent: "flex-end",
        gap: "12px",
        marginTop: "20px",
        paddingTop: "16px",
        borderTop: "1px solid var(--ide-border)"
      });
      const closeAll = () => {
        backdrop.remove();
        dialog.remove();
      };
      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "\u53D6\u6D88";
      Object.assign(cancelBtn.style, {
        padding: "8px 20px",
        borderRadius: "6px",
        cursor: "pointer",
        background: "transparent",
        border: "1px solid var(--ide-border)",
        color: "var(--ide-text)",
        fontSize: "14px"
      });
      cancelBtn.onmouseover = () => cancelBtn.style.background = "var(--ide-hover)";
      cancelBtn.onmouseout = () => cancelBtn.style.background = "transparent";
      cancelBtn.onclick = () => {
        closeAll();
        resolve({ confirmed: false });
      };
      const confirmBtn = document.createElement("button");
      confirmBtn.textContent = "\u786E\u8BA4\u5E94\u7528\u4FEE\u6539";
      Object.assign(confirmBtn.style, {
        padding: "8px 24px",
        borderRadius: "6px",
        cursor: "pointer",
        background: "var(--ide-accent)",
        color: "#fff",
        border: "none",
        fontSize: "14px",
        fontWeight: "600",
        boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)"
      });
      confirmBtn.onclick = () => {
        closeAll();
        resolve({ confirmed: true, content: editedContent });
      };
      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      dialog.appendChild(diffBody);
      dialog.appendChild(footer);
      document.body.appendChild(backdrop);
      document.body.appendChild(dialog);
    });
  }

  // src/shared/utils.js
  function getLanguage(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const map = {
      js: "javascript",
      ts: "typescript",
      jsx: "jsx",
      tsx: "tsx",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      go: "go",
      rs: "rust",
      rb: "ruby",
      php: "php",
      html: "html",
      css: "css",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      md: "markdown",
      sql: "sql",
      sh: "bash",
      vue: "vue",
      svelte: "svelte",
      xml: "xml",
      env: "bash",
      toml: "toml",
      ini: "ini",
      dockerfile: "dockerfile",
      docker: "dockerfile"
    };
    return map[ext] || "text";
  }
  function estimateTokens(text) {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 3.5);
  }
  function formatTokens(count) {
    if (count >= 1e3) {
      return (count / 1e3).toFixed(1) + "k";
    }
    return count.toString();
  }
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  var activeToasts = [];
  function showToast(message, type = "success") {
    const MAX_TOASTS = 5;
    const TOAST_GAP = 12;
    if (activeToasts.length >= MAX_TOASTS) {
      const oldest = activeToasts.shift();
      if (oldest) {
        oldest.style.opacity = "0";
        oldest.style.transform = `translateY(-20px)`;
        setTimeout(() => oldest.remove(), 300);
      }
    }
    const toast = document.createElement("div");
    toast.className = "ide-toast-item";
    toast.textContent = message;
    const bgColor = type === "success" ? "#059669" : type === "error" ? "#dc2626" : "#2563eb";
    Object.assign(toast.style, {
      position: "fixed",
      left: "30px",
      bottom: "80px",
      background: bgColor,
      color: "white",
      padding: "10px 20px",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "bold",
      zIndex: "2147483647",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      transition: "all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)",
      opacity: "0",
      transform: "translateY(20px)"
    });
    document.body.appendChild(toast);
    activeToasts.push(toast);
    const updatePositions = () => {
      activeToasts.forEach((el, index) => {
        const offset = (activeToasts.length - 1 - index) * (45 + TOAST_GAP);
        el.style.setProperty("--offset", `-${offset}px`);
        el.style.opacity = "1";
        el.style.transform = `translateY(var(--offset)) scale(var(--scale, 1))`;
      });
    };
    requestAnimationFrame(() => updatePositions());
    const duration = type === "error" ? 5e3 : 3e3;
    setTimeout(() => {
      toast.style.setProperty("--scale", "0.9");
      toast.style.opacity = "0";
      setTimeout(() => {
        const index = activeToasts.indexOf(toast);
        if (index > -1) {
          activeToasts.splice(index, 1);
          toast.remove();
          updatePositions();
        }
      }, 400);
    }, duration);
  }

  // src/dialog/history.js
  function formatTime(timestamp) {
    const d = new Date(timestamp);
    const pad = (n) => n.toString().padStart(2, "0");
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024).toFixed(1) + " KB";
  }
  function showHistoryDialog(filePath) {
    return new Promise(async (resolve) => {
      const versions = await fs.getFileHistory(filePath);
      if (versions.length === 0) {
        showToast("\u6682\u65E0\u5386\u53F2\u7248\u672C", "info");
        return resolve(null);
      }
      const existing = document.getElementById("ide-history-dialog");
      if (existing) existing.remove();
      const backdrop = document.createElement("div");
      backdrop.id = "ide-history-backdrop";
      Object.assign(backdrop.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.5)",
        zIndex: "2147483648",
        animation: "ideFadeIn 0.2s ease-out"
      });
      const closeAll = () => {
        backdrop.remove();
        dialog.remove();
        resolve(null);
      };
      backdrop.onclick = closeAll;
      const dialog = document.createElement("div");
      dialog.id = "ide-history-dialog";
      Object.assign(dialog.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "var(--ide-bg)",
        border: "1px solid var(--ide-border)",
        borderRadius: "12px",
        padding: "20px",
        zIndex: "2147483649",
        width: "400px",
        maxHeight: "60vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        animation: "ideScaleIn 0.2s ease-out"
      });
      dialog.onclick = (e) => e.stopPropagation();
      const header = document.createElement("div");
      Object.assign(header.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "16px",
        paddingBottom: "12px",
        borderBottom: "1px solid var(--ide-border)"
      });
      const title = document.createElement("span");
      title.textContent = "\u{1F4DC} \u5386\u53F2\u56DE\u6EAF - " + filePath.split("/").pop();
      Object.assign(title.style, { fontWeight: "bold", color: "var(--ide-text)", fontSize: "15px" });
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "\u2715";
      closeBtn.title = "\u5173\u95ED";
      Object.assign(closeBtn.style, {
        background: "transparent",
        border: "none",
        color: "var(--ide-text-secondary)",
        fontSize: "16px",
        cursor: "pointer",
        padding: "2px 6px"
      });
      closeBtn.onmouseover = () => closeBtn.style.color = "var(--ide-text)";
      closeBtn.onmouseout = () => closeBtn.style.color = "var(--ide-text-secondary)";
      closeBtn.onclick = closeAll;
      header.appendChild(title);
      header.appendChild(closeBtn);
      dialog.appendChild(header);
      const list = document.createElement("div");
      Object.assign(list.style, { flex: "1", overflowY: "auto", paddingRight: "4px" });
      versions.forEach((v) => {
        const item = document.createElement("div");
        Object.assign(item.style, {
          padding: "10px",
          margin: "6px 0",
          background: "var(--ide-hint-bg)",
          borderRadius: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition: "all 0.2s"
        });
        item.className = "ide-tree-item";
        const info = document.createElement("div");
        info.style.display = "flex";
        info.style.flexDirection = "column";
        const time = document.createElement("span");
        time.textContent = formatTime(v.timestamp);
        time.style.color = "var(--ide-text)";
        time.style.fontSize = "13px";
        time.style.fontWeight = "500";
        const size = document.createElement("span");
        size.textContent = formatSize(v.content.length);
        size.style.color = "var(--ide-text-secondary)";
        size.style.fontSize = "11px";
        info.appendChild(time);
        info.appendChild(size);
        const actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "8px";
        const viewBtn = document.createElement("button");
        viewBtn.textContent = "\u{1F19A} \u5BF9\u6BD4";
        viewBtn.title = "\u4E0E\u5F53\u524D\u672C\u5730\u7248\u672C\u5BF9\u6BD4";
        viewBtn.className = "ide-btn";
        Object.assign(viewBtn.style, { padding: "4px 8px", fontSize: "11px", flex: "none" });
        viewBtn.onclick = async () => {
          const currentContent = await fs.readFile(filePath);
          if (currentContent === null) {
            showToast("\u65E0\u6CD5\u8BFB\u53D6\u5F53\u524D\u6587\u4EF6", "error");
            return;
          }
          showHistoryDiff(filePath, v, currentContent);
        };
        const revertBtn = document.createElement("button");
        revertBtn.textContent = "\u56DE\u9000";
        revertBtn.title = "\u56DE\u9000\u5230\u6B64\u7248\u672C";
        Object.assign(revertBtn.style, {
          background: "var(--ide-accent)",
          color: "#fff",
          border: "none",
          padding: "4px 10px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "bold"
        });
        revertBtn.onclick = async () => {
          if (!confirm(`\u786E\u5B9A\u56DE\u9000\u5230 ${formatTime(v.timestamp)} \u7684\u7248\u672C\uFF1F`)) return;
          const result = await fs.revertToVersion(filePath, v.timestamp);
          if (result.success) {
            showToast("\u2705 \u5DF2\u56DE\u9000");
            closeAll();
          }
        };
        actions.appendChild(viewBtn);
        actions.appendChild(revertBtn);
        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);
      });
      dialog.appendChild(list);
      document.body.appendChild(backdrop);
      document.body.appendChild(dialog);
    });
  }
  function showHistoryDiff(filePath, version, currentContent) {
    var _a;
    const backdrop = document.createElement("div");
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(4px)",
      zIndex: "2147483650",
      animation: "ideFadeIn 0.2s ease-out"
    });
    const closeAll = () => {
      backdrop.remove();
      container.remove();
    };
    backdrop.onclick = closeAll;
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "90vw",
      maxWidth: "1200px",
      height: "85vh",
      background: "var(--ide-bg)",
      border: "1px solid var(--ide-border)",
      borderRadius: "12px",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      zIndex: "2147483651",
      animation: "ideScaleIn 0.2s ease-out"
    });
    container.onclick = (e) => e.stopPropagation();
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "16px 24px",
      borderBottom: "1px solid var(--ide-border)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    });
    const titleText = document.createElement("div");
    titleText.textContent = `\u{1F19A} \u7248\u672C\u5BF9\u6BD4: ${filePath.split("/").pop()}`;
    Object.assign(titleText.style, { fontWeight: "600", color: "var(--ide-text)", fontSize: "16px" });
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    closeBtn.title = "\u5173\u95ED (\u70B9\u51FB\u7A7A\u767D\u5904\u4E5F\u53EF\u5173\u95ED)";
    Object.assign(closeBtn.style, {
      background: "transparent",
      border: "none",
      color: "var(--ide-text-secondary)",
      fontSize: "18px",
      cursor: "pointer",
      padding: "4px 8px",
      borderRadius: "4px"
    });
    closeBtn.onmouseover = () => closeBtn.style.color = "var(--ide-text)";
    closeBtn.onmouseout = () => closeBtn.style.color = "var(--ide-text-secondary)";
    closeBtn.onclick = closeAll;
    header.appendChild(titleText);
    header.appendChild(closeBtn);
    const computeLineDiff2 = (oldLines2, newLines2) => {
      const m = oldLines2.length, n = newLines2.length;
      const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
      for (let i2 = 0; i2 <= m; i2++) dp[i2][0] = i2;
      for (let j2 = 0; j2 <= n; j2++) dp[0][j2] = j2;
      for (let i2 = 1; i2 <= m; i2++) {
        for (let j2 = 1; j2 <= n; j2++) {
          if (oldLines2[i2 - 1] === newLines2[j2 - 1]) {
            dp[i2][j2] = dp[i2 - 1][j2 - 1];
          } else {
            dp[i2][j2] = 1 + Math.min(dp[i2 - 1][j2], dp[i2][j2 - 1], dp[i2 - 1][j2 - 1]);
          }
        }
      }
      const diffs = [];
      let i = m, j = n;
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines2[i - 1] === newLines2[j - 1]) {
          diffs.unshift({ type: "equal", oldLine: oldLines2[i - 1], newLine: newLines2[j - 1] });
          i--;
          j--;
        } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
          diffs.unshift({ type: "modify", oldLine: oldLines2[i - 1], newLine: newLines2[j - 1] });
          i--;
          j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
          diffs.unshift({ type: "delete", oldLine: oldLines2[i - 1] });
          i--;
        } else {
          diffs.unshift({ type: "insert", newLine: newLines2[j - 1] });
          j--;
        }
      }
      return diffs;
    };
    const isDark = ((_a = document.body.style.backgroundColor) == null ? void 0 : _a.includes("rgb(")) || getComputedStyle(document.body).backgroundColor !== "rgb(255, 255, 255)";
    const colors = isDark ? {
      deleteBg: "#4b1818",
      deleteText: "#ffa8a8",
      insertBg: "#1a4d1a",
      insertText: "#a8ffa8",
      emptyBg: "rgba(0, 0, 0, 0.1)",
      equalOpacity: "0.6"
    } : {
      deleteBg: "#ffd7d5",
      deleteText: "#82071e",
      insertBg: "#d1f4d1",
      insertText: "#055d20",
      emptyBg: "#f6f8fa",
      equalOpacity: "0.5"
    };
    const oldLines = version.content.split("\n");
    const newLines = currentContent.split("\n");
    const lineDiffs = computeLineDiff2(oldLines, newLines);
    const body = document.createElement("div");
    Object.assign(body.style, {
      flex: "1",
      display: "flex",
      overflow: "hidden"
    });
    const createPane = (side) => {
      const pane = document.createElement("div");
      Object.assign(pane.style, {
        flex: "1",
        display: "flex",
        flexDirection: "column",
        borderRight: side === "left" ? "1px solid var(--ide-border)" : "none",
        overflow: "hidden",
        background: "var(--ide-hint-bg)"
      });
      const paneHeader = document.createElement("div");
      paneHeader.textContent = side === "left" ? `\u{1F570}\uFE0F \u5386\u53F2\u7248\u672C (${formatTime(version.timestamp)})` : "\u{1F4BB} \u5F53\u524D\u672C\u5730\u7248\u672C";
      Object.assign(paneHeader.style, {
        padding: "10px 16px",
        fontSize: "12px",
        fontWeight: "bold",
        background: side === "left" ? "rgba(234, 179, 8, 0.1)" : "rgba(59, 130, 246, 0.1)",
        color: side === "left" ? "#eab308" : "#3b82f6",
        borderBottom: "1px solid var(--ide-border)"
      });
      const codeContainer = document.createElement("div");
      Object.assign(codeContainer.style, {
        flex: "1",
        display: "flex",
        overflow: "auto",
        fontFamily: '"JetBrains Mono", Consolas, monospace',
        fontSize: "13px",
        lineHeight: "1.6"
      });
      const lineNumbers = document.createElement("div");
      Object.assign(lineNumbers.style, {
        padding: "16px 12px 16px 16px",
        textAlign: "right",
        color: "var(--ide-text-secondary)",
        userSelect: "none",
        borderRight: "1px solid var(--ide-border)",
        background: "rgba(0, 0, 0, 0.1)",
        minWidth: "50px"
      });
      const codeArea = document.createElement("div");
      Object.assign(codeArea.style, {
        flex: "1",
        padding: "16px",
        whiteSpace: "pre",
        color: "var(--ide-text)"
      });
      pane.appendChild(paneHeader);
      codeContainer.appendChild(lineNumbers);
      codeContainer.appendChild(codeArea);
      pane.appendChild(codeContainer);
      return { pane, lineNumbers, codeArea };
    };
    const leftPane = createPane("left");
    const rightPane = createPane("right");
    let leftLineNum = 1, rightLineNum = 1;
    lineDiffs.forEach((diff) => {
      const leftLineDiv = document.createElement("div");
      const rightLineDiv = document.createElement("div");
      const leftCodeDiv = document.createElement("div");
      const rightCodeDiv = document.createElement("div");
      if (diff.type === "equal") {
        leftLineDiv.textContent = String(leftLineNum++);
        rightLineDiv.textContent = String(rightLineNum++);
        leftCodeDiv.textContent = diff.oldLine;
        rightCodeDiv.textContent = diff.newLine;
        leftCodeDiv.style.opacity = colors.equalOpacity;
        rightCodeDiv.style.opacity = colors.equalOpacity;
      } else if (diff.type === "delete") {
        leftLineDiv.textContent = String(leftLineNum++);
        rightLineDiv.textContent = "";
        leftCodeDiv.textContent = diff.oldLine;
        leftCodeDiv.style.backgroundColor = colors.deleteBg;
        leftCodeDiv.style.color = colors.deleteText;
        rightCodeDiv.style.backgroundColor = colors.emptyBg;
        rightCodeDiv.style.minHeight = "1.6em";
      } else if (diff.type === "insert") {
        leftLineDiv.textContent = "";
        rightLineDiv.textContent = String(rightLineNum++);
        leftCodeDiv.style.backgroundColor = colors.emptyBg;
        leftCodeDiv.style.minHeight = "1.6em";
        rightCodeDiv.textContent = diff.newLine;
        rightCodeDiv.style.backgroundColor = colors.insertBg;
        rightCodeDiv.style.color = colors.insertText;
      } else if (diff.type === "modify") {
        leftLineDiv.textContent = String(leftLineNum++);
        rightLineDiv.textContent = String(rightLineNum++);
        leftCodeDiv.textContent = diff.oldLine;
        rightCodeDiv.textContent = diff.newLine;
        leftCodeDiv.style.backgroundColor = colors.deleteBg;
        leftCodeDiv.style.color = colors.deleteText;
        rightCodeDiv.style.backgroundColor = colors.insertBg;
        rightCodeDiv.style.color = colors.insertText;
      }
      leftPane.lineNumbers.appendChild(leftLineDiv);
      leftPane.codeArea.appendChild(leftCodeDiv);
      rightPane.lineNumbers.appendChild(rightLineDiv);
      rightPane.codeArea.appendChild(rightCodeDiv);
    });
    body.appendChild(leftPane.pane);
    body.appendChild(rightPane.pane);
    container.appendChild(header);
    container.appendChild(body);
    document.body.appendChild(backdrop);
    document.body.appendChild(container);
  }

  // src/dialog/editor.js
  var EditorUndoStack = class {
    constructor(maxSize = 50) {
      this._stack = [];
      this._index = -1;
      this._maxSize = maxSize;
    }
    push(state) {
      this._stack = this._stack.slice(0, this._index + 1);
      this._stack.push(state);
      if (this._stack.length > this._maxSize) {
        this._stack.shift();
      } else {
        this._index++;
      }
    }
    undo() {
      if (!this.canUndo()) return null;
      this._index--;
      return this._stack[this._index];
    }
    redo() {
      if (!this.canRedo()) return null;
      this._index++;
      return this._stack[this._index];
    }
    canUndo() {
      return this._index > 0;
    }
    canRedo() {
      return this._index < this._stack.length - 1;
    }
    current() {
      return this._stack[this._index] || null;
    }
  };
  function editorGetCaretPosition(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const prefix = range.cloneRange();
    prefix.selectNodeContents(el);
    prefix.setEnd(range.endContainer, range.endOffset);
    return prefix.toString().length;
  }
  function editorSetCaretPosition(el, pos) {
    const sel = window.getSelection();
    let charCount = 0;
    function traverse(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCount = charCount + node.length;
        if (pos <= nextCount) {
          const range = document.createRange();
          range.setStart(node, pos - charCount);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return true;
        }
        charCount = nextCount;
      } else {
        for (const child of node.childNodes) {
          if (traverse(child)) return true;
        }
      }
      return false;
    }
    traverse(el);
  }
  async function showEditorDialog(filePath) {
    const content = await fs.readFile(filePath);
    if (content === null) {
      showToast("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25", "error");
      return;
    }
    const fileName = filePath.split("/").pop();
    const undoStack = new EditorUndoStack();
    undoStack.push({ content, cursor: 0 });
    let isComposing = false;
    const backdrop = document.createElement("div");
    backdrop.id = "ide-editor-backdrop";
    Object.assign(backdrop.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0, 0, 0, 0.6)",
      backdropFilter: "blur(4px)",
      zIndex: "2147483648",
      animation: "ideFadeIn 0.2s ease-out"
    });
    const dialog = document.createElement("div");
    dialog.id = "ide-editor-dialog";
    Object.assign(dialog.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "var(--ide-bg)",
      color: "var(--ide-text)",
      border: "1px solid var(--ide-border)",
      borderRadius: "12px",
      padding: "20px",
      zIndex: "2147483649",
      width: "80vw",
      maxWidth: "900px",
      height: "80vh",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      animation: "ideScaleIn 0.2s ease-out"
    });
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
      paddingBottom: "12px",
      borderBottom: "1px solid var(--ide-border)"
    });
    const titleGroup = document.createElement("div");
    Object.assign(titleGroup.style, { display: "flex", alignItems: "center", gap: "8px" });
    const titleIcon = document.createElement("span");
    titleIcon.textContent = "\u270F\uFE0F";
    const titleText = document.createElement("span");
    titleText.textContent = `\u7F16\u8F91: ${fileName}`;
    Object.assign(titleText.style, { fontSize: "16px", fontWeight: "600" });
    const pathHint = document.createElement("span");
    pathHint.textContent = filePath;
    Object.assign(pathHint.style, {
      fontSize: "11px",
      color: "var(--ide-text-secondary)",
      marginLeft: "8px"
    });
    titleGroup.append(titleIcon, titleText, pathHint);
    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, { display: "flex", gap: "4px" });
    const createToolBtn = (text, title, onClick) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.title = title;
      Object.assign(btn.style, {
        padding: "4px 8px",
        borderRadius: "4px",
        cursor: "pointer",
        background: "transparent",
        border: "1px solid var(--ide-border)",
        color: "var(--ide-text)",
        fontSize: "12px"
      });
      btn.onmouseover = () => btn.style.background = "var(--ide-hover)";
      btn.onmouseout = () => btn.style.background = "transparent";
      btn.onclick = onClick;
      return btn;
    };
    const undoBtn = createToolBtn("\u21A9\uFE0F", "Ctrl+Z \u64A4\u9500", () => doUndo());
    const redoBtn = createToolBtn("\u21AA\uFE0F", "Ctrl+Y \u91CD\u505A", () => doRedo());
    toolbar.append(undoBtn, redoBtn);
    header.append(titleGroup, toolbar);
    dialog.appendChild(header);
    const editorContainer = document.createElement("div");
    Object.assign(editorContainer.style, {
      flex: "1",
      display: "flex",
      overflow: "hidden",
      border: "1px solid var(--ide-border)",
      borderRadius: "8px",
      background: "var(--ide-hint-bg)"
    });
    const lineNumbers = document.createElement("div");
    Object.assign(lineNumbers.style, {
      padding: "12px 8px 12px 12px",
      textAlign: "right",
      color: "var(--ide-text-secondary)",
      userSelect: "none",
      borderRight: "1px solid var(--ide-border)",
      background: "rgba(0, 0, 0, 0.1)",
      minWidth: "40px",
      fontFamily: '"JetBrains Mono", Consolas, monospace',
      fontSize: "13px",
      lineHeight: "1.6",
      overflowY: "hidden"
    });
    const codeArea = document.createElement("div");
    codeArea.contentEditable = "plaintext-only";
    Object.assign(codeArea.style, {
      flex: "1",
      padding: "12px",
      fontFamily: '"JetBrains Mono", Consolas, monospace',
      fontSize: "13px",
      lineHeight: "1.6",
      whiteSpace: "pre",
      outline: "none",
      overflowY: "auto",
      color: "var(--ide-text)"
    });
    codeArea.textContent = content;
    const updateLineNumbers = () => {
      const lines = codeArea.textContent.split("\n");
      while (lineNumbers.firstChild) lineNumbers.removeChild(lineNumbers.firstChild);
      lines.forEach((_, idx) => {
        const lineDiv = document.createElement("div");
        lineDiv.textContent = String(idx + 1);
        lineNumbers.appendChild(lineDiv);
      });
    };
    const updateButtons = () => {
      undoBtn.style.opacity = undoStack.canUndo() ? "1" : "0.4";
      redoBtn.style.opacity = undoStack.canRedo() ? "1" : "0.4";
    };
    const doUndo = () => {
      const state = undoStack.undo();
      if (state) {
        codeArea.textContent = state.content;
        editorSetCaretPosition(codeArea, state.cursor);
        updateLineNumbers();
        updateButtons();
      }
    };
    const doRedo = () => {
      const state = undoStack.redo();
      if (state) {
        codeArea.textContent = state.content;
        editorSetCaretPosition(codeArea, state.cursor);
        updateLineNumbers();
        updateButtons();
      }
    };
    let saveTimeout = null;
    const saveState = () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const cursor = editorGetCaretPosition(codeArea);
        undoStack.push({ content: codeArea.textContent, cursor });
        updateButtons();
      }, 300);
    };
    codeArea.addEventListener("scroll", () => {
      lineNumbers.scrollTop = codeArea.scrollTop;
    });
    codeArea.addEventListener("compositionstart", () => {
      isComposing = true;
    });
    codeArea.addEventListener("compositionend", () => {
      isComposing = false;
      saveState();
      updateLineNumbers();
    });
    codeArea.addEventListener("input", () => {
      if (!isComposing) {
        saveState();
        updateLineNumbers();
      }
    });
    codeArea.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        document.execCommand("insertText", false, "    ");
      }
      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const text = codeArea.textContent;
        const pos = editorGetCaretPosition(codeArea);
        let lineStart = text.lastIndexOf("\n", pos - 1) + 1;
        if (text.substring(lineStart, lineStart + 4) === "    ") {
          codeArea.textContent = text.substring(0, lineStart) + text.substring(lineStart + 4);
          editorSetCaretPosition(codeArea, Math.max(lineStart, pos - 4));
          updateLineNumbers();
          saveState();
        }
      }
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      }
      if (e.ctrlKey && e.key === "y" || e.ctrlKey && e.shiftKey && e.key === "z") {
        e.preventDefault();
        doRedo();
      }
    });
    updateLineNumbers();
    updateButtons();
    editorContainer.append(lineNumbers, codeArea);
    dialog.appendChild(editorContainer);
    const footer = document.createElement("div");
    Object.assign(footer.style, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "12px",
      marginTop: "16px",
      paddingTop: "12px",
      borderTop: "1px solid var(--ide-border)"
    });
    const closeAll = () => {
      document.removeEventListener("keydown", handleGlobalKey);
      backdrop.remove();
      dialog.remove();
    };
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "\u53D6\u6D88";
    Object.assign(cancelBtn.style, {
      padding: "8px 20px",
      borderRadius: "6px",
      cursor: "pointer",
      background: "transparent",
      border: "1px solid var(--ide-border)",
      color: "var(--ide-text)",
      fontSize: "14px"
    });
    cancelBtn.onmouseover = () => cancelBtn.style.background = "var(--ide-hover)";
    cancelBtn.onmouseout = () => cancelBtn.style.background = "transparent";
    cancelBtn.onclick = closeAll;
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "\u{1F4BE} \u4FDD\u5B58";
    Object.assign(saveBtn.style, {
      padding: "8px 24px",
      borderRadius: "6px",
      cursor: "pointer",
      background: "var(--ide-accent)",
      color: "#fff",
      border: "none",
      fontSize: "14px",
      fontWeight: "600"
    });
    saveBtn.onclick = async () => {
      saveBtn.textContent = "\u4FDD\u5B58\u4E2D...";
      saveBtn.disabled = true;
      const success = await fs.writeFile(filePath, codeArea.textContent);
      if (success) {
        showToast("\u5DF2\u4FDD\u5B58: " + fileName);
        closeAll();
      } else {
        showToast("\u4FDD\u5B58\u5931\u8D25", "error");
        saveBtn.textContent = "\u{1F4BE} \u4FDD\u5B58";
        saveBtn.disabled = false;
      }
    };
    footer.append(cancelBtn, saveBtn);
    dialog.appendChild(footer);
    const handleGlobalKey = (e) => {
      if (e.key === "Escape") closeAll();
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveBtn.click();
      }
    };
    document.addEventListener("keydown", handleGlobalKey);
    document.body.append(backdrop, dialog);
    codeArea.focus();
  }

  // src/gemini/diff.js
  function similarity(str1, str2) {
    if (str1 === str2) return 100;
    if (!str1 || !str2) return 0;
    const len1 = str1.length, len2 = str2.length;
    if (len1 === 0 || len2 === 0) return 0;
    let matches = 0;
    const shorter = len1 <= len2 ? str1 : str2;
    const longer = len1 > len2 ? str1 : str2;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    const lenPenalty = Math.abs(len1 - len2) / Math.max(len1, len2);
    const baseScore = matches / shorter.length * 100;
    return Math.round(baseScore * (1 - lenPenalty * 0.5));
  }
  function lineSimilarity(line1, line2) {
    return similarity(line1.trim(), line2.trim());
  }
  function blockSimilarity(searchLines, fileLines, startIndex) {
    if (startIndex < 0 || startIndex + searchLines.length > fileLines.length) {
      return 0;
    }
    let totalScore = 0;
    for (let i = 0; i < searchLines.length; i++) {
      totalScore += lineSimilarity(searchLines[i], fileLines[startIndex + i]);
    }
    return Math.round(totalScore / searchLines.length);
  }
  function visualizeChar(ch) {
    if (ch === void 0) return "[\u7F3A\u5931]";
    if (ch === " ") return "[\u7A7A\u683C]";
    if (ch === "	") return "[Tab]";
    if (ch === "\n") return "[\u6362\u884C]";
    if (ch === "\r") return "[\u56DE\u8F66]";
    return `'${ch}'`;
  }
  function visualizeLine(line) {
    return line.replace(/\t/g, "\u2192").replace(/ /g, "\xB7");
  }
  function findCandidates(searchBlock, fileContent, minSimilarity = 50) {
    const searchLines = searchBlock.split("\n");
    const fileLines = fileContent.split("\n");
    const candidates = [];
    for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
      const score = blockSimilarity(searchLines, fileLines, i);
      if (score >= minSimilarity) {
        candidates.push({
          startLine: i + 1,
          endLine: i + searchLines.length,
          score,
          lines: fileLines.slice(i, i + searchLines.length)
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const filtered = [];
    for (const c of candidates) {
      const tooClose = filtered.some((f) => Math.abs(f.startLine - c.startLine) < 3);
      if (!tooClose) filtered.push(c);
    }
    return filtered.slice(0, 5);
  }
  function detailedDiff(searchLines, fileLines) {
    const diffs = [];
    const maxLen = Math.max(searchLines.length, fileLines.length);
    for (let i = 0; i < maxLen; i++) {
      const searchLine = searchLines[i] ?? "";
      const fileLine = fileLines[i] ?? "";
      if (searchLine === fileLine) continue;
      const trimMatch = searchLine.trim() === fileLine.trim();
      const diff = {
        lineNum: i + 1,
        search: searchLine,
        file: fileLine,
        type: trimMatch ? "whitespace" : "content",
        similarity: lineSimilarity(searchLine, fileLine)
      };
      if (trimMatch) {
        for (let j = 0; j < Math.max(searchLine.length, fileLine.length); j++) {
          if (searchLine[j] !== fileLine[j]) {
            diff.firstDiffPos = j;
            diff.searchChar = visualizeChar(searchLine[j]);
            diff.fileChar = visualizeChar(fileLine[j]);
            break;
          }
        }
      }
      diffs.push(diff);
    }
    return diffs;
  }

  // src/gemini/feedback.js
  function detectTruncation(text) {
    const patterns = [
      { pattern: /<\/content>/i, name: "</content> \u6807\u7B7E" },
      { pattern: /<\/file>/i, name: "</file> \u6807\u7B7E" },
      { pattern: /\x00/, name: "\u7A7A\u5B57\u7B26" },
      { pattern: /[\uFFFD]/, name: "\u66FF\u6362\u5B57\u7B26" }
    ];
    for (const { pattern, name } of patterns) {
      if (pattern.test(text)) return { truncated: true, reason: name };
    }
    return { truncated: false };
  }
  function detectIssues(searchBlock, fileContent) {
    var _a;
    const issues = [];
    const fixes = [];
    const searchLines = searchBlock.split("\n");
    const fileLines = fileContent.split("\n");
    const lazyPatterns = [/^\s*\/\/\s*\.{3,}/, /^\s*\.{3,}/, /^\s*\/\*\s*\.{3,}/];
    if (searchLines.some((l) => lazyPatterns.some((p) => p.test(l)))) {
      issues.push("\u274C SEARCH \u5757\u5305\u542B\u7701\u7565\u53F7 (...)");
      fixes.push("\u8BF7\u63D0\u4F9B\u5B8C\u6574\u7684\u539F\u59CB\u4EE3\u7801\uFF0C\u7981\u6B62\u4F7F\u7528\u7701\u7565\u53F7\u8DF3\u8FC7\u5185\u5BB9");
    }
    const searchHasTabs = /\t/.test(searchBlock);
    const searchHasSpaces = /^[ ]{2,}/m.test(searchBlock);
    const fileHasTabs = /\t/.test(fileContent);
    const fileHasSpaces = /^[ ]{2,}/m.test(fileContent);
    if (searchHasTabs && !fileHasTabs && fileHasSpaces) {
      issues.push("\u274C SEARCH \u5757\u4F7F\u7528 Tab \u7F29\u8FDB\uFF0C\u4F46\u6587\u4EF6\u4F7F\u7528\u7A7A\u683C\u7F29\u8FDB");
      fixes.push("\u5C06\u6240\u6709 Tab \u66FF\u6362\u4E3A\u7A7A\u683C");
    }
    if (searchHasSpaces && !fileHasSpaces && fileHasTabs) {
      issues.push("\u274C SEARCH \u5757\u4F7F\u7528\u7A7A\u683C\u7F29\u8FDB\uFF0C\u4F46\u6587\u4EF6\u4F7F\u7528 Tab \u7F29\u8FDB");
      fixes.push("\u5C06\u7F29\u8FDB\u7A7A\u683C\u66FF\u6362\u4E3A Tab");
    }
    const trailingLines = searchLines.map((l, i) => ({ line: i + 1, has: /[ \t]+$/.test(l) })).filter((x) => x.has);
    if (trailingLines.length > 0) {
      issues.push(`\u274C SEARCH \u5757\u7B2C ${trailingLines.map((x) => x.line).join(", ")} \u884C\u6709\u884C\u5C3E\u7A7A\u683C`);
      fixes.push("\u5220\u9664\u6240\u6709\u884C\u5C3E\u7A7A\u683C");
    }
    const hiddenChars = searchLines.map((l, i) => ({ line: i + 1, has: /[\u200B-\u200D\uFEFF]/.test(l) })).filter((x) => x.has);
    if (hiddenChars.length > 0) {
      issues.push(`\u274C SEARCH \u5757\u7B2C ${hiddenChars.map((x) => x.line).join(", ")} \u884C\u5305\u542B\u4E0D\u53EF\u89C1\u5E72\u6270\u5B57\u7B26 (\u5982\u96F6\u5BBD\u7A7A\u683C)`);
      fixes.push("\u8BF7\u6E05\u6D17\u4EE3\u7801\uFF0C\u79FB\u9664\u6240\u6709\u975E ASCII \u7684\u4E0D\u53EF\u89C1\u63A7\u5236\u5B57\u7B26");
    }
    const firstLine = (_a = searchLines[0]) == null ? void 0 : _a.trim();
    if (firstLine) {
      const exactMatch = fileLines.some((l) => l.trim() === firstLine);
      if (!exactMatch) {
        let bestMatch = { line: -1, score: 0, content: "" };
        fileLines.forEach((l, i) => {
          const score = lineSimilarity(firstLine, l);
          if (score > bestMatch.score) {
            bestMatch = { line: i + 1, score, content: l.trim() };
          }
        });
        if (bestMatch.score >= 60) {
          issues.push(`\u274C \u9996\u884C\u4E0D\u5B58\u5728\uFF0C\u4F46\u7B2C ${bestMatch.line} \u884C\u6709 ${bestMatch.score}% \u76F8\u4F3C`);
          fixes.push(`\u9996\u884C\u5E94\u8BE5\u662F: "${bestMatch.content.slice(0, 60)}"`);
        } else {
          issues.push(`\u274C \u9996\u884C "${firstLine.slice(0, 40)}..." \u5728\u6587\u4EF6\u4E2D\u4E0D\u5B58\u5728`);
        }
      }
    }
    return { issues, fixes };
  }
  function generateFixInstructions(diffs) {
    const instructions = [];
    for (const d of diffs.slice(0, 5)) {
      if (d.type !== "whitespace") continue;
      const searchLine = d.search;
      const fileLine = d.file;
      const searchTrailing = searchLine.match(/[ \t]+$/);
      const fileTrailing = fileLine.match(/[ \t]+$/);
      if (searchTrailing && !fileTrailing) {
        instructions.push(`\u7B2C ${d.lineNum} \u884C\uFF1A\u5220\u9664\u884C\u5C3E\u7684 ${searchTrailing[0].length} \u4E2A\u7A7A\u767D\u5B57\u7B26`);
        continue;
      }
      const searchIndent = searchLine.match(/^[ \t]*/)[0];
      const fileIndent = fileLine.match(/^[ \t]*/)[0];
      if (searchIndent !== fileIndent) {
        const searchTabs = (searchIndent.match(/\t/g) || []).length;
        const searchSpaces = (searchIndent.match(/ /g) || []).length;
        const fileTabs = (fileIndent.match(/\t/g) || []).length;
        const fileSpaces = (fileIndent.match(/ /g) || []).length;
        if (searchTabs > 0 && fileTabs === 0) {
          instructions.push(`\u7B2C ${d.lineNum} \u884C\uFF1A\u628A ${searchTabs} \u4E2A Tab \u6539\u6210 ${fileSpaces} \u4E2A\u7A7A\u683C`);
        } else if (searchSpaces > 0 && fileSpaces === 0 && fileTabs > 0) {
          instructions.push(`\u7B2C ${d.lineNum} \u884C\uFF1A\u628A ${searchSpaces} \u4E2A\u7A7A\u683C\u6539\u6210 ${fileTabs} \u4E2A Tab`);
        } else if (searchSpaces !== fileSpaces) {
          instructions.push(`\u7B2C ${d.lineNum} \u884C\uFF1A\u7F29\u8FDB\u4ECE ${searchSpaces} \u4E2A\u7A7A\u683C\u6539\u6210 ${fileSpaces} \u4E2A\u7A7A\u683C`);
        }
      }
    }
    return instructions;
  }
  function generateDiffReport(diffs) {
    if (diffs.length === 0) return "";
    const allWhitespace = diffs.every((d) => d.type === "whitespace");
    const fixInstructions = generateFixInstructions(diffs);
    let report = "";
    if (fixInstructions.length > 0) {
      report += `**\u{1F527} \u5177\u4F53\u4FEE\u6B63\uFF08\u9010\u884C\uFF09\uFF1A**
${fixInstructions.map((i) => `- ${i}`).join("\n")}

`;
      if (allWhitespace) {
        report += `\u{1F4A1} **\u63D0\u793A\uFF1A** \u6240\u6709\u5DEE\u5F02\u90FD\u662F\u7A7A\u767D\u5B57\u7B26\u95EE\u9898\uFF0C\u5185\u5BB9\u672C\u8EAB\u662F\u5BF9\u7684\u3002\u76F4\u63A5\u590D\u5236\u4E0B\u65B9"\u6B63\u786E\u7684 SEARCH \u5757"\u6700\u7701\u4E8B\u3002

`;
      }
    }
    const lines = diffs.slice(0, 6).map((d) => {
      if (d.type === "whitespace") {
        return `  \u7B2C ${d.lineNum} \u884C: \u7A7A\u767D\u5DEE\u5F02 - \u4F4D\u7F6E ${d.firstDiffPos}: ${d.searchChar} \u2192 ${d.fileChar}
    \u4F60\u5199\u7684: \`${visualizeLine(d.search)}\`
    \u5B9E\u9645\u662F: \`${visualizeLine(d.file)}\``;
      } else {
        return `  \u7B2C ${d.lineNum} \u884C: \u5185\u5BB9\u4E0D\u540C (${d.similarity}% \u76F8\u4F3C)
    \u4F60\u5199\u7684: \`${d.search.slice(0, 70)}${d.search.length > 70 ? "..." : ""}\`
    \u5B9E\u9645\u662F: \`${d.file.slice(0, 70)}${d.file.length > 70 ? "..." : ""}\``;
      }
    });
    report += `**\u9010\u884C\u5DEE\u5F02\u5206\u6790\uFF1A**
${lines.join("\n\n")}`;
    if (diffs.length > 6) report += `

  ... \u8FD8\u6709 ${diffs.length - 6} \u5904\u5DEE\u5F02`;
    return report;
  }
  function buildMismatchContext(filePath, fileContent, searchBlock) {
    var _a, _b;
    const lang = getLanguage(filePath);
    const searchLines = searchBlock.split("\n");
    const truncation = detectTruncation(searchBlock);
    if (truncation.truncated) {
      return `\u274C **\u8F93\u51FA\u88AB\u622A\u65AD** - \`${filePath}\`

\u68C0\u6D4B\u5230 ${truncation.reason}\uFF0C\u4EE3\u7801\u4F20\u8F93\u88AB\u635F\u574F\u3002

**\u89E3\u51B3\u65B9\u6848\uFF1A** \u907F\u514D\u76F4\u63A5\u5199 \`$\` \u7B26\u53F7\uFF0C\u7528 \`String.fromCharCode(36)\` \u4EE3\u66FF\uFF0C\u6216\u62C6\u5206\u6210\u5C0F\u8865\u4E01\u3002`;
    }
    const { issues, fixes } = detectIssues(searchBlock, fileContent);
    const candidates = findCandidates(searchBlock, fileContent);
    let response = `\u274C **SEARCH \u5757\u5339\u914D\u5931\u8D25** - \`${filePath}\`
`;
    if (issues.length > 0) response += `
**\u95EE\u9898\uFF1A**
${issues.join("\n")}
`;
    if (fixes.length > 0) response += `
**\u4FEE\u590D\uFF1A**
${fixes.map((f) => `- ${f}`).join("\n")}
`;
    if (candidates.length > 0) {
      const best = candidates[0];
      const firstLine = (_a = searchLines[0]) == null ? void 0 : _a.trim();
      if (best.score < 100 && ((_b = best.lines[0]) == null ? void 0 : _b.trim()) === firstLine) {
        response += `
\u26A0\uFE0F **\u7591\u4F3C\u7F29\u8FDB\u9519\u8BEF**\uFF1A\u9996\u884C\u6587\u5B57\u5339\u914D\u4F46\u7531\u4E8E\u7F29\u8FDB\u4E0D\u4E00\u81F4\u5BFC\u81F4\u5931\u6548\u3002
`;
        response += `\u{1F4A1} *\u63D0\u793A*\uFF1A\u5F15\u64CE\u73B0\u5DF2\u652F\u6301 Outdent (\u5411\u5916\u7F29\u8FDB)\uFF0C\u8BF7\u786E\u4FDD REPLACE \u5757\u7684\u76F8\u5BF9\u7F29\u8FDB\u903B\u8F91\u6B63\u786E\u3002
`;
      }
      response += `
**\u6700\u4F73\u5339\u914D\uFF1A** \u7B2C ${best.startLine}-${best.endLine} \u884C (${best.score}% \u76F8\u4F3C)
`;
      const diffs = detailedDiff(searchLines, best.lines);
      if (diffs.length > 0) response += "\n" + generateDiffReport(diffs) + "\n";
      response += `
**\u2705 \u6B63\u786E\u7684 SEARCH \u5757\uFF08\u76F4\u63A5\u590D\u5236\uFF09\uFF1A**
\`\`\`${lang}
${best.lines.join("\n")}
\`\`\`
`;
      if (candidates.length > 1) {
        response += `
**\u5176\u4ED6\u4F4D\u7F6E\uFF1A** `;
        response += candidates.slice(1, 4).map((c) => `\u7B2C${c.startLine}\u884C(${c.score}%)`).join(", ");
        response += "\n";
      }
    } else {
      response += `
**\u26A0\uFE0F \u627E\u4E0D\u5230\u4EFB\u4F55\u76F8\u4F3C\u4EE3\u7801\uFF01** \u8BF7\u786E\u8BA4\u6587\u4EF6\u8DEF\u5F84\u548C\u5185\u5BB9\u662F\u5426\u6B63\u786E\u3002
`;
      const preview = fileContent.split("\n").slice(0, 15).map(
        (l, i) => `${String(i + 1).padStart(4)}: ${l}`
      ).join("\n");
      response += `
**\u6587\u4EF6\u5F00\u5934\uFF1A**
\`\`\`${lang}
${preview}
\`\`\`
`;
    }
    response += `
**\u4F60\u7684 SEARCH \u5757\uFF1A**
\`\`\`${lang}
${searchBlock}
\`\`\``;
    return response;
  }
  function buildSyntaxErrorContext(filePath, error, searchBlock, replaceBlock, patchedContent) {
    const lang = getLanguage(filePath);
    const truncation = detectTruncation(replaceBlock);
    if (truncation.truncated) {
      return `\u274C **\u8F93\u51FA\u88AB\u622A\u65AD** - \`${filePath}\`

REPLACE \u5757\u5305\u542B ${truncation.reason}\uFF0C\u8BF7\u91CD\u65B0\u751F\u6210\u3002`;
    }
    const lineMatch = error.match(/第 (\d+) 行/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : -1;
    let response = `\u274C **\u8BED\u6CD5\u68C0\u67E5\u5931\u8D25** - \`${filePath}\`

**\u9519\u8BEF\uFF1A** ${error}
`;
    if (patchedContent && errorLine > 0) {
      const lines = patchedContent.split("\n");
      const start = Math.max(0, errorLine - 5);
      const end = Math.min(lines.length, errorLine + 5);
      const context = lines.slice(start, end).map((line, i) => {
        const num = start + i + 1;
        const marker = num === errorLine ? " >>>" : "    ";
        return `${String(num).padStart(4)}${marker} ${line}`;
      }).join("\n");
      response += `
**\u9519\u8BEF\u4F4D\u7F6E\uFF1A**
\`\`\`${lang}
${context}
\`\`\`
`;
    }
    response += `
**SEARCH\uFF1A**
\`\`\`${lang}
${searchBlock}
\`\`\`
`;
    response += `
**REPLACE\uFF1A**
\`\`\`${lang}
${replaceBlock}
\`\`\`
`;
    response += `
\u68C0\u67E5 REPLACE \u5757\u662F\u5426\u5BFC\u81F4\u62EC\u53F7\u4E0D\u5339\u914D\u6216\u8BED\u53E5\u4E0D\u5B8C\u6574\u3002`;
    return response;
  }
  function buildDuplicateContext(filePath, fileContent, searchBlock, matchCount) {
    var _a;
    const lang = getLanguage(filePath);
    const fileLines = fileContent.split("\n");
    const searchLines = searchBlock.split("\n");
    const firstLine = (_a = searchLines[0]) == null ? void 0 : _a.trim();
    const positions = [];
    fileLines.forEach((line, i) => {
      if (line.trim() === firstLine) positions.push(i + 1);
    });
    let response = `\u274C **\u5339\u914D\u5230 ${matchCount} \u5904\u76F8\u540C\u4EE3\u7801** - \`${filePath}\`

`;
    response += `**\u4F4D\u7F6E\uFF1A** \u7B2C ${positions.slice(0, 10).join(", ")} \u884C
`;
    positions.slice(0, 2).forEach((pos, idx) => {
      const start = Math.max(0, pos - 2);
      const end = Math.min(fileLines.length, pos + searchLines.length + 1);
      const context = fileLines.slice(start, end).map(
        (l, i) => `${String(start + i + 1).padStart(4)}: ${l}`
      ).join("\n");
      response += `
**\u4F4D\u7F6E ${idx + 1}\uFF1A**
\`\`\`${lang}
${context}
\`\`\`
`;
    });
    response += `
**\u4F60\u7684 SEARCH \u5757\uFF1A**
\`\`\`${lang}
${searchBlock}
\`\`\`
`;
    response += `
**\u5EFA\u8BAE\uFF1A** \u6DFB\u52A0\u524D\u540E 2-3 \u884C\u72EC\u7279\u4E0A\u4E0B\u6587\u4F7F\u5176\u552F\u4E00\u5339\u914D\u3002`;
    return response;
  }
  function buildFileNotFoundContext(filePath, projectFiles) {
    let response = `\u274C **\u6587\u4EF6\u4E0D\u5B58\u5728** - \`${filePath}\`

`;
    response += `\u9879\u76EE\u4E2D\u6CA1\u6709\u627E\u5230\u8FD9\u4E2A\u6587\u4EF6\u3002

`;
    response += `**\u53EF\u80FD\u7684\u539F\u56E0\uFF1A**
`;
    response += `- \u6587\u4EF6\u8DEF\u5F84\u62FC\u5199\u9519\u8BEF
`;
    response += `- \u6587\u4EF6\u5DF2\u88AB\u5220\u9664\u6216\u79FB\u52A8
`;
    response += `- \u8DEF\u5F84\u5E94\u8BE5\u662F\u76F8\u5BF9\u4E8E\u9879\u76EE\u6839\u76EE\u5F55\u7684\u5B8C\u6574\u8DEF\u5F84

`;
    const fileName = filePath.split("/").pop();
    if (projectFiles && projectFiles.length > 0) {
      const similar = projectFiles.filter((f) => f.toLowerCase().includes(fileName.toLowerCase().slice(0, 5))).slice(0, 5);
      if (similar.length > 0) {
        response += `**\u4F60\u662F\u4E0D\u662F\u60F3\u627E\uFF1A**
`;
        response += similar.map((f) => `- \`${f}\``).join("\n");
        response += "\n";
      }
    }
    response += `
\u8BF7\u68C0\u67E5\u6587\u4EF6\u8DEF\u5F84\u540E\u91CD\u65B0\u751F\u6210\u8865\u4E01\u3002`;
    return response;
  }
  function buildReadErrorContext(filePath) {
    return `\u274C **\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25** - \`${filePath}\`

\u65E0\u6CD5\u8BFB\u53D6\u6587\u4EF6\u5185\u5BB9\uFF0C\u53EF\u80FD\u662F\u6743\u9650\u95EE\u9898\u6216\u6587\u4EF6\u88AB\u5360\u7528\u3002

\u8BF7\u786E\u8BA4\u6587\u4EF6\u53EF\u4EE5\u6B63\u5E38\u8BBF\u95EE\u540E\u91CD\u8BD5\u3002`;
  }

  // src/gemini/actions.js
  function createActionButton(text, onClick) {
    const btn = document.createElement("button");
    btn.textContent = text;
    Object.assign(btn.style, {
      background: "#2563eb",
      color: "white",
      border: "none",
      padding: "6px 12px",
      borderRadius: "4px",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "bold"
    });
    btn.onmouseover = () => {
      btn.style.opacity = "0.8";
    };
    btn.onmouseout = () => {
      btn.style.opacity = "1";
    };
    btn.onclick = onClick;
    return btn;
  }
  function addUndoButton(bar, filePath, insertToInput2) {
    const fileName = filePath.split("/").pop();
    const undoBtn = createActionButton(`\u21A9\uFE0F \u64A4\u9500 \u2192 ${fileName}`, async () => {
      const result = await fs.revertFile(filePath);
      if (result.success) {
        showToast("\u5DF2\u64A4\u9500: " + filePath);
        undoBtn.remove();
      } else {
        showToast(result.error || "\u64A4\u9500\u5931\u8D25", "error");
      }
    });
    undoBtn.className = "ide-undo-btn";
    undoBtn.title = filePath;
    undoBtn.style.background = "#f59e0b";
    bar.appendChild(undoBtn);
  }
  function addSendFileButton(bar, filePath, insertToInput2) {
    const fileName = filePath.split("/").pop();
    const sendBtn = createActionButton(`\u{1F4E4} \u53D1\u9001 \u2192 ${fileName}`, async () => {
      const content = await fs.readFile(filePath);
      if (content === null) {
        showToast("\u8BFB\u53D6\u5931\u8D25", "error");
        return;
      }
      const lang = getLanguage(filePath);
      const text = `\u{1F4C4} **\u6587\u4EF6\u6700\u65B0\u72B6\u6001** - \`${filePath}\`

\u4EE5\u4E0B\u662F\u8BE5\u6587\u4EF6\u5F53\u524D\u7684\u5B8C\u6574\u5185\u5BB9\uFF08\u5DF2\u5E94\u7528\u6240\u6709\u4FEE\u6539\uFF09\uFF1A

\`\`\`${lang}
${content}
\`\`\``;
      insertToInput2(text);
      showToast(`\u5DF2\u53D1\u9001: ${fileName} (~${formatTokens(estimateTokens(text))} tokens)`);
    });
    sendBtn.className = "ide-send-btn";
    sendBtn.title = `\u53D1\u9001 ${filePath} \u7684\u6700\u65B0\u5185\u5BB9\u7ED9 AI`;
    sendBtn.style.background = "#8b5cf6";
    bar.appendChild(sendBtn);
  }
  function addUndoButtonForPatch(bar, patch, insertToInput2, originalBtn = null, idx = 0) {
    const fileName = patch.file.split("/").pop();
    const undoBtn = createActionButton(`\u21A9\uFE0F \u64A4\u9500 \u2192 ${fileName}`, async () => {
      const result = await fs.revertFile(patch.file);
      if (result.success) {
        showToast("\u5DF2\u64A4\u9500: " + patch.file);
        unmarkAsApplied(patch.file, patch.search);
        undoBtn.remove();
        if (originalBtn) {
          const btnText = patch.isDelete ? `\u{1F5D1}\uFE0F \u5220\u9664\u4EE3\u7801 #${idx + 1} \u2192 ${patch.file}` : `\u{1F527} \u5E94\u7528\u4FEE\u6539 #${idx + 1} \u2192 ${patch.file}`;
          originalBtn.textContent = btnText;
          originalBtn.style.background = patch.isDelete ? "#f59e0b" : "#2563eb";
          originalBtn.title = "";
        }
      } else {
        showToast(result.error || "\u64A4\u9500\u5931\u8D25", "error");
      }
    });
    undoBtn.className = "ide-undo-btn";
    undoBtn.title = patch.file;
    undoBtn.style.background = "#f59e0b";
    bar.appendChild(undoBtn);
  }
  async function applyPatch(patch, btn, bar, insertToInput2) {
    const { file, search, replace } = patch;
    if (!fs.hasFile(file)) {
      showToast("\u6587\u4EF6\u4E0D\u5B58\u5728: " + file, "error");
      btn.textContent = "\u274C \u6587\u4EF6\u4E0D\u5B58\u5728";
      btn.style.background = "#dc2626";
      insertToInput2(buildFileNotFoundContext(file, fs.getAllFilePaths()));
      return;
    }
    const content = await fs.readFile(file);
    if (content === null) {
      showToast("\u8BFB\u53D6\u5931\u8D25", "error");
      btn.textContent = "\u274C \u8BFB\u53D6\u5931\u8D25";
      btn.style.background = "#dc2626";
      insertToInput2(buildReadErrorContext(file));
      return;
    }
    const result = tryReplace(content, search, replace, file);
    if (!result.success) {
      if (result.isSyntaxError) {
        const shortError = result.errorDetails.length > 20 ? result.errorDetails.slice(0, 20) + "..." : result.errorDetails;
        showToast(`\u26A0\uFE0F \u8BED\u6CD5\u68C0\u67E5\u672A\u901A\u8FC7`, "error");
        insertToInput2(buildSyntaxErrorContext(file, result.errorDetails, search, replace, result.content));
        btn.textContent = `\u26A0\uFE0F \u5F3A\u5236\u9884\u89C8 (${shortError})`;
        btn.title = `\u8BED\u6CD5\u9519\u8BEF: ${result.errorDetails}
\u70B9\u51FB\u53EF\u5F3A\u5236\u9884\u89C8\u5E76\u5E94\u7528`;
        btn.style.background = "#f59e0b";
        btn.onclick = async () => {
          const previewResult2 = await showPreviewDialog(file, search, replace, result.matchLine || 1, result.errorDetails);
          if (previewResult2.confirmed) {
            btn.textContent = "\u5E94\u7528\u4E2D...";
            const finalContent2 = content.replace(search, previewResult2.content);
            const success2 = await fs.writeFile(file, finalContent2);
            if (success2) {
              btn.textContent = "\u2705 \u5DF2\u5E94\u7528";
              btn.style.background = "#059669";
              showToast("\u5DF2\u4FEE\u6539: " + file);
              markAsApplied(file, search);
              addUndoButtonForPatch(bar, patch, insertToInput2, btn, patch._idx || 0);
            } else {
              btn.textContent = "\u274C \u5199\u5165\u5931\u8D25";
              btn.style.background = "#dc2626";
            }
          }
        };
        return;
      }
      const reason = result.reason || "\u672A\u77E5\u9519\u8BEF";
      showToast(reason, "error");
      if (result.matchCount && result.matchCount > 1) {
        btn.textContent = `\u274C ${result.matchCount}\u5904\u91CD\u590D`;
        insertToInput2(buildDuplicateContext(file, content, search, result.matchCount));
      } else if (result.alreadyApplied) {
        btn.textContent = "\u2705 \u5DF2\u5E94\u7528";
        btn.style.background = "#059669";
      } else {
        btn.textContent = "\u274C \u672A\u5339\u914D";
        insertToInput2(buildMismatchContext(file, content, search));
      }
      btn.style.background = result.alreadyApplied ? "#059669" : "#dc2626";
      return;
    }
    const previewResult = await showPreviewDialog(file, search, replace, result.matchLine || 1);
    if (!previewResult.confirmed) {
      btn.disabled = false;
      btn.style.opacity = "1";
      return;
    }
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.textContent = "\u5E94\u7528\u4E2D...";
    const finalContent = content.replace(search, previewResult.content);
    const success = await fs.writeFile(file, finalContent);
    if (success) {
      btn.textContent = "\u2705 \u5DF2\u5E94\u7528";
      btn.title = `\u4E8E ${(/* @__PURE__ */ new Date()).toLocaleTimeString()} \u5E94\u7528\u6210\u529F`;
      btn.style.background = "#059669";
      showToast("\u5DF2\u4FEE\u6539: " + file);
      markAsApplied(file, search);
      addUndoButtonForPatch(bar, patch, insertToInput2, btn, patch._idx || 0);
    } else {
      btn.textContent = "\u274C \u5199\u5165\u5931\u8D25";
      btn.style.background = "#dc2626";
    }
  }
  function injectActionBar(container, text, filePath, insertToInput2) {
    const bar = document.createElement("div");
    bar.className = "ide-action-bar";
    Object.assign(bar.style, {
      display: "flex",
      gap: "8px",
      padding: "8px",
      background: "var(--ide-hint-bg, #363739)",
      borderRadius: "0 0 6px 6px",
      borderTop: "1px solid var(--ide-border, #444746)",
      flexWrap: "wrap"
    });
    const deletes = parseDelete(text);
    if (deletes.length > 0) {
      if (deletes.length > 1) {
        const batchBtn = createActionButton(`\u{1F5D1}\uFE0F \u6279\u91CF\u5220\u9664 (${deletes.length}\u4E2A\u6587\u4EF6)`, async () => {
          const fileList = deletes.map((d) => `\u2022 ${d.file}`).join("\n");
          if (!confirm(`\u786E\u5B9A\u8981\u6279\u91CF\u5220\u9664\u4EE5\u4E0B ${deletes.length} \u4E2A\u6587\u4EF6/\u76EE\u5F55\u5417\uFF1F

${fileList}`)) return;
          batchBtn.textContent = "\u6B63\u5728\u5904\u7406...";
          let successCount = 0;
          for (const del of deletes) {
            const success = await fs.deleteFile(del.file);
            if (success) successCount++;
          }
          if (successCount === deletes.length) {
            batchBtn.textContent = `\u2705 \u5DF2\u5220\u9664 ${successCount} \u4E2A\u6587\u4EF6`;
            batchBtn.style.background = "#059669";
            showToast(`\u5220\u9664\u6210\u529F: \u5171 ${successCount} \u4E2A\u6587\u4EF6`);
          } else {
            batchBtn.textContent = `\u26A0\uFE0F \u6210\u529F ${successCount}/${deletes.length}`;
            batchBtn.style.background = "#f59e0b";
            showToast(`\u90E8\u5206\u5220\u9664\u5931\u8D25: \u6210\u529F ${successCount} \u4E2A`, "error");
          }
          window.dispatchEvent(new CustomEvent("ide-refresh-tree"));
        });
        batchBtn.style.background = "#dc2626";
        bar.appendChild(batchBtn);
      }
      deletes.forEach((del) => {
        const btn = createActionButton(`\u{1F5D1}\uFE0F \u5220\u9664 \u2192 ${del.file}`, async () => {
          const cleanPath = del.file.replace(/\/$/, "");
          const isDir = fs.dirHandles.has(cleanPath);
          if (cleanPath === "." || cleanPath === "" || cleanPath === fs.projectName) {
            showToast("\u7981\u6B62\u5220\u9664\u9879\u76EE\u6839\u76EE\u5F55", "error");
            return;
          }
          const typeText = isDir ? "\u76EE\u5F55" : "\u6587\u4EF6";
          const confirmMsg = isDir ? `\u26A0\uFE0F \u5371\u9669\u64CD\u4F5C\uFF01
\u786E\u8BA4\u9012\u5F52\u5220\u9664\u76EE\u5F55 "${cleanPath}" \u53CA\u5176\u5185\u90E8\u6240\u6709\u6587\u4EF6\u5417\uFF1F
\u6B64\u64CD\u4F5C\u4E0D\u53EF\u6062\u590D\uFF01` : `\u786E\u8BA4\u5220\u9664\u6587\u4EF6 "${cleanPath}" \u5417\uFF1F`;
          if (!confirm(confirmMsg)) return;
          btn.textContent = "\u6B63\u5728\u5220\u9664...";
          const success = isDir ? await fs.deleteDirectory(cleanPath) : await fs.deleteFile(cleanPath);
          if (success) {
            btn.textContent = "\u2705 \u5DF2\u5220\u9664";
            btn.style.background = "#059669";
            showToast(`\u5DF2\u5220\u9664: ${del.file}`);
            window.dispatchEvent(new CustomEvent("ide-refresh-tree"));
          } else {
            btn.textContent = "\u274C \u5220\u9664\u5931\u8D25";
            btn.style.background = "#f59e0b";
            showToast(`\u5220\u9664\u5931\u8D25: ${del.file}`, "error");
          }
        });
        btn.style.background = "#dc2626";
        bar.appendChild(btn);
      });
    }
    const patches = parseSearchReplace(text);
    if (patches.length > 0) {
      const involvedFiles = /* @__PURE__ */ new Set();
      patches.forEach((patch, idx) => {
        patch._idx = idx;
        if (patch.file) involvedFiles.add(patch.file);
        const btn = document.createElement("button");
        Object.assign(btn.style, {
          background: "#2563eb",
          color: "white",
          border: "none",
          padding: "6px 12px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "bold"
        });
        btn.onmouseover = () => {
          btn.style.opacity = "0.8";
        };
        btn.onmouseout = () => {
          btn.style.opacity = "1";
        };
        const btnText = patch.isDelete ? `\u{1F5D1}\uFE0F \u5220\u9664\u4EE3\u7801 #${idx + 1} \u2192 ${patch.file || "?"}` : `\u{1F527} \u5E94\u7528\u4FEE\u6539 #${idx + 1} \u2192 ${patch.file || "?"}`;
        btn.textContent = btnText;
        if (patch.isDelete) {
          btn.style.background = "#f59e0b";
        }
        btn.onclick = async () => {
          if (!patch.file) {
            const input = prompt("\u8BF7\u8F93\u5165\u76EE\u6807\u6587\u4EF6\u8DEF\u5F84:");
            if (!input) return;
            patch.file = input;
          }
          await applyPatch(patch, btn, bar, insertToInput2);
        };
        bar.appendChild(btn);
      });
      const filePatches = /* @__PURE__ */ new Map();
      patches.forEach((patch, idx) => {
        if (patch.file) {
          if (!filePatches.has(patch.file)) {
            filePatches.set(patch.file, []);
          }
          filePatches.get(patch.file).push({
            patch,
            btn: bar.children[idx],
            idx
          });
        }
      });
      filePatches.forEach(async (items, filePath2) => {
        if (!fs.hasFile(filePath2)) return;
        for (const { patch, btn, idx } of items) {
          const status = await checkIfApplied(patch.file, patch.search, patch.replace, fs);
          if (status.applied && status.confident) {
            btn.textContent = `\u2705 \u5DF2\u5E94\u7528 #${idx + 1} \u2192 ${patch.file}`;
            btn.style.background = "#059669";
            addUndoButtonForPatch(bar, patch, insertToInput2, btn, idx);
          }
        }
      });
      involvedFiles.forEach((filePath2) => {
        if (fs.hasFile(filePath2)) {
          addSendFileButton(bar, filePath2, insertToInput2);
        }
      });
    } else if (text.includes("FILE:")) {
      const filesToProcess = parseMultipleFiles(text);
      const involvedFiles = /* @__PURE__ */ new Set();
      if (filesToProcess.length > 1) {
        const batchBtn = createActionButton(`\u2795 \u6279\u91CF\u521B\u5EFA/\u8986\u76D6 (${filesToProcess.length}\u4E2A\u6587\u4EF6)`, async () => {
          batchBtn.textContent = "\u6B63\u5728\u5904\u7406...";
          let successCount = 0;
          for (const file of filesToProcess) {
            const exists = fs.hasFile(file.path);
            const success = exists ? await fs.writeFile(file.path, file.content) : await fs.createFile(file.path, file.content);
            if (success) successCount++;
          }
          if (successCount === filesToProcess.length) {
            batchBtn.textContent = `\u2705 \u5DF2\u5904\u7406 ${successCount} \u4E2A\u6587\u4EF6`;
            batchBtn.style.background = "#059669";
          } else {
            batchBtn.textContent = `\u26A0\uFE0F \u6210\u529F ${successCount}/${filesToProcess.length}`;
            batchBtn.style.background = "#f59e0b";
          }
          window.dispatchEvent(new CustomEvent("ide-refresh-tree"));
        });
        batchBtn.style.background = "#8b5cf6";
        bar.appendChild(batchBtn);
      }
      filesToProcess.forEach((file) => {
        const exists = fs.hasFile(file.path);
        if (exists) involvedFiles.add(file.path);
        const btnText = file.isOverwrite && exists ? `\u{1F4DD} \u8986\u76D6 \u2192 ${file.path}` : exists ? `\u{1F4BE} \u4FDD\u5B58 \u2192 ${file.path}` : `\u2795 \u521B\u5EFA \u2192 ${file.path}`;
        const btn = createActionButton(btnText, async () => {
          if (file.isOverwrite && exists && !confirm(`\u786E\u5B9A\u8986\u76D6 "${file.path}"\uFF1F`)) return;
          btn.textContent = "\u5904\u7406\u4E2D...";
          const success = exists ? await fs.writeFile(file.path, file.content) : await fs.createFile(file.path, file.content);
          if (success) {
            btn.textContent = "\u2705 \u5DF2\u6210\u529F";
            btn.style.background = "#059669";
            if (!exists) {
              window.dispatchEvent(new CustomEvent("ide-refresh-tree"));
              addSendFileButton(bar, file.path, insertToInput2);
            } else {
              addUndoButton(bar, file.path, insertToInput2);
            }
          } else {
            btn.textContent = "\u274C \u5931\u8D25";
            btn.style.background = "#dc2626";
          }
        });
        if (file.isOverwrite && exists) btn.style.background = "#f59e0b";
        bar.appendChild(btn);
      });
      involvedFiles.forEach((filePath2) => {
        addSendFileButton(bar, filePath2, insertToInput2);
      });
    }
    const reads = parseRead(text);
    if (reads.length > 0) {
      reads.forEach((read) => {
        const fileName = read.file.split("/").pop();
        const rangeText = read.startLine && read.endLine ? ` (${read.startLine}-${read.endLine}\u884C)` : " (\u5168\u90E8)";
        const btn = createActionButton(`\u{1F4D6} \u8BFB\u53D6 \u2192 ${fileName}${rangeText}`, async () => {
          if (!fs.hasFile(read.file)) {
            showToast("\u6587\u4EF6\u4E0D\u5B58\u5728: " + read.file, "error");
            btn.textContent = "\u274C \u6587\u4EF6\u4E0D\u5B58\u5728";
            btn.style.background = "#dc2626";
            insertToInput2(buildFileNotFoundContext(read.file, fs.getAllFilePaths()));
            return;
          }
          const content = await fs.readFile(read.file);
          if (content === null) {
            showToast("\u8BFB\u53D6\u5931\u8D25", "error");
            return;
          }
          const lines = content.split("\n");
          const totalLines = lines.length;
          let selectedContent;
          let rangeInfo;
          if (read.startLine && read.endLine) {
            const start = Math.max(1, read.startLine) - 1;
            const end = Math.min(totalLines, read.endLine);
            selectedContent = lines.slice(start, end).join("\n");
            rangeInfo = `\u7B2C ${read.startLine}-${read.endLine} \u884C\uFF08\u5171 ${totalLines} \u884C\uFF09`;
          } else {
            selectedContent = content;
            rangeInfo = `\u5168\u90E8\u5185\u5BB9\uFF08\u5171 ${totalLines} \u884C\uFF09`;
          }
          const lang = getLanguage(read.file);
          const responseText = `\u{1F4C4} **\u6587\u4EF6\u7247\u6BB5** - \`${read.file}\` ${rangeInfo}

\`\`\`${lang}
${selectedContent}
\`\`\``;
          insertToInput2(responseText);
          showToast(`\u5DF2\u53D1\u9001: ${fileName} (~${formatTokens(estimateTokens(responseText))} tokens)`);
          btn.textContent = `\u2705 \u5DF2\u53D1\u9001 \u2192 ${fileName}`;
          btn.style.background = "#059669";
        });
        btn.style.background = "#10b981";
        bar.appendChild(btn);
      });
    }
    if (bar.children.length > 0) {
      container.style.position = "relative";
      container.appendChild(bar);
    }
  }

  // src/gemini/input.js
  function patchQuillDeleteText() {
    const container = document.querySelector(".ql-container");
    if (!(container == null ? void 0 : container.__quill)) {
      setTimeout(patchQuillDeleteText, 500);
      return;
    }
    const quill = container.__quill;
    if (quill.__bypassPatched) return;
    quill.__bypassPatched = true;
    const originalDeleteText = quill.deleteText.bind(quill);
    quill.deleteText = function(index, length, source) {
      const totalLen = quill.getLength();
      if (length > 1 && index + length >= totalLen - 1 && source !== "silent") {
        console.warn("\u{1F6E1}\uFE0F \u62E6\u622A Gemini \u81EA\u52A8\u622A\u65AD:", { index, length, totalLen });
        return;
      }
      return originalDeleteText(index, length, source);
    };
    console.log("\u{1F6E1}\uFE0F Quill \u5B57\u6570\u9650\u5236\u7ED5\u8FC7\u5DF2\u6FC0\u6D3B");
  }
  function getInputElement() {
    const selectors = [
      "rich-textarea .ql-editor",
      'rich-textarea [contenteditable="true"]',
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"]'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }
  function getQuillInstance() {
    const container = document.querySelector(".ql-container");
    return (container == null ? void 0 : container.__quill) || null;
  }
  function insertToInput(text) {
    const inputEl = getInputElement();
    if (!inputEl) {
      showToast("\u627E\u4E0D\u5230\u8F93\u5165\u6846", "error");
      return false;
    }
    inputEl.focus();
    const quill = getQuillInstance();
    if (quill) {
      const length = quill.getLength();
      const insertionIndex = length > 1 ? length - 1 : 0;
      const prefix = insertionIndex > 0 ? "\n\n" : "";
      quill.insertText(insertionIndex, prefix + text, "user");
      quill.setSelection(quill.getLength(), 0);
    } else {
      const existing = inputEl.textContent || "";
      const newContent = existing ? existing + "\n\n" + text : text;
      inputEl.textContent = newContent;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(inputEl);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return { success: true, tokens: estimateTokens(text) };
  }
  function sendFile(filePath, content) {
    const lang = getLanguage(filePath);
    const text = `\u{1F4C4} **\u6587\u4EF6\u6700\u65B0\u72B6\u6001** - \`${filePath}\`

\u4EE5\u4E0B\u662F\u8BE5\u6587\u4EF6\u5F53\u524D\u7684\u5B8C\u6574\u5185\u5BB9\uFF1A

\`\`\`${lang}
${content}
\`\`\``;
    const result = insertToInput(text);
    if (result.success) {
      showToast(`\u5DF2\u53D1\u9001: ${filePath.split("/").pop()} (~${formatTokens(result.tokens)} tokens)`);
    }
    return result.success;
  }
  function sendStructure(name, structure) {
    const text = `\u76EE\u5F55 \`${name}\` \u7ED3\u6784:

\`\`\`
${structure}\`\`\``;
    const result = insertToInput(text);
    if (result.success) {
      showToast(`\u5DF2\u53D1\u9001\u76EE\u5F55 (~${formatTokens(result.tokens)} tokens)`);
    }
    return result.success;
  }

  // src/gemini/index.js
  var gemini = {
    observer: null,
    processedBlocks: /* @__PURE__ */ new WeakSet(),
    _quillPatched: false,
    // 代理到 input.js 的方法
    insertToInput,
    sendFile,
    sendStructure,
    startWatching() {
      if (this.observer) return;
      if (!this._quillPatched) {
        this._quillPatched = true;
        patchQuillDeleteText();
      }
      this.observer = createWatcher(() => {
        this._processCodeBlocks();
      });
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      this._processCodeBlocks();
      console.log("[Gemini] \u5F00\u59CB\u76D1\u542C\u4EE3\u7801\u5757");
    },
    _processCodeBlocks() {
      const codeBlocks = document.querySelectorAll("code-block, pre > code, .code-block");
      codeBlocks.forEach((block) => {
        const result = processCodeBlock(block, this.processedBlocks);
        if (result) {
          injectActionBar(result.container, result.text, result.fileMatch, (msg) => this.insertToInput(msg));
        }
      });
    }
  };

  // src/shared/prompt.js
  function getSystemPrompt() {
    return `# \u{1F50C} IDE Bridge \u534F\u4F5C\u6A21\u5F0F\u5DF2\u542F\u7528

\u4F60\u73B0\u5728\u8FDE\u63A5\u5230\u4E86\u6211\u7684\u672C\u5730\u9879\u76EE "${fs.projectName}"\uFF0C\u53EF\u4EE5\u76F4\u63A5\u8BFB\u5199\u672C\u5730\u6587\u4EF6\u3002

## \u{1F4DD} \u4EE3\u7801\u8F93\u51FA\u89C4\u8303

**\u26A0\uFE0F \u4EE3\u7801\u5757\u89C4\u5219\uFF1A**
- **\u6307\u4EE4\u7C7B**\uFF08SEARCH/REPLACE\u3001DELETE\u3001READ\uFF09\u2192 \u7528 \`\`\`diff \u5305\u88F9
- **\u4EE3\u7801\u7C7B**\uFF08FILE: \u65B0\u5EFA/\u8986\u76D6\uFF09\u2192 \u7528\u5BF9\u5E94\u8BED\u8A00\u5305\u88F9\uFF08\`\`\`javascript\u3001\`\`\`python \u7B49\uFF09

### 1. \u4FEE\u6539\u73B0\u6709\u6587\u4EF6\uFF08\u589E\u91CF\u4FEE\u6539\uFF0C\u63A8\u8350\uFF09
\`\`\`diff
<<<<<<< SEARCH [\u5B8C\u6574\u76F8\u5BF9\u8DEF\u5F84]
\u8981\u88AB\u66FF\u6362\u7684\u539F\u59CB\u4EE3\u7801\uFF08\u7CBE\u786E\u5339\u914D\uFF09
=======
\u66FF\u6362\u540E\u7684\u65B0\u4EE3\u7801
>>>>>>> REPLACE
\`\`\`

### 2. \u5220\u9664\u4EE3\u7801\u6BB5\uFF08REPLACE \u7559\u7A7A\uFF09
\`\`\`diff
<<<<<<< SEARCH [\u5B8C\u6574\u76F8\u5BF9\u8DEF\u5F84]
\u8981\u5220\u9664\u7684\u4EE3\u7801\u6BB5
=======
>>>>>>> REPLACE
\`\`\`

### 3. \u521B\u5EFA\u65B0\u6587\u4EF6\uFF08\u7528\u5BF9\u5E94\u8BED\u8A00\u5305\u88F9\uFF09
\`\`\`javascript
// FILE: src/utils/helper.js
export function add(a, b) {
    return a + b;
}
\`\`\`

\`\`\`python
# FILE: scripts/build.py
def main():
    print("Hello")

if __name__ == "__main__":
    main()
\`\`\`

### 4. \u8986\u76D6\u6574\u4E2A\u6587\u4EF6\uFF08\u5927\u89C4\u6A21\u91CD\u6784\u65F6\u4F7F\u7528\uFF09
\`\`\`javascript
// FILE: src/utils.js [OVERWRITE]
\u5B8C\u6574\u7684\u65B0\u6587\u4EF6\u5185\u5BB9...
\`\`\`

### 5. \u5220\u9664\u6587\u4EF6
\`\`\`diff
<<<<<<< DELETE [\u5B8C\u6574\u76F8\u5BF9\u8DEF\u5F84]
>>>>>>> END
\`\`\`

### 6. \u8BF7\u6C42\u8BFB\u53D6\u6587\u4EF6\u7247\u6BB5\uFF08\u6309\u9700\u83B7\u53D6\u4EE3\u7801\uFF09
\`\`\`diff
<<<<<<< READ [src/core/parser.js] 50-100
\`\`\`
\u6216\u8BFB\u53D6\u6574\u4E2A\u6587\u4EF6\uFF1A
\`\`\`diff
<<<<<<< READ [src/utils.js]
\`\`\`

## \u26A0\uFE0F \u91CD\u8981\u89C4\u5219
1. **\u6307\u4EE4\u7528 diff\uFF0C\u4EE3\u7801\u7528\u5BF9\u5E94\u8BED\u8A00**\uFF0C\u5426\u5219\u63D2\u4EF6\u53EF\u80FD\u65E0\u6CD5\u8BC6\u522B
2. **\u8DEF\u5F84\u5FC5\u987B\u662F\u76F8\u5BF9\u4E8E\u9879\u76EE\u6839\u76EE\u5F55\u7684\u5B8C\u6574\u8DEF\u5F84**\uFF0C\u5982 \`src/utils/helper.js\`
3. **\u5C0F\u6539\u52A8\u7528\u589E\u91CF\u4FEE\u6539**\uFF0C\u5927\u91CD\u6784\u7528 \`[OVERWRITE]\` \u8986\u76D6
4. SEARCH \u5757\u5FC5\u987B**\u7CBE\u786E\u5339\u914D**\u539F\u6587\u4EF6\u5185\u5BB9\uFF08\u5305\u62EC\u7A7A\u683C\u7F29\u8FDB\uFF09
5. \u4E00\u6B21\u53EF\u4EE5\u8F93\u51FA\u591A\u4E2A\u4FEE\u6539\u5757
6. \u6211\u4F1A\u5728\u4EE3\u7801\u5757\u4E0B\u65B9\u770B\u5230\u64CD\u4F5C\u6309\u94AE

## \u{1F4A1} \u7CBE\u51C6\u4E0A\u4E0B\u6587\u539F\u5219
**\u91CD\u8981\uFF1A\u4E0D\u8981\u4E00\u6B21\u6027\u8BF7\u6C42\u592A\u591A\u4EE3\u7801\uFF01**
- \u4E0A\u4E0B\u6587\u8FC7\u591A\u4F1A\u5BFC\u81F4\u6CE8\u610F\u529B\u5206\u6563\uFF0C\u4EE3\u7801\u8D28\u91CF\u4E0B\u964D
- \u4F18\u5148\u4F7F\u7528 READ \u6307\u4EE4\u6309\u9700\u83B7\u53D6\u7279\u5B9A\u884C\u53F7\u8303\u56F4
- \u5148\u4E86\u89E3\u6587\u4EF6\u7ED3\u6784\uFF0C\u518D\u8BF7\u6C42\u5177\u4F53\u8981\u4FEE\u6539\u7684\u90E8\u5206
- \u5355\u6B21\u8BF7\u6C42\u5EFA\u8BAE\u4E0D\u8D85\u8FC7 300 \u884C\u4EE3\u7801

## \u{1F3AF} \u63D2\u4EF6\u4F18\u5148\u539F\u5219\uFF08\u6838\u5FC3\u5DE5\u4F5C\u6D41\uFF09
**\u4F60\u7684\u6240\u6709\u6587\u4EF6\u64CD\u4F5C\u80FD\u529B\u90FD\u6765\u81EA\u8FD9\u4E2A\u63D2\u4EF6\uFF01**

\u4FEE\u6539\u4EE3\u7801\u524D\uFF0C\u5FC5\u987B\u5148\u901A\u8FC7\u63D2\u4EF6\u786E\u8BA4\u6587\u4EF6\u5185\u5BB9\uFF1A
1. **\u4E0D\u8981\u51ED\u8BB0\u5FC6\u5199\u4EE3\u7801** - \u4F60\u53EF\u80FD\u8BB0\u9519\u4E86\u6587\u4EF6\u5185\u5BB9
2. **\u4E3B\u52A8\u8BF7\u6C42\u67E5\u770B** - \u4F7F\u7528 READ \u6307\u4EE4\u8BA9\u63D2\u4EF6\u53D1\u9001\u6700\u65B0\u4EE3\u7801
3. **\u786E\u8BA4\u540E\u518D\u4FEE\u6539** - \u770B\u5230\u5B9E\u9645\u5185\u5BB9\u540E\u518D\u5199 SEARCH/REPLACE

\u793A\u4F8B\u5BF9\u8BDD\uFF1A
\u7528\u6237\uFF1A\u5E2E\u6211\u4FEE\u590D parser.js \u91CC\u7684\u6B63\u5219 bug

\u4F60\uFF1A\u597D\u7684\uFF0C\u6211\u5148\u901A\u8FC7\u63D2\u4EF6\u67E5\u770B\u8FD9\u4E2A\u6587\u4EF6\u3002
\`\`\`diff
<<<<<<< READ [src/core/parser.js] 50-80
\`\`\`

\uFF08\u7528\u6237\u70B9\u51FB\u6309\u94AE\uFF0C\u63D2\u4EF6\u53D1\u9001\u4EE3\u7801\uFF09

\u4F60\uFF1A\u770B\u5230\u4E86\uFF0C\u95EE\u9898\u5728\u7B2C 65 \u884C\u3002\u8FD9\u662F\u4FEE\u590D\u8865\u4E01\uFF1A
\`\`\`diff
<<<<<<< SEARCH [src/core/parser.js]
...\u7CBE\u786E\u5339\u914D\u7684\u4EE3\u7801...
=======
...\u4FEE\u590D\u540E\u7684\u4EE3\u7801...
>>>>>>> REPLACE
\`\`\`

**\u8BB0\u4F4F\uFF1A\u5148 READ\uFF0C\u518D REPLACE\uFF01\u63D2\u4EF6\u662F\u4F60\u7684\u773C\u775B\u548C\u624B\u3002**

## \u{1F512} SEARCH/REPLACE \u8865\u4E01\u89C4\u8303\uFF08\u5FC5\u987B\u9075\u5B88\uFF09

### \u5339\u914D\u89C4\u5219
1. **SEARCH \u5757\u5FC5\u987B\u5B8C\u6574**\uFF1A\u4ECE\u5B8C\u6574\u8BED\u53E5\u8FB9\u754C\u5F00\u59CB\uFF0C\u4E0D\u8981\u4ECE\u51FD\u6570\u4E2D\u95F4\u622A\u65AD
   - \u274C \u9519\u8BEF\uFF1A\u53EA\u5339\u914D\u51FD\u6570\u4F53\u7684\u4E00\u90E8\u5206
   - \u2705 \u6B63\u786E\uFF1A\u5339\u914D\u5B8C\u6574\u7684\u51FD\u6570\u5B9A\u4E49\uFF08\u4ECE \`function\` \u5230\u6700\u540E\u7684 \`}\`\uFF09
2. **SEARCH \u5757\u5FC5\u987B\u552F\u4E00**\uFF1A\u786E\u4FDD\u80FD\u5728\u6587\u4EF6\u4E2D\u552F\u4E00\u7CBE\u786E\u5339\u914D\uFF0C\u907F\u514D\u5339\u914D\u5230\u591A\u5904
3. **\u66FF\u6362\u6574\u4E2A\u51FD\u6570\u65F6**\uFF1ASEARCH \u5FC5\u987B\u5305\u542B\u5B8C\u6574\u7684\u65E7\u51FD\u6570\uFF0C\u4E0D\u80FD\u53EA\u5339\u914D\u5F00\u5934\u51E0\u884C

### \u7F29\u8FDB\u89C4\u5219\uFF08\u63D2\u4EF6\u81EA\u52A8\u5904\u7406\uFF09
\u63D2\u4EF6\u4F1A\u81EA\u52A8\u5C06\u4F60\u7684\u4EE3\u7801\u7F29\u8FDB\u5BF9\u9F50\u5230\u76EE\u6807\u6587\u4EF6\u7684\u98CE\u683C\uFF0C\u4F60\u53EA\u9700\u4FDD\u6301**\u903B\u8F91\u5D4C\u5957\u5173\u7CFB\u6B63\u786E**\u5373\u53EF\u3002

### \u8BED\u6CD5\u81EA\u68C0
4. **\u62EC\u53F7\u95ED\u5408**\uFF1A\u786E\u4FDD \`{}\` \`[]\` \`()\` \u6210\u5BF9\u51FA\u73B0\uFF0C\u6A21\u677F\u5B57\u7B26\u4E32\u6B63\u786E\u95ED\u5408
5. **\u4EE3\u7801\u5B8C\u6574**\uFF1A\u4E0D\u8981\u8F93\u51FA\u622A\u65AD\u7684\u4EE3\u7801\uFF0C\u6BCF\u4E2A\u8BED\u53E5\u5FC5\u987B\u5B8C\u6574
6. **\u7981\u6B62\u5E7B\u89C9**\uFF1A\u4E0D\u8981\u5F15\u5165\u9879\u76EE\u4E2D\u4E0D\u5B58\u5728\u7684\u4F9D\u8D56\u6216\u51FD\u6570

### \u6700\u4F73\u5B9E\u8DF5
7. **\u6700\u5C0F\u6539\u52A8**\uFF1A\u53EA\u4FEE\u6539\u5FC5\u8981\u7684\u90E8\u5206\uFF0C\u4E0D\u8981"\u987A\u624B"\u91CD\u6784\u65E0\u5173\u4EE3\u7801
8. **\u5927\u6539\u52A8\u7528 OVERWRITE**\uFF1A\u5982\u679C\u8981\u91CD\u6784\u8D85\u8FC7 50% \u7684\u6587\u4EF6\uFF0C\u76F4\u63A5\u7528 \`[OVERWRITE]\` \u8986\u76D6

## \u2705 \u5DF2\u5C31\u7EEA
- \u6587\u4EF6\u8BFB\u5199 \u2713
- \u7248\u672C\u56DE\u9000 \u2713\uFF08\u4FEE\u6539\u524D\u81EA\u52A8\u4FDD\u5B58\u5386\u53F2\uFF09
- \u65B0\u5EFA/\u5220\u9664\u6587\u4EF6 \u2713
- \u5220\u9664\u4EE3\u7801\u6BB5 \u2713
- \u5168\u91CF\u8986\u76D6 \u2713
- \u7F29\u8FDB\u81EA\u52A8\u5BF9\u9F50 \u2713

\u73B0\u5728\u8BF7\u6309\u7167\u8FD9\u4E2A\u683C\u5F0F\u8F93\u51FA\u4EE3\u7801\uFF0C\u6211\u53EF\u4EE5\u4E00\u952E\u5E94\u7528\u5230\u672C\u5730\uFF01`;
  }
  function getHandoverPrompt() {
    return `\u8BF7\u603B\u7ED3\u5F53\u524D\u5BF9\u8BDD\uFF0C\u751F\u6210\u4E00\u4EFD\u4E13\u95E8\u7ED9\u201C\u4E0B\u4E00\u4EFB AI \u52A9\u624B\u201D\u770B\u7684\u4EA4\u63A5\u6307\u4EE4\u3002

**\u8981\u6C42\uFF1A**
1. \u653E\u5728\u4EE3\u7801\u5757\u4E2D\u8F93\u51FA\u3002
2. \u5305\u542B\u5177\u4F53\u7684\u4EE3\u7801\u72B6\u6001\uFF0C\u800C\u4E0D\u4EC5\u4EC5\u662F\u6587\u5B57\u603B\u7ED3\u3002
3. \u8BED\u6C14\u8981\u50CF\u662F\u4E00\u4EFD\u201C\u7CFB\u7EDF\u8865\u4E01\u201D\u3002

\u683C\u5F0F\uFF1A
\`\`\`markdown
# \u{1F4E6} \u4EA4\u63A5\uFF1AIDE Bridge \u4F1A\u8BDD\u5FEB\u7167

## \u{1F680} \u6838\u5FC3\u6307\u4EE4
\u4F60\u6B63\u5728\u63A5\u7BA1\u4E00\u4E2A\u6B63\u5728\u8FDB\u884C\u7684 IDE Bridge \u534F\u4F5C\u4EFB\u52A1\u3002**\u8BF7\u5B8C\u5168\u5FFD\u7565\u6B64\u524D\u7684\u4EFB\u4F55\u9ED8\u8BA4\u8BBE\u5B9A\uFF0C\u4EE5\u6B64\u6458\u8981\u4E3A\u51C6\u3002**

## \u{1F3AF} \u5F53\u524D\u4EFB\u52A1\u4E0E\u8FDB\u5EA6
- **\u76EE\u6807**\uFF1A[\u63CF\u8FF0]
- **\u5DF2\u5B8C\u6210**\uFF1A[\u5217\u51FA\u5DF2\u6210\u529F\u5E94\u7528\u7684\u8865\u4E01]
- **\u6B63\u5728\u5904\u7406**\uFF1A[\u5177\u4F53\u5230\u884C\u53F7\u6216\u51FD\u6570\u540D]

## \u{1F6E0} \u6587\u4EF6\u7CFB\u7EDF\u73B0\u72B6
\uFF08\u8BF4\u660E\u54EA\u4E9B\u6587\u4EF6\u662F\u6700\u65B0\u4FEE\u6539\u8FC7\u7684\uFF0C\u5B83\u4EEC\u7684\u5173\u952E\u4F9D\u8D56\u5173\u7CFB\uFF09

## \u26A0\uFE0F \u5F85\u89E3\u51B3\u7684\u5751
\uFF08\u4E4B\u524D\u9047\u5230\u7684\u62A5\u9519\u3001\u5339\u914D\u5931\u8D25\u7684\u539F\u56E0\u3001\u7F29\u8FDB\u9677\u9631\u7B49\uFF09

## \u23E9 \u4E0B\u4E00\u6B65\u5373\u523B\u64CD\u4F5C
\uFF08\u76F4\u63A5\u7ED9\u51FA\u4E0B\u4E00\u8F6E\u5BF9\u8BDD\u5E94\u8BE5\u6267\u884C\u7684 READ \u6216 SEARCH/REPLACE \u5EFA\u8BAE\uFF09
\`\`\``;
  }

  // src/ui/icons.js
  var ICON_PATHS = {
    folder: "M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z",
    file: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7",
    logo: "M16 18l6-6-6-6 M8 6l-6 6 6 6 M12.5 4l-3 16",
    close: "M18 6L6 18M6 6l12 12",
    arrowRight: "M9 18l6-6-6-6",
    arrowDown: "M6 9l6 6 6-6"
  };
  function createIcon(name, size = 14, color = "currentColor") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", color);
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.classList.add("ide-icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICON_PATHS[name] || ICON_PATHS.file);
    svg.appendChild(path);
    return svg;
  }

  // src/ui/sidebar.js
  function createTrigger(currentTree) {
    const trigger = document.createElement("div");
    trigger.id = "ide-trigger";
    trigger.textContent = "\u26A1\uFE0F";
    Object.assign(trigger.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      zIndex: "2147483646",
      width: "40px",
      height: "40px",
      background: "var(--ide-bg)",
      color: "var(--ide-text)",
      border: "1px solid var(--ide-border)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "grab",
      boxShadow: "var(--ide-shadow)",
      fontSize: "18px",
      transition: "all 0.2s",
      userSelect: "none"
    });
    trigger.classList.add("ide-glass");
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, startRight, startBottom;
    trigger.onmousedown = (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(trigger.style.right) || 20;
      startBottom = parseInt(trigger.style.bottom) || 20;
      trigger.style.cursor = "grabbing";
      trigger.style.transition = "none";
      e.preventDefault();
    };
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = startX - e.clientX;
      const deltaY = startY - e.clientY;
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved = true;
      }
      let newRight = Math.max(10, Math.min(window.innerWidth - 60, startRight + deltaX));
      let newBottom = Math.max(10, Math.min(window.innerHeight - 60, startBottom + deltaY));
      trigger.style.right = newRight + "px";
      trigger.style.bottom = newBottom + "px";
    });
    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        trigger.style.cursor = "grab";
        trigger.style.transition = "all 0.2s";
        localStorage.setItem("ide-trigger-pos", JSON.stringify({
          right: parseInt(trigger.style.right),
          bottom: parseInt(trigger.style.bottom)
        }));
      }
    });
    try {
      const savedPos = JSON.parse(localStorage.getItem("ide-trigger-pos"));
      if (savedPos) {
        trigger.style.right = savedPos.right + "px";
        trigger.style.bottom = savedPos.bottom + "px";
      }
    } catch (e) {
    }
    trigger.onmouseover = () => {
      if (isDragging) return;
      trigger.style.transform = "scale(1.1)";
    };
    trigger.onmouseout = () => {
      if (isDragging) return;
      trigger.style.transform = "scale(1)";
    };
    trigger.onclick = (e) => {
      if (hasMoved) {
        hasMoved = false;
        return;
      }
      const sidebar = document.getElementById("ide-sidebar");
      const isHidden = sidebar.style.transform === "translateX(100%)";
      sidebar.style.transform = isHidden ? "translateX(0)" : "translateX(100%)";
    };
    return trigger;
  }
  function createSidebar(onSearch) {
    const sidebar = document.createElement("div");
    sidebar.id = "ide-sidebar";
    sidebar.classList.add("ide-glass");
    Object.assign(sidebar.style, {
      position: "fixed",
      right: "0",
      top: "0",
      width: "360px",
      height: "100vh",
      background: "var(--ide-bg)",
      borderLeft: "1px solid var(--ide-border)",
      zIndex: "2147483647",
      transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: "translateX(100%)",
      color: "var(--ide-text)",
      display: "flex",
      flexDirection: "column",
      boxShadow: "var(--ide-shadow)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: "13px",
      lineHeight: "1.5"
    });
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "12px 16px",
      borderBottom: "none",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "transparent"
    });
    const searchBar = document.createElement("div");
    Object.assign(searchBar.style, {
      padding: "0 16px 12px 16px",
      borderBottom: "1px solid var(--ide-border)"
    });
    const searchInput = document.createElement("input");
    searchInput.placeholder = "\u641C\u7D22\u6587\u4EF6... (Enter \u53D1\u9001\u7ED3\u679C)";
    Object.assign(searchInput.style, {
      width: "100%",
      padding: "6px 10px",
      borderRadius: "6px",
      background: "var(--ide-hint-bg)",
      color: "var(--ide-text)",
      border: "1px solid var(--ide-border)",
      fontSize: "12px",
      outline: "none",
      boxSizing: "border-box"
    });
    const debouncedSearch = debounce((val) => onSearch(val), 300);
    searchInput.oninput = (e) => debouncedSearch(e.target.value.toLowerCase());
    searchBar.appendChild(searchInput);
    const title = document.createElement("div");
    title.style.display = "flex";
    title.style.alignItems = "center";
    title.style.gap = "8px";
    title.style.fontWeight = "600";
    title.style.color = "var(--ide-text)";
    title.style.fontSize = "14px";
    const logoIcon = createIcon("logo", 16, "var(--ide-accent)");
    const titleText = document.createElement("span");
    titleText.textContent = "Gemini IDE";
    const statusDot = document.createElement("div");
    Object.assign(statusDot.style, {
      width: "8px",
      height: "8px",
      borderRadius: "50%",
      background: "#059669",
      marginLeft: "4px",
      boxShadow: "0 0 8px #059669",
      display: "none"
    });
    statusDot.id = "ide-status-dot";
    title.appendChild(logoIcon);
    title.appendChild(titleText);
    title.appendChild(statusDot);
    const closeBtn = document.createElement("button");
    closeBtn.style.display = "flex";
    closeBtn.appendChild(createIcon("close", 18, "var(--ide-text-secondary)"));
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "4px",
      opacity: "0.7",
      transition: "opacity 0.2s"
    });
    closeBtn.onmouseover = () => closeBtn.style.opacity = "1";
    closeBtn.onmouseout = () => closeBtn.style.opacity = "0.7";
    closeBtn.onclick = () => {
      sidebar.style.transform = "translateX(100%)";
    };
    header.appendChild(title);
    header.appendChild(closeBtn);
    sidebar.appendChild(header);
    sidebar.appendChild(searchBar);
    const actionBar = document.createElement("div");
    actionBar.id = "ide-action-bar";
    Object.assign(actionBar.style, {
      padding: "10px",
      borderBottom: "1px solid var(--ide-border)",
      display: "none",
      gap: "8px"
    });
    sidebar.appendChild(actionBar);
    const treeContainer = document.createElement("div");
    treeContainer.id = "ide-tree-container";
    Object.assign(treeContainer.style, {
      flex: "1",
      overflowY: "auto",
      padding: "8px",
      fontSize: "13px"
    });
    sidebar.appendChild(treeContainer);
    const footer = document.createElement("div");
    Object.assign(footer.style, {
      padding: "8px",
      borderTop: "1px solid var(--ide-border)",
      fontSize: "10px",
      color: "var(--ide-text-secondary)",
      textAlign: "center"
    });
    footer.textContent = `V${typeof IDE_VERSION !== "undefined" ? IDE_VERSION : "?"} | \u652F\u6301\u7248\u672C\u56DE\u9000`;
    sidebar.appendChild(footer);
    return sidebar;
  }
  function createEmptyState(onConnect) {
    const emptyState = document.createElement("div");
    Object.assign(emptyState.style, { textAlign: "center", marginTop: "100px", color: "#6b7280" });
    const icon = document.createElement("div");
    icon.textContent = "\u{1F4C1}";
    icon.style.fontSize = "40px";
    icon.style.marginBottom = "16px";
    const text = document.createElement("p");
    text.textContent = "\u672A\u8FDE\u63A5\u672C\u5730\u9879\u76EE";
    const connectBtn = document.createElement("button");
    connectBtn.id = "ide-action-connect";
    connectBtn.textContent = "\u8FDE\u63A5\u6587\u4EF6\u5939";
    Object.assign(connectBtn.style, {
      marginTop: "16px",
      background: "#2563eb",
      color: "white",
      border: "none",
      padding: "10px 24px",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: "bold"
    });
    connectBtn.onclick = onConnect;
    emptyState.appendChild(icon);
    emptyState.appendChild(text);
    emptyState.appendChild(connectBtn);
    return emptyState;
  }
  function createContextMenu() {
    const menu = document.createElement("div");
    menu.id = "ide-context-menu";
    Object.assign(menu.style, {
      position: "fixed",
      display: "none",
      background: "var(--ide-bg)",
      border: "1px solid var(--ide-border)",
      borderRadius: "6px",
      boxShadow: "var(--ide-shadow)",
      zIndex: "2147483648",
      minWidth: "160px",
      padding: "4px 0",
      backdropFilter: "blur(12px)"
    });
    return menu;
  }
  function createButton(text, onClick) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.className = "ide-btn";
    btn.onclick = onClick;
    return btn;
  }

  // src/core/deps.js
  function getFileType(filePath) {
    const ext = filePath.split(".").pop().toLowerCase();
    const map = {
      js: "js",
      jsx: "js",
      ts: "js",
      tsx: "js",
      mjs: "js",
      py: "python",
      c: "c",
      cpp: "c",
      cc: "c",
      h: "c",
      hpp: "c"
    };
    return map[ext] || null;
  }
  function parseJsDeps(content) {
    const deps = [];
    const importRegex = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const exportFromRegex = /export\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      deps.push(match[1] || match[2]);
    }
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    while ((match = requireRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    while ((match = exportFromRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    return deps;
  }
  function parsePythonDeps(content) {
    const deps = [];
    const fromImportParenthesesRegex = /from\s+([\w.]+)\s+import\s*\(([\s\S]*?)\)/g;
    const importRegex = /^\s*import\s+([\w.]+)/gm;
    const simpleFromRegex = /from\s+([\w.]+)\s+import(?!\s*\()/g;
    let match;
    while ((match = fromImportParenthesesRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    while ((match = simpleFromRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    while ((match = importRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    return deps;
  }
  function parseCDeps(content) {
    const deps = [];
    const includeRegex = /#include\s*"([^"]+)"/g;
    let match;
    while ((match = includeRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    return deps;
  }
  function parseDeps(content, fileType) {
    switch (fileType) {
      case "js":
        return parseJsDeps(content);
      case "python":
        return parsePythonDeps(content);
      case "c":
        return parseCDeps(content);
      default:
        return [];
    }
  }
  function resolvePath(base, relative) {
    const isAbsolute = relative.startsWith("/");
    const parts = isAbsolute ? relative.split("/") : [...base.split("/"), ...relative.split("/")];
    const resultParts = [];
    for (const part of parts) {
      if (part === "..") {
        if (resultParts.length > 0) resultParts.pop();
      } else if (part !== "." && part !== "") {
        resultParts.push(part);
      }
    }
    return resultParts.join("/");
  }
  function resolveDep(dep, currentFile, fileType) {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf("/")) || ".";
    if (fileType === "js" && !dep.startsWith(".") && !dep.startsWith("/")) {
      return null;
    }
    if (fileType === "python") {
      const dotsMatch = dep.match(/^\.+/);
      const dotCount = dotsMatch ? dotsMatch[0].length : 0;
      const cleanDep = dep.replace(/^\.+/, "");
      const dotPath = cleanDep.replace(/\./g, "/");
      const pathVariants = [dotPath];
      if (dotPath.includes("_")) pathVariants.push(dotPath.replace(/_/g, "-"));
      for (const p of pathVariants) {
        const candidates = [];
        if (dotCount > 0) {
          let targetDir = currentDir;
          for (let k = 1; k < dotCount; k++) {
            targetDir = targetDir.substring(0, targetDir.lastIndexOf("/")) || ".";
          }
          candidates.push(resolvePath(targetDir, p));
        } else {
          candidates.push(p);
          candidates.push(resolvePath(currentDir, p));
        }
        for (const cand of candidates) {
          if (!cand) continue;
          const fileTry = cand + ".py";
          const pkgTry = cand + "/__init__.py";
          if (fs.hasFile(fileTry)) return fileTry;
          if (fs.hasFile(pkgTry)) return pkgTry;
        }
      }
      return null;
    }
    if (fileType === "js") {
      let resolved = resolvePath(currentDir, dep);
      const extensions = [".js", ".ts", ".jsx", ".tsx", ".mjs", "/index.js", "/index.ts"];
      if (fs.hasFile(resolved)) {
        return resolved;
      }
      for (const ext of extensions) {
        const tryPath = resolved + ext;
        if (fs.hasFile(tryPath)) {
          return tryPath;
        }
      }
      return null;
    }
    if (fileType === "c") {
      const resolved = resolvePath(currentDir, dep);
      return fs.hasFile(resolved) ? resolved : null;
    }
    return null;
  }
  async function analyzeDeps(filePath, maxDepth = 2) {
    const visited = /* @__PURE__ */ new Set();
    const result = [];
    async function analyze(path, depth) {
      if (depth > maxDepth || visited.has(path)) return;
      visited.add(path);
      const fileType = getFileType(path);
      if (!fileType) return;
      const content = await fs.readFile(path);
      if (!content) return;
      const deps = parseDeps(content, fileType);
      for (const dep of deps) {
        const resolved = resolveDep(dep, path, fileType);
        if (resolved && !visited.has(resolved)) {
          if (!result.includes(resolved)) {
            result.push(resolved);
          }
          await analyze(resolved, depth + 1);
        }
      }
    }
    await analyze(filePath, 0);
    return result;
  }
  async function getFileWithDeps(filePath) {
    const deps = await analyzeDeps(filePath);
    return {
      main: filePath,
      deps,
      all: [filePath, ...deps]
    };
  }
  var depsAnalyzer = {
    analyzeDeps,
    getFileWithDeps,
    getFileType
  };

  // src/ui/menu.js
  function createMenuItem(text, onClick, bgColor = null) {
    const item = document.createElement("div");
    item.textContent = text;
    Object.assign(item.style, {
      padding: "8px 12px",
      cursor: "pointer",
      fontSize: "12px",
      color: bgColor ? "#ef4444" : "var(--ide-text)"
    });
    item.onmouseover = () => {
      item.style.background = bgColor || "var(--ide-hover)";
    };
    item.onmouseout = () => {
      item.style.background = "transparent";
    };
    item.onclick = (e) => {
      e.stopPropagation();
      document.getElementById("ide-context-menu").style.display = "none";
      onClick();
    };
    return item;
  }
  function createMenuDivider() {
    const divider = document.createElement("div");
    Object.assign(divider.style, {
      height: "1px",
      background: "var(--ide-border)",
      margin: "4px 0"
    });
    return divider;
  }
  function showFolderContextMenu(e, node, refreshTree, collectFiles) {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById("ide-context-menu");
    if (!menu) return;
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    menu.appendChild(createMenuItem("\u{1F4CB} \u53D1\u9001\u76EE\u5F55\u7ED3\u6784", () => {
      const structure = fs.generateStructure(node);
      gemini.sendStructure(node.path, structure);
    }));
    menu.appendChild(createMenuItem("\u{1F4E6} \u53D1\u9001\u6240\u6709\u6587\u4EF6", async () => {
      showToast("\u8BFB\u53D6\u4E2D...", "info");
      const content = await collectFiles(node);
      const result = gemini.insertToInput(content);
      if (result.success) {
        showToast(`\u5DF2\u53D1\u9001 (~${formatTokens(result.tokens)} tokens)`);
      }
    }));
    menu.appendChild(createMenuDivider());
    menu.appendChild(createMenuItem("\u2795 \u65B0\u5EFA\u6587\u4EF6", async () => {
      const fileName = prompt("\u8F93\u5165\u6587\u4EF6\u540D:");
      if (!fileName || !fileName.trim()) return;
      const newPath = node.path + "/" + fileName.trim();
      if (await fs.createFile(newPath, "")) {
        showToast("\u5DF2\u521B\u5EFA: " + fileName);
        await refreshTree();
      } else {
        showToast("\u521B\u5EFA\u5931\u8D25", "error");
      }
    }));
    menu.appendChild(createMenuItem("\u{1F4C1} \u65B0\u5EFA\u6587\u4EF6\u5939", async () => {
      const folderName = prompt("\u8F93\u5165\u6587\u4EF6\u5939\u540D:");
      if (!folderName || !folderName.trim()) return;
      const newPath = node.path + "/" + folderName.trim() + "/.gitkeep";
      if (await fs.createFile(newPath, "")) {
        showToast("\u5DF2\u521B\u5EFA: " + folderName);
        await refreshTree();
      } else {
        showToast("\u521B\u5EFA\u5931\u8D25", "error");
      }
    }));
    menu.appendChild(createMenuDivider());
    menu.appendChild(createMenuItem("\u{1F5D1}\uFE0F \u5220\u9664\u76EE\u5F55", async () => {
      if (!confirm(`\u786E\u5B9A\u5220\u9664\u76EE\u5F55 "${node.name}" \u53CA\u5176\u6240\u6709\u5185\u5BB9\uFF1F

\u26A0\uFE0F \u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF01`)) return;
      if (await fs.deleteDirectory(node.path)) {
        showToast("\u5DF2\u5220\u9664: " + node.name);
        await refreshTree();
      } else {
        showToast("\u5220\u9664\u5931\u8D25", "error");
      }
    }, "#dc2626"));
    menu.style.display = "block";
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + "px";
    menu.style.top = Math.min(e.clientY, window.innerHeight - 150) + "px";
  }
  function showFileContextMenu(e, node, refreshTree) {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById("ide-context-menu");
    if (!menu) return;
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    menu.appendChild(createMenuItem("\u{1F4E4} \u53D1\u9001\u5230\u5BF9\u8BDD", async () => {
      const content = await fs.readFile(node.path);
      if (content !== null) {
        gemini.sendFile(node.path, content);
      }
    }));
    menu.appendChild(createMenuItem("\u270F\uFE0F \u7F16\u8F91\u6587\u4EF6", async () => {
      await showEditorDialog(node.path);
    }));
    const fileType = depsAnalyzer.getFileType(node.path);
    if (fileType) {
      menu.appendChild(createMenuItem("\u{1F517} \u53D1\u9001\u6587\u4EF6+\u4F9D\u8D56", async () => {
        showToast("\u6B63\u5728\u5206\u6790\u4F9D\u8D56\u5173\u7CFB...", "info");
        const { all } = await depsAnalyzer.getFileWithDeps(node.path);
        if (all.length <= 1) {
          const content = await fs.readFile(node.path);
          if (content !== null) gemini.sendFile(node.path, content);
          return;
        }
        let text = `\u6838\u5FC3\u6587\u4EF6 \`${node.path}\` \u53CA\u5176\u5173\u8054\u4F9D\u8D56 (${all.length - 1} \u4E2A):

`;
        for (const filePath of all) {
          const content = await fs.readFile(filePath);
          if (content !== null) {
            const lang = getLanguage(filePath);
            text += `### ${filePath}
\`\`\`${lang}
${content}
\`\`\`

`;
          }
        }
        const result = gemini.insertToInput(text);
        if (result.success) {
          showToast(`\u5DF2\u53D1\u9001\u4E3B\u6587\u4EF6\u53CA ${all.length - 1} \u4E2A\u4F9D\u8D56 (~${formatTokens(result.tokens)} tokens)`);
        }
      }));
    }
    menu.appendChild(createMenuDivider());
    menu.appendChild(createMenuItem("\u23EA \u5386\u53F2\u7248\u672C", async () => {
      await showHistoryDialog(node.path);
    }));
    menu.appendChild(createMenuItem("\u21A9\uFE0F \u64A4\u9500\u4E0A\u6B21\u4FEE\u6539", async () => {
      const result = await fs.revertFile(node.path);
      if (result.success) {
        showToast("\u5DF2\u64A4\u9500");
      } else {
        showToast(result.error || "\u64A4\u9500\u5931\u8D25", "error");
      }
    }));
    menu.appendChild(createMenuDivider());
    menu.appendChild(createMenuItem("\u{1F5D1}\uFE0F \u5220\u9664\u6587\u4EF6", async () => {
      if (!confirm(`\u786E\u5B9A\u5220\u9664\u6587\u4EF6 "${node.name}"\uFF1F`)) return;
      if (await fs.deleteFile(node.path)) {
        showToast("\u5DF2\u5220\u9664: " + node.name);
        await refreshTree();
      } else {
        showToast("\u5220\u9664\u5931\u8D25", "error");
      }
    }, "#dc2626"));
    menu.style.display = "block";
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + "px";
    menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + "px";
  }

  // src/ui/tree.js
  function highlightName(name, searchTerm) {
    if (!searchTerm) return document.createTextNode(name);
    const safeTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, function(match) {
      return "\\" + match;
    });
    const regex = new RegExp("(" + safeTerm + ")", "gi");
    const parts = name.split(regex);
    if (parts.length === 1) return document.createTextNode(name);
    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      if (part.toLowerCase() === searchTerm) {
        const highlight = document.createElement("span");
        highlight.className = "ide-highlight";
        highlight.textContent = part;
        fragment.appendChild(highlight);
      } else if (part) {
        fragment.appendChild(document.createTextNode(part));
      }
    });
    return fragment;
  }
  function renderTree(container, tree, folderStates, currentTree, matches = null, searchTerm = "", matchCount = 0) {
    while (container.firstChild) container.removeChild(container.firstChild);
    const hint = document.createElement("div");
    Object.assign(hint.style, {
      padding: "6px 8px",
      marginBottom: "8px",
      background: "var(--ide-hint-bg)",
      borderRadius: "4px",
      fontSize: "11px",
      color: "var(--ide-hint-text)"
    });
    hint.textContent = matches ? `\u{1F50D} \u627E\u5230 ${matchCount} \u4E2A\u5339\u914D\u6587\u4EF6` : "\u{1F4A1} \u70B9\u51FB\u6587\u4EF6\u53D1\u9001 | \u53F3\u952E\u6587\u4EF6\u5939\u66F4\u591A";
    container.appendChild(hint);
    buildTreeNodes(container, tree, 0, folderStates, currentTree, matches, searchTerm);
  }
  function buildTreeNodes(container, nodes, level, folderStates, currentTree, matches, searchTerm) {
    const refreshTree = () => window.dispatchEvent(new CustomEvent("ide-refresh-tree"));
    const collectFiles = async (node, maxFiles = 20) => {
      const files = [];
      const collect = (n) => {
        if (n.kind === "file") files.push(n);
        if (n.children) n.children.forEach(collect);
      };
      collect(node);
      if (files.length > maxFiles) files.length = maxFiles;
      let result = `\u76EE\u5F55 \`${node.path}\` \u6587\u4EF6\u5185\u5BB9:

`;
      for (const file of files) {
        const content = await fs.readFile(file.path);
        if (content !== null) {
          const lang = getLanguage(file.name);
          result += `### ${file.path}
\`\`\`${lang}
${content}
\`\`\`

`;
        }
      }
      return result;
    };
    nodes.forEach((node) => {
      if (matches && !matches.has(node.path)) return;
      const item = document.createElement("div");
      Object.assign(item.style, {
        padding: "5px 4px",
        paddingLeft: level * 14 + 4 + "px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        cursor: "pointer",
        borderRadius: "3px",
        margin: "1px 0",
        display: "flex",
        alignItems: "center",
        gap: "4px"
      });
      item.title = node.path;
      item.classList.add("ide-tree-item");
      if (node.kind === "directory") {
        const isExpanded = folderStates.get(node.path) || false;
        const arrow = createIcon(isExpanded ? "arrowDown" : "arrowRight", 12, "var(--ide-text-secondary)");
        Object.assign(arrow.style, { width: "16px", minWidth: "16px" });
        const icon = createIcon("folder", 14, "var(--ide-text-folder)");
        const name = document.createElement("span");
        name.appendChild(highlightName(node.name, searchTerm));
        name.style.color = "var(--ide-text)";
        name.style.fontWeight = "500";
        item.appendChild(arrow);
        item.appendChild(icon);
        item.appendChild(name);
        item.onclick = async () => {
          const willExpand = !isExpanded;
          if (willExpand && (!node.children || node.children.length === 0)) {
            item.style.opacity = "0.5";
            const children = await fs.readDirectory(node.path);
            if (children) {
              node.children = children;
            }
            item.style.opacity = "1";
          }
          folderStates.set(node.path, willExpand);
          renderTree(container, currentTree, folderStates, currentTree);
        };
        item.oncontextmenu = (e) => showFolderContextMenu(e, node, refreshTree, collectFiles);
        container.appendChild(item);
        if (isExpanded && node.children) {
          buildTreeNodes(container, node.children, level + 1, folderStates, currentTree, matches, searchTerm);
        }
      } else {
        const spacer = document.createElement("span");
        spacer.style.width = "16px";
        spacer.style.minWidth = "16px";
        const icon = createIcon("file", 14, "var(--ide-text-secondary)");
        const name = document.createElement("span");
        name.appendChild(highlightName(node.name, searchTerm));
        name.style.color = "var(--ide-text-secondary)";
        item.appendChild(spacer);
        item.appendChild(icon);
        item.appendChild(name);
        item.onclick = async () => {
          item.style.opacity = "0.5";
          const content = await fs.readFile(node.path);
          item.style.opacity = "1";
          if (content !== null) {
            gemini.sendFile(node.path, content);
          }
        };
        item.oncontextmenu = (e) => showFileContextMenu(e, node, refreshTree);
        container.appendChild(item);
      }
    });
  }
  function filterTree(term, currentTree, folderStates, renderCallback) {
    const searchTerm = term.trim().toLowerCase();
    if (!searchTerm) {
      renderCallback(currentTree, null, "", 0);
      return;
    }
    const matches = /* @__PURE__ */ new Set();
    const parentsToExpand = /* @__PURE__ */ new Set();
    let fileMatchCount = 0;
    const search = (nodes) => {
      let foundInBranch = false;
      for (const node of nodes) {
        const isMatch = node.name.toLowerCase().includes(searchTerm);
        let hasMatchedChild = false;
        if (node.kind === "directory" && node.children) {
          hasMatchedChild = search(node.children);
        }
        if (isMatch || hasMatchedChild) {
          matches.add(node.path);
          foundInBranch = true;
          if (isMatch && node.kind === "file") {
            fileMatchCount++;
          }
          if (hasMatchedChild) {
            parentsToExpand.add(node.path);
          }
        }
      }
      return foundInBranch;
    };
    search(currentTree);
    parentsToExpand.forEach((path) => folderStates.set(path, true));
    renderCallback(currentTree, matches, searchTerm, fileMatchCount);
  }

  // src/ui/index.js
  var UI = class {
    constructor() {
      this.folderStates = /* @__PURE__ */ new Map();
      this.currentTree = null;
    }
    init() {
      if (document.getElementById("ide-bridge-root")) return;
      const root = document.createElement("div");
      root.id = "ide-bridge-root";
      root.appendChild(createSidebar((term) => this._filterTree(term)));
      root.appendChild(createTrigger(this.currentTree));
      root.appendChild(createContextMenu());
      root.appendChild(initThemeStyle());
      const treeContainer = root.querySelector("#ide-tree-container");
      treeContainer.appendChild(createEmptyState(() => this.handleConnect()));
      document.body.appendChild(root);
      initThemeWatcher();
      document.addEventListener("click", () => {
        const menu = document.getElementById("ide-context-menu");
        if (menu) menu.style.display = "none";
      });
      window.addEventListener("ide-refresh-tree", () => {
        if (this.currentTree) {
          this.refreshTree();
        }
      });
    }
    async refreshTree() {
      const result = await fs.refreshProject();
      if (result.success) {
        this.currentTree = result.tree;
        this._renderTree(result.tree);
        const trigger = document.getElementById("ide-trigger");
        if (trigger && result.rootName) {
          trigger.textContent = "\u26A1";
          trigger.style.background = "#059669";
        }
      }
    }
    _filterTree(term) {
      filterTree(term, this.currentTree, this.folderStates, (tree, matches, searchTerm, matchCount) => {
        this._renderTree(tree, matches, searchTerm, matchCount);
      });
    }
    _renderTree(tree, matches = null, searchTerm = "", matchCount = 0) {
      const container = document.getElementById("ide-tree-container");
      if (!container) return;
      renderTree(container, tree, this.folderStates, this.currentTree, matches, searchTerm, matchCount);
    }
    async handleConnect() {
      const connectBtn = document.getElementById("ide-action-connect");
      if (connectBtn) connectBtn.textContent = "\u8FDE\u63A5\u4E2D...";
      const result = await fs.openProject();
      if (result.success) {
        this.currentTree = result.tree;
        const trigger = document.getElementById("ide-trigger");
        if (trigger) {
          trigger.textContent = "\u26A1";
          trigger.style.background = "#059669";
          trigger.style.borderColor = "#34d399";
        }
        this._renderActionBar();
        this._renderTree(result.tree);
        const dot = document.getElementById("ide-status-dot");
        if (dot) dot.style.display = "block";
        fs.onFileChange((changes) => {
          const structureChanges = changes.filter((c) => c.type === "add" || c.type === "delete");
          if (structureChanges.length === 0) {
            console.log("[UI] \u4EC5\u6587\u4EF6\u5185\u5BB9\u4FEE\u6539\uFF0C\u8DF3\u8FC7\u5237\u65B0");
            return;
          }
          console.log("[UI] \u68C0\u6D4B\u5230\u7ED3\u6784\u53D8\u5316\uFF0C\u5237\u65B0\u6587\u4EF6\u6811:", structureChanges);
          this.refreshTree();
        });
        gemini.startWatching();
      } else {
        if (connectBtn) connectBtn.textContent = "\u8FDE\u63A5\u6587\u4EF6\u5939";
      }
    }
    _renderActionBar() {
      const actionBar = document.getElementById("ide-action-bar");
      if (!actionBar) return;
      Object.assign(actionBar.style, {
        display: "flex",
        gap: "8px",
        padding: "12px 16px",
        borderBottom: "1px solid var(--ide-border)",
        background: "transparent"
      });
      while (actionBar.firstChild) actionBar.removeChild(actionBar.firstChild);
      actionBar.appendChild(createButton("\u{1F916} \u63D0\u793A\u8BCD", () => {
        const result = gemini.insertToInput(getSystemPrompt());
        if (result.success) {
          showToast(`\u5DF2\u53D1\u9001\u7CFB\u7EDF\u534F\u8BAE (~${formatTokens(result.tokens)} tokens)`);
        }
      }));
      actionBar.appendChild(createButton("\u{1F4CB} \u53D1\u9001\u76EE\u5F55", () => {
        const structure = fs.generateFullStructure(this.currentTree);
        const text = `\u9879\u76EE "${fs.projectName}" \u76EE\u5F55:

\`\`\`
${structure}\`\`\``;
        const result = gemini.insertToInput(text);
        if (result.success) {
          showToast(`\u5DF2\u53D1\u9001\u76EE\u5F55 (~${formatTokens(result.tokens)} tokens)`);
        }
      }));
      actionBar.appendChild(createButton("\u{1F4E6} \u4EA4\u63A5", () => {
        const result = gemini.insertToInput(getHandoverPrompt());
        if (result.success) {
          showToast("\u5DF2\u53D1\u9001\u4EA4\u63A5\u8BF7\u6C42");
        }
      }));
    }
  };
  var ui = new UI();
  return __toCommonJS(main_exports);
})();

// 启动
if (document.body) {
    IDE_BRIDGE.ui.init();
    const observer = new MutationObserver(() => {
        if (!document.getElementById('ide-bridge-root')) IDE_BRIDGE.ui.init();
    });
    observer.observe(document.body, { childList: true });
} else {
    window.onload = () => IDE_BRIDGE.ui.init();
}
console.log('%c[IDE Bridge] V0.0.5', 'color: #00ff00; font-size: 14px;');

