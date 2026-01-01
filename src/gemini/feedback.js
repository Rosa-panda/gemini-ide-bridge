/**
 * 错误回传模块 - 向 AI 发送精确的错误上下文
 * 目标：让 Gemini 无言以对，只能乖乖改正
 */

import { getLanguage } from '../shared/utils.js';
import { lineSimilarity, findCandidates, detailedDiff, visualizeLine } from './diff.js';

// ============ 检测函数 ============

/**
 * 检测输出是否被截断
 */
function detectTruncation(text) {
    const patterns = [
        { pattern: /<\/content>/i, name: '</content> 标签' },
        { pattern: /<\/file>/i, name: '</file> 标签' },
        { pattern: /\x00/, name: '空字符' },
        { pattern: /[\uFFFD]/, name: '替换字符' },
    ];
    
    for (const { pattern, name } of patterns) {
        if (pattern.test(text)) return { truncated: true, reason: name };
    }
    return { truncated: false };
}

/**
 * 检测常见错误模式
 */
function detectIssues(searchBlock, fileContent) {
    const issues = [];
    const fixes = [];
    const searchLines = searchBlock.split('\n');
    const fileLines = fileContent.split('\n');
    
    // Tab vs 空格
    const searchHasTabs = /\t/.test(searchBlock);
    const searchHasSpaces = /^[ ]{2,}/m.test(searchBlock);
    const fileHasTabs = /\t/.test(fileContent);
    const fileHasSpaces = /^[ ]{2,}/m.test(fileContent);
    
    if (searchHasTabs && !fileHasTabs && fileHasSpaces) {
        issues.push('❌ SEARCH 块使用 Tab 缩进，但文件使用空格缩进');
        fixes.push('将所有 Tab 替换为空格');
    }
    if (searchHasSpaces && !fileHasSpaces && fileHasTabs) {
        issues.push('❌ SEARCH 块使用空格缩进，但文件使用 Tab 缩进');
        fixes.push('将缩进空格替换为 Tab');
    }
    
    // 行尾空格
    const trailingLines = searchLines
        .map((l, i) => ({ line: i + 1, has: /[ \t]+$/.test(l) }))
        .filter(x => x.has);
    if (trailingLines.length > 0) {
        issues.push(`❌ SEARCH 块第 ${trailingLines.map(x => x.line).join(', ')} 行有行尾空格`);
        fixes.push('删除所有行尾空格');
    }
    
    // 首行检测
    const firstLine = searchLines[0]?.trim();
    if (firstLine) {
        const exactMatch = fileLines.some(l => l.trim() === firstLine);
        if (!exactMatch) {
            let bestMatch = { line: -1, score: 0, content: '' };
            fileLines.forEach((l, i) => {
                const score = lineSimilarity(firstLine, l);
                if (score > bestMatch.score) {
                    bestMatch = { line: i + 1, score, content: l.trim() };
                }
            });
            
            if (bestMatch.score >= 60) {
                issues.push(`❌ 首行不存在，但第 ${bestMatch.line} 行有 ${bestMatch.score}% 相似`);
                fixes.push(`首行应该是: "${bestMatch.content.slice(0, 60)}"`);
            } else {
                issues.push(`❌ 首行 "${firstLine.slice(0, 40)}..." 在文件中不存在`);
            }
        }
    }
    
    return { issues, fixes };
}

// ============ 反馈生成 ============

function generateDiffReport(diffs) {
    if (diffs.length === 0) return '';
    
    const lines = diffs.slice(0, 8).map(d => {
        if (d.type === 'whitespace') {
            return `  第 ${d.lineNum} 行: 空白差异 - 位置 ${d.firstDiffPos}: ${d.searchChar} → ${d.fileChar}
    你写的: \`${visualizeLine(d.search)}\`
    实际是: \`${visualizeLine(d.file)}\``;
        } else {
            return `  第 ${d.lineNum} 行: 内容不同 (${d.similarity}% 相似)
    你写的: \`${d.search.slice(0, 70)}${d.search.length > 70 ? '...' : ''}\`
    实际是: \`${d.file.slice(0, 70)}${d.file.length > 70 ? '...' : ''}\``;
        }
    });
    
    let report = `**逐行差异分析：**\n${lines.join('\n\n')}`;
    if (diffs.length > 8) report += `\n\n  ... 还有 ${diffs.length - 8} 处差异`;
    return report;
}

/**
 * 匹配失败反馈
 */
export function buildMismatchContext(filePath, fileContent, searchBlock) {
    const lang = getLanguage(filePath);
    const searchLines = searchBlock.split('\n');
    
    // 检测截断
    const truncation = detectTruncation(searchBlock);
    if (truncation.truncated) {
        return `❌ **输出被截断** - \`${filePath}\`

检测到 ${truncation.reason}，代码传输被损坏。

**解决方案：** 避免直接写 \`$\` 符号，用 \`String.fromCharCode(36)\` 代替，或拆分成小补丁。`;
    }
    
    const { issues, fixes } = detectIssues(searchBlock, fileContent);
    const candidates = findCandidates(searchBlock, fileContent);
    
    let response = `❌ **SEARCH 块匹配失败** - \`${filePath}\`\n`;
    
    if (issues.length > 0) response += `\n**问题：**\n${issues.join('\n')}\n`;
    if (fixes.length > 0) response += `\n**修复：**\n${fixes.map(f => `- ${f}`).join('\n')}\n`;
    
    if (candidates.length > 0) {
        const best = candidates[0];
        response += `\n**最佳匹配：** 第 ${best.startLine}-${best.endLine} 行 (${best.score}% 相似)\n`;
        
        const diffs = detailedDiff(searchLines, best.lines);
        if (diffs.length > 0) response += '\n' + generateDiffReport(diffs) + '\n';
        
        // 直接给出正确的 SEARCH 块
        response += `\n**✅ 正确的 SEARCH 块（直接复制）：**\n\`\`\`${lang}\n${best.lines.join('\n')}\n\`\`\`\n`;
        
        if (candidates.length > 1) {
            response += `\n**其他位置：** `;
            response += candidates.slice(1, 4).map(c => `第${c.startLine}行(${c.score}%)`).join(', ');
            response += '\n';
        }
    } else {
        response += `\n**⚠️ 找不到任何相似代码！** 请确认文件路径和内容是否正确。\n`;
        const preview = fileContent.split('\n').slice(0, 15).map((l, i) => 
            `${String(i + 1).padStart(4)}: ${l}`
        ).join('\n');
        response += `\n**文件开头：**\n\`\`\`${lang}\n${preview}\n\`\`\`\n`;
    }
    
    response += `\n**你的 SEARCH 块：**\n\`\`\`${lang}\n${searchBlock}\n\`\`\``;
    return response;
}

/**
 * 语法错误反馈
 */
export function buildSyntaxErrorContext(filePath, error, searchBlock, replaceBlock, patchedContent) {
    const lang = getLanguage(filePath);
    
    const truncation = detectTruncation(replaceBlock);
    if (truncation.truncated) {
        return `❌ **输出被截断** - \`${filePath}\`\n\nREPLACE 块包含 ${truncation.reason}，请重新生成。`;
    }
    
    const lineMatch = error.match(/第 (\d+) 行/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : -1;
    
    let response = `❌ **语法检查失败** - \`${filePath}\`\n\n**错误：** ${error}\n`;
    
    if (patchedContent && errorLine > 0) {
        const lines = patchedContent.split('\n');
        const start = Math.max(0, errorLine - 5);
        const end = Math.min(lines.length, errorLine + 5);
        const context = lines.slice(start, end).map((line, i) => {
            const num = start + i + 1;
            const marker = num === errorLine ? ' >>>' : '    ';
            return `${String(num).padStart(4)}${marker} ${line}`;
        }).join('\n');
        response += `\n**错误位置：**\n\`\`\`${lang}\n${context}\n\`\`\`\n`;
    }
    
    response += `\n**SEARCH：**\n\`\`\`${lang}\n${searchBlock}\n\`\`\`\n`;
    response += `\n**REPLACE：**\n\`\`\`${lang}\n${replaceBlock}\n\`\`\`\n`;
    response += `\n检查 REPLACE 块是否导致括号不匹配或语句不完整。`;
    return response;
}

/**
 * 重复匹配反馈
 */
export function buildDuplicateContext(filePath, fileContent, searchBlock, matchCount) {
    const lang = getLanguage(filePath);
    const fileLines = fileContent.split('\n');
    const searchLines = searchBlock.split('\n');
    const firstLine = searchLines[0]?.trim();
    
    const positions = [];
    fileLines.forEach((line, i) => {
        if (line.trim() === firstLine) positions.push(i + 1);
    });
    
    let response = `❌ **匹配到 ${matchCount} 处相同代码** - \`${filePath}\`\n\n`;
    response += `**位置：** 第 ${positions.slice(0, 10).join(', ')} 行\n`;
    
    positions.slice(0, 2).forEach((pos, idx) => {
        const start = Math.max(0, pos - 2);
        const end = Math.min(fileLines.length, pos + searchLines.length + 1);
        const context = fileLines.slice(start, end).map((l, i) => 
            `${String(start + i + 1).padStart(4)}: ${l}`
        ).join('\n');
        response += `\n**位置 ${idx + 1}：**\n\`\`\`${lang}\n${context}\n\`\`\`\n`;
    });
    
    response += `\n**你的 SEARCH 块：**\n\`\`\`${lang}\n${searchBlock}\n\`\`\`\n`;
    response += `\n**建议：** 添加前后 2-3 行独特上下文使其唯一匹配。`;
    return response;
}
