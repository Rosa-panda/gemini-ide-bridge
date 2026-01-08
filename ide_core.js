/**
 * Gemini IDE Bridge Core (V0.0.4)
 * 自动构建于 2026-01-08T07:02:20.304Z
 */

(function() {
'use strict';

const IDE_VERSION = '0.0.4';

// ========== src/shared/utils.js ==========
/**
 * 工具函数模块
 */

function getLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        js: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx',
        py: 'python', java: 'java', cpp: 'cpp', c: 'c', go: 'go',
        rs: 'rust', rb: 'ruby', php: 'php', html: 'html', css: 'css',
        json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
        sql: 'sql', sh: 'bash', vue: 'vue', svelte: 'svelte',
        xml: 'xml', env: 'bash', toml: 'toml', ini: 'ini',
        dockerfile: 'dockerfile', docker: 'dockerfile'
    };
    return map[ext] || 'text';
}

function estimateTokens(text) {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 3.5);
}

function formatTokens(count) {
    if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
}

/**
* 防抖函数 - 限制高频事件触发
*/
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

let activeToasts = [];

function showToast(message, type = 'success') {
    const MAX_TOASTS = 5;
    const TOAST_GAP = 12;
    
    if (activeToasts.length >= MAX_TOASTS) {
        const oldest = activeToasts.shift();
        if (oldest) {
            oldest.style.opacity = '0';
            oldest.style.transform = `translateY(-20px)`;
            setTimeout(() => oldest.remove(), 300);
        }
    }

    const toast = document.createElement('div');
    toast.className = 'ide-toast-item';
    toast.textContent = message;
    
    const bgColor = type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#2563eb';
    
    Object.assign(toast.style, {
        position: 'fixed', 
        left: '30px',
        bottom: '80px',
        background: bgColor, 
        color: 'white', 
        padding: '10px 20px',
        borderRadius: '8px', 
        fontSize: '13px', 
        fontWeight: 'bold',
        zIndex: '2147483647', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        opacity: '0',
        transform: 'translateY(20px)'
    });

    document.body.appendChild(toast);
    activeToasts.push(toast);

    const updatePositions = () => {
        activeToasts.forEach((el, index) => {
            const offset = (activeToasts.length - 1 - index) * (45 + TOAST_GAP);
            el.style.setProperty('--offset', `-${offset}px`);
            el.style.opacity = '1';
            el.style.transform = `translateY(var(--offset)) scale(var(--scale, 1))`;
        });
    };

    requestAnimationFrame(() => updatePositions());

    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.style.setProperty('--scale', '0.9');
        toast.style.opacity = '0';
        
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


// ========== src/shared/theme.js ==========
/**
 * 主题模块 - 检测和管理主题样式
 */

function detectTheme() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/\d+/g);
    if (match) {
        const [r, g, b] = match.map(Number);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128 ? 'dark' : 'light';
    }
    return 'dark';
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
    
    if (theme === 'light') {
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
    const style = document.getElementById('ide-theme-style');
    if (style) {
        const theme = detectTheme();
        const newCSS = getThemeCSS(theme);
        if (style.textContent !== newCSS) {
            style.textContent = newCSS;
        }
    }
}

function initThemeStyle() {
    const style = document.createElement('style');
    style.id = 'ide-theme-style';
    style.textContent = getThemeCSS(detectTheme());
    return style;
}

/**
 * 初始化主题监听器
 * - MutationObserver 监听 body 的 style/class 变化
 * - matchMedia 监听系统主题偏好变化
 */
function initThemeWatcher() {
    // 1. MutationObserver 监听 body 变化
    const observer = new MutationObserver(() => updateTheme());
    
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['style', 'class', 'data-theme']
    });

    // 2. 监听系统主题偏好变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => updateTheme());
}


// ========== src/shared/prompt.js ==========
/**
 * 提示词模块 - 系统提示词生成
 */



function getSystemPrompt() {
    return `# 🔌 IDE Bridge 协作模式已启用

你现在连接到了我的本地项目 "${fs.projectName}"，可以直接读写本地文件。

## 📝 代码输出规范

**⚠️ 代码块规则：**
- **指令类**（SEARCH/REPLACE、DELETE、READ）→ 用 \`\`\`diff 包裹
- **代码类**（FILE: 新建/覆盖）→ 用对应语言包裹（\`\`\`javascript、\`\`\`python 等）

### 1. 修改现有文件（增量修改，推荐）
\`\`\`diff
<<<<<<< SEARCH [完整相对路径]
要被替换的原始代码（精确匹配）
=======
替换后的新代码
>>>>>>> REPLACE
\`\`\`

### 2. 删除代码段（REPLACE 留空）
\`\`\`diff
<<<<<<< SEARCH [完整相对路径]
要删除的代码段
=======
>>>>>>> REPLACE
\`\`\`

### 3. 创建新文件（用对应语言包裹）
\`\`\`javascript
// FILE: src/utils/helper.js
function add(a, b) {
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

### 4. 覆盖整个文件（大规模重构时使用）
\`\`\`javascript
// FILE: src/utils.js [OVERWRITE]
完整的新文件内容...
\`\`\`

### 5. 删除文件
\`\`\`diff
<<<<<<< DELETE [完整相对路径]
>>>>>>> END
\`\`\`

### 6. 请求读取文件片段（按需获取代码）
\`\`\`diff
<<<<<<< READ [src/core/parser.js] 50-100
\`\`\`
或读取整个文件：
\`\`\`diff
<<<<<<< READ [src/utils.js]
\`\`\`

## ⚠️ 重要规则
1. **指令用 diff，代码用对应语言**，否则插件可能无法识别
2. **路径必须是相对于项目根目录的完整路径**，如 \`src/utils/helper.js\`
3. **小改动用增量修改**，大重构用 \`[OVERWRITE]\` 覆盖
4. SEARCH 块必须**精确匹配**原文件内容（包括空格缩进）
5. 一次可以输出多个修改块
6. 我会在代码块下方看到操作按钮

## 💡 精准上下文原则
**重要：不要一次性请求太多代码！**
- 上下文过多会导致注意力分散，代码质量下降
- 优先使用 READ 指令按需获取特定行号范围
- 先了解文件结构，再请求具体要修改的部分
- 单次请求建议不超过 300 行代码

## 🎯 插件优先原则（核心工作流）
**你的所有文件操作能力都来自这个插件！**

修改代码前，必须先通过插件确认文件内容：
1. **不要凭记忆写代码** - 你可能记错了文件内容
2. **主动请求查看** - 使用 READ 指令让插件发送最新代码
3. **确认后再修改** - 看到实际内容后再写 SEARCH/REPLACE

示例对话：
用户：帮我修复 parser.js 里的正则 bug

你：好的，我先通过插件查看这个文件。
\`\`\`diff
<<<<<<< READ [src/core/parser.js] 50-80
\`\`\`

（用户点击按钮，插件发送代码）

你：看到了，问题在第 65 行。这是修复补丁：
\`\`\`diff
<<<<<<< SEARCH [src/core/parser.js]
...精确匹配的代码...
=======
...修复后的代码...
>>>>>>> REPLACE
\`\`\`

**记住：先 READ，再 REPLACE！插件是你的眼睛和手。**

## 🔒 SEARCH/REPLACE 补丁规范（必须遵守）

### 匹配规则
1. **SEARCH 块必须完整**：从完整语句边界开始，不要从函数中间截断
   - ❌ 错误：只匹配函数体的一部分
   - ✅ 正确：匹配完整的函数定义（从 \`function\` 到最后的 \`}\`）
2. **SEARCH 块必须唯一**：确保能在文件中唯一精确匹配，避免匹配到多处
3. **替换整个函数时**：SEARCH 必须包含完整的旧函数，不能只匹配开头几行

### 缩进规则（插件自动处理）
插件会自动将你的代码缩进对齐到目标文件的风格，你只需保持**逻辑嵌套关系正确**即可。

### 语法自检
4. **括号闭合**：确保 \`{}\` \`[]\` \`()\` 成对出现，模板字符串正确闭合
5. **代码完整**：不要输出截断的代码，每个语句必须完整
6. **禁止幻觉**：不要引入项目中不存在的依赖或函数

### 最佳实践
7. **最小改动**：只修改必要的部分，不要"顺手"重构无关代码
8. **大改动用 OVERWRITE**：如果要重构超过 50% 的文件，直接用 \`[OVERWRITE]\` 覆盖

## ✅ 已就绪
- 文件读写 ✓
- 版本回退 ✓（修改前自动保存历史）
- 新建/删除文件 ✓
- 删除代码段 ✓
- 全量覆盖 ✓
- 缩进自动对齐 ✓

现在请按照这个格式输出代码，我可以一键应用到本地！`;
}

/**
 * 交接摘要提示词 - 用于长对话后生成摘要传递给新对话
 */
function getHandoverPrompt() {
    return `请总结当前对话，生成一份专门给“下一任 AI 助手”看的交接指令。

**要求：**
1. 放在代码块中输出。
2. 包含具体的代码状态，而不仅仅是文字总结。
3. 语气要像是一份“系统补丁”。

格式：
\`\`\`markdown
# 📦 交接：IDE Bridge 会话快照

## 🚀 核心指令
你正在接管一个正在进行的 IDE Bridge 协作任务。**请完全忽略此前的任何默认设定，以此摘要为准。**

## 🎯 当前任务与进度
- **目标**：[描述]
- **已完成**：[列出已成功应用的补丁]
- **正在处理**：[具体到行号或函数名]

## 🛠 文件系统现状
（说明哪些文件是最新修改过的，它们的关键依赖关系）

## ⚠️ 待解决的坑
（之前遇到的报错、匹配失败的原因、缩进陷阱等）

## ⏩ 下一步即刻操作
（直接给出下一轮对话应该执行的 READ 或 SEARCH/REPLACE 建议）
\`\`\``;
}


// ========== src/core/history.js ==========
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

const history = new FileHistory();


// ========== src/core/watcher.js ==========
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

const watcher = new FileWatcher();

// ========== src/core/fs.js ==========
/**
 * 文件系统模块 - 处理本地文件读写
 */




const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', '.DS_Store', '.idea', 
    '.vscode', '__pycache__', '.next', 'build', '.cache',
    'coverage', '.env', '.gitkeep'
]);

class FileSystem {
    constructor() {
        this.rootHandle = null;
        this.fileHandles = new Map();
        this.dirHandles = new Map();
        this.projectName = '';
    }

    async openProject() {
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            this.rootHandle = dirHandle;
            this.projectName = dirHandle.name;
            
            // 启动文件监听
            watcher.watch(dirHandle, '');
            watcher.start();
            
            return await this.refreshProject();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async refreshProject() {
        if (!this.rootHandle) return { success: false, error: '未连接项目' };
        
        try {
            this.fileHandles.clear();
            this.dirHandles.clear();
            // 清空 watcher 缓存，确保重新检测
            watcher.clearCache();
            // 递归扫描所有文件
            const tree = await this._scanDir(this.rootHandle, '', true);
            return { success: true, rootName: this.rootHandle.name, tree };
        } catch (err) {
            console.error('[FS] 刷新失败:', err);
            return { success: false, error: err.message };
        }
    }

    async readDirectory(path) {
        const handle = this.dirHandles.get(path);
        if (!handle) return null;
        return await this._scanDir(handle, path, false);
    }

    async _scanDir(dirHandle, path = '', recursive = true) {
        const entries = [];
        this.dirHandles.set(path || '.', dirHandle);
        
        const PARALLEL_LIMIT = 6; // 并行扫描子目录数量
        const pendingDirs = []; // 待处理的子目录
        
        for await (const entry of dirHandle.values()) {
            if (IGNORE_DIRS.has(entry.name)) continue;
            const relPath = path ? `${path}/${entry.name}` : entry.name;
            
            if (entry.kind === 'file') {
                this.fileHandles.set(relPath, entry);
                entries.push({ name: entry.name, kind: 'file', path: relPath });
            } else if (entry.kind === 'directory') {
                this.dirHandles.set(relPath, entry);
                const dirEntry = {
                    name: entry.name, kind: 'directory', path: relPath,
                    children: []
                };
                entries.push(dirEntry);
                if (recursive) {
                    pendingDirs.push({ handle: entry, path: relPath, entry: dirEntry });
                }
            }
        }
        
        // 并行扫描子目录（限制并发数）
        for (let i = 0; i < pendingDirs.length; i += PARALLEL_LIMIT) {
            const batch = pendingDirs.slice(i, i + PARALLEL_LIMIT);
            const results = await Promise.all(
                batch.map(dir => this._scanDir(dir.handle, dir.path, true))
            );
            batch.forEach((dir, idx) => {
                dir.entry.children = results[idx];
            });
            // 每批处理完让出主线程
            if (i + PARALLEL_LIMIT < pendingDirs.length) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
        
        return entries.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });
    }

    async readFile(filePath) {
        const handle = this.fileHandles.get(filePath);
        if (!handle) return null;
        try {
            const file = await handle.getFile();
            const content = await file.text();
            this._lineEndings = this._lineEndings || new Map();
            this._lineEndings.set(filePath, content.includes('\r\n') ? '\r\n' : '\n');
            return content;
        } catch (err) {
            console.error('[FS] 读取失败:', filePath, err);
            return null;
        }
    }

    getLineEnding(filePath) {
        return this._lineEndings?.get(filePath) || '\n';
    }

    async writeFile(filePath, content, saveHistory = true) {
        const handle = this.fileHandles.get(filePath);
        if (!handle) {
            console.error('[FS] 文件不存在:', filePath);
            return false;
        }
        try {
            if (saveHistory) {
                const oldContent = await this.readFile(filePath);
                // 优化：只有内容发生变化且不为 null 时才保存历史
                if (oldContent !== null && oldContent !== content) {
                    await history.saveVersion(filePath, oldContent);
                }
            }
            
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (err) {
            console.error('[FS] 写入失败:', filePath, err);
            return false;
        }
    }

    async revertFile(filePath) {
        const lastVersion = await history.getLastVersion(filePath);
        if (!lastVersion) {
            return { success: false, error: '没有可回退的版本' };
        }
        // 关键修改：saveHistory 改为 true，保留"撤销前"的状态，允许"撤销撤销"
        const success = await this.writeFile(filePath, lastVersion.content, true);
        return { success, content: lastVersion.content, timestamp: lastVersion.timestamp };
    }

    async revertToVersion(filePath, timestamp) {
        const versions = await history.getVersions(filePath);
        const target = versions.find(v => v.timestamp === timestamp);
        if (!target) {
            return { success: false, error: '版本不存在' };
        }
        // 关键修改：saveHistory 改为 true
        const success = await this.writeFile(filePath, target.content, true);
        return { success, content: target.content };
    }

    async getFileHistory(filePath) {
        return await history.getVersions(filePath);
    }

    async createFile(filePath, content = '') {
        if (!this.rootHandle) return false;
        try {
            const parts = filePath.split('/');
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
            console.error('[FS] 创建文件失败:', filePath, err);
            return false;
        }
    }

    async deleteFile(filePath) {
        if (!this.rootHandle) return false;
        
        try {
            const parts = filePath.split('/');
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
            console.error('[FS] 删除文件失败:', filePath, err);
            return false;
        }
    }

    async deleteDirectory(dirPath) {
        if (!this.rootHandle) return false;
        
        try {
            const parts = dirPath.split('/');
            const dirName = parts.pop();
            
            let parentHandle = this.rootHandle;
            for (const part of parts) {
                parentHandle = await parentHandle.getDirectoryHandle(part);
            }
            
            await parentHandle.removeEntry(dirName, { recursive: true });
            
            const pathsToDelete = [];
            for (const [path] of this.fileHandles) {
                if (path === dirPath || path.startsWith(dirPath + '/')) {
                    pathsToDelete.push(path);
                }
            }
            
            for (const path of pathsToDelete) {
                this.fileHandles.delete(path);
                await history.clearFileHistory(path);
            }
            
            // 清理目录句柄 (包括子目录)
            const dirsToDelete = [];
            for (const [path] of this.dirHandles) {
                if (path === dirPath || path.startsWith(dirPath + '/')) {
                    dirsToDelete.push(path);
                }
            }
            for (const path of dirsToDelete) {
                this.dirHandles.delete(path);
            }
            
            return true;
        } catch (err) {
            console.error('[FS] 删除目录失败:', dirPath, err);
            return false;
        }
    }

    hasFile(filePath) {
        return this.fileHandles.has(filePath);
    }

    getAllFilePaths() {
        return Array.from(this.fileHandles.keys());
    }

    generateStructure(node, indent = '', isLast = true) {
        let result = '';
        const marker = isLast ? '└── ' : '├── ';
        const icon = node.kind === 'directory' ? '📂' : '📄';
        
        result += indent + marker + icon + node.name + '\n';
        
        if (node.kind === 'directory' && node.children) {
            const nextIndent = indent + (isLast ? '    ' : '│   ');
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
            return this.generateStructure(node, '', isLast);
        }).join('');
    }

    /**
     * 标记目录展开状态（供 watcher 优化检测）
     * @param {string} path 
     */
    markDirExpanded(path) {
        watcher.markExpanded(path);
        // 同时注册该目录的 handle 到 watcher
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
}

const fs = new FileSystem();



// ========== src/core/parser.js ==========
/**
 * 解析器模块 - 解析 AI 输出的指令
 */

/**
 * 提取文件路径 (支持 [OVERWRITE] 标记)
 */
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

/**
 * 检测是否为 OVERWRITE 模式
 */
function isOverwriteMode(text) {
    return /FILE:\s*.+?\s*\[OVERWRITE\]/i.test(text);
}

/**
 * 解析 DELETE 块
 */
function parseDelete(text) {
    const deletes = [];
    // 同步优化：增加 {6,10} 兼容性与行首锚点，防止误匹配
    const regex = /^<{6,10}\s*DELETE\s*\[([^\]]+)\]\s*[\s\S]*?^>{6,10}\s*END\s*$/gm;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        deletes.push({
            file: match[1].trim()
        });
    }
    
    return deletes;
}

/**
 * 解析 READ 块（请求读取文件片段）
 * 支持多种格式：
 * - <<<<<<< READ [path] 50-100
 * - <<<<<<< READ [path]
 * - 同一行多个 READ
 */
function parseRead(text) {
    const reads = [];
    // 不用 ^ 锚点，允许同一行多个 READ
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

/**
 * 解析 SEARCH/REPLACE 块（支持空 replace 表示删除）
 * 支持两种格式：
 * - <<<<<<< SEARCH [path/to/file]
 * - <<<<<<< SEARCH path/to/file
 */
function parseSearchReplace(text) {
    const patches = [];
    /**
     * 稳健性增强正则：
     * 1. ^...$ + m 模式：确保标记必须占据整行。
     * 2. \s*?\n：允许标记行末尾有不可见空格。
     * 3. ^={6,10}\s*$：确保分隔符必须在行首，且允许行末空格。
     * 4. 避免了非行首的 ======= 误触发截断。
     */
    // 优化：REPLACE 标记前的 \n 改为 \n?，增强对 AI 偶尔漏掉最后一个换行的容错性
    // 兼容 Gemini 输出的带行号格式：<<<<<<< SEARCH [file] 414-428
    const regex = /^<{6,10} SEARCH(?:\s*\[([^\]]+)\]|\s+([^\s\n]+))?(?:\s+\d+-\d+)?\s*?\n([\s\S]*?)\n^={6,10}\s*?\n([\s\S]*?)\n?^>{6,10} REPLACE\s*$/gm;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        patches.push({
            file: (match[1] || match[2] || null)?.trim(),
            search: match[3],
            // 移除末尾可能存在的换行符，保持内容纯净
            replace: match[4].replace(/\n$/, ''),
            isDelete: match[4].trim() === ''
        });
    }
    
    return patches;
}

/**
 * 清理代码内容 (移除 FILE: 注释)
 */
function cleanContent(text) {
    return text
        .replace(/^\/\/\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*\n?/m, '')
        .replace(/^#\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*\n?/m, '')
        .replace(/^\/\*\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*\*\/\n?/m, '')
        .replace(/^<!--\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*-->\n?/m, '')
        .trim();
}

/**
 * 解析多个 FILE: 块（批量创建/覆盖）
 */
function parseMultipleFiles(text) {
    const files = [];
    const filePattern = /(?:\/\/|#|\/\*)\s*FILE:\s*\[?(.+?)\]?(?:\s*\[OVERWRITE\])?\s*(?:\*\/|-->)?$/gm;
    
    const matches = [];
    let match;
    while ((match = filePattern.exec(text)) !== null) {
        matches.push({
            index: match.index,
            path: match[1].trim(),
            isOverwrite: match[0].includes('[OVERWRITE]')
        });
    }
    
    if (matches.length === 0) return files;
    
    for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
        
        let blockText = text.substring(current.index, nextIndex);
        blockText = blockText
            .replace(/^(?:\/\/|#|\/\*)\s*FILE:.*(?:\r?\n|$)/m, '')
            .trim();
        
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


// ========== src/core/state.js ==========
/**
 * 状态管理模块 - 补丁应用状态持久化
 */

const STORAGE_KEY = 'ide-applied-patches';

/**
 * 生成修改块的唯一标识
 */
function getPatchKey(file, search) {
    const content = file + ':' + search.slice(0, 100);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash = hash & hash;
    }
    return 'patch_' + Math.abs(hash).toString(36);
}

/**
 * 记录已应用的修改
 */
function markAsApplied(file, search) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = getPatchKey(file, search);
        data[key] = { file, timestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[IDE] 保存应用记录失败', e);
    }
}

/**
 * 移除应用记录（撤销时）
 */
function unmarkAsApplied(file, search) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = getPatchKey(file, search);
        delete data[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[IDE] 移除应用记录失败', e);
    }
}

/**
 * 检查修改是否已应用
 */
async function checkIfApplied(file, search, replace, fsModule) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = getPatchKey(file, search);
        const hasRecord = !!data[key];
        
        if (fsModule.hasFile(file)) {
            const content = await fsModule.readFile(file);
            if (content !== null) {
                const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
                const normalizedContent = normalize(content);
                const normalizedSearch = normalize(search);
                
                const searchExists = normalizedContent.includes(normalizedSearch);
                
                if (searchExists) {
                    return { applied: false, confident: true };
                }
                
                if (hasRecord) {
                    return { applied: true, confident: true };
                }
            }
        }
        
        return { applied: false, confident: false };
    } catch (e) {
        return { applied: false, confident: false };
    }
}


// ========== src/core/deps.js ==========
/**
 * 依赖分析模块 - 自动解析文件的 import/require 依赖
 */



function getFileType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const map = {
        js: 'js', jsx: 'js', ts: 'js', tsx: 'js', mjs: 'js',
        py: 'python',
        c: 'c', cpp: 'c', cc: 'c', h: 'c', hpp: 'c'
    };
    return map[ext] || null;
}

function parseJsDeps(content) {
    const deps = [];
    const importRegex = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const exportFromRegex = /export\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
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
    // 1. 处理 from module import (...)
    const fromImportParenthesesRegex = /from\s+([\w.]+)\s+import\s*\(([\s\S]*?)\)/g;
    // 2. 处理 import module [as alias]
    const importRegex = /^\s*import\s+([\w.]+)/gm;
    // 3. 处理 from .[module] import ...
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
        case 'js': return parseJsDeps(content);
        case 'python': return parsePythonDeps(content);
        case 'c': return parseCDeps(content);
        default: return [];
    }
}

function resolvePath(base, relative) {
    const isAbsolute = relative.startsWith('/');
    const parts = isAbsolute ? relative.split('/') : [...base.split('/'), ...relative.split('/')];
    
    const resultParts = [];
    for (const part of parts) {
        if (part === '..') {
            if (resultParts.length > 0) resultParts.pop();
        } else if (part !== '.' && part !== '') {
            resultParts.push(part);
        }
    }
    return resultParts.join('/');
}

function resolveDep(dep, currentFile, fileType) {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/')) || '.';
    
    if (fileType === 'js' && !dep.startsWith('.') && !dep.startsWith('/')) {
        return null;
    }
    
    if (fileType === 'python') {
        const dotsMatch = dep.match(/^\.+/);
        const dotCount = dotsMatch ? dotsMatch[0].length : 0;
        const cleanDep = dep.replace(/^\.+/, '');
        const dotPath = cleanDep.replace(/\./g, '/');
        
        const pathVariants = [dotPath];
        if (dotPath.includes('_')) pathVariants.push(dotPath.replace(/_/g, '-'));

        for (const p of pathVariants) {
            const candidates = [];
            if (dotCount > 0) {
                // 处理 Python 相对路径层级: . 是当前目录, .. 是上一级
                let targetDir = currentDir;
                for (let k = 1; k < dotCount; k++) {
                    targetDir = targetDir.substring(0, targetDir.lastIndexOf('/')) || '.';
                }
                candidates.push(resolvePath(targetDir, p));
            } else {
                candidates.push(p); 
                candidates.push(resolvePath(currentDir, p));
            }

            for (const cand of candidates) {
                if (!cand) continue;
                const fileTry = cand + '.py';
                const pkgTry = cand + '/__init__.py';
                
                if (fs.hasFile(fileTry)) return fileTry;
                if (fs.hasFile(pkgTry)) return pkgTry;
            }
        }
        return null;
    }
    
    if (fileType === 'js') {
        let resolved = resolvePath(currentDir, dep);
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '/index.js', '/index.ts'];
        
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
    
    if (fileType === 'c') {
        const resolved = resolvePath(currentDir, dep);
        return fs.hasFile(resolved) ? resolved : null;
    }
    
    return null;
}

async function analyzeDeps(filePath, maxDepth = 2) {
    const visited = new Set();
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
        deps: deps,
        all: [filePath, ...deps]
    };
}

const depsAnalyzer = {
    analyzeDeps,
    getFileWithDeps,
    getFileType
};


// ========== src/core/patcher/literals.js ==========
/**
 * 语义掩码模块 - 保护多行字符串不被缩进处理破坏
 */

/**
 * 提取并保护多行字符串（语义掩码）
 * 返回 { masked: 处理后的代码, literals: 原始字符串映射 }
 */
function extractLiterals(code) {
    const literals = new Map();
    let counter = 0;
    let result = '';
    let i = 0;
    const len = code.length;
    
    while (i < len) {
        // Python 三引号字符串 """ 或 '''
        if ((code.slice(i, i + 3) === '"""' || code.slice(i, i + 3) === "'''")) {
            const quote = code.slice(i, i + 3);
            const start = i;
            i += 3;
            
            // 找到结束引号
            while (i < len - 2) {
                if (code.slice(i, i + 3) === quote) {
                    i += 3;
                    break;
                }
                if (code[i] === '\\') i++; // 跳过转义
                i++;
            }
            
            const literal = code.slice(start, i);
            const placeholder = '__LITERAL_' + counter++ + '__';
            literals.set(placeholder, literal);
            result += placeholder;
            continue;
        }
        
        // JS 模板字符串 ` （包含换行的才保护）
        if (code[i] === '`') {
            const start = i;
            i++;
            let hasNewline = false;
            let depth = 1;
            
            while (i < len && depth > 0) {
                if (code[i] === '\n') hasNewline = true;
                if (code[i] === '\\') {
                    i += 2;
                    continue;
                }
                // 检测 ${ (插值开始) 或普通 { (插值内部的对象)
                if (code[i] === '$' && code[i + 1] === '{') {
                    depth++;
                    i += 2;
                    continue;
                }
                if (code[i] === '{' && depth > 1) {
                    depth++;
                    i++;
                    continue;
                }
                // 只有在插值深度内才减少深度
                if (code[i] === '}' && depth > 1) {
                    depth--;
                    i++;
                    continue;
                }
                if (code[i] === '`') {
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
                const placeholder = '__LITERAL_' + counter++ + '__';
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

/**
* 还原被保护的字符串
*/
function restoreLiterals(code, literals) {
    let result = code;
    for (const [placeholder, original] of literals) {
        // 安全修复：使用 split/join 替代 replace
        // 理由：String.prototype.replace(str, str) 会解析 original 中的 $ 符号
        // 这在代码替换场景下极易导致内容损毁（如把 $1 误当成正则分组）
        result = result.split(placeholder).join(original);
    }
    return result;
}


// ========== src/core/patcher/lineEnding.js ==========
/**
 * 换行符处理模块 - 镜像风格回写
 */

/**
 * 检测文件的换行符风格
 */
function detectLineEnding(content) {
    if (content.includes('\r\n')) return '\r\n';
    return '\n';
}

/**
 * 统一换行符为 LF（内部处理用）
 */
function normalizeLineEnding(content) {
    return content.replace(/\r\n/g, '\n');
}

/**
 * 恢复原始换行符风格
 */
function restoreLineEnding(content, originalEnding) {
    if (originalEnding === '\r\n') {
        return content.replace(/\n/g, '\r\n');
    }
    return content;
}


// ========== src/core/patcher/matcher.js ==========
/**
 * 匹配器模块 - 逻辑签名匹配算法
 */

// 预编译正则 - 避免每次调用重复编译
const RE_CRLF = /\r\n/g;
const RE_CR = /\r/g;
const RE_ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const RE_LEADING_SPACE = /^(\s*)/;
const RE_TAB = /\t/g;

/**
* 核心：将代码转化为纯粹的逻辑行序列（忽略空行、换行符差异）
* 对于 Python 等缩进敏感语言，保留缩进深度信息
*/
function getLogicSignature(code) {
    return code.replace(RE_CRLF, '\n')
                .replace(RE_CR, '\n')
                .split('\n')
                .map((line, index) => {
                    // 核心优化：只 trimRight，保留逻辑所需的左侧缩进意图
                    // 但 content 比较时使用全 trim 后的内容
                    const cleanLine = line.replace(RE_ZERO_WIDTH, '').replace(/\s+$/, '');
                    const trimmed = cleanLine.trim();
                    const indentMatch = cleanLine.match(RE_LEADING_SPACE);
                    const indentStr = indentMatch ? indentMatch[1].replace(RE_TAB, '    ') : '';
                    return { 
                        content: trimmed, 
                        indent: indentStr.length,
                        originalIndex: index 
                    };
                })
                .filter(item => item.content.length > 0);
}

/**
* 极致鲁棒的计数器：支持逻辑签名匹配
* @param {boolean} isStrictIndent 是否开启严格缩进校验（Python 建议开启）
*/
function countMatches(content, search, isStrictIndent = false) {
    const contentSigs = typeof content === 'string' ? getLogicSignature(content) : content;
    const searchSigs = typeof search === 'string' ? getLogicSignature(search) : search;
    
    if (searchSigs.length === 0) return 0;
    
    let count = 0;
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
        if (checkMatchAt(contentSigs, searchSigs, i, isStrictIndent)) {
            count++;
        }
    }
    return count;
}

/**
* 内部函数：检查指定位置是否匹配
*/
function checkMatchAt(contentSigs, searchSigs, startIdx, isStrictIndent) {
    // 基础逻辑匹配
    for (let j = 0; j < searchSigs.length; j++) {
        if (contentSigs[startIdx + j].content !== searchSigs[j].content) {
            return false;
        }
    }
    
    // Python 语义缩进校验：检查相对缩进变化是否一致
    if (isStrictIndent && searchSigs.length > 1) {
        const fileBaseIndent = contentSigs[startIdx].indent;
        const searchBaseIndent = searchSigs[0].indent;
        
        for (let j = 1; j < searchSigs.length; j++) {
            const fileRelative = contentSigs[startIdx + j].indent - fileBaseIndent;
            const searchRelative = searchSigs[j].indent - searchBaseIndent;
            
            // 注意：这里允许缩进单位不一致（如 2 空格 vs 4 空格），只要变化方向和比例一致
            // 但为简单起见，我们先校验绝对相对值。如果需要更强兼容性，可以改用比例校验。
            if (fileRelative !== searchRelative) return false;
        }
    }
    
    return true;
}

/**
 * 检测补丁是否已经应用过
 * 核心逻辑：使用逻辑签名进行比对，若目标状态已达成则跳过
 */
function isAlreadyApplied(content, search, replace) {
    const contentSigs = getLogicSignature(content);
    const searchSigs = getLogicSignature(search);
    const replaceSigs = getLogicSignature(replace);
    
    const searchContent = searchSigs.map(s => s.content).join('\n');
    const replaceContent = replaceSigs.map(s => s.content).join('\n');
    
    if (searchContent === replaceContent) return false;

    const replaceMatchCount = countMatches(contentSigs, replaceSigs);
    const searchMatchCount = countMatches(contentSigs, searchSigs);

    // 情况1：REPLACE 逻辑已存在且 SEARCH 逻辑已完全消失 -> 已应用
    if (replaceMatchCount > 0 && searchMatchCount === 0) return true;
    
    // 情况2：REPLACE 包含 SEARCH (嵌套情况)，且 REPLACE 数量 >= SEARCH 数量 -> 已应用
    if (replaceMatchCount > 0 && replaceMatchCount >= searchMatchCount && replaceContent.includes(searchContent)) {
        return true;
    }
    
    return false;
}

/**
* 查找逻辑匹配的物理位置
* @returns {number} 匹配的物理起始行索引，未找到返回 -1
*/
function findMatchPosition(contentSigs, searchSigs, isStrictIndent = false) {
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
        if (checkMatchAt(contentSigs, searchSigs, i, isStrictIndent)) {
            return contentSigs[i].originalIndex;
        }
    }
    return -1;
}


// ========== src/core/patcher/indent.js ==========
/**
 * 缩进对齐模块 - 智能缩进对齐算法
 */

/**
 * 智能缩进对齐（抽象深度映射）
 */
function alignIndent(fileLines, matchStart, searchLines, replace) {
    const targetUnit = detectIndentUnit(fileLines);
    const baseLevel = detectBaseLevel(fileLines, matchStart, targetUnit);
    const replaceLines = replace.split('\n');
    return normalizeIndent(replaceLines, targetUnit, baseLevel);
}

/**
 * 检测文件的缩进单位（4空格 / 2空格 / Tab）
 */
function detectIndentUnit(lines) {
    const indentCounts = { 2: 0, 4: 0, tab: 0 };
    
    for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^(\s+)/);
        if (!match) continue;
        
        const indent = match[1];
        if (indent.includes('\t')) {
            indentCounts.tab++;
        } else {
            const len = indent.length;
            if (len % 4 === 0) indentCounts[4]++;
            else if (len % 2 === 0) indentCounts[2]++;
        }
    }
    
    if (indentCounts.tab > indentCounts[4] && indentCounts.tab > indentCounts[2]) {
        return '\t';
    }
    return indentCounts[2] > indentCounts[4] ? '  ' : '    ';
}

/**
 * 检测匹配位置的基准缩进层级
 */
function detectBaseLevel(lines, matchStart, unit) {
    const line = lines[matchStart] || '';
    const match = line.match(/^(\s*)/);
    if (!match || !match[1]) return 0;
    
    const indent = match[1];
    if (unit === '\t') {
        return (indent.match(/\t/g) || []).length;
    }
    return Math.floor(indent.length / unit.length);
}

/**
 * 规范化缩进（抽象深度映射核心算法）
 */
function normalizeIndent(lines, targetUnit, baseLevel) {
    const levels = analyzeIndentLevels(lines);
    
    return lines.map((line, i) => {
        // 关键：清洗 AI 可能输出的不可见干扰字符（如 \u200B）
        const cleanLine = line.replace(/[\u200B-\u200D\uFEFF]/g, '');
        if (!cleanLine.trim()) return cleanLine;
        
        // 占位符行保护
        if (cleanLine.trim().match(/^__LITERAL_\d+__$/)) {
            const level = levels[i];
            const totalLevel = baseLevel + level;
            return targetUnit.repeat(totalLevel) + cleanLine.trim();
        }
        
        const level = levels[i];
        // 核心防护：确保最终计算的缩进层级永远不小于 0，防止 repeat() 抛出 RangeError
        const totalLevel = Math.max(0, baseLevel + level);
        const trimmed = cleanLine.trimStart();
        
        // 保护 JSDoc 格式：增强启发式判断
        // 仅当 trimmed 以 * 开头，且原文件该位置的上下文暗示这是 JSDoc 时才补空格
        // 这里的简单方案是：如果 baseLevel 大于 0 且 trimmed 是 *，通常就是 JSDoc
        if (/^\*(\s|\/|$)/.test(trimmed) && totalLevel > 0) {
            // 进一步防止误伤：如果这一行看起来像数学乘法（例如后面紧跟变量名而非 @tags）
            // 我们检查它是否以 * [a-zA-Z] 开头且没有明显的 JSDoc 标志
            const isLikelyMath = /^\*\s+[a-zA-Z_]/.test(trimmed) && !trimmed.includes('@');
            if (!isLikelyMath) {
                return targetUnit.repeat(totalLevel) + ' ' + trimmed;
            }
        }
        
        return targetUnit.repeat(totalLevel) + trimmed;
    });
}

/**
 * 分析每行的相对逻辑层级
 */
function analyzeIndentLevels(lines) {
    const indents = lines.map(line => {
        if (!line.trim()) return -1;
        const match = line.match(/^(\s*)/);
        return match ? match[1].replace(/\t/g, '    ').length : 0;
    });

    const firstValidIdx = indents.findIndex(n => n >= 0);
    if (firstValidIdx === -1) return lines.map(() => 0);

    const anchorIndent = indents[firstValidIdx];
    
    // 改进：增加最小阈值并过滤掉单空格干扰（常见于 JSDoc ' * '）
    const steps = [];
    for (let i = 0; i < indents.length - 1; i++) {
        if (indents[i] >= 0 && indents[i + 1] >= 0) {
            const diff = Math.abs(indents[i + 1] - indents[i]);
            // 关键：现代 JS/Python 几乎没有 1 空格缩进，diff=1 通常是注释干扰，应忽略
            if (diff >= 2) steps.push(diff);
        }
    }

    let sourceUnit = 4;
    if (steps.length > 0) {
        const counts = {};
        steps.forEach(s => counts[s] = (counts[s] || 0) + 1);
        const mostFrequent = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
        sourceUnit = Math.max(2, parseInt(mostFrequent)); 
    } else {
        const diffs = indents.filter(n => n > anchorIndent).map(n => n - anchorIndent);
        // 关键：在 fallback 逻辑中也要强制最小步长为 2，防止 JSDoc 干扰导致的 sourceUnit=1
        if (diffs.length > 0) {
            const minDiff = Math.min(...diffs);
            sourceUnit = Math.max(2, minDiff);
        }
    }

    return indents.map(indent => {
        if (indent < 0) return 0;
        const diff = indent - anchorIndent;
        // 改进的安全检查：计算相对层级，由 normalizeIndent 确保最终 totalLevel 不为负
        return Math.round(diff / sourceUnit);
    });
}


// ========== src/core/patcher/syntax.js ==========
/**
 * 语法检查模块 - JS/TS 代码语法验证
 */

/**
* 检查 JS/TS 代码语法是否有效
*/
function checkJsSyntax(code, filePath = '') {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const jsExts = ['js', 'jsx', 'ts', 'tsx', 'mjs'];
    if (filePath && !jsExts.includes(ext)) {
        return { valid: true };
    }
    const { result, finalStack } = stripCommentsAndStrings(code);
    
    // 检查模板字符串或插值是否未闭合
    if (finalStack.length > 1) {
        const lastMode = finalStack[finalStack.length - 1];
        return { 
            valid: false, 
            error: lastMode === 'T' ? "未闭合的模板字符串" : "插值表达式 (${}) 未完成" 
        };
    }
    
    return checkBrackets(result);
}

/**
* 移除代码中的注释、字符串和正则表达式
* 支持嵌套模板字符串和插值表达式的正确解析
*/
function stripCommentsAndStrings(code) {
    let result = '';
    let i = 0;
    const len = code.length;
    
    // 状态栈：追踪模板模式 ('T' = 文本, 'I' = 代码模式)
    // 初始为 'I'，确保顶层代码和插值内部的逻辑一致
    const stack = ['I'];
    
    const DOLLAR = String.fromCharCode(36);
    
    const canBeRegex = () => {
        let j = result.length - 1;
        while (j >= 0 && /\s/.test(result[j])) j--;
        if (j < 0) return true;
        const lastChar = result[j];
        return /[=(:,;\[!&|?{}<>+\-*%^~()]/.test(lastChar) || 
            result.slice(Math.max(0, j - 6), j + 1).match(/(?:return|yield|await|typeof|void|delete|throw|case|in)$/);
    };
    
    while (i < len) {
        const char = code[i];
        const next = code[i + 1];
        const currentMode = stack[stack.length - 1]; // 'T' 或 'I'

        // 1. 处于模板字符串文本区域 ('T')
        if (currentMode === 'T') {
            if (char === '`') {
                stack.pop();
                i++;
            } else if (char === DOLLAR && next === '{') {
                stack.push('I');
                result += '{'; 
                i += 2;
            } else if (char === '\\') {
                // 即使在转义中也要注意换行同步
                if (next === '\n') result += '\n';
                i += 2;
            } else {
                if (char === '\n') result += '\n'; // 保持行号
                i++;
            }
            continue;
        }
        
        // 2. 处于代码区域（顶层或插值表达式内部 'I'）
        
        // 优先识别注释（防止注释内的 } 干扰栈）
        if (char === '/' && next === '/') {
            i += 2;
            while (i < len && code[i] !== '\n') i++;
            continue; // 保留下一个 iteration 处理 \n 以维持行号
        }
        if (char === '/' && next === '*') {
            i += 2;
            while (i < len - 1 && !(code[i] === '*' && code[i+1] === '/')) {
                if (code[i] === '\n') result += '\n'; // 关键：保留多行注释内的换行
                i++;
            }
            i += 2;
            continue;
        }

        // 识别字符串和正则（防止内部的 } 干扰栈）
        if (char === '"' || char === "'") {
            const quote = char;
            i++;
            while (i < len && code[i] !== quote) {
                if (code[i] === '\\') {
                    i++; // 跳过转义符本身
                    if (i < len && code[i] === '\n') result += '\n';
                } else if (code[i] === '\n') {
                    result += '\n';
                }
                i++;
            }
            i++;
            continue;
        }
        if (char === '/' && next !== '/' && next !== '*' && canBeRegex()) {
            i++;
            let inClass = false;
            while (i < len) {
                if (code[i] === '/' && !inClass) break;
                if (code[i] === '\\') {
                    i++;
                } else if (code[i] === '[') {
                    inClass = true;
                } else if (code[i] === ']') {
                    inClass = false;
                }
                i++;
            }
            i++;
            while (i < len && /[gimsuy]/.test(code[i])) i++;
            continue;
        }

        // 处理核心语法符号
        if (char === '{') {
            stack.push('I');
            result += '{';
            i++;
        } else if (char === '}') {
            // 保护根作用域：只有当栈中有超过 1 个元素且处于代码模式时才弹出
            if (stack.length > 1 && currentMode === 'I') {
                stack.pop();
            }
            result += '}';
            i++;
        } else if (char === '`') {
            stack.push('T');
            i++;
        } else {
            result += char;
            i++;
        }
    }
    
    return { result, finalStack: stack };
}

/**
 * 检查括号是否匹配
 */
function checkBrackets(code) {
    const stack = [];
    const pairs = { ')': '(', ']': '[', '}': '{' };
    const opens = new Set(['(', '[', '{']);
    const closes = new Set([')', ']', '}']);
    
    let line = 1;
    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        if (ch === '\n') line++;
        
        if (opens.has(ch)) {
            stack.push({ char: ch, line });
        } else if (closes.has(ch)) {
            if (stack.length === 0) {
                return { valid: false, error: `第 ${line} 行: 多余的 '${ch}'` };
            }
            const last = stack.pop();
            if (last.char !== pairs[ch]) {
                return { valid: false, error: `第 ${line} 行: '${ch}' 与 '${last.char}' (第 ${last.line} 行) 不匹配` };
            }
        }
    }
    
    if (stack.length > 0) {
        const unclosed = stack[stack.length - 1];
        return { valid: false, error: `第 ${unclosed.line} 行: '${unclosed.char}' 未闭合` };
    }
    
    return { valid: true };
}


// ========== src/core/patcher/index.js ==========
/**
 * 补丁模块 - 代码匹配和替换算法
 * 
 * 三大鲁棒性机制：
 * 1. 确定性唯一匹配 - 匹配数 > 1 时拒绝执行
 * 2. 语义掩码保护 - 多行字符串提取→对齐→还原
 * 3. 镜像风格回写 - 保持原文件换行符风格
 */







// 重新导出供外部使用


/**
 * 尝试替换（返回结果对象）
 * 
 * 鲁棒性保障：
 * 1. 已应用检测 - 防止重复插入
 * 2. 唯一性检查 - 匹配数 > 1 时拒绝
 * 3. 语义掩码 - 保护多行字符串
 * 4. 语法自检 - 内置 JS/TS 括号匹配校验
 * 5. 换行符保持 - 记录并恢复原始风格
 */
function tryReplace(content, search, replace, filePath = '') {
    // 0. 记录原始换行符风格
    const originalEnding = detectLineEnding(content);
    const normalizedContent = normalizeLineEnding(content);
    const normalizedSearch = normalizeLineEnding(search);
    const normalizedReplace = normalizeLineEnding(replace);
    
    // 1. 已应用检测 - 防止重复插入
    const alreadyApplied = isAlreadyApplied(normalizedContent, normalizedSearch, normalizedReplace);
    console.log('[Patcher] isAlreadyApplied:', alreadyApplied);
    if (alreadyApplied) {
        return {
            success: false,
            reason: '补丁已应用过，无需重复操作',
            alreadyApplied: true
        };
    }
    
    // 2. 唯一性检查
    const isPython = filePath.endsWith('.py');
    const matchCount = countMatches(normalizedContent, normalizedSearch, isPython);
    console.log('[Patcher] matchCount:', matchCount);
    
    if (matchCount === 0) {
        return { success: false, reason: '未找到匹配' };
    }
    
    if (matchCount > 1) {
        console.log('[Patcher] 拦截：存在多处匹配');
        return { 
            success: false, 
            reason: `存在 ${matchCount} 处相同代码块，请提供更多上下文以确保唯一匹配`,
            matchCount 
        };
    }
    
    // 3. 语义掩码 - 保护 REPLACE 块中的多行字符串
    const { masked: maskedReplace, literals } = extractLiterals(normalizedReplace);
    
    // 4. 执行基于逻辑签名的物理定位
    const contentSigs = getLogicSignature(normalizedContent);
    const searchSigs = getLogicSignature(normalizedSearch);
    const lines = normalizedContent.split('\n');
    
    const matchPhysicalStart = findMatchPosition(contentSigs, searchSigs, isPython);

    if (matchPhysicalStart !== -1) {
        // 确定物理结束位置
        const startIdx = contentSigs.findIndex(s => s.originalIndex === matchPhysicalStart);
        const searchSigsInFile = contentSigs.slice(startIdx, startIdx + searchSigs.length);
        const matchPhysicalEnd = searchSigsInFile[searchSigsInFile.length - 1].originalIndex;
        const physicalLineCount = matchPhysicalEnd - matchPhysicalStart + 1;

        // 对掩码后的 REPLACE 块进行缩进对齐
        const alignedReplace = alignIndent(lines, matchPhysicalStart, normalizedSearch.split('\n'), maskedReplace);
        const restoredReplace = alignedReplace.map(line => restoreLiterals(line, literals));
        
        const before = lines.slice(0, matchPhysicalStart);
        const after = lines.slice(matchPhysicalEnd + 1);
        const result = [...before, ...restoredReplace, ...after].join('\n');
        const finalContent = restoreLineEnding(result, originalEnding);

        // 5. 语法自检：拦截破坏性的 JS/TS 错误
        const syntax = checkJsSyntax(finalContent, filePath);
        if (!syntax.valid) {
            return {
                success: false,
                reason: `补丁应用后将导致语法错误：${syntax.error}`,
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
    
    // 模糊匹配 (Python 环境下增加缩进感知)
    const fuzzyResult = fuzzyReplace(normalizedContent, normalizedSearch, maskedReplace, literals, isPython);
    if (fuzzyResult) {
        if (fuzzyResult.ambiguity) {
            console.log('[Patcher] 拦截：模糊匹配存在多处');
            return {
                success: false,
                reason: `模糊匹配到 ${fuzzyResult.matchCount} 处相似代码块，请提供更多上下文（如函数名或注释）以确保唯一匹配`,
                matchCount: fuzzyResult.matchCount
            };
        }

        const finalContent = restoreLineEnding(fuzzyResult.content, originalEnding);
        
        // 5. 语法自检（模糊匹配同样需要）
        const syntax = checkJsSyntax(finalContent, filePath);
        if (!syntax.valid) {
            return {
                success: false,
                reason: `补丁应用后将导致语法错误：${syntax.error}`,
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
    
    return { success: false, reason: '未找到匹配' };
}

/**
* 模糊匹配替换 (处理空白差异 + 智能缩进对齐)
*/
function fuzzyReplace(content, search, maskedReplace, literals, isStrictIndent = false) {
    if (!search || !search.trim()) return null;

    const lines = content.split('\n');
    const searchLines = search.replace(/\r\n/g, '\n').split('\n');
    
    const matches = [];
    // 预计算 SEARCH 块的缩进签名（用于 Python 严格模式）
    const searchSigs = isStrictIndent ? getLogicSignature(search) : null;

    for (let i = 0; i <= lines.length - searchLines.length; i++) {
        let match = true;
        
        // 1. 基础文本匹配 (trim 校验)
        for (let j = 0; j < searchLines.length; j++) {
            const lineTrim = lines[i + j].trim();
            const searchTrim = searchLines[j].trim();
            
            if (searchTrim === '') {
                if (lineTrim !== '') { match = false; break; }
            } else if (lineTrim !== searchTrim) {
                match = false;
                break;
            }
        }
        
        // 2. Python 严格模式下的额外缩进校验
        if (match && isStrictIndent && searchSigs) {
            const segment = lines.slice(i, i + searchLines.length).join('\n');
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
    
    // 歧义拦截：模糊匹配到的结果不唯一
    if (matches.length > 1) {
        return { ambiguity: true, matchCount: matches.length };
    }

    const matchIndex = matches[0];
    const before = lines.slice(0, matchIndex);
    const after = lines.slice(matchIndex + searchLines.length);
    const alignedReplace = alignIndent(lines, matchIndex, searchLines, maskedReplace);
    const restoredReplace = alignedReplace.map(line => restoreLiterals(line, literals));
    
    return {
        content: [...before, ...restoredReplace, ...after].join('\n'),
        matchLine: matchIndex + 1,
        lineCount: searchLines.length
    };
}

/**
 * 为代码块添加行号预览（Git 风格）
 */
function generateNumberedLines(code, startLine = 1) {
    const lines = code.split('\n');
    return lines.map((line, index) => {
        const lineNum = startLine + index;
        return `<div class="diff-line">
            <span class="line-number">${lineNum}</span>
            <span class="line-content">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>
        </div>`;
    }).join('');
}

// 导出模糊匹配函数供外部使用



// ========== src/dialog/preview.js ==========
/**
 * 预览对话框 - 变更确认（Side-by-Side Diff）
 */

/**
 * Myers Diff 算法 - 计算两个文本的行级差异
 * @param {string[]} oldLines - 原始文本的行数组
 * @param {string[]} newLines - 新文本的行数组
 * @returns {Array} 差异数组，每项包含 {type: 'equal'|'delete'|'insert', oldLine?, newLine?}
 */
function computeLineDiff(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;
    
    // 动态规划表：dp[i][j] 表示 oldLines[0..i-1] 和 newLines[0..j-1] 的最小编辑距离
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    // 初始化第一行和第一列
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // 填充 DP 表
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1]; // 相同，不需要操作
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // 删除
                    dp[i][j - 1],     // 插入
                    dp[i - 1][j - 1]  // 替换
                );
            }
        }
    }
    
    // 回溯构建差异序列
    const diffs = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            // 相同行
            diffs.unshift({ type: 'equal', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
            i--;
            j--;
        } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
            // 修改行（替换）
            diffs.unshift({ type: 'modify', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
            i--;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            // 删除行
            diffs.unshift({ type: 'delete', oldLine: oldLines[i - 1] });
            i--;
        } else {
            // 插入行
            diffs.unshift({ type: 'insert', newLine: newLines[j - 1] });
            j--;
        }
    }
    
    return diffs;
}

/**
 * 字符级 Diff - 用于高亮修改行内的具体差异
 * @param {string} oldText - 原始文本
 * @param {string} newText - 新文本
 * @returns {Array} 差异数组，每项包含 {type: 'equal'|'delete'|'insert', value}
 */
function computeCharDiff(oldText, newText) {
    const m = oldText.length;
    const n = newText.length;
    
    // 动态规划表
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldText[i - 1] === newText[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    
    // 回溯
    const diffs = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldText[i - 1] === newText[j - 1]) {
            diffs.unshift({ type: 'equal', value: oldText[i - 1] });
            i--;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            diffs.unshift({ type: 'delete', value: oldText[i - 1] });
            i--;
        } else {
            diffs.unshift({ type: 'insert', value: newText[j - 1] });
            j--;
        }
    }
    
    return diffs;
}

/**
 * 渲染带字符级高亮的行
 * @param {Array} charDiffs - 字符级差异数组
 * @param {string} type - 'old' 或 'new'
 * @returns {HTMLElement} 渲染后的行元素
 */
function renderHighlightedLine(charDiffs, type) {
    const span = document.createElement('span');
    
    charDiffs.forEach(diff => {
        const part = document.createElement('span');
        part.textContent = diff.value;
        
        if (type === 'old' && diff.type === 'delete') {
            // 删除的字符用深红色背景
            part.style.backgroundColor = '#8b0000';
            part.style.color = '#fff';
        } else if (type === 'new' && diff.type === 'insert') {
            // 插入的字符用深绿色背景
            part.style.backgroundColor = '#006400';
            part.style.color = '#fff';
        }
        
        span.appendChild(part);
    });
    
    return span;
}

/**
 * 显示预览对话框
 * @param {string} file - 文件路径
 * @param {string} oldText - SEARCH 块内容
 * @param {string} newText - REPLACE 块内容
 * @param {number} startLine - 匹配位置的起始行号
 * @param {string} syntaxError - 可选的语法错误信息
 */
function showPreviewDialog(file, oldText, newText, startLine = 1, syntaxError = null) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.id = 'ide-modal-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0', 
            background: 'rgba(0, 0, 0, 0.6)', 
            backdropFilter: 'blur(4px)',
            zIndex: '2147483648',
            animation: 'ideFadeIn 0.2s ease-out'
        });

        const dialog = document.createElement('div');
        dialog.id = 'ide-preview-dialog';
        Object.assign(dialog.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--ide-bg)', 
            color: 'var(--ide-text)',
            border: '1px solid var(--ide-border)',
            borderRadius: '12px', 
            padding: '24px', 
            zIndex: '2147483649',
            width: '90vw', maxWidth: '1400px', height: '85vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            animation: 'ideScaleIn 0.2s ease-out'
        });

        // 头部
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: syntaxError ? '12px' : '20px', paddingBottom: '16px',
            borderBottom: '1px solid var(--ide-border)'
        });
        
        const titleGroup = document.createElement('div');
        const titleIcon = document.createElement('span');
        titleIcon.textContent = syntaxError ? '⚠️' : '📝';
        titleIcon.style.marginRight = '8px';
        const titleText = document.createElement('span');
        titleText.textContent = `${syntaxError ? '强制预览' : '变更预览'}: ${file}`;
        titleText.style.fontSize = '18px';
        titleText.style.fontWeight = '600';
        
        titleGroup.appendChild(titleIcon);
        titleGroup.appendChild(titleText);
        header.appendChild(titleGroup);
        dialog.appendChild(header);

        // 语法警告横幅
        if (syntaxError) {
            const warningBanner = document.createElement('div');
            Object.assign(warningBanner.style, {
                padding: '12px 16px', marginBottom: '16px',
                background: 'rgba(220, 38, 38, 0.15)',
                border: '1px solid #dc2626', borderRadius: '8px',
                color: '#ef4444', fontSize: '13px'
            });
            
            const strongEl = document.createElement('strong');
            strongEl.textContent = '🚨 语法校验警告：';
            warningBanner.appendChild(strongEl);
            
            const errorText = document.createTextNode(syntaxError);
            warningBanner.appendChild(errorText);
            
            warningBanner.appendChild(document.createElement('br'));
            
            const hintSpan = document.createElement('span');
            hintSpan.style.color = 'var(--ide-text-secondary)';
            hintSpan.style.fontSize = '12px';
            hintSpan.textContent = '请仔细核对代码完整性后再确认应用。';
            warningBanner.appendChild(hintSpan);
            
            dialog.appendChild(warningBanner);
        }

        // Diff 内容区（Side-by-Side）
        const diffBody = document.createElement('div');
        Object.assign(diffBody.style, {
            flex: '1', display: 'flex', gap: '0', 
            overflow: 'hidden', minHeight: '0',
            border: '1px solid var(--ide-border)',
            borderRadius: '8px'
        });

        // 计算行级差异
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const lineDiffs = computeLineDiff(oldLines, newLines);

        // 创建左右两个面板
        const createSidePanel = (side) => {
            const panel = document.createElement('div');
            Object.assign(panel.style, {
                flex: '1', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', background: 'var(--ide-hint-bg)',
                borderRight: side === 'left' ? '1px solid var(--ide-border)' : 'none'
            });

            // 面板头部
            const panelHeader = document.createElement('div');
            panelHeader.textContent = side === 'left' ? '🔴 原始代码 (SEARCH)' : '🟢 修改后代码 (REPLACE)';
            Object.assign(panelHeader.style, {
                padding: '10px 16px', fontSize: '12px', fontWeight: 'bold',
                background: side === 'left' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                color: side === 'left' ? '#ef4444' : '#22c55e',
                borderBottom: '1px solid var(--ide-border)'
            });

            // 代码容器
            const codeContainer = document.createElement('div');
            Object.assign(codeContainer.style, {
                flex: '1', display: 'flex', overflow: 'auto',
                fontFamily: '"JetBrains Mono", Consolas, monospace',
                fontSize: '13px', lineHeight: '1.6'
            });

            // 行号列
            const lineNumbers = document.createElement('div');
            Object.assign(lineNumbers.style, {
                padding: '16px 12px 16px 16px',
                textAlign: 'right',
                color: 'var(--ide-text-secondary)',
                userSelect: 'none',
                borderRight: '1px solid var(--ide-border)',
                background: 'rgba(0, 0, 0, 0.1)',
                minWidth: '50px'
            });

            // 代码列
            const codeArea = document.createElement('div');
            Object.assign(codeArea.style, {
                flex: '1', padding: '16px',
                overflow: 'visible', color: 'var(--ide-text)',
                whiteSpace: 'pre'
            });

            panel.appendChild(panelHeader);
            codeContainer.appendChild(lineNumbers);
            codeContainer.appendChild(codeArea);
            panel.appendChild(codeContainer);

            return { panel, lineNumbers, codeArea };
        };

        const leftPanel = createSidePanel('left');
        const rightPanel = createSidePanel('right');

        // 渲染差异
        let leftLineNum = startLine;
        let rightLineNum = startLine;

        lineDiffs.forEach(diff => {
            const leftLineDiv = document.createElement('div');
            const rightLineDiv = document.createElement('div');
            const leftCodeDiv = document.createElement('div');
            const rightCodeDiv = document.createElement('div');

            if (diff.type === 'equal') {
                // 相同行 - 灰色显示
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = String(rightLineNum++);
                leftCodeDiv.textContent = diff.oldLine;
                rightCodeDiv.textContent = diff.newLine;
                leftCodeDiv.style.color = 'var(--ide-text-secondary)';
                rightCodeDiv.style.color = 'var(--ide-text-secondary)';
            } else if (diff.type === 'delete') {
                // 删除行 - 左侧红色背景，右侧空白
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = '';
                leftCodeDiv.textContent = diff.oldLine;
                leftCodeDiv.style.backgroundColor = '#3d1a1a';
                leftCodeDiv.style.color = '#ff6b6b';
                rightCodeDiv.textContent = '';
                rightCodeDiv.style.backgroundColor = '#1a1a1a';
            } else if (diff.type === 'insert') {
                // 插入行 - 右侧绿色背景，左侧空白
                leftLineDiv.textContent = '';
                rightLineDiv.textContent = String(rightLineNum++);
                leftCodeDiv.textContent = '';
                leftCodeDiv.style.backgroundColor = '#1a1a1a';
                rightCodeDiv.textContent = diff.newLine;
                rightCodeDiv.style.backgroundColor = '#1a3d1a';
                rightCodeDiv.style.color = '#6bff6b';
            } else if (diff.type === 'modify') {
                // 修改行 - 两侧都显示，字符级高亮
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = String(rightLineNum++);
                
                const charDiffs = computeCharDiff(diff.oldLine, diff.newLine);
                leftCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'old'));
                rightCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'new'));
                
                leftCodeDiv.style.backgroundColor = '#3d2a1a';
                rightCodeDiv.style.backgroundColor = '#2a3d1a';
            }

            leftPanel.lineNumbers.appendChild(leftLineDiv);
            leftPanel.codeArea.appendChild(leftCodeDiv);
            rightPanel.lineNumbers.appendChild(rightLineDiv);
            rightPanel.codeArea.appendChild(rightCodeDiv);
        });

        diffBody.appendChild(leftPanel.panel);
        diffBody.appendChild(rightPanel.panel);

        // 底部按钮
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '12px',
            marginTop: '20px', paddingTop: '16px',
            borderTop: '1px solid var(--ide-border)'
        });

        const closeAll = () => { backdrop.remove(); dialog.remove(); };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        Object.assign(cancelBtn.style, {
            padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--ide-border)',
            color: 'var(--ide-text)', fontSize: '14px'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.background = 'var(--ide-hover)';
        cancelBtn.onmouseout = () => cancelBtn.style.background = 'transparent';
        cancelBtn.onclick = () => { closeAll(); resolve(false); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确认应用修改';
        Object.assign(confirmBtn.style, {
            padding: '8px 24px', borderRadius: '6px', cursor: 'pointer',
            background: 'var(--ide-accent)', color: '#fff', 
            border: 'none', fontSize: '14px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
        });
        confirmBtn.onclick = () => { closeAll(); resolve(true); };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        dialog.appendChild(diffBody);
        dialog.appendChild(footer);

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
    });
}


// ========== src/dialog/history.js ==========
/**
 * 历史版本对话框
 */




function formatTime(timestamp) {
    const d = new Date(timestamp);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
}

/**
 * 显示历史版本对话框
 */
function showHistoryDialog(filePath) {
    return new Promise(async (resolve) => {
        const versions = await fs.getFileHistory(filePath);
        if (versions.length === 0) {
            showToast('暂无历史版本', 'info');
            return resolve(null);
        }

        const existing = document.getElementById('ide-history-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'ide-history-dialog';
        Object.assign(dialog.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--ide-bg)', border: '1px solid var(--ide-border)',
            borderRadius: '12px', padding: '20px', zIndex: '2147483649',
            width: '400px', maxHeight: '60vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)'
        });

        const header = document.createElement('div');
        header.textContent = '📜 历史回溯 - ' + filePath.split('/').pop();
        Object.assign(header.style, {
            fontWeight: 'bold', marginBottom: '16px', color: 'var(--ide-text)',
            paddingBottom: '12px', borderBottom: '1px solid var(--ide-border)', fontSize: '15px'
        });
        dialog.appendChild(header);

        const list = document.createElement('div');
        Object.assign(list.style, { flex: '1', overflowY: 'auto', paddingRight: '4px' });

        versions.forEach((v) => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '10px', margin: '6px 0', background: 'var(--ide-hint-bg)',
                borderRadius: '6px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s'
            });
            item.className = 'ide-tree-item';

            const info = document.createElement('div');
            info.style.display = 'flex';
            info.style.flexDirection = 'column';
            
            const time = document.createElement('span');
            time.textContent = formatTime(v.timestamp);
            time.style.color = 'var(--ide-text)';
            time.style.fontSize = '13px';
            time.style.fontWeight = '500';

            const size = document.createElement('span');
            size.textContent = formatSize(v.content.length);
            size.style.color = 'var(--ide-text-secondary)';
            size.style.fontSize = '11px';
            
            info.appendChild(time);
            info.appendChild(size);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';

            const viewBtn = document.createElement('button');
            viewBtn.textContent = '🆚 对比';
            viewBtn.title = '与当前本地版本对比';
            viewBtn.className = 'ide-btn';
            Object.assign(viewBtn.style, { padding: '4px 8px', fontSize: '11px', flex: 'none' });
            
            viewBtn.onclick = async () => {
                const currentContent = await fs.readFile(filePath);
                if (currentContent === null) {
                    showToast('无法读取当前文件', 'error');
                    return;
                }
                showHistoryDiff(filePath, v, currentContent);
            };

            const revertBtn = document.createElement('button');
            revertBtn.textContent = '回退';
            revertBtn.title = '回退到此版本';
            Object.assign(revertBtn.style, {
                background: 'var(--ide-accent)', color: '#fff', border: 'none',
                padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 'bold'
            });
            revertBtn.onclick = async () => {
                if (!confirm(`确定回退到 ${formatTime(v.timestamp)} 的版本？`)) return;
                const result = await fs.revertToVersion(filePath, v.timestamp);
                if (result.success) {
                    showToast('✅ 已回退');
                    dialog.remove();
                }
            };

            actions.appendChild(viewBtn);
            actions.appendChild(revertBtn);
            
            item.appendChild(info);
            item.appendChild(actions);
            list.appendChild(item);
        });
        dialog.appendChild(list);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        Object.assign(closeBtn.style, {
            marginTop: '16px', width: '100%', background: 'transparent',
            color: 'var(--ide-text-secondary)', border: '1px solid var(--ide-border)', 
            padding: '10px', borderRadius: '6px', cursor: 'pointer'
        });
        closeBtn.onmouseover = () => closeBtn.style.color = 'var(--ide-text)';
        closeBtn.onmouseout = () => closeBtn.style.color = 'var(--ide-text-secondary)';
        closeBtn.onclick = () => { dialog.remove(); resolve(null); };
        dialog.appendChild(closeBtn);

        document.body.appendChild(dialog);
    });
}

/**
 * 历史对比视图
 */
function showHistoryDiff(filePath, version, currentContent) {
    const backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', zIndex: '2147483650',
        animation: 'ideFadeIn 0.2s ease-out'
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90vw', maxWidth: '1200px', height: '85vh',
        background: 'var(--ide-bg)', border: '1px solid var(--ide-border)',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', zIndex: '2147483651',
        animation: 'ideScaleIn 0.2s ease-out'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '16px 24px', borderBottom: '1px solid var(--ide-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    });

    const titleText = document.createElement('div');
    titleText.textContent = `🆚 版本对比: ${filePath.split('/').pop()}`;
    Object.assign(titleText.style, { fontWeight: '600', color: 'var(--ide-text)', fontSize: '16px' });
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭预览';
    closeBtn.className = 'ide-btn';
    closeBtn.onclick = () => { backdrop.remove(); container.remove(); };
    
    header.appendChild(titleText);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    Object.assign(body.style, {
        flex: '1', display: 'flex', overflow: 'hidden',
        background: 'var(--ide-hint-bg)'
    });

    const createPane = (title, content, bgColor, borderColor) => {
        const pane = document.createElement('div');
        Object.assign(pane.style, {
            flex: '1', display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--ide-border)', minWidth: '0'
        });

        const paneHeader = document.createElement('div');
        paneHeader.textContent = title;
        Object.assign(paneHeader.style, {
            padding: '8px 16px', fontSize: '12px', fontWeight: 'bold',
            background: bgColor, color: borderColor,
            borderBottom: `1px solid ${borderColor}`, opacity: '0.9'
        });

        const pre = document.createElement('pre');
        pre.textContent = content;
        Object.assign(pre.style, {
            flex: '1', margin: '0', padding: '16px', overflow: 'auto',
            fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: '13px',
            lineHeight: '1.5', color: 'var(--ide-text)', whiteSpace: 'pre'
        });

        pane.appendChild(paneHeader);
        pane.appendChild(pre);
        return pane;
    };

    const leftPane = createPane(`🕰️ 历史版本 (${formatTime(version.timestamp)})`, version.content, 'rgba(234, 179, 8, 0.1)', '#eab308');
    const rightPane = createPane('💻 当前本地版本', currentContent, 'rgba(59, 130, 246, 0.1)', '#3b82f6');
    rightPane.style.borderRight = 'none';

    body.appendChild(leftPane);
    body.appendChild(rightPane);
    container.appendChild(header);
    container.appendChild(body);

    document.body.appendChild(backdrop);
    document.body.appendChild(container);
}


// ========== src/dialog/index.js ==========
/**
 * 对话框模块入口
 */





// ========== src/ui/icons.js ==========
/**
 * SVG 图标模块 - Trusted Types Safe
 */

const ICON_PATHS = {
    folder: 'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z',
    file: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7',
    logo: 'M16 18l6-6-6-6 M8 6l-6 6 6 6 M12.5 4l-3 16',
    close: 'M18 6L6 18M6 6l12 12',
    arrowRight: 'M9 18l6-6-6-6',
    arrowDown: 'M6 9l6 6 6-6'
};

/**
 * 创建 SVG 图标
 */
function createIcon(name, size = 14, color = 'currentColor') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', color);
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.classList.add('ide-icon');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', ICON_PATHS[name] || ICON_PATHS.file);
    svg.appendChild(path);
    
    return svg;
}


// ========== src/ui/menu.js ==========
/**
 * 右键菜单模块
 */







/**
 * 创建菜单项
 */
function createMenuItem(text, onClick, bgColor = null) {
    const item = document.createElement('div');
    item.textContent = text;
    Object.assign(item.style, {
        padding: '8px 12px', cursor: 'pointer', fontSize: '12px', 
        color: bgColor ? '#ef4444' : 'var(--ide-text)'
    });
    item.onmouseover = () => { 
        item.style.background = bgColor || 'var(--ide-hover)'; 
    };
    item.onmouseout = () => { item.style.background = 'transparent'; };
    item.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('ide-context-menu').style.display = 'none';
        onClick();
    };
    return item;
}

/**
 * 创建菜单分隔线
 */
function createMenuDivider() {
    const divider = document.createElement('div');
    Object.assign(divider.style, {
        height: '1px', background: 'var(--ide-border)', margin: '4px 0'
    });
    return divider;
}

/**
 * 显示文件夹右键菜单
 */
function showFolderContextMenu(e, node, refreshTree, collectFiles) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = document.getElementById('ide-context-menu');
    if (!menu) return;
    
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    
    // 发送目录结构
    menu.appendChild(createMenuItem('📋 发送目录结构', () => {
        const structure = fs.generateStructure(node);
        gemini.sendStructure(node.path, structure);
    }));
    
    // 发送所有文件
    menu.appendChild(createMenuItem('📦 发送所有文件', async () => {
        showToast('读取中...', 'info');
        const content = await collectFiles(node);
        const result = gemini.insertToInput(content);
        if (result.success) {
            showToast(`已发送 (~${formatTokens(result.tokens)} tokens)`);
        }
    }));

    menu.appendChild(createMenuDivider());

    // 新建文件
    menu.appendChild(createMenuItem('➕ 新建文件', async () => {
        const fileName = prompt('输入文件名:');
        if (!fileName || !fileName.trim()) return;
        const newPath = node.path + '/' + fileName.trim();
        if (await fs.createFile(newPath, '')) {
            showToast('已创建: ' + fileName);
            await refreshTree();
        } else {
            showToast('创建失败', 'error');
        }
    }));

    // 新建文件夹
    menu.appendChild(createMenuItem('📁 新建文件夹', async () => {
        const folderName = prompt('输入文件夹名:');
        if (!folderName || !folderName.trim()) return;
        const newPath = node.path + '/' + folderName.trim() + '/.gitkeep';
        if (await fs.createFile(newPath, '')) {
            showToast('已创建: ' + folderName);
            await refreshTree();
        } else {
            showToast('创建失败', 'error');
        }
    }));

    menu.appendChild(createMenuDivider());

    // 删除目录
    menu.appendChild(createMenuItem('🗑️ 删除目录', async () => {
        if (!confirm(`确定删除目录 "${node.name}" 及其所有内容？\n\n⚠️ 此操作不可撤销！`)) return;
        if (await fs.deleteDirectory(node.path)) {
            showToast('已删除: ' + node.name);
            await refreshTree();
        } else {
            showToast('删除失败', 'error');
        }
    }, '#dc2626'));
    
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 150) + 'px';
}

/**
 * 显示文件右键菜单
 */
function showFileContextMenu(e, node, refreshTree) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = document.getElementById('ide-context-menu');
    if (!menu) return;
    
    while (menu.firstChild) menu.removeChild(menu.firstChild);

    // 发送文件
    menu.appendChild(createMenuItem('📤 发送到对话', async () => {
        const content = await fs.readFile(node.path);
        if (content !== null) {
            gemini.sendFile(node.path, content);
        }
    }));

    // 发送文件及依赖
    const fileType = depsAnalyzer.getFileType(node.path);
    if (fileType) {
        menu.appendChild(createMenuItem('🔗 发送文件+依赖', async () => {
            showToast('正在分析依赖关系...', 'info');
            const { all } = await depsAnalyzer.getFileWithDeps(node.path);
            
            if (all.length <= 1) {
                const content = await fs.readFile(node.path);
                if (content !== null) gemini.sendFile(node.path, content);
                return;
            }
            
            let text = `核心文件 \`${node.path}\` 及其关联依赖 (${all.length - 1} 个):\n\n`;
            for (const filePath of all) {
                const content = await fs.readFile(filePath);
                if (content !== null) {
                    const lang = getLanguage(filePath);
                    text += `### ${filePath}\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
                }
            }
            
            const result = gemini.insertToInput(text);
            if (result.success) {
                showToast(`已发送主文件及 ${all.length - 1} 个依赖 (~${formatTokens(result.tokens)} tokens)`);
            }
        }));
    }

    menu.appendChild(createMenuDivider());

    // 查看历史版本
    menu.appendChild(createMenuItem('⏪ 历史版本', async () => {
        await showHistoryDialog(node.path);
    }));

    // 快速撤销
    menu.appendChild(createMenuItem('↩️ 撤销上次修改', async () => {
        const result = await fs.revertFile(node.path);
        if (result.success) {
            showToast('已撤销');
        } else {
            showToast(result.error || '撤销失败', 'error');
        }
    }));

    menu.appendChild(createMenuDivider());

    // 删除文件
    menu.appendChild(createMenuItem('🗑️ 删除文件', async () => {
        if (!confirm(`确定删除文件 "${node.name}"？`)) return;
        if (await fs.deleteFile(node.path)) {
            showToast('已删除: ' + node.name);
            await refreshTree();
        } else {
            showToast('删除失败', 'error');
        }
    }, '#dc2626'));

    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
}


// ========== src/ui/tree.js ==========
/**
 * 文件树渲染模块
 */







/**
 * 高亮文件名中的搜索词
 */
function highlightName(name, searchTerm) {
    if (!searchTerm) return document.createTextNode(name);

    // 转义正则特殊字符
    const safeTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, function(match) {
        return '\\' + match;
    });
    const regex = new RegExp('(' + safeTerm + ')', 'gi');
    const parts = name.split(regex);
    
    if (parts.length === 1) return document.createTextNode(name);

    const fragment = document.createDocumentFragment();
    parts.forEach(part => {
        if (part.toLowerCase() === searchTerm) {
            const highlight = document.createElement('span');
            highlight.className = 'ide-highlight';
            highlight.textContent = part;
            fragment.appendChild(highlight);
        } else if (part) {
            fragment.appendChild(document.createTextNode(part));
        }
    });

    return fragment;
}

/**
 * 渲染文件树
 */
function renderTree(container, tree, folderStates, currentTree, matches = null, searchTerm = '', matchCount = 0) {
    while (container.firstChild) container.removeChild(container.firstChild);
    
    const hint = document.createElement('div');
    Object.assign(hint.style, {
        padding: '6px 8px', marginBottom: '8px', background: 'var(--ide-hint-bg)',
        borderRadius: '4px', fontSize: '11px', color: 'var(--ide-hint-text)'
    });
    hint.textContent = matches ? `🔍 找到 ${matchCount} 个匹配文件` : '💡 点击文件发送 | 右键文件夹更多';
    container.appendChild(hint);
    
    buildTreeNodes(container, tree, 0, folderStates, currentTree, matches, searchTerm);
}

/**
 * 构建树节点
 */
function buildTreeNodes(container, nodes, level, folderStates, currentTree, matches, searchTerm) {
    const refreshTree = () => window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
    
    const collectFiles = async (node, maxFiles = 20) => {
        const files = [];
        const collect = (n) => {
            if (n.kind === 'file') files.push(n);
            if (n.children) n.children.forEach(collect);
        };
        collect(node);
        
        if (files.length > maxFiles) files.length = maxFiles;
        
        let result = `目录 \`${node.path}\` 文件内容:\n\n`;
        for (const file of files) {
            const content = await fs.readFile(file.path);
            if (content !== null) {
                const lang = getLanguage(file.name);
                result += `### ${file.path}\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
            }
        }
        return result;
    };

    nodes.forEach(node => {
        if (matches && !matches.has(node.path)) return;

        const item = document.createElement('div');
        Object.assign(item.style, {
            padding: '5px 4px', paddingLeft: (level * 14 + 4) + 'px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            cursor: 'pointer', borderRadius: '3px', margin: '1px 0',
            display: 'flex', alignItems: 'center', gap: '4px'
        });
        item.title = node.path;
        item.classList.add('ide-tree-item');

        if (node.kind === 'directory') {
            const isExpanded = folderStates.get(node.path) || false;
            
            const arrow = createIcon(isExpanded ? 'arrowDown' : 'arrowRight', 12, 'var(--ide-text-secondary)');
            Object.assign(arrow.style, { width: '16px', minWidth: '16px' });
            
            const icon = createIcon('folder', 14, 'var(--ide-text-folder)');
            
            const name = document.createElement('span');
            name.appendChild(highlightName(node.name, searchTerm));
            name.style.color = 'var(--ide-text)';
            name.style.fontWeight = '500';
            
            item.appendChild(arrow);
            item.appendChild(icon);
            item.appendChild(name);
            
            item.onclick = async () => {
                const willExpand = !isExpanded;
                
                // 懒加载核心：如果准备展开且子节点为空，则去读取
                if (willExpand && (!node.children || node.children.length === 0)) {
                    item.style.opacity = '0.5';
                    const children = await fs.readDirectory(node.path);
                    if (children) {
                        node.children = children;
                    }
                    item.style.opacity = '1';
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
            const spacer = document.createElement('span');
            spacer.style.width = '16px'; 
            spacer.style.minWidth = '16px';
            
            const icon = createIcon('file', 14, 'var(--ide-text-secondary)');
            
            const name = document.createElement('span');
            name.appendChild(highlightName(node.name, searchTerm));
            name.style.color = 'var(--ide-text-secondary)';
            
            item.appendChild(spacer);
            item.appendChild(icon);
            item.appendChild(name);
            
            item.onclick = async () => {
                item.style.opacity = '0.5';
                const content = await fs.readFile(node.path);
                item.style.opacity = '1';
                
                if (content !== null) {
                    gemini.sendFile(node.path, content);
                }
            };

            item.oncontextmenu = (e) => showFileContextMenu(e, node, refreshTree);
            
            container.appendChild(item);
        }
    });
}

/**
 * 过滤文件树
 */
function filterTree(term, currentTree, folderStates, renderCallback) {
    const searchTerm = term.trim().toLowerCase();
    
    if (!searchTerm) {
        renderCallback(currentTree, null, '', 0);
        return;
    }

    const matches = new Set();
    const parentsToExpand = new Set();
    let fileMatchCount = 0;

    const search = (nodes) => {
        let foundInBranch = false;
        for (const node of nodes) {
            const isMatch = node.name.toLowerCase().includes(searchTerm);
            let hasMatchedChild = false;

            if (node.kind === 'directory' && node.children) {
                hasMatchedChild = search(node.children);
            }

            if (isMatch || hasMatchedChild) {
                matches.add(node.path);
                foundInBranch = true;
                if (isMatch && node.kind === 'file') {
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
    parentsToExpand.forEach(path => folderStates.set(path, true));
    renderCallback(currentTree, matches, searchTerm, fileMatchCount);
}


// ========== src/ui/sidebar.js ==========
/**
 * 侧边栏模块
 */




/**
     * 创建触发按钮
     */
function createTrigger(currentTree) {
    const trigger = document.createElement('div');
    trigger.id = 'ide-trigger';
    trigger.textContent = '⚡️';
    Object.assign(trigger.style, {
        position: 'fixed', bottom: '20px', right: '20px',
        zIndex: '2147483646', width: '40px', height: '40px',
        background: 'var(--ide-bg)', color: 'var(--ide-text)',
        border: '1px solid var(--ide-border)', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: 'var(--ide-shadow)',
        fontSize: '18px', transition: 'all 0.2s', userSelect: 'none'
    });
    
    trigger.classList.add('ide-glass');

    trigger.onmouseover = () => {
        trigger.style.width = 'auto';
        trigger.style.borderRadius = '20px';
        trigger.style.padding = '0 12px';
        trigger.textContent = '⚡️ IDE Bridge';
    };
    trigger.onmouseout = () => {
        if (!currentTree) {
            trigger.style.width = '40px';
            trigger.style.padding = '0';
            trigger.style.borderRadius = '50%';
            trigger.textContent = '⚡️';
        }
    };

    trigger.onclick = () => {
        const sidebar = document.getElementById('ide-sidebar');
        const isHidden = sidebar.style.transform === 'translateX(100%)';
        sidebar.style.transform = isHidden ? 'translateX(0)' : 'translateX(100%)';
    };
    return trigger;
}

/**
 * 创建侧边栏
 */
function createSidebar(onSearch) {
    const sidebar = document.createElement('div');
    sidebar.id = 'ide-sidebar';
    sidebar.classList.add('ide-glass');
    
    Object.assign(sidebar.style, {
        position: 'fixed', right: '0', top: '0',
        width: '360px', height: '100vh',
        background: 'var(--ide-bg)',
        borderLeft: '1px solid var(--ide-border)',
        zIndex: '2147483647', 
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'translateX(100%)',
        color: 'var(--ide-text)', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--ide-shadow)', 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '13px', lineHeight: '1.5'
    });

    // 标题栏
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '12px 16px', borderBottom: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'transparent'
    });

    // 搜索框
    const searchBar = document.createElement('div');
    Object.assign(searchBar.style, {
        padding: '0 16px 12px 16px',
        borderBottom: '1px solid var(--ide-border)'
    });
    
    const searchInput = document.createElement('input');
    searchInput.placeholder = '搜索文件... (Enter 发送结果)';
    Object.assign(searchInput.style, {
        width: '100%', padding: '6px 10px', borderRadius: '6px',
        background: 'var(--ide-hint-bg)', color: 'var(--ide-text)',
        border: '1px solid var(--ide-border)', fontSize: '12px',
        outline: 'none', boxSizing: 'border-box'
    });

    const debouncedSearch = debounce((val) => onSearch(val), 300);
    searchInput.oninput = (e) => debouncedSearch(e.target.value.toLowerCase());
    searchBar.appendChild(searchInput);
    
    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '8px';
    title.style.fontWeight = '600';
    title.style.color = 'var(--ide-text)';
    title.style.fontSize = '14px';
    
    const logoIcon = createIcon('logo', 16, 'var(--ide-accent)');
    const titleText = document.createElement('span');
    titleText.textContent = 'Gemini IDE';
    
    const statusDot = document.createElement('div');
    Object.assign(statusDot.style, {
        width: '8px', height: '8px', borderRadius: '50%',
        background: '#059669', marginLeft: '4px',
        boxShadow: '0 0 8px #059669',
        display: 'none'
    });
    statusDot.id = 'ide-status-dot';
    
    title.appendChild(logoIcon);
    title.appendChild(titleText);
    title.appendChild(statusDot);
    
    const closeBtn = document.createElement('button');
    closeBtn.style.display = 'flex';
    closeBtn.appendChild(createIcon('close', 18, 'var(--ide-text-secondary)'));
    Object.assign(closeBtn.style, {
        background: 'none', border: 'none',
        cursor: 'pointer', padding: '4px', opacity: '0.7', transition: 'opacity 0.2s'
    });
    closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
    closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';
    closeBtn.onclick = () => { sidebar.style.transform = 'translateX(100%)'; };
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    sidebar.appendChild(header);
    sidebar.appendChild(searchBar);

    // 操作栏
    const actionBar = document.createElement('div');
    actionBar.id = 'ide-action-bar';
    Object.assign(actionBar.style, {
        padding: '10px', borderBottom: '1px solid var(--ide-border)',
        display: 'none', gap: '8px'
    });
    sidebar.appendChild(actionBar);

    // 文件树容器
    const treeContainer = document.createElement('div');
    treeContainer.id = 'ide-tree-container';
    Object.assign(treeContainer.style, {
        flex: '1', overflowY: 'auto', padding: '8px', fontSize: '13px'
    });
    sidebar.appendChild(treeContainer);

    // 底部
    const footer = document.createElement('div');
    Object.assign(footer.style, {
        padding: '8px', borderTop: '1px solid var(--ide-border)',
        fontSize: '10px', color: 'var(--ide-text-secondary)', textAlign: 'center'
    });
    footer.textContent = `V${typeof IDE_VERSION !== 'undefined' ? IDE_VERSION : '?'} | 支持版本回退`;
    sidebar.appendChild(footer);

    return sidebar;
}

/**
 * 创建空状态
 */
function createEmptyState(onConnect) {
    const emptyState = document.createElement('div');
    Object.assign(emptyState.style, { textAlign: 'center', marginTop: '100px', color: '#6b7280' });
    
    const icon = document.createElement('div');
    icon.textContent = '📁';
    icon.style.fontSize = '40px';
    icon.style.marginBottom = '16px';
    
    const text = document.createElement('p');
    text.textContent = '未连接本地项目';
    
    const connectBtn = document.createElement('button');
    connectBtn.id = 'ide-action-connect';
    connectBtn.textContent = '连接文件夹';
    Object.assign(connectBtn.style, {
        marginTop: '16px', background: '#2563eb', color: 'white',
        border: 'none', padding: '10px 24px', borderRadius: '6px',
        cursor: 'pointer', fontWeight: 'bold'
    });
    connectBtn.onclick = onConnect;
    
    emptyState.appendChild(icon);
    emptyState.appendChild(text);
    emptyState.appendChild(connectBtn);
    return emptyState;
}

/**
 * 创建右键菜单容器
 */
function createContextMenu() {
    const menu = document.createElement('div');
    menu.id = 'ide-context-menu';
    Object.assign(menu.style, {
        position: 'fixed', display: 'none', 
        background: 'var(--ide-bg)', 
        border: '1px solid var(--ide-border)', 
        borderRadius: '6px',
        boxShadow: 'var(--ide-shadow)', 
        zIndex: '2147483648',
        minWidth: '160px', padding: '4px 0',
        backdropFilter: 'blur(12px)'
    });
    return menu;
}

/**
 * 创建按钮
 */
function createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'ide-btn';
    btn.onclick = onClick;
    return btn;
}


// ========== src/ui/index.js ==========
/**
 * UI 模块入口
 */









class UI {
    constructor() {
        this.folderStates = new Map();
        this.currentTree = null;
    }

    init() {
        if (document.getElementById('ide-bridge-root')) return;
        
        const root = document.createElement('div');
        root.id = 'ide-bridge-root';
        
        root.appendChild(createSidebar((term) => this._filterTree(term)));
        root.appendChild(createTrigger(this.currentTree));
        root.appendChild(createContextMenu());
        root.appendChild(initThemeStyle());

        // 添加空状态
        const treeContainer = root.querySelector('#ide-tree-container');
        treeContainer.appendChild(createEmptyState(() => this.handleConnect()));

        document.body.appendChild(root);
        
        initThemeWatcher();
        
        document.addEventListener('click', () => {
            const menu = document.getElementById('ide-context-menu');
            if (menu) menu.style.display = 'none';
        });

        window.addEventListener('ide-refresh-tree', () => {
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
            const trigger = document.getElementById('ide-trigger');
            if (trigger && result.rootName) {
                trigger.textContent = '✅ ' + result.rootName;
            }
        }
    }

    _filterTree(term) {
        filterTree(term, this.currentTree, this.folderStates, (tree, matches, searchTerm, matchCount) => {
            this._renderTree(tree, matches, searchTerm, matchCount);
        });
    }

    _renderTree(tree, matches = null, searchTerm = '', matchCount = 0) {
        const container = document.getElementById('ide-tree-container');
        if (!container) return;
        renderTree(container, tree, this.folderStates, this.currentTree, matches, searchTerm, matchCount);
    }

    async handleConnect() {
        const connectBtn = document.getElementById('ide-action-connect');
        if (connectBtn) connectBtn.textContent = '连接中...';
        
        const result = await fs.openProject();
        
        if (result.success) {
            this.currentTree = result.tree;
            
            const trigger = document.getElementById('ide-trigger');
            if (trigger) {
                trigger.textContent = '✅ ' + result.rootName;
                trigger.style.background = '#059669';
                trigger.style.borderColor = '#34d399';
            }
            
            this._renderActionBar();
            this._renderTree(result.tree);

            const dot = document.getElementById('ide-status-dot');
            if (dot) dot.style.display = 'block';
            
            // 注册文件变化回调，智能刷新文件树
            fs.onFileChange((changes) => {
                // 只有增删才需要刷新树结构，修改不需要
                const structureChanges = changes.filter(c => c.type === 'add' || c.type === 'delete');
                
                if (structureChanges.length === 0) {
                    console.log('[UI] 仅文件内容修改，跳过刷新');
                    return;
                }
                
                console.log('[UI] 检测到结构变化，刷新文件树:', structureChanges);
                this.refreshTree();
            });
            
            gemini.startWatching();
        } else {
            if (connectBtn) connectBtn.textContent = '连接文件夹';
        }
    }

    _renderActionBar() {
        const actionBar = document.getElementById('ide-action-bar');
        if (!actionBar) return;
        
        Object.assign(actionBar.style, {
            display: 'flex', gap: '8px', padding: '12px 16px',
            borderBottom: '1px solid var(--ide-border)',
            background: 'transparent'
        });

        while (actionBar.firstChild) actionBar.removeChild(actionBar.firstChild);
        
        // 提示词
        actionBar.appendChild(createButton('🤖 提示词', () => {
            const result = gemini.insertToInput(getSystemPrompt());
            if (result.success) {
                showToast(`已发送系统协议 (~${formatTokens(result.tokens)} tokens)`);
            }
        }));

        // 发送目录
        actionBar.appendChild(createButton('📋 发送目录', () => {
            const structure = fs.generateFullStructure(this.currentTree);
            const text = `项目 "${fs.projectName}" 目录:\n\n\`\`\`\n${structure}\`\`\``;
            const result = gemini.insertToInput(text);
            if (result.success) {
                showToast(`已发送目录 (~${formatTokens(result.tokens)} tokens)`);
            }
        }));
        
        // 交接摘要
        actionBar.appendChild(createButton('📦 交接', () => {
            const result = gemini.insertToInput(getHandoverPrompt());
            if (result.success) {
                showToast('已发送交接请求');
            }
        }));
    }
}

const ui = new UI();


// ========== src/gemini/diff.js ==========
/**
 * 差异分析工具 - 相似度计算、匹配搜索、差异对比
 */

// ============ 相似度计算 ============

/**
 * 计算两个字符串的相似度（0-100）
 */
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
    const baseScore = (matches / shorter.length) * 100;
    return Math.round(baseScore * (1 - lenPenalty * 0.5));
}

/**
 * 计算两行的相似度（忽略前后空白）
 */
function lineSimilarity(line1, line2) {
    return similarity(line1.trim(), line2.trim());
}

/**
 * 计算代码块的整体相似度
 */
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

// ============ 可视化 ============

/**
 * 可视化特殊字符
 */
function visualizeChar(ch) {
    if (ch === undefined) return '[缺失]';
    if (ch === ' ') return '[空格]';
    if (ch === '\t') return '[Tab]';
    if (ch === '\n') return '[换行]';
    if (ch === '\r') return '[回车]';
    return `'${ch}'`;
}

/**
 * 可视化整行的空白字符
 */
function visualizeLine(line) {
    return line.replace(/\t/g, '→').replace(/ /g, '·');
}

// ============ 匹配搜索 ============

/**
 * 搜索所有可能的匹配位置
 */
function findCandidates(searchBlock, fileContent, minSimilarity = 50) {
    const searchLines = searchBlock.split('\n');
    const fileLines = fileContent.split('\n');
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
    
    // 去重相邻位置
    const filtered = [];
    for (const c of candidates) {
        const tooClose = filtered.some(f => Math.abs(f.startLine - c.startLine) < 3);
        if (!tooClose) filtered.push(c);
    }
    
    return filtered.slice(0, 5);
}

// ============ 差异分析 ============

/**
 * 详细对比两个代码块
 */
function detailedDiff(searchLines, fileLines) {
    const diffs = [];
    const maxLen = Math.max(searchLines.length, fileLines.length);
    
    for (let i = 0; i < maxLen; i++) {
        const searchLine = searchLines[i] ?? '';
        const fileLine = fileLines[i] ?? '';
        
        if (searchLine === fileLine) continue;
        
        const trimMatch = searchLine.trim() === fileLine.trim();
        const diff = {
            lineNum: i + 1,
            search: searchLine,
            file: fileLine,
            type: trimMatch ? 'whitespace' : 'content',
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


// ========== src/gemini/feedback.js ==========
/**
 * 错误回传模块 - 向 AI 发送精确的错误上下文
 * 目标：让 Gemini 无言以对，只能乖乖改正
 */




// ============ 检测函数 ============

/**
 * 检测输出是否被截断
 */
function detectTruncation(text) {
    const patterns = [
        { pattern: /<\/content>/i, name: '</content> 标签' },
        { pattern: /<\/file>/i, name: '</file> 标签' },
        { pattern: /\x00/, name: '空字符' },
        { pattern: /[\uFFFD]/, name: '替换字符' },
    ];
    
    for (const { pattern, name } of patterns) {
        if (pattern.test(text)) return { truncated: true, reason: name };
    }
    return { truncated: false };
}

/**
 * 检测常见错误模式
 */
function detectIssues(searchBlock, fileContent) {
    const issues = [];
    const fixes = [];
    const searchLines = searchBlock.split('\n');
    const fileLines = fileContent.split('\n');

    // 检测省略号
    const lazyPatterns = [/^\s*\/\/\s*\.{3,}/, /^\s*\.{3,}/, /^\s*\/\*\s*\.{3,}/];
    if (searchLines.some(l => lazyPatterns.some(p => p.test(l)))) {
        issues.push('❌ SEARCH 块包含省略号 (...)');
        fixes.push('请提供完整的原始代码，禁止使用省略号跳过内容');
    }
    
    // Tab vs 空格
    const searchHasTabs = /\t/.test(searchBlock);
    const searchHasSpaces = /^[ ]{2,}/m.test(searchBlock);
    const fileHasTabs = /\t/.test(fileContent);
    const fileHasSpaces = /^[ ]{2,}/m.test(fileContent);
    
    if (searchHasTabs && !fileHasTabs && fileHasSpaces) {
        issues.push('❌ SEARCH 块使用 Tab 缩进，但文件使用空格缩进');
        fixes.push('将所有 Tab 替换为空格');
    }
    if (searchHasSpaces && !fileHasSpaces && fileHasTabs) {
        issues.push('❌ SEARCH 块使用空格缩进，但文件使用 Tab 缩进');
        fixes.push('将缩进空格替换为 Tab');
    }
    
    // 行尾空格
    const trailingLines = searchLines
        .map((l, i) => ({ line: i + 1, has: /[ \t]+$/.test(l) }))
        .filter(x => x.has);
    if (trailingLines.length > 0) {
        issues.push(`❌ SEARCH 块第 ${trailingLines.map(x => x.line).join(', ')} 行有行尾空格`);
        fixes.push('删除所有行尾空格');
    }

    // 不可见字符检测 (Gremlins)
    const hiddenChars = searchLines
        .map((l, i) => ({ line: i + 1, has: /[\u200B-\u200D\uFEFF]/.test(l) }))
        .filter(x => x.has);
    if (hiddenChars.length > 0) {
        issues.push(`❌ SEARCH 块第 ${hiddenChars.map(x => x.line).join(', ')} 行包含不可见干扰字符 (如零宽空格)`);
        fixes.push('请清洗代码，移除所有非 ASCII 的不可见控制字符');
    }
    
    // 首行检测
    const firstLine = searchLines[0]?.trim();
    if (firstLine) {
        const exactMatch = fileLines.some(l => l.trim() === firstLine);
        if (!exactMatch) {
            let bestMatch = { line: -1, score: 0, content: '' };
            fileLines.forEach((l, i) => {
                const score = lineSimilarity(firstLine, l);
                if (score > bestMatch.score) {
                    bestMatch = { line: i + 1, score, content: l.trim() };
                }
            });
            
            if (bestMatch.score >= 60) {
                issues.push(`❌ 首行不存在，但第 ${bestMatch.line} 行有 ${bestMatch.score}% 相似`);
                fixes.push(`首行应该是: "${bestMatch.content.slice(0, 60)}"`);
            } else {
                issues.push(`❌ 首行 "${firstLine.slice(0, 40)}..." 在文件中不存在`);
            }
        }
    }
    
    return { issues, fixes };
}

// ============ 反馈生成 ============

/**
 * 生成具体的修正指令
 * 当差异只是空白字符时，告诉 Gemini 具体怎么改
 */
function generateFixInstructions(diffs) {
    const instructions = [];
    
    for (const d of diffs.slice(0, 5)) {
        if (d.type !== 'whitespace') continue;
        
        const searchLine = d.search;
        const fileLine = d.file;
        
        // 检测行尾空格
        const searchTrailing = searchLine.match(/[ \t]+$/);
        const fileTrailing = fileLine.match(/[ \t]+$/);
        if (searchTrailing && !fileTrailing) {
            instructions.push(`第 ${d.lineNum} 行：删除行尾的 ${searchTrailing[0].length} 个空白字符`);
            continue;
        }
        
        // 检测缩进差异
        const searchIndent = searchLine.match(/^[ \t]*/)[0];
        const fileIndent = fileLine.match(/^[ \t]*/)[0];
        if (searchIndent !== fileIndent) {
            const searchTabs = (searchIndent.match(/\t/g) || []).length;
            const searchSpaces = (searchIndent.match(/ /g) || []).length;
            const fileTabs = (fileIndent.match(/\t/g) || []).length;
            const fileSpaces = (fileIndent.match(/ /g) || []).length;
            
            if (searchTabs > 0 && fileTabs === 0) {
                instructions.push(`第 ${d.lineNum} 行：把 ${searchTabs} 个 Tab 改成 ${fileSpaces} 个空格`);
            } else if (searchSpaces > 0 && fileSpaces === 0 && fileTabs > 0) {
                instructions.push(`第 ${d.lineNum} 行：把 ${searchSpaces} 个空格改成 ${fileTabs} 个 Tab`);
            } else if (searchSpaces !== fileSpaces) {
                instructions.push(`第 ${d.lineNum} 行：缩进从 ${searchSpaces} 个空格改成 ${fileSpaces} 个空格`);
            }
        }
    }
    
    return instructions;
}

function generateDiffReport(diffs) {
    if (diffs.length === 0) return '';
    
    // 检查是否全是空白差异
    const allWhitespace = diffs.every(d => d.type === 'whitespace');
    
    // 生成具体修正指令
    const fixInstructions = generateFixInstructions(diffs);
    
    let report = '';
    
    // 如果有具体修正指令，优先显示
    if (fixInstructions.length > 0) {
        report += `**🔧 具体修正（逐行）：**\n${fixInstructions.map(i => `- ${i}`).join('\n')}\n\n`;
        if (allWhitespace) {
            report += `💡 **提示：** 所有差异都是空白字符问题，内容本身是对的。直接复制下方"正确的 SEARCH 块"最省事。\n\n`;
        }
    }
    
    // 详细差异
    const lines = diffs.slice(0, 6).map(d => {
        if (d.type === 'whitespace') {
            return `  第 ${d.lineNum} 行: 空白差异 - 位置 ${d.firstDiffPos}: ${d.searchChar} → ${d.fileChar}
    你写的: \`${visualizeLine(d.search)}\`
    实际是: \`${visualizeLine(d.file)}\``;
        } else {
            return `  第 ${d.lineNum} 行: 内容不同 (${d.similarity}% 相似)
    你写的: \`${d.search.slice(0, 70)}${d.search.length > 70 ? '...' : ''}\`
    实际是: \`${d.file.slice(0, 70)}${d.file.length > 70 ? '...' : ''}\``;
        }
    });
    
    report += `**逐行差异分析：**\n${lines.join('\n\n')}`;
    if (diffs.length > 6) report += `\n\n  ... 还有 ${diffs.length - 6} 处差异`;
    return report;
}

/**
 * 匹配失败反馈
 */
function buildMismatchContext(filePath, fileContent, searchBlock) {
    const lang = getLanguage(filePath);
    const searchLines = searchBlock.split('\n');
    
    // 检测截断
    const truncation = detectTruncation(searchBlock);
    if (truncation.truncated) {
        return `❌ **输出被截断** - \`${filePath}\`

检测到 ${truncation.reason}，代码传输被损坏。

**解决方案：** 避免直接写 \`$\` 符号，用 \`String.fromCharCode(36)\` 代替，或拆分成小补丁。`;
    }
    
    const { issues, fixes } = detectIssues(searchBlock, fileContent);
    const candidates = findCandidates(searchBlock, fileContent);
    
    let response = `❌ **SEARCH 块匹配失败** - \`${filePath}\`\n`;
    
    if (issues.length > 0) response += `\n**问题：**\n${issues.join('\n')}\n`;
    if (fixes.length > 0) response += `\n**修复：**\n${fixes.map(f => `- ${f}`).join('\n')}\n`;
    
    if (candidates.length > 0) {
        const best = candidates[0];

        // 缩进检测
        const firstLine = searchLines[0]?.trim();
        if (best.score < 100 && best.lines[0]?.trim() === firstLine) {
            response += `\n⚠️ **疑似缩进错误**：首行文字匹配但由于缩进不一致导致失效。\n`;
            response += `💡 *提示*：引擎现已支持 Outdent (向外缩进)，请确保 REPLACE 块的相对缩进逻辑正确。\n`;
        }

        response += `\n**最佳匹配：** 第 ${best.startLine}-${best.endLine} 行 (${best.score}% 相似)\n`;
        
        const diffs = detailedDiff(searchLines, best.lines);
        if (diffs.length > 0) response += '\n' + generateDiffReport(diffs) + '\n';
        
        // 直接给出正确的 SEARCH 块
        response += `\n**✅ 正确的 SEARCH 块（直接复制）：**\n\`\`\`${lang}\n${best.lines.join('\n')}\n\`\`\`\n`;
        
        if (candidates.length > 1) {
            response += `\n**其他位置：** `;
            response += candidates.slice(1, 4).map(c => `第${c.startLine}行(${c.score}%)`).join(', ');
            response += '\n';
        }
    } else {
        response += `\n**⚠️ 找不到任何相似代码！** 请确认文件路径和内容是否正确。\n`;
        const preview = fileContent.split('\n').slice(0, 15).map((l, i) => 
            `${String(i + 1).padStart(4)}: ${l}`
        ).join('\n');
        response += `\n**文件开头：**\n\`\`\`${lang}\n${preview}\n\`\`\`\n`;
    }
    
    response += `\n**你的 SEARCH 块：**\n\`\`\`${lang}\n${searchBlock}\n\`\`\``;
    return response;
}

/**
 * 语法错误反馈
 */
function buildSyntaxErrorContext(filePath, error, searchBlock, replaceBlock, patchedContent) {
    const lang = getLanguage(filePath);
    
    const truncation = detectTruncation(replaceBlock);
    if (truncation.truncated) {
        return `❌ **输出被截断** - \`${filePath}\`\n\nREPLACE 块包含 ${truncation.reason}，请重新生成。`;
    }
    
    const lineMatch = error.match(/第 (\d+) 行/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : -1;
    
    let response = `❌ **语法检查失败** - \`${filePath}\`\n\n**错误：** ${error}\n`;
    
    if (patchedContent && errorLine > 0) {
        const lines = patchedContent.split('\n');
        const start = Math.max(0, errorLine - 5);
        const end = Math.min(lines.length, errorLine + 5);
        const context = lines.slice(start, end).map((line, i) => {
            const num = start + i + 1;
            const marker = num === errorLine ? ' >>>' : '    ';
            return `${String(num).padStart(4)}${marker} ${line}`;
        }).join('\n');
        response += `\n**错误位置：**\n\`\`\`${lang}\n${context}\n\`\`\`\n`;
    }
    
    response += `\n**SEARCH：**\n\`\`\`${lang}\n${searchBlock}\n\`\`\`\n`;
    response += `\n**REPLACE：**\n\`\`\`${lang}\n${replaceBlock}\n\`\`\`\n`;
    response += `\n检查 REPLACE 块是否导致括号不匹配或语句不完整。`;
    return response;
}

/**
 * 重复匹配反馈
 */
function buildDuplicateContext(filePath, fileContent, searchBlock, matchCount) {
    const lang = getLanguage(filePath);
    const fileLines = fileContent.split('\n');
    const searchLines = searchBlock.split('\n');
    const firstLine = searchLines[0]?.trim();
    
    const positions = [];
    fileLines.forEach((line, i) => {
        if (line.trim() === firstLine) positions.push(i + 1);
    });
    
    let response = `❌ **匹配到 ${matchCount} 处相同代码** - \`${filePath}\`\n\n`;
    response += `**位置：** 第 ${positions.slice(0, 10).join(', ')} 行\n`;
    
    positions.slice(0, 2).forEach((pos, idx) => {
        const start = Math.max(0, pos - 2);
        const end = Math.min(fileLines.length, pos + searchLines.length + 1);
        const context = fileLines.slice(start, end).map((l, i) => 
            `${String(start + i + 1).padStart(4)}: ${l}`
        ).join('\n');
        response += `\n**位置 ${idx + 1}：**\n\`\`\`${lang}\n${context}\n\`\`\`\n`;
    });
    
    response += `\n**你的 SEARCH 块：**\n\`\`\`${lang}\n${searchBlock}\n\`\`\`\n`;
    response += `\n**建议：** 添加前后 2-3 行独特上下文使其唯一匹配。`;
    return response;
}

/**
 * 文件不存在反馈
 */
function buildFileNotFoundContext(filePath, projectFiles) {
    let response = `❌ **文件不存在** - \`${filePath}\`\n\n`;
    response += `项目中没有找到这个文件。\n\n`;
    response += `**可能的原因：**\n`;
    response += `- 文件路径拼写错误\n`;
    response += `- 文件已被删除或移动\n`;
    response += `- 路径应该是相对于项目根目录的完整路径\n\n`;
    
    // 尝试找相似的文件名
    const fileName = filePath.split('/').pop();
    if (projectFiles && projectFiles.length > 0) {
        const similar = projectFiles
            .filter(f => f.toLowerCase().includes(fileName.toLowerCase().slice(0, 5)))
            .slice(0, 5);
        if (similar.length > 0) {
            response += `**你是不是想找：**\n`;
            response += similar.map(f => `- \`${f}\``).join('\n');
            response += '\n';
        }
    }
    
    response += `\n请检查文件路径后重新生成补丁。`;
    return response;
}

/**
 * 读取失败反馈
 */
function buildReadErrorContext(filePath) {
    return `❌ **文件读取失败** - \`${filePath}\`

无法读取文件内容，可能是权限问题或文件被占用。

请确认文件可以正常访问后重试。`;
}


// ========== src/gemini/input.js ==========
/**
 * 输入框操作模块 - Quill 编辑器交互与文本注入
 */



/**
 * Patch Quill 编辑器，绕过 Gemini 的字数限制
 * 原理：拦截 deleteText 方法，阻止系统自动截断大段文本
 */
function patchQuillDeleteText() {
    const container = document.querySelector('.ql-container');
    if (!container?.__quill) {
        // Quill 还没初始化，稍后重试
        setTimeout(patchQuillDeleteText, 500);
        return;
    }
    
    const quill = container.__quill;
    
    // 避免重复 patch
    if (quill.__bypassPatched) return;
    quill.__bypassPatched = true;
    
    const originalDeleteText = quill.deleteText.bind(quill);
    
    quill.deleteText = function(index, length, source) {
        const totalLen = quill.getLength();
        
        // 拦截条件：批量删除（length > 1）且删到末尾（系统截断特征）
        // 但允许用户主动清空（通过 source === 'user' 或 'api' 配合 silent）
        if (length > 1 && (index + length) >= totalLen - 1 && source !== 'silent') {
            console.warn('🛡️ 拦截 Gemini 自动截断:', { index, length, totalLen });
            return;
        }
        
        return originalDeleteText(index, length, source);
    };
    
    console.log('🛡️ Quill 字数限制绕过已激活');
}

/**
 * 获取输入框元素
 */
function getInputElement() {
    const selectors = [
        'rich-textarea .ql-editor',
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

/**
 * 获取 Quill 实例
 */
function getQuillInstance() {
    const container = document.querySelector('.ql-container');
    return container?.__quill || null;
}

/**
 * 向输入框插入文本
 */
function insertToInput(text) {
    const inputEl = getInputElement();
    
    if (!inputEl) {
        showToast('找不到输入框', 'error');
        return false;
    }
    
    inputEl.focus();

    const quill = getQuillInstance();

    if (quill) {
        // 使用 Quill 原生 API 注入，能自动触发所有内部监听并更新 UI
        const length = quill.getLength();
        const insertionIndex = length > 1 ? length - 1 : 0;
        const prefix = insertionIndex > 0 ? '\n\n' : '';
        quill.insertText(insertionIndex, prefix + text, 'user');
        quill.setSelection(quill.getLength(), 0); // 光标移到末尾
    } else {
        // 降级方案：直接操作 DOM
        const existing = inputEl.textContent || '';
        const newContent = existing ? existing + '\n\n' + text : text;
        inputEl.textContent = newContent;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 手动定位光标到末尾
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(inputEl);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    return { success: true, tokens: estimateTokens(text) };
}

/**
 * 发送文件内容到输入框
 */
function sendFile(filePath, content) {
    const lang = getLanguage(filePath);
    const text = `📄 **文件最新状态** - \`${filePath}\`\n\n以下是该文件当前的完整内容：\n\n\`\`\`${lang}\n${content}\n\`\`\``;
    const result = insertToInput(text);
    if (result.success) {
        showToast(`已发送: ${filePath.split('/').pop()} (~${formatTokens(result.tokens)} tokens)`);
    }
    return result.success;
}

/**
 * 发送目录结构到输入框
 */
function sendStructure(name, structure) {
    const text = `目录 \`${name}\` 结构:\n\n\`\`\`\n${structure}\`\`\``;
    const result = insertToInput(text);
    if (result.success) {
        showToast(`已发送目录 (~${formatTokens(result.tokens)} tokens)`);
    }
    return result.success;
}


// ========== src/gemini/watcher.js ==========
/**
 * 代码块监听模块
 */



/**
 * 处理代码块，返回需要注入按钮的块
 */
function processCodeBlock(block, processedBlocks) {
    if (processedBlocks.has(block)) return null;
    processedBlocks.add(block);
    
    const container = block.closest('code-block') || block.closest('pre') || block;
    if (container.querySelector('.ide-action-bar')) return null;
    
    const text = block.textContent || '';
    
    if (text.includes('IGNORE_IDE_ACTION')) return null;

    const fileMatch = extractFilePath(text);
    // 增加 ^ 锚点和多行模式，确保标记是在行首，避免匹配到字符串内部的示例
    const hasSearchReplace = /^<{6,10} SEARCH/m.test(text) && /^>{6,10} REPLACE/m.test(text);
    const hasDelete = /^<{6,10} DELETE/m.test(text) && /^>{6,10} END/m.test(text);
    const hasRead = /^<{6,10}\s*READ\s*\[/m.test(text);
    
    if (fileMatch || hasSearchReplace || hasDelete || hasRead) {
        return { container, text, fileMatch };
    }
    
    return null;
}

/**
 * 创建 MutationObserver 监听代码块
 */
function createWatcher(onCodeBlock) {
    let timeout = null;
    return new MutationObserver(() => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            const codeBlocks = document.querySelectorAll('code-block, pre > code, .code-block');
            codeBlocks.forEach(block => onCodeBlock(block));
        }, 500);
    });
}


// ========== src/gemini/actions.js ==========
/**
 * 按钮注入和操作模块
 */









/**
* 创建操作按钮（用于代码块操作栏）
 */
function createActionButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
        background: '#2563eb', color: 'white', border: 'none',
        padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
        fontSize: '12px', fontWeight: 'bold'
    });
    btn.onmouseover = () => { btn.style.opacity = '0.8'; };
    btn.onmouseout = () => { btn.style.opacity = '1'; };
    btn.onclick = onClick;
    return btn;
}

/**
 * 添加撤销按钮
 */
function addUndoButton(bar, filePath, insertToInput) {
    const fileName = filePath.split('/').pop();
    const undoBtn = createActionButton(`↩️ 撤销 → ${fileName}`, async () => {
        const result = await fs.revertFile(filePath);
        if (result.success) {
            showToast('已撤销: ' + filePath);
            undoBtn.remove();
        } else {
            showToast(result.error || '撤销失败', 'error');
        }
    });
    undoBtn.className = 'ide-undo-btn';
    undoBtn.title = filePath;
    undoBtn.style.background = '#f59e0b';
    bar.appendChild(undoBtn);
}

/**
 * 添加"发送当前文件"按钮
 */
function addSendFileButton(bar, filePath, insertToInput) {
    const fileName = filePath.split('/').pop();
    const sendBtn = createActionButton(`📤 发送 → ${fileName}`, async () => {
        const content = await fs.readFile(filePath);
        if (content === null) {
            showToast('读取失败', 'error');
            return;
        }
        const lang = getLanguage(filePath);
        const text = `📄 **文件最新状态** - \`${filePath}\`\n\n以下是该文件当前的完整内容（已应用所有修改）：\n\n\`\`\`${lang}\n${content}\n\`\`\``;
        insertToInput(text);
        showToast(`已发送: ${fileName} (~${formatTokens(estimateTokens(text))} tokens)`);
    });
    sendBtn.className = 'ide-send-btn';
    sendBtn.title = `发送 ${filePath} 的最新内容给 AI`;
    sendBtn.style.background = '#8b5cf6';
    bar.appendChild(sendBtn);
}

/**
 * 添加补丁撤销按钮
 * @param {HTMLElement} bar - 操作栏
 * @param {Object} patch - 补丁对象
 * @param {Function} insertToInput - 输入框插入函数
 * @param {HTMLElement} originalBtn - 原始的应用按钮（撤销后恢复它）
 * @param {number} idx - 补丁索引
 */
function addUndoButtonForPatch(bar, patch, insertToInput, originalBtn = null, idx = 0) {
    const fileName = patch.file.split('/').pop();
    const undoBtn = createActionButton(`↩️ 撤销 → ${fileName}`, async () => {
        const result = await fs.revertFile(patch.file);
        if (result.success) {
            showToast('已撤销: ' + patch.file);
            unmarkAsApplied(patch.file, patch.search);
            undoBtn.remove();
            
            // 恢复原按钮状态
            if (originalBtn) {
                const btnText = patch.isDelete 
                    ? `🗑️ 删除代码 #${idx + 1} → ${patch.file}`
                    : `🔧 应用修改 #${idx + 1} → ${patch.file}`;
                originalBtn.textContent = btnText;
                originalBtn.style.background = patch.isDelete ? '#f59e0b' : '#2563eb';
                originalBtn.title = '';
            }
        } else {
            showToast(result.error || '撤销失败', 'error');
        }
    });
    undoBtn.className = 'ide-undo-btn';
    undoBtn.title = patch.file;
    undoBtn.style.background = '#f59e0b';
    bar.appendChild(undoBtn);
}

/**
 * 应用补丁
 */
async function applyPatch(patch, btn, bar, insertToInput) {
    const { file, search, replace } = patch;
    
    // 文件不存在 → 自动反馈
    if (!fs.hasFile(file)) {
        showToast('文件不存在: ' + file, 'error');
        btn.textContent = '❌ 文件不存在';
        btn.style.background = '#dc2626';
        insertToInput(buildFileNotFoundContext(file, fs.getAllFilePaths()));
        return;
    }
    
    const content = await fs.readFile(file);
    // 读取失败 → 自动反馈
    if (content === null) {
        showToast('读取失败', 'error');
        btn.textContent = '❌ 读取失败';
        btn.style.background = '#dc2626';
        insertToInput(buildReadErrorContext(file));
        return;
    }
    
    const result = tryReplace(content, search, replace, file);
    if (!result.success) {
        if (result.isSyntaxError) {
            const shortError = result.errorDetails.length > 20 
                ? result.errorDetails.slice(0, 20) + '...' 
                : result.errorDetails;
            showToast(`⚠️ 语法检查未通过`, 'error');
            insertToInput(buildSyntaxErrorContext(file, result.errorDetails, search, replace, result.content));
            
            btn.textContent = `⚠️ 强制预览 (${shortError})`;
            btn.title = `语法错误: ${result.errorDetails}\n点击可强制预览并应用`;
            btn.style.background = '#f59e0b';
            
            btn.onclick = async () => {
                const confirmed = await showPreviewDialog(file, search, replace, result.matchLine || 1, result.errorDetails);
                if (confirmed) {
                    btn.textContent = '应用中...';
                    const success = await fs.writeFile(file, result.content);
                    if (success) {
                        btn.textContent = '✅ 已应用';
                        btn.style.background = '#059669';
                        showToast('已修改: ' + file);
                        markAsApplied(file, search);
                        addUndoButtonForPatch(bar, patch, insertToInput, btn, patch._idx || 0);
                    } else {
                        btn.textContent = '❌ 写入失败';
                        btn.style.background = '#dc2626';
                    }
                }
            };
            return;
        }

        const reason = result.reason || '未知错误';
        showToast(reason, 'error');
        
        if (result.matchCount && result.matchCount > 1) {
            btn.textContent = `❌ ${result.matchCount}处重复`;
            insertToInput(buildDuplicateContext(file, content, search, result.matchCount));
        } else if (result.alreadyApplied) {
            btn.textContent = '✅ 已应用';
            btn.style.background = '#059669';
        } else {
            btn.textContent = '❌ 未匹配';
            insertToInput(buildMismatchContext(file, content, search));
        }
        
        btn.style.background = result.alreadyApplied ? '#059669' : '#dc2626';
        return;
    }

    const confirmed = await showPreviewDialog(file, search, replace, result.matchLine || 1);
    if (!confirmed) {
        btn.disabled = false;
        btn.style.opacity = '1';
        return;
    }
    
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = '应用中...';
    const success = await fs.writeFile(file, result.content);
    if (success) {
        btn.textContent = '✅ 已应用';
        btn.title = `于 ${new Date().toLocaleTimeString()} 应用成功`;
        btn.style.background = '#059669';
        showToast('已修改: ' + file);
        markAsApplied(file, search);
        addUndoButtonForPatch(bar, patch, insertToInput, btn, patch._idx || 0);
    } else {
        btn.textContent = '❌ 写入失败';
        btn.style.background = '#dc2626';
    }
}

/**
 * 注入操作栏
 */
function injectActionBar(container, text, filePath, insertToInput) {
    const bar = document.createElement('div');
    bar.className = 'ide-action-bar';
    Object.assign(bar.style, {
        display: 'flex', gap: '8px', padding: '8px',
        background: 'var(--ide-hint-bg, #363739)', 
        borderRadius: '0 0 6px 6px',
        borderTop: '1px solid var(--ide-border, #444746)', 
        flexWrap: 'wrap'
    });

    // 删除指令
    const deletes = parseDelete(text);
    if (deletes.length > 0) {
        if (deletes.length > 1) {
            const batchBtn = createActionButton(`🗑️ 批量删除 (${deletes.length}个文件)`, async () => {
                const fileList = deletes.map(d => `• ${d.file}`).join('\n');
                if (!confirm(`确定要批量删除以下 ${deletes.length} 个文件/目录吗？\n\n${fileList}`)) return;

                batchBtn.textContent = '正在处理...';
                let successCount = 0;
                
                for (const del of deletes) {
                    const success = await fs.deleteFile(del.file);
                    if (success) successCount++;
                }

                if (successCount === deletes.length) {
                    batchBtn.textContent = `✅ 已删除 ${successCount} 个文件`;
                    batchBtn.style.background = '#059669';
                    showToast(`删除成功: 共 ${successCount} 个文件`);
                } else {
                    batchBtn.textContent = `⚠️ 成功 ${successCount}/${deletes.length}`;
                    batchBtn.style.background = '#f59e0b';
                    showToast(`部分删除失败: 成功 ${successCount} 个`, 'error');
                }
                
                window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
            });
            batchBtn.style.background = '#dc2626';
            bar.appendChild(batchBtn);
        }
        
        deletes.forEach(del => {
            const btn = createActionButton(`🗑️ 删除 → ${del.file}`, async () => {
                const cleanPath = del.file.replace(/\/$/, '');
                // 严谨校验：只有在目录句柄池中的才视为目录
                const isDir = fs.dirHandles.has(cleanPath);
                
                // 安全阀：严禁通过此指令删除项目根目录
                if (cleanPath === '.' || cleanPath === '' || cleanPath === fs.projectName) {
                    showToast('禁止删除项目根目录', 'error');
                    return;
                }

                const typeText = isDir ? '目录' : '文件';
                const confirmMsg = isDir 
                    ? `⚠️ 危险操作！\n确认递归删除目录 "${cleanPath}" 及其内部所有文件吗？\n此操作不可恢复！`
                    : `确认删除文件 "${cleanPath}" 吗？`;

                if (!confirm(confirmMsg)) return;
                
                btn.textContent = '正在删除...';
                const success = isDir 
                    ? await fs.deleteDirectory(cleanPath) 
                    : await fs.deleteFile(cleanPath);
                
                if (success) {
                    btn.textContent = '✅ 已删除';
                    btn.style.background = '#059669';
                    showToast(`已删除: ${del.file}`);
                    window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
                } else {
                    btn.textContent = '❌ 删除失败';
                    btn.style.background = '#f59e0b';
                    showToast(`删除失败: ${del.file}`, 'error');
                }
            });
            btn.style.background = '#dc2626';
            bar.appendChild(btn);
        });
    }

    // 增量修改
    const patches = parseSearchReplace(text);
    
    if (patches.length > 0) {
        // 收集所有涉及的文件（去重）
        const involvedFiles = new Set();
        
        patches.forEach((patch, idx) => {
            patch._idx = idx; // 保存索引供撤销时使用
            if (patch.file) involvedFiles.add(patch.file);
            
            const btn = document.createElement('button');
            Object.assign(btn.style, {
                background: '#2563eb', color: 'white', border: 'none',
                padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 'bold'
            });
            btn.onmouseover = () => { btn.style.opacity = '0.8'; };
            btn.onmouseout = () => { btn.style.opacity = '1'; };

            const btnText = patch.isDelete 
                ? `🗑️ 删除代码 #${idx + 1} → ${patch.file || '?'}`
                : `🔧 应用修改 #${idx + 1} → ${patch.file || '?'}`;
            btn.textContent = btnText;
            
            if (patch.isDelete) {
                btn.style.background = '#f59e0b';
            }

            btn.onclick = async () => {
                if (!patch.file) {
                    const input = prompt('请输入目标文件路径:');
                    if (!input) return;
                    patch.file = input;
                }
                await applyPatch(patch, btn, bar, insertToInput);
            };
            
            bar.appendChild(btn);
        });
        
        // 按文件分组批量检查已应用状态（避免同一文件重复读取）
        const filePatches = new Map(); // file -> [{patch, btn, idx}]
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
        
        // 每个文件只读取一次，批量检查其所有补丁
        filePatches.forEach(async (items, filePath) => {
            if (!fs.hasFile(filePath)) return;
            
            const content = await fs.readFile(filePath);
            if (content === null) return;
            
            const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
            const normalizedContent = normalize(content);
            
            for (const { patch, btn, idx } of items) {
                const normalizedSearch = normalize(patch.search);
                const searchExists = normalizedContent.includes(normalizedSearch);
                
                if (!searchExists) {
                    // search 不存在，可能已应用
                    const data = JSON.parse(localStorage.getItem('ide-applied-patches') || '{}');
                    const key = getPatchKey(patch.file, patch.search);
                    if (data[key]) {
                        btn.textContent = `✅ 已应用 #${idx + 1} → ${patch.file}`;
                        btn.style.background = '#059669';
                        addUndoButtonForPatch(bar, patch, insertToInput, btn, idx);
                    }
                }
            }
        });
        
        // 为每个涉及的文件添加发送按钮（只要文件存在）
        involvedFiles.forEach(filePath => {
            if (fs.hasFile(filePath)) {
                addSendFileButton(bar, filePath, insertToInput);
            }
        });
    } else if (text.includes('FILE:')) {
        const filesToProcess = parseMultipleFiles(text);
        
        // 收集所有涉及的文件（去重）
        const involvedFiles = new Set();
        
        if (filesToProcess.length > 1) {
            const batchBtn = createActionButton(`➕ 批量创建/覆盖 (${filesToProcess.length}个文件)`, async () => {
                batchBtn.textContent = '正在处理...';
                let successCount = 0;
                for (const file of filesToProcess) {
                    const exists = fs.hasFile(file.path);
                    const success = exists 
                        ? await fs.writeFile(file.path, file.content) 
                        : await fs.createFile(file.path, file.content);
                    if (success) successCount++;
                }
                if (successCount === filesToProcess.length) {
                    batchBtn.textContent = `✅ 已处理 ${successCount} 个文件`;
                    batchBtn.style.background = '#059669';
                } else {
                    batchBtn.textContent = `⚠️ 成功 ${successCount}/${filesToProcess.length}`;
                    batchBtn.style.background = '#f59e0b';
                }
                window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
            });
            batchBtn.style.background = '#8b5cf6';
            bar.appendChild(batchBtn);
        }
        
        filesToProcess.forEach(file => {
            const exists = fs.hasFile(file.path);
            if (exists) involvedFiles.add(file.path);
            
            const btnText = file.isOverwrite && exists 
                ? `📝 覆盖 → ${file.path}` 
                : (exists ? `💾 保存 → ${file.path}` : `➕ 创建 → ${file.path}`);
            
            const btn = createActionButton(btnText, async () => {
                if (file.isOverwrite && exists && !confirm(`确定覆盖 "${file.path}"？`)) return;
                btn.textContent = '处理中...';
                const success = exists 
                    ? await fs.writeFile(file.path, file.content) 
                    : await fs.createFile(file.path, file.content);
                if (success) {
                    btn.textContent = '✅ 已成功';
                    btn.style.background = '#059669';
                    if (!exists) {
                        window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
                        // 新建成功后添加发送按钮
                        addSendFileButton(bar, file.path, insertToInput);
                    } else {
                        addUndoButton(bar, file.path, insertToInput);
                    }
                } else {
                    btn.textContent = '❌ 失败';
                    btn.style.background = '#dc2626';
                }
            });
            if (file.isOverwrite && exists) btn.style.background = '#f59e0b';
            bar.appendChild(btn);
        });
        
        // 为每个已存在的文件添加发送按钮
        involvedFiles.forEach(filePath => {
            addSendFileButton(bar, filePath, insertToInput);
        });
    }

    // READ 指令（请求读取文件片段）
    const reads = parseRead(text);
    if (reads.length > 0) {
        reads.forEach(read => {
            const fileName = read.file.split('/').pop();
            const rangeText = read.startLine && read.endLine 
                ? ` (${read.startLine}-${read.endLine}行)` 
                : ' (全部)';
            
            const btn = createActionButton(`📖 读取 → ${fileName}${rangeText}`, async () => {
                if (!fs.hasFile(read.file)) {
                    showToast('文件不存在: ' + read.file, 'error');
                    btn.textContent = '❌ 文件不存在';
                    btn.style.background = '#dc2626';
                    return;
                }
                
                const content = await fs.readFile(read.file);
                if (content === null) {
                    showToast('读取失败', 'error');
                    return;
                }
                
                const lines = content.split('\n');
                const totalLines = lines.length;
                
                let selectedContent;
                let rangeInfo;
                
                if (read.startLine && read.endLine) {
                    // 指定行号范围
                    const start = Math.max(1, read.startLine) - 1;
                    const end = Math.min(totalLines, read.endLine);
                    selectedContent = lines.slice(start, end).join('\n');
                    rangeInfo = `第 ${read.startLine}-${read.endLine} 行（共 ${totalLines} 行）`;
                } else {
                    // 读取整个文件
                    selectedContent = content;
                    rangeInfo = `全部内容（共 ${totalLines} 行）`;
                }
                
                const lang = getLanguage(read.file);
                const responseText = `📄 **文件片段** - \`${read.file}\` ${rangeInfo}\n\n\`\`\`${lang}\n${selectedContent}\n\`\`\``;
                
                insertToInput(responseText);
                showToast(`已发送: ${fileName} (~${formatTokens(estimateTokens(responseText))} tokens)`);
                
                btn.textContent = `✅ 已发送 → ${fileName}`;
                btn.style.background = '#059669';
            });
            btn.style.background = '#10b981';
            bar.appendChild(btn);
        });
    }

    if (bar.children.length > 0) {
        container.style.position = 'relative';
        container.appendChild(bar);
    }
}


// ========== src/gemini/index.js ==========
/**
 * Gemini 交互模块入口
 */





const gemini = {
    observer: null,
    processedBlocks: new WeakSet(),
    _quillPatched: false,

    // 代理到 input.js 的方法
    insertToInput,
    sendFile,
    sendStructure,

    startWatching() {
        if (this.observer) return;
        
        // 启动 Quill patch
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
        console.log('[Gemini] 开始监听代码块');
    },

    _processCodeBlocks() {
        const codeBlocks = document.querySelectorAll('code-block, pre > code, .code-block');
        
        codeBlocks.forEach(block => {
            const result = processCodeBlock(block, this.processedBlocks);
            if (result) {
                injectActionBar(result.container, result.text, result.fileMatch, (msg) => this.insertToInput(msg));
            }
        });
    }
};


// ========== src/main.js ==========
/**
 * Gemini IDE Bridge - 入口文件
 * 版本号从 manifest.json 读取
 * 
 * 注意：此文件的启动逻辑由 build.js 在构建时添加
 * 这里只导出必要的对象供调试使用
 */





// 导出供调试
window.IDE_BRIDGE = { fs, ui, gemini };



// 启动
if (document.body) {
    ui.init();
    const observer = new MutationObserver(() => {
        if (!document.getElementById('ide-bridge-root')) ui.init();
    });
    observer.observe(document.body, { childList: true });
} else {
    window.onload = () => ui.init();
}

window.IDE_BRIDGE = { fs, ui, gemini, version: IDE_VERSION };
console.log('%c[IDE Bridge] V' + IDE_VERSION, 'color: #00ff00; font-size: 14px;');

})();
