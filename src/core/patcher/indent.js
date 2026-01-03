/**
 * 缩进对齐模块 - 智能缩进对齐算法
 */

/**
 * 智能缩进对齐（抽象深度映射）
 */
export function alignIndent(fileLines, matchStart, searchLines, replace) {
    const targetUnit = detectIndentUnit(fileLines);
    const baseLevel = detectBaseLevel(fileLines, matchStart, targetUnit);
    const replaceLines = replace.split('\n');
    return normalizeIndent(replaceLines, targetUnit, baseLevel);
}

/**
 * 检测文件的缩进单位（4空格 / 2空格 / Tab）
 */
export function detectIndentUnit(lines) {
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
export function detectBaseLevel(lines, matchStart, unit) {
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
 */
export function normalizeIndent(lines, targetUnit, baseLevel) {
    const levels = analyzeIndentLevels(lines);
    
    return lines.map((line, i) => {
        // 关键：清洗 AI 可能输出的不可见干扰字符（如 \u200B）
        const cleanLine = line.replace(/[\u200B-\u200D\uFEFF]/g, '');
        if (!cleanLine.trim()) return cleanLine;
        
        // 占位符行保护
        if (cleanLine.trim().match(/^__LITERAL_\d+__$/)) {
            const level = levels[i];
            const totalLevel = baseLevel + level;
            return targetUnit.repeat(totalLevel) + cleanLine.trim();
        }
        
        const level = levels[i];
        // 核心防护：确保最终计算的缩进层级永远不小于 0，防止 repeat() 抛出 RangeError
        const totalLevel = Math.max(0, baseLevel + level);
        const trimmed = cleanLine.trimStart();
        
        // 保护 JSDoc 格式：增强启发式判断
        // 仅当 trimmed 以 * 开头，且原文件该位置的上下文暗示这是 JSDoc 时才补空格
        // 这里的简单方案是：如果 baseLevel 大于 0 且 trimmed 是 *，通常就是 JSDoc
        if (/^\*(\s|\/|$)/.test(trimmed) && totalLevel > 0) {
            // 进一步防止误伤：如果这一行看起来像数学乘法（例如后面紧跟变量名而非 @tags）
            // 我们检查它是否以 * [a-zA-Z] 开头且没有明显的 JSDoc 标志
            const isLikelyMath = /^\*\s+[a-zA-Z_]/.test(trimmed) && !trimmed.includes('@');
            if (!isLikelyMath) {
                return targetUnit.repeat(totalLevel) + ' ' + trimmed;
            }
        }
        
        return targetUnit.repeat(totalLevel) + trimmed;
    });
}

/**
 * 分析每行的相对逻辑层级
 */
export function analyzeIndentLevels(lines) {
    const indents = lines.map(line => {
        if (!line.trim()) return -1;
        const match = line.match(/^(\s*)/);
        return match ? match[1].replace(/\t/g, '    ').length : 0;
    });

    const firstValidIdx = indents.findIndex(n => n >= 0);
    if (firstValidIdx === -1) return lines.map(() => 0);

    const anchorIndent = indents[firstValidIdx];
    
    // 改进：增加最小阈值并过滤掉单空格干扰（常见于 JSDoc ' * '）
    const steps = [];
    for (let i = 0; i < indents.length - 1; i++) {
        if (indents[i] >= 0 && indents[i + 1] >= 0) {
            const diff = Math.abs(indents[i + 1] - indents[i]);
            // 关键：现代 JS/Python 几乎没有 1 空格缩进，diff=1 通常是注释干扰，应忽略
            if (diff >= 2) steps.push(diff);
        }
    }

    let sourceUnit = 4;
    if (steps.length > 0) {
        const counts = {};
        steps.forEach(s => counts[s] = (counts[s] || 0) + 1);
        const mostFrequent = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
        sourceUnit = Math.max(2, parseInt(mostFrequent)); 
    } else {
        const diffs = indents.filter(n => n > anchorIndent).map(n => n - anchorIndent);
        // 关键：在 fallback 逻辑中也要强制最小步长为 2，防止 JSDoc 干扰导致的 sourceUnit=1
        if (diffs.length > 0) {
            const minDiff = Math.min(...diffs);
            sourceUnit = Math.max(2, minDiff);
        }
    }

    return indents.map(indent => {
        if (indent < 0) return 0;
        const diff = indent - anchorIndent;
        // 改进的安全检查：计算相对层级，由 normalizeIndent 确保最终 totalLevel 不为负
        return Math.round(diff / sourceUnit);
    });
}
