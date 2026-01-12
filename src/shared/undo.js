/**
 * Undo/Redo 栈 - 通用的撤销重做实现
 * 参考 Firefox devtools undo.js
 */

/**
 * @typedef {Object} UndoState
 * @property {string} content - 内容快照
 * @property {number} cursor - 光标位置
 */

/**
 * 撤销/重做栈
 */
export class UndoStack {
    /**
     * @param {number} [maxSize=50] - 最大历史记录数
     */
    constructor(maxSize = 50) {
        this._stack = [];
        this._index = -1;
        this._maxSize = maxSize;
    }
    
    /**
     * 压入新状态
     * @param {UndoState} state - 状态快照
     */
    push(state) {
        // 截断后面的历史
        this._stack = this._stack.slice(0, this._index + 1);
        this._stack.push(state);
        // 限制栈大小
        if (this._stack.length > this._maxSize) {
            this._stack.shift();
        } else {
            this._index++;
        }
    }
    
    /**
     * 撤销，返回上一状态
     * @returns {UndoState|null}
     */
    undo() {
        if (!this.canUndo()) return null;
        this._index--;
        return this._stack[this._index];
    }
    
    /**
     * 重做，返回下一状态
     * @returns {UndoState|null}
     */
    redo() {
        if (!this.canRedo()) return null;
        this._index++;
        return this._stack[this._index];
    }
    
    /** @returns {boolean} */
    canUndo() { return this._index > 0; }
    /** @returns {boolean} */
    canRedo() { return this._index < this._stack.length - 1; }
    /** @returns {UndoState|null} */
    current() { return this._stack[this._index] || null; }
}
