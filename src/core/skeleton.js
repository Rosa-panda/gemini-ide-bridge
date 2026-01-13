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
 * 只保留 export 声明,不保留 import 和内部函数
 */
function generateJsSkeleton(lines) {
    const result = [];
    let inBlockComment = false;
    let braceDepth = 0;
    let inBody = false;
    
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
        
        // 如果在函数/类/对象体内,只追踪大括号
        if (inBody) {
            for (const char of line) {
                if (char === '{') braceDepth++;
                if (char === '}') braceDepth--;
            }
            if (braceDepth === 0) inBody = false;
            continue;
        }
        
        // 只处理 export 开头的语句
        if (!trimmed.startsWith('export ')) continue;
        
        // export function / export class
        if (trimmed.includes('function ') || trimmed.includes('class ')) {
            const lastBraceIdx = line.lastIndexOf('{');
            const signature = lastBraceIdx !== -1 ? line.substring(0, lastBraceIdx).trim() : line.trim();
            result.push(signature + ' { /* ... */ }');
            if (lastBraceIdx !== -1) {
                inBody = true;
                braceDepth = 1;
                const afterBrace = line.substring(lastBraceIdx + 1);
                for (const char of afterBrace) {
                    if (char === '{') braceDepth++;
                    if (char === '}') braceDepth--;
                }
                if (braceDepth === 0) inBody = false;
            }
            continue;
        }
        
        // export const xxx = { ... } 对象定义
        if (trimmed.includes('= {') || trimmed.includes('={')) {
            result.push(line.split('=')[0].trim() + ' = { /* ... */ }');
            if (line.includes('{')) {
                inBody = true;
                braceDepth = 1;
                const afterBrace = line.substring(line.indexOf('{') + 1);
                for (const char of afterBrace) {
                    if (char === '{') braceDepth++;
                    if (char === '}') braceDepth--;
                }
                if (braceDepth === 0) inBody = false;
            }
            continue;
        }
        
        // 其他 export (re-export, export const xxx = value 等)
        result.push(line);
    }
    
    return result.join('\n');
}

/**
 * 生成 Python 的结构化骨架
 * 只保留顶层的类和函数定义,不保留 import 和嵌套定义
 */
function generatePythonSkeleton(lines) {
    const result = [];
    let inBody = false;
    let bodyIndent = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // 计算缩进
        const indent = line.length - line.trimStart().length;
        
        // 如果在函数/类内部,跳过
        if (inBody) {
            if (indent <= bodyIndent && trimmed) {
                inBody = false;
            } else {
                continue;
            }
        }
        
        // 跳过 import
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
            continue;
        }
        
        // 只保留顶层(缩进为0)的类和函数
        if (indent === 0) {
            if (trimmed.startsWith('class ')) {
                result.push(line);
                result.push('    pass');
                result.push('');
                inBody = true;
                bodyIndent = 0;
                continue;
            }
            
            if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
                result.push(line);
                result.push('    pass');
                result.push('');
                inBody = true;
                bodyIndent = 0;
                continue;
            }
        }
    }
    
    return result.join('\n');
}