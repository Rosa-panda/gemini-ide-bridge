/**
 * 编辑器核心模块 - 重新导出共享模块
 */

// 从共享模块重新导出，保持向后兼容
export { UndoStack } from '../shared/undo.js';
export { getCaretPosition, setCaretPosition, getLineCol } from '../shared/caret.js';
