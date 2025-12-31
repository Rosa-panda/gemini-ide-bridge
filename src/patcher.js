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
