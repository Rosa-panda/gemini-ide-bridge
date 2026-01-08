/**
 * 输入框操作模块 - Quill 编辑器交互与文本注入
 */

import { showToast, getLanguage, estimateTokens, formatTokens } from '../shared/utils.js';

/**
 * Patch Quill 编辑器，绕过 Gemini 的字数限制
 * 原理：拦截 deleteText 方法，阻止系统自动截断大段文本
 */
export function patchQuillDeleteText() {
    const container = document.querySelector('.ql-container');
    if (!container?.__quill) {
        // Quill 还没初始化，稍后重试
        setTimeout(patchQuillDeleteText, 500);
        return;
    }
    
    const quill = container.__quill;
    
    // 避免重复 patch
    if (quill.__bypassPatched) return;
    quill.__bypassPatched = true;
    
    const originalDeleteText = quill.deleteText.bind(quill);
    
    quill.deleteText = function(index, length, source) {
        const totalLen = quill.getLength();
        
        // 拦截条件：批量删除（length > 1）且删到末尾（系统截断特征）
        // 但允许用户主动清空（通过 source === 'user' 或 'api' 配合 silent）
        if (length > 1 && (index + length) >= totalLen - 1 && source !== 'silent') {
            console.warn('🛡️ 拦截 Gemini 自动截断:', { index, length, totalLen });
            return;
        }
        
        return originalDeleteText(index, length, source);
    };
    
    console.log('🛡️ Quill 字数限制绕过已激活');
}

/**
 * 获取输入框元素
 */
function getInputElement() {
    const selectors = [
        'rich-textarea .ql-editor',
        'rich-textarea [contenteditable="true"]',
        '.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"]'
    ];
    
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

/**
 * 获取 Quill 实例
 */
function getQuillInstance() {
    const container = document.querySelector('.ql-container');
    return container?.__quill || null;
}

/**
 * 向输入框插入文本
 */
export function insertToInput(text) {
    const inputEl = getInputElement();
    
    if (!inputEl) {
        showToast('找不到输入框', 'error');
        return false;
    }
    
    inputEl.focus();

    const quill = getQuillInstance();

    if (quill) {
        // 使用 Quill 原生 API 注入，能自动触发所有内部监听并更新 UI
        const length = quill.getLength();
        const insertionIndex = length > 1 ? length - 1 : 0;
        const prefix = insertionIndex > 0 ? '\n\n' : '';
        quill.insertText(insertionIndex, prefix + text, 'user');
        quill.setSelection(quill.getLength(), 0); // 光标移到末尾
    } else {
        // 降级方案：直接操作 DOM
        const existing = inputEl.textContent || '';
        const newContent = existing ? existing + '\n\n' + text : text;
        inputEl.textContent = newContent;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 手动定位光标到末尾
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(inputEl);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    return { success: true, tokens: estimateTokens(text) };
}

/**
 * 发送文件内容到输入框
 */
export function sendFile(filePath, content) {
    const lang = getLanguage(filePath);
    const text = `📄 **文件最新状态** - \`${filePath}\`\n\n以下是该文件当前的完整内容：\n\n\`\`\`${lang}\n${content}\n\`\`\``;
    const result = insertToInput(text);
    if (result.success) {
        showToast(`已发送: ${filePath.split('/').pop()} (~${formatTokens(result.tokens)} tokens)`);
    }
    return result.success;
}

/**
 * 发送目录结构到输入框
 */
export function sendStructure(name, structure) {
    const text = `目录 \`${name}\` 结构:\n\n\`\`\`\n${structure}\`\`\``;
    const result = insertToInput(text);
    if (result.success) {
        showToast(`已发送目录 (~${formatTokens(result.tokens)} tokens)`);
    }
    return result.success;
}
