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
 * 保留：导入、导出、类定义、函数签名、类型定义、重要注释
 */
function generateJsSkeleton(lines, sigs) {
    const result = [];
    let currentClass = null;
    let currentIndent = 0;
    
    sigs.forEach((sig, index) => {
        const c = sig.content.trim();
        const line = lines[sig.originalIndex];
        const prevLine = sig.originalIndex > 0 ? lines[sig.originalIndex - 1] : '';
        
        // 保留重要的文档注释（/** 或 ///)
        if (prevLine.trim().startsWith('/**') || prevLine.trim().startsWith('///')) {
            result.push(prevLine);
        }
        
        // 导入/导出语句
        if (c.startsWith('import ') || c.startsWith('export ')) {
            result.push(line);
            return;
        }
        
        // 类定义 (放宽匹配条件，支持 export default, abstract 等)
        if (c.includes('class ') && (c.includes('export ') || c.startsWith('class ') || c.startsWith('abstract '))) {
            if (currentClass) {
                // 关闭上一个类
                result.push(' '.repeat(currentIndent) + '}');
                result.push('');
            }
            currentClass = c.match(/class\s+(\w+)/)?.[1];
            currentIndent = sig.indent;
            result.push(line.split('{')[0] + '{');
            return;
        }
        
        // 函数定义（包括箭头函数）
        if (c.startsWith('function ') || c.startsWith('async function ') || 
            c.startsWith('export function ') || c.startsWith('export async function ') ||
            c.match(/^\w+\s*\([^)]*\)\s*{/) || // 方法
            c.match(/^\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/)) { // 箭头函数
            
            // 提取函数签名
            let signature = line.split('{')[0].split('=>')[0].trim();
            if (currentClass) {
                // 类方法，保持缩进
                result.push(' '.repeat(sig.indent) + signature + ' { /* ... */ }');
            } else {
                // 顶层函数
                result.push(signature + ' { /* ... */ }');
            }
            return;
        }
        
        // TypeScript 类型定义
        if (c.startsWith('interface ') || c.startsWith('type ') || 
            c.startsWith('export interface ') || c.startsWith('export type ')) {
            result.push(line);
            return;
        }
        
        // 常量/变量定义（只保留导出的）
        if (c.startsWith('export const ') || c.startsWith('export let ') || c.startsWith('export var ')) {
            result.push(line.split('=')[0] + '= ...;');
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
 * 保留：导入、类定义、函数签名、装饰器、文档字符串
 */
function generatePythonSkeleton(lines, sigs) {
    const result = [];
    let currentClass = null;
    let currentIndent = 0;
    
    sigs.forEach((sig, index) => {
        const c = sig.content.trim();
        const line = lines[sig.originalIndex];
        const nextLine = sig.originalIndex < lines.length - 1 ? lines[sig.originalIndex + 1] : '';
        
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
            currentClass = c.match(/class\s+(\w+)/)?.[1];
            currentIndent = sig.indent;
            result.push(line);
            // 保留文档字符串
            if (nextLine.trim().startsWith('"""') || nextLine.trim().startsWith("'''")) {
                result.push(nextLine);
                // 查找文档字符串结束
                for (let i = sig.originalIndex + 2; i < lines.length; i++) {
                    result.push(lines[i]);
                    if (lines[i].trim().endsWith('"""') || lines[i].trim().endsWith("'''")) {
                        break;
                    }
                }
            }
            result.push(' '.repeat(sig.indent + 4) + 'pass  # ...实现已省略...');
            result.push('');
            return;
        }
        
        // 函数定义
        if (c.startsWith('def ') || c.startsWith('async def ')) {
            result.push(line);
            // 保留文档字符串
            if (nextLine.trim().startsWith('"""') || nextLine.trim().startsWith("'''")) {
                result.push(nextLine);
                // 查找文档字符串结束
                for (let i = sig.originalIndex + 2; i < lines.length; i++) {
                    result.push(lines[i]);
                    if (lines[i].trim().endsWith('"""') || lines[i].trim().endsWith("'''")) {
                        break;
                    }
                }
            }
            result.push(' '.repeat(sig.indent + 4) + 'pass  # ...实现已省略...');
            result.push('');
            return;
        }
    });
    
    return result.join('\n');
}