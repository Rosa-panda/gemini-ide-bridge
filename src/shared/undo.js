/**
 * Undo/Redo 栈 - 通用的撤销重做实现
 * 参考 Firefox devtools undo.js
 */

export class UndoStack {
    constructor(maxSize = 50) {
        this._stack = [];
        this._index = -1;
        this._maxSize = maxSize;
    }
    
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
