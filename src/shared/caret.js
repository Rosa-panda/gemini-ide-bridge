/**
 * 光标操作模块 - contenteditable 元素的光标管理
 * 参考 zserge 方案
 */

/**
 * 获取光标位置
 * @param {HTMLElement} el - contenteditable 元素
 * @returns {number} 光标位置（字符偏移量）
 */
export function getCaretPosition(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const prefix = range.cloneRange();
    prefix.selectNodeContents(el);
    prefix.setEnd(range.endContainer, range.endOffset);
    return prefix.toString().length;
}

/**
 * 设置光标位置
 * @param {HTMLElement} el - contenteditable 元素
 * @param {number} pos - 目标位置（字符偏移量）
 */
export function setCaretPosition(el, pos) {
    const sel = window.getSelection();
    let charCount = 0;
    
    function traverse(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const nextCount = charCount + node.length;
            if (pos <= nextCount) {
                const range = document.createRange();
                range.setStart(node, pos - charCount);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return true;
            }
            charCount = nextCount;
        } else {
            for (const child of node.childNodes) {
                if (traverse(child)) return true;
            }
        }
        return false;
    }
    
    traverse(el);
}

/**
 * 获取当前行列号
 * @param {string} text - 文本内容
 * @param {number} pos - 光标位置
 * @returns {{line: number, col: number}} 行列号（从1开始）
 */
export function getLineCol(text, pos) {
    const before = text.substring(0, pos);
    const lines = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}
