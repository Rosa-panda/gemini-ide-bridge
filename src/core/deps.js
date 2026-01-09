/**
 * 依赖分析模块 - 自动解析文件的 import/require 依赖
 */

import { fs } from './fs.js';

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
    // 匹配 import ... from "..." 或 import "..."
    const importRegex = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
    // 🆕 新增：支持 import('./module') 动态导入语法
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const exportFromRegex = /export\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        // 修复：如果没有 from，路径会在 match[2] 中
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
