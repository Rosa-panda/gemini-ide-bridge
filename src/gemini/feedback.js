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
 */
export function buildSyntaxErrorContext(filePath, error, searchBlock, replaceBlock) {
    const lang = getLanguage(filePath);
    
    const lineMatch = error.match(/第 (\d+) 行/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : -1;
    
    const replaceLines = replaceBlock.split('\n');
    const numberedReplace = replaceLines.map((line, i) => {
        const lineNum = String(i + 1).padStart(3);
        const marker = (i + 1 === errorLine) ? ' >>> ' : '     ';
        return `${lineNum}${marker}${line}`;
    }).join('\n');
    
    return `❌ **语法检查失败** - \`${filePath}\`

**错误信息：** ${error}

**你提供的 REPLACE 块（已标注行号，>>> 标记出错行）：**
\`\`\`${lang}
${numberedReplace}
\`\`\`

请检查第 ${errorLine > 0 ? errorLine : '?'} 行附近的语法错误（括号是否匹配、是否有多余或缺失的符号），然后重新生成正确的补丁。`;
}
