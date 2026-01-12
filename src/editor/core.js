/**
 * 编辑器核心模块 - 光标、输入、Undo/Redo
 */

/**
 * Undo/Redo 栈
 */
export class UndoStack {
    constructor(maxSize = 50) {
        this._stack = [];
        this._index = -1;
        this._maxSize = maxSize;
    }
    
    push(state) {
        this._stack = this._stack.slice(0, this._index + 1);
        this._stack.push(state);
        if (this._stack.length > this._maxSize) {
            this._stack.shift();
        } else {
            this._index++;
        }
    }
    
    undo() {
        if (!this.canUndo()) return null;
        this._index--;
        return this._stack[this._index];
    }
    
    redo() {
        if (!this.canRedo()) return null;
        this._index++;
        return this._stack[this._index];
    }
    
    canUndo() { return this._index > 0; }
    canRedo() { return this._index < this._stack.length - 1; }
    current() { return this._stack[this._index] || null; }
}

/**
 * 获取光标位置
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
 */
export function getLineCol(text, pos) {
    const before = text.substring(0, pos);
    const lines = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}
