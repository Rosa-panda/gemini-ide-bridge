/**
 * 文件系统模块 - 处理本地文件读写
 */

import { history } from './history.js';
import { watcher } from './watcher.js';

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', '.DS_Store', '.idea', 
    '.vscode', '__pycache__', '.next', 'build', '.cache',
    'coverage', '.env', '.gitkeep',
    'venv', '.venv'  // Python 虚拟环境，动辄数万文件，必须忽略
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

export const fs = new FileSystem();
export { watcher };
