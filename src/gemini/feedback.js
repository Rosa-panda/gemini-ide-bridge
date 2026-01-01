/**
 * 错误回传模块 - 向 AI 发送错误上下文
 */

import { getLanguage } from '../shared/utils.js';

/**
 * 匹配失败时，提取文件上下文发送给 AI
 */
export function buildMismatchContext(filePath, fileContent, searchBlock) {
    const lines = fileContent.split('\n');
    const searchLines = searchBlock.trim().split('\n');
    const searchFirst = searchLines[0].trim();
    
    let bestLine = -1;
    let bestScore = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === searchFirst) {
            bestLine = i;
            bestScore = 1;
            break;
        }
        if (line.length > 5 && searchFirst.length > 5) {
            const common = [...line].filter(c => searchFirst.includes(c)).length;
            const score = common / Math.max(line.length, searchFirst.length);
            if (score > bestScore && score > 0.5) {
                bestScore = score;
                bestLine = i;
            }
        }
    }
    
    let contextStart, contextEnd;
    if (bestLine >= 0) {
        contextStart = Math.max(0, bestLine - 5);
        contextEnd = Math.min(lines.length, bestLine + searchLines.length + 5);
    } else {
        contextStart = 0;
        contextEnd = Math.min(lines.length, 30);
    }
    
    const contextLines = lines.slice(contextStart, contextEnd);
    const numberedContext = contextLines.map((line, i) => 
        `${String(contextStart + i + 1).padStart(4)}: ${line}`
    ).join('\n');
    
    const lang = getLanguage(filePath);
    return `❌ **补丁匹配失败** - \`${filePath}\`

**你提供的 SEARCH 块：**
\`\`\`${lang}
${searchBlock}
\`\`\`

**文件实际内容（第 ${contextStart + 1}-${contextEnd} 行）：**
\`\`\`${lang}
${numberedContext}
\`\`\`

请检查 SEARCH 块是否与实际代码一致（注意空格、缩进、换行），然后重新生成正确的补丁。`;
}

/**
 * 语法检查失败时，发送错误详情给 AI
 * 注意：语法检查是针对应用补丁后的完整文件，不是单独的 REPLACE 块
 */
export function buildSyntaxErrorContext(filePath, error, searchBlock, replaceBlock, patchedContent) {
    const lang = getLanguage(filePath);
    
    // 提取错误行号
    const lineMatch = error.match(/第 (\d+) 行/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : -1;
    
    // 如果有完整的补丁后内容，展示错误位置附近的代码
    let contextSection = '';
    if (patchedContent && errorLine > 0) {
        const lines = patchedContent.split('\n');
        const start = Math.max(0, errorLine - 5);
        const end = Math.min(lines.length, errorLine + 5);
        const contextLines = lines.slice(start, end).map((line, i) => {
            const lineNum = start + i + 1;
            const marker = lineNum === errorLine ? ' >>> ' : '     ';
            return `${String(lineNum).padStart(4)}${marker}${line}`;
        }).join('\n');
        
        contextSection = `
**应用补丁后的文件（错误位置附近）：**
\`\`\`${lang}
${contextLines}
\`\`\`
`;
    }
    
    return `❌ **语法检查失败** - \`${filePath}\`

**错误信息：** ${error}

**说明：** 语法检查是针对应用补丁后的完整文件进行的，不是单独检查 REPLACE 块。
${contextSection}
**你提供的 SEARCH 块：**
\`\`\`${lang}
${searchBlock}
\`\`\`

**你提供的 REPLACE 块：**
\`\`\`${lang}
${replaceBlock}
\`\`\`

请检查 REPLACE 块是否会导致文件语法错误（括号不匹配、语句不完整等），然后重新生成正确的补丁。`;
}

/**
 * 匹配到多处重复时，告知 AI 重复出现的位置
 */
export function buildDuplicateContext(filePath, fileContent, searchBlock, matchCount) {
    const lines = fileContent.split('\n');
    const searchLines = searchBlock.trim().split('\n');
    const searchFirst = searchLines[0].trim();
    
    const matchLineNumbers = [];
    lines.forEach((line, index) => {
        if (line.trim() === searchFirst) {
            matchLineNumbers.push(index + 1);
        }
    });

    const lang = getLanguage(filePath);
    return `❌ **补丁匹配不唯一** - \`${filePath}\`

**检测到 ${matchCount} 处完全相同的代码块。**

**你提供的 SEARCH 块：**
\`\`\`${lang}
${searchBlock}
\`\`\`

**该代码块出现在以下行号：** ${matchLineNumbers.join(', ')}

请在 SEARCH 块中包含更多前后的代码行（上下文），以确保补丁能唯一精确地匹配到目标位置。`;
}
