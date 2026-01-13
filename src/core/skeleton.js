/**
 * 语义骨架模块 - 生成代码的精简结构图（基于 AST 思想）
 * 参考：LLVM AST 的结构化生成思路
 */

import { getLogicSignature } from './patcher/matcher.js';

export function generateSkeleton(code, filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const lines = code.split('\n');
    const sigs = getLogicSignature(code);
    
    let skeleton = `// ========== FILE: ${filePath} ==========\n`;
    
    // 针对不同语言的提取逻辑
    if (ext === 'py') {
        return skeleton + generatePythonSkeleton(lines, sigs);
    }
    return skeleton + generateJsSkeleton(lines, sigs);
}

/**
 * 生成 JavaScript/TypeScript 的结构化骨架
 * 保留：导入、导出、类定义、函数签名、类型定义
 */
function generateJsSkeleton(lines, sigs) {
    const result = [];
    let currentClass = null;
    let currentIndent = 0;
    
    sigs.forEach((sig, index) => {
        const c = sig.content.trim();
        const line = lines[sig.originalIndex];
        
        // 1. 类定义 (优先处理，支持 export default, abstract 等)
        if (c.includes('class ') && (c.includes('export ') || c.startsWith('class ') || c.startsWith('abstract '))) {
            if (currentClass) {
                result.push(' '.repeat(currentIndent) + '}');
                result.push('');
            }
            currentClass = c.match(/class\s+(\w+)/)?.[1] || 'Default';
            currentIndent = sig.indent;
            result.push(line.split('{')[0].trim() + ' { /* ... */ }');
            return;
        }
        
        // 2. 函数定义（只保留签名，不保留函数体）
        if (c.startsWith('function ') || c.startsWith('async function ') || 
            c.startsWith('export function ') || c.startsWith('export async function ') ||
            c.match(/^\w+\s*\([^)]*\)\s*{/) || 
            c.match(/^(\w+\s*[:=]\s*)?(async\s*)?\(?[^)]*\)?\s*=>/)) {
            
            let signature = line.split('{')[0].split('=>')[0].trim();
            result.push(signature + ' { /* ... */ }');
            return;
        }

        // 3. 导入/导出/类型定义
        if (c.startsWith('import ') || c.startsWith('export ') || 
            c.startsWith('interface ') || c.startsWith('type ')) {
            result.push(line);
            return;
        }
    });
    
    // 关闭最后一个类
    if (currentClass) {
        result.push(' '.repeat(currentIndent) + '}');
    }
    
    return result.join('\n');
}

/**
 * 生成 Python 的结构化骨架
 * 保留：导入、类定义、函数签名、装饰器
 */
function generatePythonSkeleton(lines, sigs) {
    const result = [];
    
    sigs.forEach((sig, index) => {
        const c = sig.content.trim();
        const line = lines[sig.originalIndex];
        
        // 导入语句
        if (c.startsWith('import ') || c.startsWith('from ')) {
            result.push(line);
            return;
        }
        
        // 装饰器
        if (c.startsWith('@')) {
            result.push(line);
            return;
        }
        
        // 类定义
        if (c.startsWith('class ')) {
            result.push(line);
            result.push(' '.repeat(sig.indent + 4) + 'pass');
            result.push('');
            return;
        }
        
        // 函数定义
        if (c.startsWith('def ') || c.startsWith('async def ')) {
            result.push(line);
            result.push(' '.repeat(sig.indent + 4) + 'pass');
            result.push('');
            return;
        }
    });
    
    return result.join('\n');
}