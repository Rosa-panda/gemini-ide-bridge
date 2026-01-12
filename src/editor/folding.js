/**
 * 代码折叠模块 - 重量级实现
 * 
 * 参考：
 * - VSCode Monaco Editor 的 foldingModel
 * - Python IDLE codecontext.py 的 BLOCKOPENERS
 * - Neovim semantic_tokens.lua 的 check_fold
 * 
 * 特性：
 * - 基于括号匹配的折叠检测（JS/CSS/JSON）
 * - 基于缩进的折叠检测（Python）
 * - 支持嵌套折叠
 * - 多行注释折叠
 * - 折叠区域缓存优化
 * - 折叠标记显示（...）
 */

// 块开始关键字（参考 Python IDLE BLOCKOPENERS）
const BLOCK_OPENERS = {
    javascript: ['function', 'class', 'if', 'else', 'for', 'while', 'switch', 'try', 'catch', 'finally', 'with', 'async', 'export', 'import'],
    python: ['class', 'def', 'if', 'elif', 'else', 'while', 'for', 'try', 'except', 'finally', 'with', 'async', 'match', 'case'],
    css: ['@media', '@keyframes', '@font-face', '@supports'],
    html: [],
    json: [],
};

// 折叠区域最小行数（小于此值不显示折叠图标）
const MIN_FOLD_LINES = 1;

// 折叠区域最大数量（性能保护）
const MAX_FOLD_REGIONS = 500;

/**
 * 获取行的缩进级别
 */
function getIndent(line) {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    // 将 tab 转换为 4 空格计算
    return match[1].replace(/\t/g, '    ').length;
}

/**
 * 检查位置是否在字符串中（简单检测）
 */
function isInString(line, col) {
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < col && i < line.length; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';
        
        if (!inString) {
            if (char === '"' || char === "'" || char === '`') {
                inString = true;
                stringChar = char;
            } else if (char === '/' && line[i + 1] === '/') {
                return true; // 行注释后的内容
            }
        } else {
            if (char === stringChar && prevChar !== '\\') {
                inString = false;
            }
        }
    }
    
    return inString;
}

/**
 * 分析代码，找出所有可折叠区域
 * @param {string} code - 源代码
 * @param {string} language - 语言类型
 * @returns {Array<{startLine: number, endLine: number, indent: number, type: string}>}
 */
export function analyzeFoldingRanges(code, language = 'javascript') {
    const lines = code.split('\n');
    const ranges = [];
    
    // 性能保护：超大文件跳过分析
    if (lines.length > 10000) {
        console.warn('[Folding] 文件过大，跳过折叠分析');
        return ranges;
    }
    
    // 基于缩进的折叠检测（Python）
    if (language === 'python') {
        analyzePythonFolding(lines, ranges);
    } else {
        // 基于括号匹配的折叠检测（JS/CSS/JSON 等）
        analyzeBracketFolding(lines, ranges, language);
    }
    
    // 检测多行注释折叠（通用，不区分语言）
    analyzeCommentFolding(lines, ranges);
    
    // 按起始行排序
    ranges.sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine);
    
    // 去除重复的折叠区域（同一起始行只保留最大的）
    const uniqueRanges = [];
    let lastStart = -1;
    for (const range of ranges) {
        if (range.startLine !== lastStart && range.endLine - range.startLine >= MIN_FOLD_LINES) {
            uniqueRanges.push(range);
            lastStart = range.startLine;
        }
    }
    
    // 限制最大数量
    return uniqueRanges.slice(0, MAX_FOLD_REGIONS);
}

/**
 * Python 缩进折叠分析
 */
function analyzePythonFolding(lines, ranges) {
    const openers = BLOCK_OPENERS.python;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        // 检查是否是块开始（以冒号结尾）
        if (!trimmed.endsWith(':')) continue;
        
        // 检查是否包含块关键字
        const hasOpener = openers.some(op => {
            const regex = new RegExp(`^${op}\\b`);
            return regex.test(trimmed);
        });
        
        if (!hasOpener) continue;
        
        const startIndent = getIndent(line);
        let endLine = i;
        
        // 找到块结束位置
        for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            const nextTrimmed = nextLine.trim();
            
            if (!nextTrimmed) continue; // 跳过空行
            
            const nextIndent = getIndent(nextLine);
            if (nextIndent <= startIndent) {
                break;
            }
            endLine = j;
        }
        
        if (endLine > i) {
            ranges.push({
                startLine: i,
                endLine,
                indent: startIndent,
                type: 'block',
            });
        }
    }
}

/**
 * 括号匹配折叠分析
 */
function analyzeBracketFolding(lines, ranges, language) {
    const bracketStack = [];
    const bracketPairs = { '{': '}', '[': ']' };
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            // 跳过字符串中的括号
            if (isInString(line, j)) continue;
            
            if (char === '{' || char === '[') {
                bracketStack.push({ char, line: i, col: j });
            } else if (char === '}' || char === ']') {
                if (bracketStack.length > 0) {
                    const open = bracketStack.pop();
                    const expectedClose = bracketPairs[open.char];
                    
                    if (char === expectedClose && i > open.line) {
                        ranges.push({
                            startLine: open.line,
                            endLine: i,
                            indent: getIndent(lines[open.line]),
                            type: 'bracket',
                        });
                    }
                }
            }
        }
    }
}

/**
 * 多行注释折叠分析
 * 支持 JS 风格 (块注释) 和 Python 风格 (三引号)
 */
function analyzeCommentFolding(lines, ranges) {
    let inComment = false;
    let commentStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (!inComment) {
            // 检测多行注释开始
            if (trimmed.startsWith('/*')) {
                inComment = true;
                commentStart = i;
                // 检查是否在同一行结束
                if (trimmed.endsWith('*/') && trimmed.length > 4) {
                    inComment = false;
                    commentStart = -1;
                }
            } else if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
                const quote = trimmed.slice(0, 3);
                inComment = true;
                commentStart = i;
                // 检查是否在同一行结束
                if (trimmed.length > 6 && trimmed.endsWith(quote)) {
                    inComment = false;
                    commentStart = -1;
                }
            }
        } else {
            // 检测多行注释结束
            if (trimmed.endsWith('*/') || trimmed.endsWith('"""') || trimmed.endsWith("'''")) {
                if (i > commentStart) {
                    ranges.push({
                        startLine: commentStart,
                        endLine: i,
                        indent: getIndent(lines[commentStart]),
                        type: 'comment',
                    });
                }
                inComment = false;
                commentStart = -1;
            }
        }
    }
}

/**
 * 创建折叠状态管理器
 */
export function createFoldingManager() {
    let foldingRanges = [];
    let collapsedRanges = new Set(); // 存储已折叠的起始行号
    let cachedCode = '';
    let cachedLanguage = '';
    
    return {
        /**
         * 更新折叠区域（带缓存）
         */
        update(code, language) {
            // 缓存检查：代码未变化时跳过重新分析
            if (code === cachedCode && language === cachedLanguage) {
                return;
            }
            
            cachedCode = code;
            cachedLanguage = language;
            foldingRanges = analyzeFoldingRanges(code, language);
            
            // 清理无效的折叠状态
            const validStarts = new Set(foldingRanges.map(r => r.startLine));
            for (const line of collapsedRanges) {
                if (!validStarts.has(line)) {
                    collapsedRanges.delete(line);
                }
            }
        },
        
        /**
         * 获取所有折叠区域
         */
        getRanges() {
            return foldingRanges.map(r => ({
                ...r,
                collapsed: collapsedRanges.has(r.startLine),
            }));
        },
        
        /**
         * 获取指定行的折叠区域
         */
        getRangeAtLine(lineNum) {
            return foldingRanges.find(r => r.startLine === lineNum);
        },
        
        /**
         * 切换折叠状态
         */
        toggle(lineNum) {
            const range = this.getRangeAtLine(lineNum);
            if (!range) return false;
            
            if (collapsedRanges.has(lineNum)) {
                collapsedRanges.delete(lineNum);
            } else {
                collapsedRanges.add(lineNum);
            }
            return true;
        },
        
        /**
         * 检查行是否被折叠隐藏
         */
        isLineHidden(lineNum) {
            for (const startLine of collapsedRanges) {
                const range = foldingRanges.find(r => r.startLine === startLine);
                if (range && lineNum > range.startLine && lineNum <= range.endLine) {
                    return true;
                }
            }
            return false;
        },
        
        /**
         * 检查行是否是折叠区域的起始行
         */
        isFoldStart(lineNum) {
            return foldingRanges.some(r => r.startLine === lineNum);
        },
        
        /**
         * 检查行是否已折叠
         */
        isCollapsed(lineNum) {
            return collapsedRanges.has(lineNum);
        },
        
        /**
         * 获取折叠区域的隐藏行数
         */
        getHiddenLineCount(lineNum) {
            const range = this.getRangeAtLine(lineNum);
            if (!range || !collapsedRanges.has(lineNum)) return 0;
            return range.endLine - range.startLine;
        },
        
        /**
         * 折叠所有
         */
        foldAll() {
            foldingRanges.forEach(r => collapsedRanges.add(r.startLine));
        },
        
        /**
         * 展开所有
         */
        unfoldAll() {
            collapsedRanges.clear();
        },
        
        /**
         * 按级别折叠（1 = 顶级，2 = 第二级...）
         */
        foldAtLevel(level) {
            const indentUnit = 4; // 假设 4 空格为一级
            foldingRanges.forEach(r => {
                const rangeLevel = Math.floor(r.indent / indentUnit) + 1;
                if (rangeLevel >= level) {
                    collapsedRanges.add(r.startLine);
                }
            });
        },
        
        /**
         * 获取统计信息
         */
        getStats() {
            return {
                totalRanges: foldingRanges.length,
                collapsedCount: collapsedRanges.size,
                hiddenLines: Array.from(collapsedRanges).reduce((sum, startLine) => {
                    const range = foldingRanges.find(r => r.startLine === startLine);
                    return sum + (range ? range.endLine - range.startLine : 0);
                }, 0),
            };
        },
        
        /**
         * 清除缓存（强制下次重新分析）
         */
        clearCache() {
            cachedCode = '';
            cachedLanguage = '';
        },
    };
}

/**
 * 获取折叠相关的 CSS 样式
 */
export function getFoldingStyles() {
    return `
        .ide-fold-icon {
            position: absolute;
            left: 2px;
            top: 50%;
            transform: translateY(-50%);
            width: 14px;
            height: 14px;
            font-size: 10px;
            line-height: 14px;
            text-align: center;
            cursor: pointer;
            color: rgba(255,255,255,0.4);
            border-radius: 2px;
            user-select: none;
            transition: all 0.15s ease;
        }
        .ide-fold-icon:hover {
            background: rgba(255,255,255,0.15);
            color: rgba(255,255,255,0.9);
        }
        .ide-fold-icon.collapsed {
            color: #569cd6;
        }
        .ide-fold-marker {
            display: inline-block;
            background: rgba(86, 156, 214, 0.2);
            color: #569cd6;
            padding: 0 4px;
            margin-left: 4px;
            border-radius: 2px;
            font-size: 10px;
            cursor: pointer;
            user-select: none;
        }
        .ide-fold-marker:hover {
            background: rgba(86, 156, 214, 0.4);
        }
        .ide-editor-gutter div.hidden {
            display: none;
        }
        .ide-highlight-line.hidden {
            display: none;
        }
    `;
}
