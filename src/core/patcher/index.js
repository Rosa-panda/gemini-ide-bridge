/**
 * 补丁模块 - 代码匹配和替换算法
 * 
 * 三大鲁棒性机制：
 * 1. 确定性唯一匹配 - 匹配数 > 1 时拒绝执行
 * 2. 语义掩码保护 - 多行字符串提取→对齐→还原
 * 3. 镜像风格回写 - 保持原文件换行符风格
 */

import { getLogicSignature, countMatches, isAlreadyApplied, findMatchPosition } from './matcher.js';
import { alignIndent } from './indent.js';
import { extractLiterals, restoreLiterals } from './literals.js';
import { detectLineEnding, normalizeLineEnding, restoreLineEnding } from './lineEnding.js';
export { checkJsSyntax } from './syntax.js';

// 重新导出供外部使用
export { detectLineEnding, restoreLineEnding };

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
    const alreadyApplied = isAlreadyApplied(normalizedContent, normalizedSearch, normalizedReplace);
    console.log('[Patcher] isAlreadyApplied:', alreadyApplied);
    if (alreadyApplied) {
        return {
            success: false,
            reason: '补丁已应用过，无需重复操作',
            alreadyApplied: true
        };
    }
    
    // 2. 唯一性检查
    const matchCount = countMatches(normalizedContent, normalizedSearch);
    console.log('[Patcher] matchCount:', matchCount);
    
    if (matchCount === 0) {
        return { success: false, reason: '未找到匹配' };
    }
    
    if (matchCount > 1) {
        console.log('[Patcher] 拦截：存在多处匹配');
        return { 
            success: false, 
            reason: `存在 ${matchCount} 处相同代码块，请提供更多上下文以确保唯一匹配`,
            matchCount 
        };
    }
    
    // 3. 语义掩码 - 保护 REPLACE 块中的多行字符串
    const { masked: maskedReplace, literals } = extractLiterals(normalizedReplace);
    
    // 4. 执行基于逻辑签名的物理定位
    const contentSigs = getLogicSignature(normalizedContent);
    const searchSigs = getLogicSignature(normalizedSearch);
    const lines = normalizedContent.split('\n');
    
    const matchPhysicalStart = findMatchPosition(contentSigs, searchSigs);

    if (matchPhysicalStart !== -1) {
        // 确定物理结束位置
        const startIdx = contentSigs.findIndex(s => s.originalIndex === matchPhysicalStart);
        const searchSigsInFile = contentSigs.slice(startIdx, startIdx + searchSigs.length);
        const matchPhysicalEnd = searchSigsInFile[searchSigsInFile.length - 1].originalIndex;
        const physicalLineCount = matchPhysicalEnd - matchPhysicalStart + 1;

        // 对掩码后的 REPLACE 块进行缩进对齐
        const alignedReplace = alignIndent(lines, matchPhysicalStart, normalizedSearch.split('\n'), maskedReplace);
        const restoredReplace = alignedReplace.map(line => restoreLiterals(line, literals));
        
        const before = lines.slice(0, matchPhysicalStart);
        const after = lines.slice(matchPhysicalEnd + 1);
        const result = [...before, ...restoredReplace, ...after].join('\n');
        
        return {
            success: true,
            content: restoreLineEnding(result, originalEnding),
            matchLine: matchPhysicalStart + 1,
            lineCount: physicalLineCount
        };
    }
    
    // 模糊匹配
    const fuzzyResult = fuzzyReplace(normalizedContent, normalizedSearch, maskedReplace, literals);
    if (fuzzyResult) {
        return {
            success: true,
            content: restoreLineEnding(fuzzyResult.content, originalEnding),
            matchLine: fuzzyResult.matchLine,
            lineCount: fuzzyResult.lineCount
        };
    }
    
    return { success: false, reason: '未找到匹配' };
}

/**
 * 模糊匹配替换 (处理空白差异 + 智能缩进对齐)
 */
function fuzzyReplace(content, search, maskedReplace, literals) {
    if (!search || !search.trim()) return null;

    const lines = content.split('\n');
    const searchLines = search.replace(/\r\n/g, '\n').split('\n');
    
    for (let i = 0; i <= lines.length - searchLines.length; i++) {
        let match = true;
        for (let j = 0; j < searchLines.length; j++) {
            if (searchLines[j].trim() === '') {
                if (lines[i + j].trim() !== '') {
                    match = false;
                    break;
                }
            } else if (lines[i + j].trim() !== searchLines[j].trim()) {
                match = false;
                break;
            }
        }
        
        if (match) {
            const before = lines.slice(0, i);
            const after = lines.slice(i + searchLines.length);
            const alignedReplace = alignIndent(lines, i, searchLines, maskedReplace);
            const restoredReplace = alignedReplace.map(line => restoreLiterals(line, literals));
            
            return {
                content: [...before, ...restoredReplace, ...after].join('\n'),
                matchLine: i + 1,
                lineCount: searchLines.length
            };
        }
    }
    return null;
}

/**
 * 为代码块添加行号预览（Git 风格）
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
