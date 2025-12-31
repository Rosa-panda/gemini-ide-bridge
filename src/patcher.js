/**
 * 补丁模块 - 代码匹配和替换算法
 */

/**
 * 尝试替换（返回结果对象）
 * 三层匹配：精确 → 模糊(空白) → 智能(相似度)
 */
export function tryReplace(content, search, replace) {
    // 1. 精确匹配
    if (content.includes(search)) {
        return {
            success: true,
            content: content.replace(search, replace)
        };
    }

    // 2. 模糊匹配（忽略空白）
    const fuzzyResult = fuzzyReplace(content, search, replace);
    if (fuzzyResult) {
        return {
            success: true,
            content: fuzzyResult
        };
    }

    // 3. 智能匹配（基于相似度）
    const smartResult = smartReplace(content, search, replace);
    if (smartResult) {
        return {
            success: true,
            content: smartResult
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
    const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
    
    const normalizedContent = normalize(content);
    const normalizedSearch = normalize(search);
    
    if (normalizedContent.includes(normalizedSearch)) {
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
 * 智能匹配（基于行相似度）
 */
export function smartReplace(content, search, replace) {
    const contentLines = content.split('\n');
    const searchLines = search.trim().split('\n');
    
    if (searchLines.length === 0) return null;

    let bestMatch = { score: 0, startLine: -1 };
    const threshold = 0.6;

    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
        let matchScore = 0;
        for (let j = 0; j < searchLines.length; j++) {
            const similarity = lineSimilarity(
                contentLines[i + j].trim(),
                searchLines[j].trim()
            );
            matchScore += similarity;
        }
        const avgScore = matchScore / searchLines.length;
        
        if (avgScore > bestMatch.score) {
            bestMatch = { score: avgScore, startLine: i };
        }
    }

    if (bestMatch.score >= threshold && bestMatch.startLine >= 0) {
        const before = contentLines.slice(0, bestMatch.startLine);
        const after = contentLines.slice(bestMatch.startLine + searchLines.length);
        const replaceLines = replace.split('\n');
        return [...before, ...replaceLines, ...after].join('\n');
    }

    return null;
}

/**
 * 计算两行的相似度 (0-1) - Dice 系数
 */
export function lineSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    
    const bigrams = (str) => {
        const result = new Set();
        for (let i = 0; i < str.length - 1; i++) {
            result.add(str.slice(i, i + 2));
        }
        return result;
    };
    
    const setA = bigrams(a.toLowerCase());
    const setB = bigrams(b.toLowerCase());
    
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;
    
    let intersection = 0;
    setA.forEach(bg => { if (setB.has(bg)) intersection++; });
    
    return (2 * intersection) / (setA.size + setB.size);
}

/**
 * 检查 JS/TS 代码语法是否有效（静态分析，不使用 eval/new Function）
 * 返回 { valid: boolean, error?: string }
 * 
 * 检查项：
 * 1. 括号匹配 {} [] ()
 * 2. 字符串/模板字符串闭合
 * 3. 常见语法垃圾（如多余的 return null; }）
 */
export function checkJsSyntax(code, filePath = '') {
    // 只检查 JS/TS 文件
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const jsExts = ['js', 'jsx', 'ts', 'tsx', 'mjs'];
    if (filePath && !jsExts.includes(ext)) {
        return { valid: true }; // 非 JS 文件跳过检查
    }
    
    // 移除注释和字符串，简化分析
    const stripped = stripCommentsAndStrings(code);
    
    // 1. 检查括号匹配
    const bracketResult = checkBrackets(stripped);
    if (!bracketResult.valid) {
        return bracketResult;
    }
    
    // 2. 检查常见的 Gemini 语法垃圾
    const garbagePatterns = [
        { pattern: /return\s+\w+;\s*\}\s*\}(?:\s*\})+\s*$/m, error: '多余的闭合括号 (可能是 return xxx; } } })' },
        { pattern: /\}\s*\}\s*return\s+null;\s*\}/m, error: '错位的 return null; }' },
    ];
    
    for (const { pattern, error } of garbagePatterns) {
        if (pattern.test(stripped)) {
            return { valid: false, error };
        }
    }
    
    return { valid: true };
}

/**
 * 移除代码中的注释、字符串和正则表达式（用于括号匹配分析）
 */
function stripCommentsAndStrings(code) {
    let result = '';
    let i = 0;
    
    // 判断当前位置的 / 是否可能是正则表达式开头
    const canBeRegex = () => {
        // 往前找最近的非空白字符
        let j = result.length - 1;
        while (j >= 0 && /\s/.test(result[j])) j--;
        if (j < 0) return true;
        const lastChar = result[j];
        // 这些字符后面的 / 通常是正则
        return /[=(:,;\[!&|?{}<>+\-*%^~]/.test(lastChar) || 
               result.slice(Math.max(0, j - 5), j + 1).match(/return|typeof|void|delete|throw|case|in$/);
    };
    
    while (i < code.length) {
        // 单行注释
        if (code[i] === '/' && code[i + 1] === '/') {
            while (i < code.length && code[i] !== '\n') i++;
            continue;
        }
        
        // 多行注释
        if (code[i] === '/' && code[i + 1] === '*') {
            i += 2;
            while (i < code.length - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        
        // 正则表达式字面量
        if (code[i] === '/' && code[i + 1] !== '/' && code[i + 1] !== '*' && canBeRegex()) {
            i++; // 跳过开头的 /
            while (i < code.length && code[i] !== '/') {
                if (code[i] === '\\') i++; // 跳过转义
                if (code[i] === '[') { // 字符类 [...]
                    i++;
                    while (i < code.length && code[i] !== ']') {
                        if (code[i] === '\\') i++;
                        i++;
                    }
                }
                i++;
            }
            i++; // 跳过结尾的 /
            // 跳过 flags (g, i, m, s, u, y)
            while (i < code.length && /[gimsuy]/.test(code[i])) i++;
            continue;
        }
        
        // 模板字符串
        if (code[i] === '`') {
            i++;
            while (i < code.length && code[i] !== '`') {
                if (code[i] === '\\') i++; // 跳过转义
                i++;
            }
            i++;
            continue;
        }
        
        // 普通字符串
        if (code[i] === '"' || code[i] === "'") {
            const quote = code[i];
            i++;
            while (i < code.length && code[i] !== quote) {
                if (code[i] === '\\') i++; // 跳过转义
                i++;
            }
            i++;
            continue;
        }
        
        result += code[i];
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
