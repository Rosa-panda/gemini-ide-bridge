/**
 * 语法检查模块 - JS/TS 代码语法验证
 * 
 * 参考：
 * - Wren 语言的模板字符串实现 (munificent/wren)
 * - VSCode 的 jsonc.ts 注释剥离
 */

/**
 * 检查 JS/TS 代码语法是否有效
 */
export function checkJsSyntax(code, filePath = '') {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const jsExts = ['js', 'jsx', 'ts', 'tsx', 'mjs'];
    if (filePath && !jsExts.includes(ext)) {
        return { valid: true };
    }
    const { result, valid, error } = stripCommentsAndStrings(code);
    
    if (!valid) {
        return { valid: false, error };
    }
    
    return checkBrackets(result);
}

/**
 * 移除代码中的注释、字符串和正则表达式
 * 支持嵌套模板字符串的正确解析
 * 
 * 状态机设计（参考 Wren）：
 * - 使用栈追踪模板字符串嵌套
 * - 每个栈元素记录：类型('T'=模板文本, 'I'=插值) + 花括号深度
 * - 栈为空时处于普通代码区域
 */
function stripCommentsAndStrings(code) {
    let result = '';
    let i = 0;
    const len = code.length;
    
    // 状态栈：每个元素是 { type: 'T'|'I', braceDepth: number }
    // 'T' = 在模板字符串文本区域
    // 'I' = 在模板字符串的 ${} 插值表达式内
    const stack = [];
    
    const DOLLAR = String.fromCharCode(36); // '$'
    
    const inTemplate = () => stack.length > 0 && stack[stack.length - 1].type === 'T';
    const inInterpolation = () => stack.length > 0 && stack[stack.length - 1].type === 'I';
    
    const canBeRegex = () => {
        let j = result.length - 1;
        while (j >= 0 && /\s/.test(result[j])) j--;
        if (j < 0) return true;
        const lastChar = result[j];
        return /[=(:,;\[!&|?{}<>+\-*%^~]/.test(lastChar) ||
               result.slice(Math.max(0, j - 6), j + 1).match(/(?:return|yield|await|typeof|void|delete|throw|case|in)$/);
    };

    while (i < len) {
        const char = code[i];
        const next = code[i + 1];

        // 1. 在模板字符串文本区域 ('T')
        if (inTemplate()) {
            if (char === '`') {
                // 模板字符串结束
                stack.pop();
                i++;
            } else if (char === DOLLAR && next === '{') {
                // 进入插值表达式，初始花括号深度为 1
                stack.push({ type: 'I', braceDepth: 1 });
                result += '{';  // 保留 { 给括号检查
                i += 2;
            } else if (char === '\\') {
                // 转义字符
                if (next === '\n') result += '\n';
                i += 2;
            } else {
                // 普通模板文本，忽略（但保留换行）
                if (char === '\n') result += '\n';
                i++;
            }
            continue;
        }
        
        // 2. 在插值表达式内 ('I')
        if (inInterpolation()) {
            const state = stack[stack.length - 1];
            
            // 处理插值内的花括号嵌套
            if (char === '{') {
                state.braceDepth++;
                result += '{';
                i++;
                continue;
            }
            if (char === '}') {
                state.braceDepth--;
                if (state.braceDepth === 0) {
                    // 插值结束，回到上一层（应该是模板文本 'T'）
                    stack.pop();
                }
                result += '}';
                i++;
                continue;
            }
            
            // 插值内的模板字符串（嵌套）
            if (char === '`') {
                stack.push({ type: 'T', braceDepth: 0 });
                i++;
                continue;
            }
            
            // 插值内的普通字符串
            if (char === '"' || char === "'") {
                const quote = char;
                i++;
                while (i < len && code[i] !== quote) {
                    if (code[i] === '\\') i++;
                    if (i < len && code[i] === '\n') result += '\n';
                    i++;
                }
                i++;
                continue;
            }
            
            // 插值内的注释
            if (char === '/' && next === '/') {
                i += 2;
                while (i < len && code[i] !== '\n') i++;
                if (i < len) result += '\n';
                continue;
            }
            if (char === '/' && next === '*') {
                i += 2;
                while (i < len - 1 && !(code[i] === '*' && code[i+1] === '/')) {
                    if (code[i] === '\n') result += '\n';
                    i++;
                }
                i += 2;
                continue;
            }
            
            // 其他字符
            result += char;
            i++;
            continue;
        }

        // 3. 普通代码区域（栈为空）
        
        // 单行注释
        if (char === '/' && next === '/') {
            i += 2;
            while (i < len && code[i] !== '\n') i++;
            if (i < len) {
                result += '\n';
                i++;
            }
            continue;
        }

        // 多行注释
        if (char === '/' && next === '*') {
            i += 2;
            while (i < len - 1 && !(code[i] === '*' && code[i+1] === '/')) {
                if (code[i] === '\n') result += '\n';
                i++;
            }
            i += 2;
            continue;
        }

        // 正则表达式
        if (char === '/' && next !== '/' && next !== '*' && canBeRegex()) {
            i++;
            let inClass = false;
            while (i < len) {
                const c = code[i];
                if (c === '/' && !inClass) break;
                if (c === '\\') i++;
                else if (c === '[') inClass = true;
                else if (c === ']') inClass = false;
                i++;
            }
            i++;
            while (i < len && /[gimsuy]/.test(code[i])) i++;
            continue;
        }

        // 普通字符串
        if (char === '"' || char === "'") {
            const quote = char;
            i++;
            while (i < len && code[i] !== quote) {
                if (code[i] === '\\') i++;
                if (i < len && code[i] === '\n') result += '\n';
                i++;
            }
            i++;
            continue;
        }

        // 模板字符串开始
        if (char === '`') {
            stack.push({ type: 'T', braceDepth: 0 });
            i++;
            continue;
        }

        result += char;
        i++;
    }
    
    // 检查是否有未闭合的模板字符串
    if (stack.length > 0) {
        const lastState = stack[stack.length - 1];
        return { 
            result, 
            valid: false, 
            error: lastState.type === 'T' ? "未闭合的模板字符串" : "插值表达式 (${}) 未完成" 
        };
    }

    return { result, valid: true };
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
