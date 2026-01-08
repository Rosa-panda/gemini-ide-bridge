/**
 * Gemini 交互模块入口
 */

import { processCodeBlock, createWatcher } from './watcher.js';
import { injectActionBar } from './actions.js';
import { patchQuillDeleteText, insertToInput, sendFile, sendStructure } from './input.js';

export const gemini = {
    observer: null,
    processedBlocks: new WeakSet(),
    _quillPatched: false,

    // 代理到 input.js 的方法
    insertToInput,
    sendFile,
    sendStructure,

    startWatching() {
        if (this.observer) return;
        
        // 启动 Quill patch
        if (!this._quillPatched) {
            this._quillPatched = true;
            patchQuillDeleteText();
        }
        
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
