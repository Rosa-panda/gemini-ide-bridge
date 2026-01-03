/**
 * 语法检查模块 - JS/TS 代码语法验证
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
    const { result, finalStack } = stripCommentsAndStrings(code);
    
    // 检查模板字符串或插值是否未闭合
    if (finalStack.length > 1) {
        const lastMode = finalStack[finalStack.length - 1];
        return { 
            valid: false, 
            error: lastMode === 'T' ? "未闭合的模板字符串" : "插值表达式 (${}) 未完成" 
        };
    }
    
    return checkBrackets(result);
}

/**
* 移除代码中的注释、字符串和正则表达式
* 支持嵌套模板字符串和插值表达式的正确解析
*/
function stripCommentsAndStrings(code) {
    let result = '';
    let i = 0;
    const len = code.length;
    
    // 状态栈：追踪模板模式 ('T' = 文本, 'I' = 代码模式)
    // 初始为 'I'，确保顶层代码和插值内部的逻辑一致
    const stack = ['I'];
    
    const DOLLAR = String.fromCharCode(36);
    
    const canBeRegex = () => {
        let j = result.length - 1;
        while (j >= 0 && /\s/.test(result[j])) j--;
        if (j < 0) return true;
        const lastChar = result[j];
        return /[=(:,;\[!&|?{}<>+\-*%^~()]/.test(lastChar) || 
            result.slice(Math.max(0, j - 6), j + 1).match(/(?:return|yield|await|typeof|void|delete|throw|case|in)$/);
    };
    
    while (i < len) {
        const char = code[i];
        const next = code[i + 1];
        const currentMode = stack[stack.length - 1]; // 'T' 或 'I'

        // 1. 处于模板字符串文本区域 ('T')
        if (currentMode === 'T') {
            if (char === '`') {
                stack.pop();
                i++;
            } else if (char === DOLLAR && next === '{') {
                stack.push('I');
                result += '{'; 
                i += 2;
            } else if (char === '\\') {
                // 即使在转义中也要注意换行同步
                if (next === '\n') result += '\n';
                i += 2;
            } else {
                if (char === '\n') result += '\n'; // 保持行号
                i++;
            }
            continue;
        }
        
        // 2. 处于代码区域（顶层或插值表达式内部 'I'）
        
        // 优先识别注释（防止注释内的 } 干扰栈）
        if (char === '/' && next === '/') {
            i += 2;
            while (i < len && code[i] !== '\n') i++;
            continue; // 保留下一个 iteration 处理 \n 以维持行号
        }
        if (char === '/' && next === '*') {
            i += 2;
            while (i < len - 1 && !(code[i] === '*' && code[i+1] === '/')) {
                if (code[i] === '\n') result += '\n'; // 关键：保留多行注释内的换行
                i++;
            }
            i += 2;
            continue;
        }

        // 识别字符串和正则（防止内部的 } 干扰栈）
        if (char === '"' || char === "'") {
            const quote = char;
            i++;
            while (i < len && code[i] !== quote) {
                if (code[i] === '\\') {
                    i++; // 跳过转义符本身
                    if (i < len && code[i] === '\n') result += '\n';
                } else if (code[i] === '\n') {
                    result += '\n';
                }
                i++;
            }
            i++;
            continue;
        }
        if (char === '/' && next !== '/' && next !== '*' && canBeRegex()) {
            i++;
            let inClass = false;
            while (i < len) {
                if (code[i] === '/' && !inClass) break;
                if (code[i] === '\\') {
                    i++;
                } else if (code[i] === '[') {
                    inClass = true;
                } else if (code[i] === ']') {
                    inClass = false;
                }
                i++;
            }
            i++;
            while (i < len && /[gimsuy]/.test(code[i])) i++;
            continue;
        }

        // 处理核心语法符号
        if (char === '{') {
            stack.push('I');
            result += '{';
            i++;
        } else if (char === '}') {
            // 保护根作用域：只有当栈中有超过 1 个元素且处于代码模式时才弹出
            if (stack.length > 1 && currentMode === 'I') {
                stack.pop();
            }
            result += '}';
            i++;
        } else if (char === '`') {
            stack.push('T');
            i++;
        } else {
            result += char;
            i++;
        }
    }
    
    return { result, finalStack: stack };
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
