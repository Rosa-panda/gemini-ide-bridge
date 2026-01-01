/**
 * 错误回传模块 - 向 AI 发送精确的错误上下文
 */

import { getLanguage } from '../shared/utils.js';

/**
 * 检测输出是否被截断（Gemini 网页版常见问题）
 */
function detectTruncation(text) {
    const truncationPatterns = [
        { pattern: /<\/content>/i, name: '</content> 标签' },
        { pattern: /<\/file>/i, name: '</file> 标签' },
        { pattern: /\x00/, name: '空字符' },
        { pattern: /[\uFFFD]/, name: '替换字符' },
    ];
    
    for (const { pattern, name } of truncationPatterns) {
        if (pattern.test(text)) {
            return { truncated: true, reason: name };
        }
    }
    return { truncated: false };
}

/**
 * 检测常见错误模式
 */
function detectCommonIssues(searchBlock, fileContent) {
    const issues = [];
    const searchLines = searchBlock.trim().split('\n');
    const fileLines = fileContent.split('\n');
    
    // 1. 检测缩进问题（Tab vs Space）
    const searchHasTabs = /\t/.test(searchBlock);
    const searchHasSpaces = /^[ ]{2,}/m.test(searchBlock);
    const fileHasTabs = /\t/.test(fileContent);
    const fileHasSpaces = /^[ ]{2,}/m.test(fileContent);
    
    if (searchHasTabs && !fileHasTabs && fileHasSpaces) {
        issues.push('SEARCH 块使用 Tab 缩进，但文件使用空格缩进');
    }
    if (searchHasSpaces && !fileHasSpaces && fileHasTabs) {
        issues.push('SEARCH 块使用空格缩进，但文件使用 Tab 缩进');
    }
    
    // 2. 检测行尾空格问题
    const searchTrailingSpaces = searchLines.filter(l => /[ \t]+$/.test(l)).length;
    if (searchTrailingSpaces > 0) {
        issues.push(`SEARCH 块有 ${searchTrailingSpaces} 行包含行尾空格，这可能导致匹配失败`);
    }
    
    // 3. 检测空行数量差异
    const searchEmptyLines = searchLines.filter(l => l.trim() === '').length;
    
    // 4. 检测首行是否能找到
    const firstLine = searchLines[0]?.trim();
    if (firstLine) {
        const foundInFile = fileLines.some(l => l.trim() === firstLine);
        if (!foundInFile) {
            issues.push(`SEARCH 块的第一行 "${firstLine.slice(0, 50)}${firstLine.length > 50 ? '...' : ''}" 在文件中不存在`);
        }
    }
    
    return issues;
}

/**
 * 行级 diff - 找出具体哪一行不一样
 */
function lineDiff(searchBlock, fileContent) {
    const searchLines = searchBlock.split('\n');
    const fileLines = fileContent.split('\n');
    
    // 尝试找到最佳匹配位置
    const firstSearchLine = searchLines[0]?.trim();
    let bestStartIndex = -1;
    let bestScore = 0;
    
    for (let i = 0; i < fileLines.length; i++) {
        if (fileLines[i].trim() === firstSearchLine) {
            // 计算从这个位置开始的匹配分数
            let score = 0;
            for (let j = 0; j < searchLines.length && i + j < fileLines.length; j++) {
                if (searchLines[j].trim() === fileLines[i + j].trim()) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestStartIndex = i;
            }
        }
    }
    
    if (bestStartIndex === -1) {
        return { found: false, message: '无法在文件中找到匹配的起始位置' };
    }
    
    // 逐行对比，找出差异
    const diffs = [];
    for (let j = 0; j < searchLines.length; j++) {
        const fileLineIndex = bestStartIndex + j;
        const searchLine = searchLines[j];
        const fileLine = fileLines[fileLineIndex] || '';
        
        if (searchLine !== fileLine) {
            const trimMatch = searchLine.trim() === fileLine.trim();
            diffs.push({
                lineNum: j + 1,
                fileLineNum: fileLineIndex + 1,
                search: searchLine,
                file: fileLine,
                type: trimMatch ? 'whitespace' : 'content'
            });
        }
    }
    
    return { found: true, startLine: bestStartIndex + 1, diffs };
}

/**
 * 字符级 diff - 找出具体哪个字符不一样
 */
function charDiff(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    let firstDiffIndex = -1;
    
    for (let i = 0; i < maxLen; i++) {
        if (str1[i] !== str2[i]) {
            firstDiffIndex = i;
            break;
        }
    }
    
    if (firstDiffIndex === -1) return null;
    
    // 获取差异位置附近的上下文
    const contextStart = Math.max(0, firstDiffIndex - 10);
    const contextEnd = Math.min(maxLen, firstDiffIndex + 20);
    
    const char1 = str1[firstDiffIndex];
    const char2 = str2[firstDiffIndex];
    
    // 可视化特殊字符
    const visualize = (ch) => {
        if (ch === undefined) return '[缺失]';
        if (ch === ' ') return '[空格]';
        if (ch === '\t') return '[Tab]';
        if (ch === '\n') return '[换行]';
        if (ch === '\r') return '[回车]';
        return `'${ch}'`;
    };
    
    return {
        position: firstDiffIndex,
        expected: visualize(char1),
        actual: visualize(char2),
        context1: str1.slice(contextStart, contextEnd).replace(/\t/g, '→').replace(/ /g, '·'),
        context2: str2.slice(contextStart, contextEnd).replace(/\t/g, '→').replace(/ /g, '·')
    };
}

/**
 * 匹配失败时，提取文件上下文发送给 AI
 */
export function buildMismatchContext(filePath, fileContent, searchBlock) {
    const lang = getLanguage(filePath);
    
    // 1. 检测截断
    const truncation = detectTruncation(searchBlock);
    if (truncation.truncated) {
        return `❌ **输出被截断** - \`${filePath}\`

**检测到你的输出包含 ${truncation.reason}，这说明代码在传输过程中被损坏了。**

**常见原因：**
- 网页版 Gemini 对 \`$\` 符号处理异常
- 输出过长被截断

**解决方案：**
1. 如果代码包含 \`$\`（如模板字符串 \`\${}\`），尝试用 \`String.fromCharCode(36)\` 代替
2. 将大的修改拆分成多个小补丁
3. 重新生成补丁

请重新输出完整的、未截断的补丁。`;
    }
    
    // 2. 检测常见问题
    const commonIssues = detectCommonIssues(searchBlock, fileContent);
    
    // 3. 行级 diff
    const diff = lineDiff(searchBlock, fileContent);
    
    let diffSection = '';
    if (diff.found && diff.diffs.length > 0) {
        const diffDetails = diff.diffs.slice(0, 5).map(d => {
            if (d.type === 'whitespace') {
                const charDiffResult = charDiff(d.search, d.file);
                if (charDiffResult) {
                    return `- **第 ${d.lineNum} 行** (文件第 ${d.fileLineNum} 行): 空白字符差异
  - 位置 ${charDiffResult.position}: 期望 ${charDiffResult.expected}，实际 ${charDiffResult.actual}
  - SEARCH: \`${charDiffResult.context1}\`
  - 文件:  \`${charDiffResult.context2}\``;
                }
                return `- **第 ${d.lineNum} 行** (文件第 ${d.fileLineNum} 行): 空白字符差异`;
            } else {
                return `- **第 ${d.lineNum} 行** (文件第 ${d.fileLineNum} 行): 内容不同
  - SEARCH: \`${d.search.slice(0, 60)}${d.search.length > 60 ? '...' : ''}\`
  - 文件:  \`${d.file.slice(0, 60)}${d.file.length > 60 ? '...' : ''}\``;
            }
        }).join('\n');
        
        diffSection = `
**差异分析（从文件第 ${diff.startLine} 行开始匹配）：**
${diffDetails}
${diff.diffs.length > 5 ? `\n... 还有 ${diff.diffs.length - 5} 处差异` : ''}
`;
    }
    
    let issuesSection = '';
    if (commonIssues.length > 0) {
        issuesSection = `
**检测到的问题：**
${commonIssues.map(i => `- ${i}`).join('\n')}
`;
    }
    
    // 4. 展示文件相关片段
    const lines = fileContent.split('\n');
    const searchLines = searchBlock.trim().split('\n');
    const searchFirst = searchLines[0].trim();
    
    let contextStart = 0, contextEnd = Math.min(30, lines.length);
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === searchFirst) {
            contextStart = Math.max(0, i - 3);
            contextEnd = Math.min(lines.length, i + searchLines.length + 3);
            break;
        }
    }
    
    const contextLines = lines.slice(contextStart, contextEnd);
    const numberedContext = contextLines.map((line, i) => 
        `${String(contextStart + i + 1).padStart(4)}: ${line}`
    ).join('\n');

    return `❌ **补丁匹配失败** - \`${filePath}\`
${issuesSection}${diffSection}
**你提供的 SEARCH 块：**
\`\`\`${lang}
${searchBlock}
\`\`\`

**文件实际内容（第 ${contextStart + 1}-${contextEnd} 行）：**
\`\`\`${lang}
${numberedContext}
\`\`\`

请根据上述差异分析，修正 SEARCH 块使其与文件内容完全一致，然后重新生成补丁。`;
}

/**
 * 语法检查失败时，发送错误详情给 AI
 */
export function buildSyntaxErrorContext(filePath, error, searchBlock, replaceBlock, patchedContent) {
    const lang = getLanguage(filePath);
    
    // 检测截断
    const truncation = detectTruncation(replaceBlock);
    if (truncation.truncated) {
        return `❌ **输出被截断** - \`${filePath}\`

**检测到你的 REPLACE 块包含 ${truncation.reason}，代码在传输过程中被损坏了。**

请重新输出完整的补丁，避免使用可能触发截断的特殊字符。`;
    }
    
    const lineMatch = error.match(/第 (\d+) 行/);
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : -1;
    
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

**说明：** 语法检查是针对应用补丁后的完整文件进行的。
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
    
    // 展示每个匹配位置的上下文
    const matchContexts = matchLineNumbers.slice(0, 3).map(lineNum => {
        const start = Math.max(0, lineNum - 2);
        const end = Math.min(lines.length, lineNum + 2);
        const context = lines.slice(start, end).map((l, i) => 
            `${String(start + i + 1).padStart(4)}: ${l}`
        ).join('\n');
        return `**位置 ${lineNum} 行附近：**\n\`\`\`\n${context}\n\`\`\``;
    }).join('\n\n');

    const lang = getLanguage(filePath);
    return `❌ **补丁匹配不唯一** - \`${filePath}\`

**检测到 ${matchCount} 处完全相同的代码块，无法确定要修改哪一处。**

**你提供的 SEARCH 块：**
\`\`\`${lang}
${searchBlock}
\`\`\`

**该代码块出现在以下位置：** 第 ${matchLineNumbers.join(', ')} 行

${matchContexts}

**解决方案：**
在 SEARCH 块中包含更多上下文（前后几行代码），使其能唯一匹配到目标位置。`;
}
