/**
 * 文件系统模块 - 处理本地文件读写
 */

import { history } from './history.js';

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', '.DS_Store', '.idea', 
    '.vscode', '__pycache__', '.next', 'build', '.cache'
]);

class FileSystem {
    constructor() {
        this.rootHandle = null;
        this.fileHandles = new Map();
        this.dirHandles = new Map(); // 新增：目录句柄缓存
        this.projectName = '';
    }

    async openProject() {
        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            this.rootHandle = dirHandle;
            this.projectName = dirHandle.name;
            return await this.refreshProject();
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // 🔄 新增：静默刷新项目（不弹窗）
    async refreshProject() {
        if (!this.rootHandle) return { success: false, error: '未连接项目' };
        
        try {
            this.fileHandles.clear();
            this.dirHandles.clear();
            const tree = await this._scanDir(this.rootHandle);
            return { success: true, rootName: this.rootHandle.name, tree };
        } catch (err) {
            console.error('[FS] 刷新失败:', err);
            return { success: false, error: err.message };
        }
    }

    async _scanDir(dirHandle, path = '') {
        const entries = [];
        // 缓存目录句柄
        this.dirHandles.set(path || '.', dirHandle);
        
        for await (const entry of dirHandle.values()) {
            if (IGNORE_DIRS.has(entry.name)) continue;
            const relPath = path ? `${path}/${entry.name}` : entry.name;
            
            if (entry.kind === 'file') {
                this.fileHandles.set(relPath, entry);
                entries.push({ name: entry.name, kind: 'file', path: relPath });
            } else if (entry.kind === 'directory') {
                entries.push({
                    name: entry.name, kind: 'directory', path: relPath,
                    children: await this._scanDir(entry, relPath)
                });
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
            return await file.text();
        } catch (err) {
            console.error('[FS] 读取失败:', filePath, err);
            return null;
        }
    }

    async writeFile(filePath, content, saveHistory = true) {
        const handle = this.fileHandles.get(filePath);
        if (!handle) {
            console.error('[FS] 文件不存在:', filePath);
            return false;
        }
        try {
            // 写入前保存历史版本
            if (saveHistory) {
                const oldContent = await this.readFile(filePath);
                if (oldContent !== null) {
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

    /**
     * 回退文件到上一个版本
     */
    async revertFile(filePath) {
        const lastVersion = await history.getLastVersion(filePath);
        if (!lastVersion) {
            return { success: false, error: '没有可回退的版本' };
        }
        const success = await this.writeFile(filePath, lastVersion.content, false);
        return { success, content: lastVersion.content, timestamp: lastVersion.timestamp };
    }

    /**
     * 回退到指定版本
     */
    async revertToVersion(filePath, timestamp) {
        const versions = await history.getVersions(filePath);
        const target = versions.find(v => v.timestamp === timestamp);
        if (!target) {
            return { success: false, error: '版本不存在' };
        }
        const success = await this.writeFile(filePath, target.content, false);
        return { success, content: target.content };
    }

    /**
     * 获取文件历史版本
     */
    async getFileHistory(filePath) {
        return await history.getVersions(filePath);
    }

    async createFile(filePath, content = '') {
        if (!this.rootHandle) return false;
        try {
            const parts = filePath.split('/');
            const fileName = parts.pop();
            let currentHandle = this.rootHandle;
            
            // 创建中间目录
            for (const part of parts) {
                currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
            }
            
            // 创建文件
            const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
            this.fileHandles.set(filePath, fileHandle);
            
            // 写入内容
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (err) {
            console.error('[FS] 创建文件失败:', filePath, err);
            return false;
        }
    }

    /**
     * 删除文件
     */
    async deleteFile(filePath) {
        if (!this.rootHandle) return false;
        
        try {
            const parts = filePath.split('/');
            const fileName = parts.pop();
            
            // 获取父目录句柄
            let parentHandle = this.rootHandle;
            for (const part of parts) {
                parentHandle = await parentHandle.getDirectoryHandle(part);
            }
            
            // 删除文件
            await parentHandle.removeEntry(fileName);
            
            // 清理缓存
            this.fileHandles.delete(filePath);
            await history.clearFileHistory(filePath);
            
            return true;
        } catch (err) {
            console.error('[FS] 删除文件失败:', filePath, err);
            return false;
        }
    }

    /**
     * 删除目录（递归）
     */
    async deleteDirectory(dirPath) {
        if (!this.rootHandle) return false;
        
        try {
            const parts = dirPath.split('/');
            const dirName = parts.pop();
            
            // 获取父目录句柄
            let parentHandle = this.rootHandle;
            for (const part of parts) {
                parentHandle = await parentHandle.getDirectoryHandle(part);
            }
            
            // 递归删除
            await parentHandle.removeEntry(dirName, { recursive: true });
            
            // 清理相关缓存
            for (const [path] of this.fileHandles) {
                if (path === dirPath || path.startsWith(dirPath + '/')) {
                    this.fileHandles.delete(path);
                    await history.clearFileHistory(path);
                }
            }
            this.dirHandles.delete(dirPath);
            
            return true;
        } catch (err) {
            console.error('[FS] 删除目录失败:', dirPath, err);
            return false;
        }
    }

    hasFile(filePath) {
        return this.fileHandles.has(filePath);
    }

    generateStructure(node, indent = '') {
        let result = '';
        const icon = node.kind === 'directory' ? '📂' : '📄';
        result += indent + icon + ' ' + node.name + '\n';
        if (node.kind === 'directory' && node.children) {
            node.children.forEach(child => {
                result += this.generateStructure(child, indent + '  ');
            });
        }
        return result;
    }

    generateFullStructure(tree) {
        return tree.map(node => this.generateStructure(node)).join('');
    }
}

export const fs = new FileSystem();
