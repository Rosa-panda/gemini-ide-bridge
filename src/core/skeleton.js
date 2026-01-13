/**
 * 语义骨架模块 - 生成代码的精简结构图
 * 只保留顶层结构：导入、导出、函数签名、类定义
 */

export function generateSkeleton(code, filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const lines = code.split('\n');
    
    // 针对不同语言的提取逻辑
    let content = '';
    if (ext === 'py') {
        content = generatePythonSkeleton(lines);
    } else {
        content = generateJsSkeleton(lines);
    }
    
    // 如果没有提取到任何内容,返回空字符串
    if (!content.trim()) {
        return '';
    }
    
    return `// ========== FILE: ${filePath} ==========\n${content}`;
}

/**
 * 生成 JavaScript/TypeScript 的结构化骨架
 * 只保留顶层声明,不进入函数体
 */
function generateJsSkeleton(lines) {
    const result = [];
    let inBlockComment = false;
    let braceDepth = 0;  // 追踪大括号深度
    let inFunctionBody = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 跳过空行
        if (!trimmed) continue;
        
        // 处理块注释
        if (trimmed.startsWith('/*')) inBlockComment = true;
        if (inBlockComment) {
            if (trimmed.includes('*/')) inBlockComment = false;
            continue;
        }
        
        // 跳过单行注释
        if (trimmed.startsWith('//')) continue;
        
        // 如果在函数体内,只追踪大括号,不输出内容
        if (inFunctionBody) {
            // 统计这行的大括号
            for (const char of line) {
                if (char === '{') braceDepth++;
                if (char === '}') braceDepth--;
            }
            // 如果回到顶层,退出函数体
            if (braceDepth === 0) {
                inFunctionBody = false;
            }
            continue;
        }
        
        // 导入/导出语句
        if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
            // 如果是 export function/class,继续处理
            if (trimmed.includes('function ') || trimmed.includes('class ')) {
                // 找函数体的 { (最后一个)
                const lastBraceIdx = line.lastIndexOf('{');
                const signature = lastBraceIdx !== -1 ? line.substring(0, lastBraceIdx).trim() : line.trim();
                result.push(signature + ' { /* ... */ }');
                // 如果这行有 {,进入函数体模式
                if (lastBraceIdx !== -1) {
                    inFunctionBody = true;
                    braceDepth = 1;
                    // 统计这行剩余的大括号
                    const afterBrace = line.substring(lastBraceIdx + 1);
                    for (const char of afterBrace) {
                        if (char === '{') braceDepth++;
                        if (char === '}') braceDepth--;
                    }
                    if (braceDepth === 0) inFunctionBody = false;
                }
            } else if (trimmed.includes('= {') || trimmed.includes('={')) {
                // export const xxx = { ... } 这种对象定义
                result.push(line.split('=')[0].trim() + ' = { /* ... */ }');
                if (line.includes('{')) {
                    inFunctionBody = true;
                    braceDepth = 1;
                    const afterBrace = line.substring(line.indexOf('{') + 1);
                    for (const char of afterBrace) {
                        if (char === '{') braceDepth++;
                        if (char === '}') braceDepth--;
                    }
                    if (braceDepth === 0) inFunctionBody = false;
                }
            } else {
                // 普通的 import/export
                result.push(line);
            }
            continue;
        }
        
        // 顶层函数定义
        if (trimmed.startsWith('function ') || trimmed.startsWith('async function ')) {
            const lastBraceIdx = line.lastIndexOf('{');
            const signature = lastBraceIdx !== -1 ? line.substring(0, lastBraceIdx).trim() : line.trim();
            result.push(signature + ' { /* ... */ }');
            if (lastBraceIdx !== -1) {
                inFunctionBody = true;
                braceDepth = 1;
                const afterBrace = line.substring(lastBraceIdx + 1);
                for (const char of afterBrace) {
                    if (char === '{') braceDepth++;
                    if (char === '}') braceDepth--;
                }
                if (braceDepth === 0) inFunctionBody = false;
            }
            continue;
        }
        
        // 类定义
        if (trimmed.startsWith('class ')) {
            const signature = line.split('{')[0].trim();
            result.push(signature + ' { /* ... */ }');
            if (line.includes('{')) {
                inFunctionBody = true;
                braceDepth = 1;
                const afterBrace = line.substring(line.indexOf('{') + 1);
                for (const char of afterBrace) {
                    if (char === '{') braceDepth++;
                    if (char === '}') braceDepth--;
                }
                if (braceDepth === 0) inFunctionBody = false;
            }
            continue;
        }
        
        // 类型定义
        if (trimmed.startsWith('interface ') || trimmed.startsWith('type ')) {
            result.push(line);
            if (line.includes('{')) {
                inFunctionBody = true;
                braceDepth = 1;
                const afterBrace = line.substring(line.indexOf('{') + 1);
                for (const char of afterBrace) {
                    if (char === '{') braceDepth++;
                    if (char === '}') braceDepth--;
                }
                if (braceDepth === 0) inFunctionBody = false;
            }
            continue;
        }
    }
    
    return result.join('\n');
}

/**
 * 生成 Python 的结构化骨架
 * 只保留顶层声明
 */
function generatePythonSkeleton(lines) {
    const result = [];
    let inFunctionOrClass = false;
    let currentIndent = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // 计算缩进
        const indent = line.length - line.trimStart().length;
        
        // 如果在函数/类内部,且缩进更深,跳过
        if (inFunctionOrClass && indent > currentIndent) {
            continue;
        }
        
        // 回到顶层
        if (inFunctionOrClass && indent <= currentIndent) {
            inFunctionOrClass = false;
        }
        
        // 导入语句
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
            result.push(line);
            continue;
        }
        
        // 装饰器
        if (trimmed.startsWith('@')) {
            result.push(line);
            continue;
        }
        
        // 类定义
        if (trimmed.startsWith('class ')) {
            result.push(line);
            result.push(' '.repeat(indent + 4) + 'pass');
            result.push('');
            inFunctionOrClass = true;
            currentIndent = indent;
            continue;
        }
        
        // 函数定义
        if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
            result.push(line);
            result.push(' '.repeat(indent + 4) + 'pass');
            result.push('');
            inFunctionOrClass = true;
            currentIndent = indent;
            continue;
        }
    }
    
    return result.join('\n');
}