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
    
    // 增强版正则：支持多行导入及更复杂的 import 语法
    const importRegex = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
    
    // require('./path')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    
    // export { x } from './path'
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
        // 1. 预处理：提取纯路径并处理变体
        const isRelative = dep.startsWith('.');
        const cleanDep = dep.replace(/^\.+/, '');
        const dotPath = cleanDep.replace(/\./g, '/');
        
        // 生成路径变体：test_lab -> [test_lab, test-lab]
        const pathVariants = [dotPath];
        if (dotPath.includes('_')) pathVariants.push(dotPath.replace(/_/g, '-'));

        for (const p of pathVariants) {
            const candidates = [];
            if (isRelative) {
                // 相对导入：只在当前目录下找
                candidates.push(resolvePath(currentDir, p));
            } else {
                // 绝对/普通导入：先找根目录，再找当前目录（兼容性最强）
                candidates.push(p); 
                candidates.push(resolvePath(currentDir, p));
            }

            for (const cand of candidates) {
                if (!cand) continue;
                // 验证所有可能的后缀
                const fileTry = cand + '.py';
                const pkgTry = cand + '/__init__.py';
                
                if (fs.hasFile(fileTry)) return fileTry;
                if (fs.hasFile(pkgTry)) return pkgTry;
            }
        }
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
    // 确保处理绝对路径和相对路径的一致性
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
    // 始终返回相对于项目根目录的路径，不带前导斜杠
    return resultParts.join('/');
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
                // 确保先分析子依赖，再将当前确认的依赖放入结果集，且避免重复
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
