/**
 * 代码块监听模块
 */

import { extractFilePath } from '../core/parser.js';

/**
 * 处理代码块，返回需要注入按钮的块
 */
export function processCodeBlock(block, processedBlocks) {
    if (processedBlocks.has(block)) return null;
    processedBlocks.add(block);
    
    const container = block.closest('code-block') || block.closest('pre') || block;
    if (container.querySelector('.ide-action-bar')) return null;
    
    const text = block.textContent || '';
    
    if (text.includes('IGNORE_IDE_ACTION')) return null;

    const fileMatch = extractFilePath(text);
    // 增加 ^ 锚点和多行模式，确保标记是在行首，避免匹配到字符串内部的示例
    const hasSearchReplace = /^<{6,10} SEARCH/m.test(text) && /^>{6,10} REPLACE/m.test(text);
    const hasDelete = /^<{6,10} DELETE/m.test(text) && /^>{6,10} END/m.test(text);
    
    if (fileMatch || hasSearchReplace || hasDelete) {
        return { container, text, fileMatch };
    }
    
    return null;
}

/**
 * 创建 MutationObserver 监听代码块
 */
export function createWatcher(onCodeBlock) {
    let timeout = null;
    return new MutationObserver(() => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            const codeBlocks = document.querySelectorAll('code-block, pre > code, .code-block');
            codeBlocks.forEach(block => onCodeBlock(block));
        }, 500);
    });
}
