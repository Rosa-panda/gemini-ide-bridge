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
    const regex = /<{6,7}\s*DELETE\s*\[([^\]]+)\]\s*[\s\S]*?>{6,7}\s*END/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        deletes.push({
            file: match[1].trim()
        });
    }
    
    return deletes;
}

/**
 * 解析 SEARCH/REPLACE 块（支持空 replace 表示删除）
 */
export function parseSearchReplace(text) {
    const patches = [];
    const regex = /<{6,7} SEARCH(?:\s*\[(.+?)\])?\s*\n([\s\S]*?)\n={6,7}\n?([\s\S]*?)>{6,7} REPLACE/g;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        patches.push({
            file: match[1] || null,
            search: match[2],
            replace: match[3].replace(/\n$/, ''),
            isDelete: match[3].trim() === ''
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
