/**
 * 依赖分析模块 - 自动解析文件的 import/require 依赖
 * 支持: JS/TS, Python, C/C++
 */

import { fs } from './fs.js';

/**
 * 根据文件后缀获取语言类型
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

/**
 * 解析 JS/TS 的依赖
 */
function parseJsDeps(content) {
    const deps = [];
    
    // import x from './path'
    // import { x } from './path'
    // import './path'
    const importRegex = /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"]+)['"]/g;
    
    // require('./path')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    // export { x } from './path'
    const exportFromRegex = /export\s+(?:[\w\s{},*]+\s+)?from\s+['"]([^'"]+)['"]/g;
    
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

/**
 * 解析 Python 的依赖
 */
function parsePythonDeps(content) {
    const deps = [];
    
    // 1. 处理 from xxx import (a, b) 多行或单行括号格式
    const fromImportParenthesesRegex = /from\s+([\w.]+)\s+import\s*\(([\s\S]*?)\)/g;
    
    // 2. 处理普通的 from xxx import yyy
    const fromImportRegex = /from\s+([\w.]+)\s+import\s+[\w.*,\s]+$/gm;
    
    // 3. 处理 import xxx
    const importRegex = /^import\s+([\w.]+)/gm;
    
    let match;
    
    // 解析带括号的导入
    while ((match = fromImportParenthesesRegex.exec(content)) !== null) {
        deps.push(match[1]);
    }
    
    // 解析普通的 from 导入 (排除已经匹配的括号内容)
    const simpleFromRegex = /from\s+([\w.]+)\s+import(?!\s*\()/g;
    while ((match = simpleFromRegex.exec(content)) !== null) {
        deps.push(match[1]);
    }
    
    // 解析直接 import
    while ((match = importRegex.exec(content)) !== null) {
        deps.push(match[1]);
    }
    
    return deps;
}

/**
 * 解析 C/C++ 的依赖
 */
function parseCDeps(content) {
    const deps = [];
    
    // #include "header.h" (本地头文件)
    const includeRegex = /#include\s*"([^"]+)"/g;
    
    let match;
    while ((match = includeRegex.exec(content)) !== null) {
        deps.push(match[1]);
    }
    
    // 忽略 #include <xxx> 系统头文件
    return deps;
}

/**
 * 解析文件依赖
 */
function parseDeps(content, fileType) {
    switch (fileType) {
        case 'js': return parseJsDeps(content);
        case 'python': return parsePythonDeps(content);
        case 'c': return parseCDeps(content);
        default: return [];
    }
}

/**
 * 将依赖路径解析为项目中的实际文件路径
 */
function resolveDep(dep, currentFile, fileType) {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/')) || '.';
    
    // 忽略第三方包
    if (fileType === 'js' && !dep.startsWith('.') && !dep.startsWith('/')) {
        return null; // node_modules
    }
    
    if (fileType === 'python') {
        // 将 python 的 pkg.module 转换为 pkg/module
        const dotPath = dep.replace(/\./g, '/');
        
        // 1. 相对导入 (from . import xxx, from .. import xxx)
        if (dep.startsWith('.')) {
            const relPath = resolvePath(currentDir, dotPath);
            if (fs.hasFile(relPath + '.py')) return relPath + '.py';
            if (fs.hasFile(relPath + '/__init__.py')) return relPath + '/__init__.py';
        }
        
        // 2. 项目内绝对导入 (import src.utils)
        if (fs.hasFile(dotPath + '.py')) return dotPath + '.py';
        if (fs.hasFile(dotPath + '/__init__.py')) return dotPath + '/__init__.py';
        
        return null;
    }
    
    if (fileType === 'js') {
        // 处理相对路径
        let resolved = resolvePath(currentDir, dep);
        
        // 尝试补全后缀
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
        // C/C++ 头文件，直接相对路径
        const resolved = resolvePath(currentDir, dep);
        return fs.hasFile(resolved) ? resolved : null;
    }
    
    return null;
}

/**
 * 解析相对路径
 */
function resolvePath(base, relative) {
    if (relative.startsWith('/')) {
        return relative.substring(1).replace(/\/+$/, '');
    }
    
    const baseParts = base.split('/').filter(p => p && p !== '.' && p !== '');
    const relativeParts = relative.split('/');
    
    for (const part of relativeParts) {
        if (part === '..') {
            if (baseParts.length > 0) baseParts.pop();
        } else if (part !== '.' && part !== '') {
            baseParts.push(part);
        }
    }
    
    return baseParts.join('/');
}

/**
 * 分析文件的所有依赖（递归）
 * @param {string} filePath - 起始文件路径
 * @param {number} maxDepth - 最大递归深度
 * @returns {Promise<string[]>} - 依赖文件路径列表
 */
export async function analyzeDeps(filePath, maxDepth = 2) {
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
                result.push(resolved);
                await analyze(resolved, depth + 1);
            }
        }
    }
    
    await analyze(filePath, 0);
    return result;
}

/**
 * 获取文件及其依赖的完整列表
 */
export async function getFileWithDeps(filePath) {
    const deps = await analyzeDeps(filePath);
    return {
        main: filePath,
        deps: deps,
        all: [filePath, ...deps]
    };
}

export const depsAnalyzer = {
    analyzeDeps,
    getFileWithDeps,
    getFileType
};
