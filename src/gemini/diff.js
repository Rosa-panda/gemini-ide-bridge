/**
 * 差异分析工具 - 相似度计算、匹配搜索、差异对比
 */

// ============ 相似度计算 ============

/**
 * 计算两个字符串的相似度（0-100）
 */
export function similarity(str1, str2) {
    if (str1 === str2) return 100;
    if (!str1 || !str2) return 0;
    
    const len1 = str1.length, len2 = str2.length;
    if (len1 === 0 || len2 === 0) return 0;
    
    let matches = 0;
    const shorter = len1 <= len2 ? str1 : str2;
    const longer = len1 > len2 ? str1 : str2;
    
    for (let i = 0; i < shorter.length; i++) {
        if (longer.includes(shorter[i])) matches++;
    }
    
    const lenPenalty = Math.abs(len1 - len2) / Math.max(len1, len2);
    const baseScore = (matches / shorter.length) * 100;
    return Math.round(baseScore * (1 - lenPenalty * 0.5));
}

/**
 * 计算两行的相似度（忽略前后空白）
 */
export function lineSimilarity(line1, line2) {
    return similarity(line1.trim(), line2.trim());
}

/**
 * 计算代码块的整体相似度
 */
export function blockSimilarity(searchLines, fileLines, startIndex) {
    if (startIndex < 0 || startIndex + searchLines.length > fileLines.length) {
        return 0;
    }
    
    let totalScore = 0;
    for (let i = 0; i < searchLines.length; i++) {
        totalScore += lineSimilarity(searchLines[i], fileLines[startIndex + i]);
    }
    return Math.round(totalScore / searchLines.length);
}

// ============ 可视化 ============

/**
 * 可视化特殊字符
 */
export function visualizeChar(ch) {
    if (ch === undefined) return '[缺失]';
    if (ch === ' ') return '[空格]';
    if (ch === '\t') return '[Tab]';
    if (ch === '\n') return '[换行]';
    if (ch === '\r') return '[回车]';
    return `'${ch}'`;
}

/**
 * 可视化整行的空白字符
 */
export function visualizeLine(line) {
    return line.replace(/\t/g, '→').replace(/ /g, '·');
}

// ============ 匹配搜索 ============

/**
 * 搜索所有可能的匹配位置
 */
export function findCandidates(searchBlock, fileContent, minSimilarity = 50) {
    const searchLines = searchBlock.split('\n');
    const fileLines = fileContent.split('\n');
    const candidates = [];
    
    for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
        const score = blockSimilarity(searchLines, fileLines, i);
        if (score >= minSimilarity) {
            candidates.push({
                startLine: i + 1,
                endLine: i + searchLines.length,
                score,
                lines: fileLines.slice(i, i + searchLines.length)
            });
        }
    }
    
    candidates.sort((a, b) => b.score - a.score);
    
    // 去重相邻位置
    const filtered = [];
    for (const c of candidates) {
        const tooClose = filtered.some(f => Math.abs(f.startLine - c.startLine) < 3);
        if (!tooClose) filtered.push(c);
    }
    
    return filtered.slice(0, 5);
}

// ============ 差异分析 ============

/**
 * 详细对比两个代码块
 */
export function detailedDiff(searchLines, fileLines) {
    const diffs = [];
    const maxLen = Math.max(searchLines.length, fileLines.length);
    
    for (let i = 0; i < maxLen; i++) {
        const searchLine = searchLines[i] ?? '';
        const fileLine = fileLines[i] ?? '';
        
        if (searchLine === fileLine) continue;
        
        const trimMatch = searchLine.trim() === fileLine.trim();
        const diff = {
            lineNum: i + 1,
            search: searchLine,
            file: fileLine,
            type: trimMatch ? 'whitespace' : 'content',
            similarity: lineSimilarity(searchLine, fileLine)
        };
        
        if (trimMatch) {
            for (let j = 0; j < Math.max(searchLine.length, fileLine.length); j++) {
                if (searchLine[j] !== fileLine[j]) {
                    diff.firstDiffPos = j;
                    diff.searchChar = visualizeChar(searchLine[j]);
                    diff.fileChar = visualizeChar(fileLine[j]);
                    break;
                }
            }
        }
        
        diffs.push(diff);
    }
    
    return diffs;
}
