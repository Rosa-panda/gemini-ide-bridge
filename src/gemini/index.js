/**
 * Gemini 交互模块入口
 */

import { showToast, getLanguage, estimateTokens, formatTokens } from '../shared/utils.js';
import { processCodeBlock, createWatcher } from './watcher.js';
import { injectActionBar } from './actions.js';

export const gemini = {
    observer: null,
    processedBlocks: new WeakSet(),

    insertToInput(text) {
        const selectors = [
            'rich-textarea .ql-editor',
            'rich-textarea [contenteditable="true"]',
            '.ql-editor[contenteditable="true"]',
            'div[contenteditable="true"]'
        ];
        
        let inputEl = null;
        for (const sel of selectors) {
            inputEl = document.querySelector(sel);
            if (inputEl) break;
        }
        
        if (!inputEl) {
            showToast('找不到输入框', 'error');
            return false;
        }
        
        inputEl.focus();
        
        const existing = inputEl.textContent || '';
        const newContent = existing ? existing + '\n\n' + text : text;
        
        inputEl.textContent = newContent;
        
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(inputEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        
        return { success: true, tokens: estimateTokens(text) };
    },

    sendFile(filePath, content) {
        const lang = getLanguage(filePath);
        const text = `📄 **文件最新状态** - \`${filePath}\`\n\n以下是该文件当前的完整内容：\n\n\`\`\`${lang}\n${content}\n\`\`\``;
        const result = this.insertToInput(text);
        if (result.success) {
            showToast(`已发送: ${filePath.split('/').pop()} (~${formatTokens(result.tokens)} tokens)`);
        }
        return result.success;
    },

    sendStructure(name, structure) {
        const text = `目录 \`${name}\` 结构:\n\n\`\`\`\n${structure}\`\`\``;
        const result = this.insertToInput(text);
        if (result.success) {
            showToast(`已发送目录 (~${formatTokens(result.tokens)} tokens)`);
        }
        return result.success;
    },

    startWatching() {
        if (this.observer) return;
        
        this.observer = createWatcher(() => {
            this._processCodeBlocks();
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this._processCodeBlocks();
        console.log('[Gemini] 开始监听代码块');
    },

    _processCodeBlocks() {
        const codeBlocks = document.querySelectorAll('code-block, pre > code, .code-block');
        
        codeBlocks.forEach(block => {
            const result = processCodeBlock(block, this.processedBlocks);
            if (result) {
                injectActionBar(result.container, result.text, result.fileMatch, (msg) => this.insertToInput(msg));
            }
        });
    }
};
