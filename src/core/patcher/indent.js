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
        if (!line.trim()) return line;
        
        // 占位符行也需要正确缩进
        if (line.trim().match(/^__LITERAL_\d+__$/)) {
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

    return indents.map(indent => {
        if (indent < 0) return 0;
        const diff = indent - anchorIndent;
        if (diff <= 0) return 0;
        return Math.max(0, Math.round(diff / 3));
    });
}
