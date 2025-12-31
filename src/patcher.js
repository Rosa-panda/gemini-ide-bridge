/**
 * 补丁模块 - 代码匹配和替换算法
 */

/**
 * 尝试替换（返回结果对象）
 * 两层匹配：精确 → 模糊(空白)
 * 注：已移除智能匹配，宁可不匹配也不要匹配错位置
 */
export function tryReplace(content, search, replace) {
    // 1. 精确匹配
    if (content.includes(search)) {
        return {
            success: true,
            content: content.replace(search, replace)
        };
    }

    // 2. 模糊匹配（忽略空白差异）
    const fuzzyResult = fuzzyReplace(content, search, replace);
    if (fuzzyResult) {
        return {
            success: true,
            content: fuzzyResult
        };
    }

    return {
        success: false,
        reason: '未找到匹配'
    };
}

/**
 * 模糊匹配替换 (处理空白差异)
 */
export function fuzzyReplace(content, search, replace) {
    // 基础防御：Search 必须包含有效内容
    if (!search || !search.trim()) return null;

    const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
    
    const normalizedContent = normalize(content);
    const normalizedSearch = normalize(search);
    
    // 只有在 normalizedSearch 不为空时才进行包含检查
    if (normalizedSearch && normalizedContent.includes(normalizedSearch)) {
        const lines = content.split('\n');
        const searchLines = search.trim().split('\n');
        
        for (let i = 0; i <= lines.length - searchLines.length; i++) {
            let match = true;
            for (let j = 0; j < searchLines.length; j++) {
                if (lines[i + j].trim() !== searchLines[j].trim()) {
                    match = false;
                    break;
                }
            }
            if (match) {
                const before = lines.slice(0, i);
                const after = lines.slice(i + searchLines.length);
                const replaceLines = replace.split('\n');
                return [...before, ...replaceLines, ...after].join('\n');
            }
        }
    }
    return null;
}

/**
 * 检查 JS/TS 代码语法是否有效（静态分析，不使用 eval/new Function）
 * 返回 { valid: boolean, error?: string }
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
 * 移除代码中的注释、字符串和正则表达式（增强版状态机）
 */
function stripCommentsAndStrings(code) {
    let result = '';
    let i = 0;
    const len = code.length;
    
    // 判断是否可能为正则开头
    const canBeRegex = () => {
        let j = result.length - 1;
        while (j >= 0 && /\s/.test(result[j])) j--;
        if (j < 0) return true;
        const lastChar = result[j];
        // 扩展了关键字列表，包括 yield 和 await
        return /[=(:,;\[!&|?{}<>+\-*%^~]/.test(lastChar) || 
               result.slice(Math.max(0, j - 6), j + 1).match(/(?:return|yield|await|typeof|void|delete|throw|case|in)$/);
    };
    
    while (i < len) {
        const char = code[i];
        const next = code[i + 1];

        // 1. 单行注释 //...
        if (char === '/' && next === '/') {
            i += 2;
            while (i < len && code[i] !== '\n') i++;
            continue;
        }
        
        // 2. 多行注释 /*...*/
        if (char === '/' && next === '*') {
            i += 2;
            while (i < len - 1 && !(code[i] === '*' && code[i+1] === '/')) i++;
            i += 2;
            continue;
        }
        
        // 3. 正则表达式 /.../
        if (char === '/' && next !== '/' && next !== '*' && canBeRegex()) {
            i++; // 跳过开头 /
            let inClass = false; // 是否在 [] 内
            while (i < len) {
                const c = code[i];
                if (c === '/') {
                    if (!inClass) break; // 正则结束
                } else if (c === '\\') {
                    i++; // 跳过转义字符
                } else if (c === '[') {
                    inClass = true;
                } else if (c === ']') {
                    inClass = false;
                }
                i++;
            }
            i++; // 跳过结尾 /
            // 跳过 flags
            while (i < len && /[gimsuy]/.test(code[i])) i++;
            continue;
        }
        
        // 4. 字符串 '...' "..." `...`
        if (char === '"' || char === "'" || char === '`') {
            const quote = char;
            i++;
            while (i < len && code[i] !== quote) {
                if (code[i] === '\\') i++; // 跳过转义
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
