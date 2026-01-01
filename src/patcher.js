/**
 * 补丁模块 - 代码匹配和替换算法
 * 
 * 三大鲁棒性机制：
 * 1. 确定性唯一匹配 - 匹配数 > 1 时拒绝执行
 * 2. 语义掩码保护 - 多行字符串提取→对齐→还原
 * 3. 镜像风格回写 - 保持原文件换行符风格
 */

// ==================== 语义掩码保护 ====================

/**
 * 提取并保护多行字符串（语义掩码）
 * 返回 { masked: 处理后的代码, literals: 原始字符串映射 }
 */
function extractLiterals(code) {
    const literals = new Map();
    let counter = 0;
    let result = '';
    let i = 0;
    const len = code.length;
    
    while (i < len) {
        // Python 三引号字符串 """ 或 '''
        if ((code.slice(i, i + 3) === '"""' || code.slice(i, i + 3) === "'''")) {
            const quote = code.slice(i, i + 3);
            const start = i;
            i += 3;
            
            // 找到结束引号
            while (i < len - 2) {
                if (code.slice(i, i + 3) === quote) {
                    i += 3;
                    break;
                }
                if (code[i] === '\\') i++; // 跳过转义
                i++;
            }
            
            const literal = code.slice(start, i);
            const placeholder = `__LITERAL_${counter++}__`;
            literals.set(placeholder, literal);
            result += placeholder;
            continue;
        }
        
        // JS 模板字符串 ` （包含换行的才保护）
        if (code[i] === '`') {
            const start = i;
            i++;
            let hasNewline = false;
            let depth = 1; // 处理嵌套 ${}
            
            while (i < len && depth > 0) {
                if (code[i] === '\n') hasNewline = true;
                if (code[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (code[i] === '$' && code[i + 1] === '{') {
                    depth++;
                    i += 2;
                    continue;
                }
                if (code[i] === '}' && depth > 1) {
                    depth--;
                    i++;
                    continue;
                }
                if (code[i] === '`') {
                    depth--;
                    if (depth === 0) {
                        i++;
                        break;
                    }
                }
                i++;
            }
            
            const literal = code.slice(start, i);
            // 只保护包含换行的模板字符串
            if (hasNewline) {
                const placeholder = `__LITERAL_${counter++}__`;
                literals.set(placeholder, literal);
                result += placeholder;
            } else {
                result += literal;
            }
            continue;
        }
        
        result += code[i];
        i++;
    }
    
    return { masked: result, literals };
}

/**
 * 还原被保护的字符串
 */
function restoreLiterals(code, literals) {
    let result = code;
    for (const [placeholder, original] of literals) {
        result = result.replace(placeholder, original);
    }
    return result;
}

// ==================== 镜像风格回写 ====================

/**
 * 检测文件的换行符风格
 */
export function detectLineEnding(content) {
    if (content.includes('\r\n')) return '\r\n';
    return '\n';
}

/**
 * 统一换行符为 LF（内部处理用）
 */
function normalizeLineEnding(content) {
    return content.replace(/\r\n/g, '\n');
}

/**
 * 恢复原始换行符风格
 */
export function restoreLineEnding(content, originalEnding) {
    if (originalEnding === '\r\n') {
        return content.replace(/\n/g, '\r\n');
    }
    return content;
}


// ==================== 确定性唯一匹配 ====================

/**
* 计算 SEARCH 块在文件中的匹配次数
* 使用深度标准化进行匹配（忽略缩进差异）
* [DEBUG] 增加了控制台日志以便排查唯一性检测失效问题
*/
function countMatches(content, search) {
    // 增强的深度标准化：
    // 1. 统一换行符
    // 2. 移除每行开头和结尾的所有空白字符 (trim)
    // 3. 移除空行，避免空行干扰匹配逻辑
    const deepNormalize = (s) => {
            return s.replace(/\r\n/g, '\n')
                    .split('\n')
                    .map(line => line.trim())
                    .join('\n'); // 保持换行结构，但每行内容都已 Clean
    };
    
    const normalizedContent = deepNormalize(content);
    const normalizedSearch = deepNormalize(search);
    
    if (!normalizedSearch) return 0;
    
    // 按行匹配计数
    const contentLines = normalizedContent.split('\n');
    const searchLines = normalizedSearch.split('\n'); // Search 已经 trim 过了，不需要再次 trim
    
    // [DEBUG LOGS] - 请在控制台查看这些输出
    console.log('[Patcher Debug] Search Lines:', searchLines);
    // 截取 contentLines 前几行打印，避免刷屏
    // console.log('[Patcher Debug] Content Lines Preview:', contentLines.slice(0, 20));

    let count = 0;
    // 修正：确保 i 能遍历到最后一个可能的匹配位置
    for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
            let match = true;
            for (let j = 0; j < searchLines.length; j++) {
                // 因为 deepNormalize 已经 trim 过了，这里直接比较
                if (contentLines[i + j] !== searchLines[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                count++;
                console.log(`[Patcher Debug] Found match #${count} at line index ${i}`);
            }
    }
    
    console.log(`[Patcher Debug] Total matches found: ${count}`);
    return count;
}

// ==================== 核心替换逻辑 ====================

/**
 * 检测补丁是否已经应用过
 * 核心逻辑：如果 REPLACE 块的内容已经存在于文件中，说明已应用
 */
function isAlreadyApplied(content, search, replace) {
    const deepNormalize = (s) => {
        return s.replace(/\r\n/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line) // 移除空行
            .join('\n');
    };
    
    const normalizedContent = deepNormalize(content);
    const normalizedSearch = deepNormalize(search);
    const normalizedReplace = deepNormalize(replace);
    
    // 如果 SEARCH 和 REPLACE 相同，无法判断
    if (normalizedSearch === normalizedReplace) return false;
    
    // 如果 REPLACE 内容已存在，且 SEARCH 内容不存在（或 REPLACE 包含 SEARCH）
    const replaceExists = normalizedContent.includes(normalizedReplace);
    const searchExists = normalizedContent.includes(normalizedSearch);
    
    // 情况1：REPLACE 存在但 SEARCH 不存在 → 已应用
    if (replaceExists && !searchExists) return true;
    
    // 情况2：REPLACE 包含 SEARCH（嵌套情况），且 REPLACE 已存在 → 已应用
    if (replaceExists && normalizedReplace.includes(normalizedSearch)) {
        // 进一步检查：REPLACE 在文件中出现的次数
        // 如果 REPLACE 出现次数 >= SEARCH 出现次数，说明已应用
        const replaceCount = countOccurrences(normalizedContent, normalizedReplace);
        const searchCount = countOccurrences(normalizedContent, normalizedSearch);
        if (replaceCount >= searchCount) return true;
    }
    
    return false;
}

/**
 * 计算子串出现次数
 */
function countOccurrences(str, substr) {
    if (!substr) return 0;
    let count = 0;
    let pos = 0;
    while ((pos = str.indexOf(substr, pos)) !== -1) {
        count++;
        pos += substr.length;
    }
    return count;
}

/**
 * 尝试替换（返回结果对象）
 * 
 * 鲁棒性保障：
 * 1. 已应用检测 - 防止重复插入
 * 2. 唯一性检查 - 匹配数 > 1 时拒绝
 * 3. 语义掩码 - 保护多行字符串
 * 4. 换行符保持 - 记录并恢复原始风格
 */
export function tryReplace(content, search, replace) {
    // 0. 记录原始换行符风格
    const originalEnding = detectLineEnding(content);
    const normalizedContent = normalizeLineEnding(content);
    const normalizedSearch = normalizeLineEnding(search);
    const normalizedReplace = normalizeLineEnding(replace);
    
    // 1. 已应用检测 - 防止重复插入
    if (isAlreadyApplied(normalizedContent, normalizedSearch, normalizedReplace)) {
        return {
            success: false,
            reason: '补丁已应用过，无需重复操作',
            alreadyApplied: true
        };
    }
    
    // 2. 唯一性检查
    const matchCount = countMatches(normalizedContent, normalizedSearch);
    
    if (matchCount === 0) {
        return { success: false, reason: '未找到匹配' };
    }
    
    if (matchCount > 1) {
        return { 
            success: false, 
            reason: `存在 ${matchCount} 处相同代码块，请提供更多上下文以确保唯一匹配`,
            matchCount 
        };
    }
    
    // 3. 语义掩码 - 保护 REPLACE 块中的多行字符串
    const { masked: maskedReplace, literals } = extractLiterals(normalizedReplace);
    
    // 4. 执行匹配和替换
    const lines = normalizedContent.split('\n');
    const searchLines = normalizedSearch.split('\n');
    
    // 精确匹配
    if (normalizedContent.includes(normalizedSearch)) {
        const searchStart = normalizedContent.indexOf(normalizedSearch);
        const matchStart = normalizedContent.slice(0, searchStart).split('\n').length - 1;
        
        // 对掩码后的 REPLACE 块进行缩进对齐
        const alignedReplace = alignIndent(lines, matchStart, searchLines, maskedReplace);
        
        // 还原被保护的字符串
        const restoredReplace = alignedReplace.map(line => restoreLiterals(line, literals));
        
        const before = lines.slice(0, matchStart);
        const after = lines.slice(matchStart + searchLines.length);
        const result = [...before, ...restoredReplace, ...after].join('\n');
        
        // 恢复原始换行符风格，并返回具体的修改行号
        return {
            success: true,
            content: restoreLineEnding(result, originalEnding),
            matchLine: matchStart + 1, // 供 UI 显示起始行号
            lineCount: searchLines.length
        };
    }
    
    // 模糊匹配
    const fuzzyResult = fuzzyReplace(normalizedContent, normalizedSearch, maskedReplace, literals);
    if (fuzzyResult) {
        return {
            success: true,
            content: restoreLineEnding(fuzzyResult, originalEnding)
        };
    }
    
    return { success: false, reason: '未找到匹配' };
}

/**
 * 模糊匹配替换 (处理空白差异 + 智能缩进对齐)
 */
function fuzzyReplace(content, search, maskedReplace, literals) {
    if (!search || !search.trim()) return null;

    const normalize = (s) => s.replace(/[ \t]+$/gm, '');
    const deepNormalize = (s) => normalize(s).replace(/^[ \t]+/gm, '');
    
    const normalizedContent = normalize(content);
    const normalizedSearch = normalize(search);
    
    if (normalizedSearch && deepNormalize(normalizedContent).includes(deepNormalize(normalizedSearch))) {
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
                
                // 对掩码后的 REPLACE 块进行缩进对齐
                const alignedReplace = alignIndent(lines, i, searchLines, maskedReplace);
                
                // 还原被保护的字符串
                const restoredReplace = alignedReplace.map(line => restoreLiterals(line, literals));
                
                return [...before, ...restoredReplace, ...after].join('\n');
            }
        }
    }
    return null;
}


// ==================== 缩进对齐算法 ====================

/**
 * 智能缩进对齐（抽象深度映射）
 * 不看绝对空格数，只看逻辑层级，然后用目标文件的缩进单位重建
 */
function alignIndent(fileLines, matchStart, searchLines, replace) {
    // 1. 检测目标文件的缩进单位
    const targetUnit = detectIndentUnit(fileLines);
    
    // 2. 检测目标位置的基准缩进层级
    const baseLevel = detectBaseLevel(fileLines, matchStart, targetUnit);
    
    // 3. 规范化 REPLACE 块的缩进
    const replaceLines = replace.split('\n');
    const normalized = normalizeIndent(replaceLines, targetUnit, baseLevel);
    
    return normalized;
}

/**
 * 检测文件的缩进单位（4空格 / 2空格 / Tab）
 */
function detectIndentUnit(lines) {
    const indentCounts = { 2: 0, 4: 0, tab: 0 };
    
    for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^(\s+)/);
        if (!match) continue;
        
        const indent = match[1];
        if (indent.includes('\t')) {
            indentCounts.tab++;
        } else {
            const len = indent.length;
            if (len % 4 === 0) indentCounts[4]++;
            else if (len % 2 === 0) indentCounts[2]++;
        }
    }
    
    if (indentCounts.tab > indentCounts[4] && indentCounts.tab > indentCounts[2]) {
        return '\t';
    }
    return indentCounts[2] > indentCounts[4] ? '  ' : '    ';
}

/**
 * 检测匹配位置的基准缩进层级
 */
function detectBaseLevel(lines, matchStart, unit) {
    const line = lines[matchStart] || '';
    const match = line.match(/^(\s*)/);
    if (!match || !match[1]) return 0;
    
    const indent = match[1];
    if (unit === '\t') {
        return (indent.match(/\t/g) || []).length;
    }
    return Math.floor(indent.length / unit.length);
}

/**
 * 规范化缩进（抽象深度映射核心算法）
 * 将 AI 输出的混乱缩进转换为标准缩进
 */
function normalizeIndent(lines, targetUnit, baseLevel) {
    // 1. 分析每行的逻辑层级
    const levels = analyzeIndentLevels(lines);
    
    // 2. 用目标单位重建每行缩进
    return lines.map((line, i) => {
        if (!line.trim()) return line; // 保留空行
        
        // 检查是否是占位符行（被保护的多行字符串）
        if (line.trim().match(/^__LITERAL_\d+__$/)) {
            // 占位符行也需要正确缩进
            const level = levels[i];
            const totalLevel = baseLevel + level;
            return targetUnit.repeat(totalLevel) + line.trim();
        }
        
        const level = levels[i];
        const totalLevel = baseLevel + level;
        return targetUnit.repeat(totalLevel) + line.trimStart();
    });
}

/**
 * 分析每行的相对逻辑层级
 * 以第一行为锚点，根据相对偏移估算层级
 */
function analyzeIndentLevels(lines) {
    const indents = lines.map(line => {
        if (!line.trim()) return -1;
        const match = line.match(/^(\s*)/);
        return match ? match[1].replace(/\t/g, '    ').length : 0;
    });

    const firstValidIdx = indents.findIndex(n => n >= 0);
    if (firstValidIdx === -1) return lines.map(() => 0);

    const anchorIndent = indents[firstValidIdx];

    return indents.map(indent => {
        if (indent < 0) return 0;
        const diff = indent - anchorIndent;
        if (diff <= 0) return 0;
        // 以 2-4 空格为步长计算相对层级
        return Math.max(0, Math.round(diff / 3));
    });
}


// ==================== 语法检查 ====================

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

/**
 * 为代码块添加行号预览（Git 风格）
 * @param {string} code 
 * @param {number} startLine 起始行号
 */
export function generateNumberedLines(code, startLine = 1) {
    const lines = code.split('\n');
    return lines.map((line, index) => {
        const lineNum = startLine + index;
        return `<div class="diff-line">
            <span class="line-number">${lineNum}</span>
            <span class="line-content">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>
        </div>`;
    }).join('');
}

// 导出模糊匹配函数供外部使用
export { fuzzyReplace };
