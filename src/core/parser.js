/**
 * 解析器模块 - 解析 AI 输出的指令
 */

/**
 * 提取文件路径 (支持 [OVERWRITE] 标记)
 */
export function extractFilePath(text) {
    const patterns = [
        /^\/\/\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*$/m,
        /^#\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*$/m,
        /^\/\*\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*\*\/$/m,
        /^<!--\s*FILE:\s*(.+?)(?:\s*\[OVERWRITE\])?\s*-->$/m
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

/**
 * 检测是否为 OVERWRITE 模式
 */
export function isOverwriteMode(text) {
    return /FILE:\s*.+?\s*\[OVERWRITE\]/i.test(text);
}

/**
 * 解析 DELETE 块
 */
export function parseDelete(text) {
    const deletes = [];
    // 同步优化：增加 {6,10} 兼容性与行首锚点，防止误匹配
    const regex = /^<{6,10}\s*DELETE\s*\[([^\]]+)\]\s*[\s\S]*?^>{6,10}\s*END\s*$/gm;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        deletes.push({
            file: match[1].trim()
        });
    }
    
    return deletes;
}

/**
 * 解析 READ 块（请求读取文件片段）
 * 支持多种格式：
 * - <<<<<<< READ [path] 50-100
 * - <<<<<<< READ [path]
 * - 同一行多个 READ
 */
export function parseRead(text) {
    const reads = [];
    // 不用 ^ 锚点，允许同一行多个 READ
    const regex = /<{6,10}\s*READ\s*\[([^\]]+)\](?:\s+(\d+)-(\d+))?/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        reads.push({
            file: match[1].trim(),
            startLine: match[2] ? parseInt(match[2]) : null,
            endLine: match[3] ? parseInt(match[3]) : null
        });
    }
    
    return reads;
}

/**
 * 解析 SEARCH/REPLACE 块（支持空 replace 表示删除）
 * 支持两种格式：
 * - <<<<<<< SEARCH [path/to/file]
 * - <<<<<<< SEARCH path/to/file
 */
export function parseSearchReplace(text) {
    const patches = [];
    /**
     * 稳健性增强正则：
     * 1. ^...$ + m 模式：确保标记必须占据整行。
     * 2. \s*?\n：允许标记行末尾有不可见空格。
     * 3. ^={6,10}\s*$：确保分隔符必须在行首，且允许行末空格。
     * 4. 避免了非行首的 ======= 误触发截断。
     */
    // 优化：REPLACE 标记前的 \n 改为 \n?，增强对 AI 偶尔漏掉最后一个换行的容错性
    // 兼容 Gemini 输出的带行号格式：<<<<<<< SEARCH [file] 414-428
    const regex = /^<{6,10} SEARCH(?:\s*\[([^\]]+)\]|\s+([^\s\n]+))?(?:\s+\d+-\d+)?\s*?\n([\s\S]*?)\n^={6,10}\s*?\n([\s\S]*?)(?:\n?^>{6,10} REPLACE\s*$|$)/gm;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        patches.push({
            file: (match[1] || match[2] || null)?.trim(),
            search: match[3],
            // 移除末尾可能存在的换行符，保持内容纯净
            replace: match[4].replace(/\n$/, ''),
            isDelete: match[4].trim() === ''
        });
    }
    
    return patches;
}

/**
 * 清理代码内容 (移除 FILE: 注释)
 */
export function cleanContent(text) {
    return text
        .replace(/^\/\/\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*\n?/m, '')
        .replace(/^#\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*\n?/m, '')
        .replace(/^\/\*\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*\*\/\n?/m, '')
        .replace(/^<!--\s*FILE:\s*.+?(?:\s*\[OVERWRITE\])?\s*-->\n?/m, '')
        .trim();
}

/**
 * 解析多个 FILE: 块（批量创建/覆盖）
 */
export function parseMultipleFiles(text) {
    const files = [];
    const filePattern = /(?:\/\/|#|\/\*)\s*FILE:\s*\[?(.+?)\]?(?:\s*\[OVERWRITE\])?\s*(?:\*\/|-->)?$/gm;
    
    const matches = [];
    let match;
    while ((match = filePattern.exec(text)) !== null) {
        matches.push({
            index: match.index,
            path: match[1].trim(),
            isOverwrite: match[0].includes('[OVERWRITE]')
        });
    }
    
    if (matches.length === 0) return files;
    
    for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const nextIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
        
        let blockText = text.substring(current.index, nextIndex);
        blockText = blockText
            .replace(/^(?:\/\/|#|\/\*)\s*FILE:.*(?:\r?\n|$)/m, '')
            .trim();
        
        if (current.path && blockText) {
            files.push({
                path: current.path,
                content: blockText,
                isOverwrite: current.isOverwrite
            });
        }
    }
    
    return files;
}
