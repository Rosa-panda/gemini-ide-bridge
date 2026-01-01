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
    const stripped = stripCommentsAndStrings(code);
    return checkBrackets(stripped);
}

/**
 * 移除代码中的注释、字符串和正则表达式
 */
function stripCommentsAndStrings(code) {
    let result = '';
    let i = 0;
    const len = code.length;
    
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

        // 单行注释
        if (char === '/' && next === '/') {
            i += 2;
            while (i < len && code[i] !== '\n') i++;
            continue;
        }
        
        // 多行注释
        if (char === '/' && next === '*') {
            i += 2;
            while (i < len - 1 && !(code[i] === '*' && code[i+1] === '/')) i++;
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
        
        // 字符串
        if (char === '"' || char === "'" || char === '`') {
            const quote = char;
            i++;
            while (i < len && code[i] !== quote) {
                if (code[i] === '\\') i++;
                i++;
            }
            i++;
            continue;
        }
        
        result += char;
        i++;
    }
    
    return result;
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
