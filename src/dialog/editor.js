/**
 * 编辑器对话框 - 基于 zserge 方案改进
 * 
 * 功能：
 * - Undo/Redo 栈（参考 Firefox undo.js）
 * - Tab 键插入空格
 * - 中文输入法兼容（compositionstart/end）
 * - Ctrl+Z/Y 撤销重做
 * - Ctrl+S 保存
 */

import { fs } from '../core/fs.js';
import { showToast } from '../shared/utils.js';

/**
 * 编辑器专用 Undo/Redo 栈
 */
class EditorUndoStack {
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
 * 获取光标位置（编辑器专用）
 */
function editorGetCaretPosition(el) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return 0;
    const range = sel.getRangeAt(0);
    const prefix = range.cloneRange();
    prefix.selectNodeContents(el);
    prefix.setEnd(range.endContainer, range.endOffset);
    return prefix.toString().length;
}

/**
 * 设置光标位置（编辑器专用）
 */
function editorSetCaretPosition(el, pos) {
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
 * 显示编辑器对话框
 */
export async function showEditorDialog(filePath) {
    const content = await fs.readFile(filePath);
    if (content === null) {
        showToast('读取文件失败', 'error');
        return;
    }
    
    const fileName = filePath.split('/').pop();
    
    // Undo/Redo 栈
    const undoStack = new EditorUndoStack();
    undoStack.push({ content, cursor: 0 });
    
    // 中文输入法状态
    let isComposing = false;
    
    // === UI 构建 ===
    const backdrop = document.createElement('div');
    backdrop.id = 'ide-editor-backdrop';
    Object.assign(backdrop.style, {
        position: 'fixed', inset: '0',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: '2147483648',
        animation: 'ideFadeIn 0.2s ease-out'
    });

    const dialog = document.createElement('div');
    dialog.id = 'ide-editor-dialog';
    Object.assign(dialog.style, {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--ide-bg)',
        color: 'var(--ide-text)',
        border: '1px solid var(--ide-border)',
        borderRadius: '12px',
        padding: '20px',
        zIndex: '2147483649',
        width: '80vw', maxWidth: '900px', height: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        animation: 'ideScaleIn 0.2s ease-out'
    });

    // 头部
    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', paddingBottom: '12px',
        borderBottom: '1px solid var(--ide-border)'
    });

    const titleGroup = document.createElement('div');
    Object.assign(titleGroup.style, { display: 'flex', alignItems: 'center', gap: '8px' });
    
    const titleIcon = document.createElement('span');
    titleIcon.textContent = '✏️';
    const titleText = document.createElement('span');
    titleText.textContent = `编辑: ${fileName}`;
    Object.assign(titleText.style, { fontSize: '16px', fontWeight: '600' });
    
    const pathHint = document.createElement('span');
    pathHint.textContent = filePath;
    Object.assign(pathHint.style, { 
        fontSize: '11px', color: 'var(--ide-text-secondary)', marginLeft: '8px' 
    });
    
    titleGroup.append(titleIcon, titleText, pathHint);
    
    // 工具栏（Undo/Redo 按钮）
    const toolbar = document.createElement('div');
    Object.assign(toolbar.style, { display: 'flex', gap: '4px' });
    
    const createToolBtn = (text, title, onClick) => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.title = title;
        Object.assign(btn.style, {
            padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--ide-border)',
            color: 'var(--ide-text)', fontSize: '12px'
        });
        btn.onmouseover = () => btn.style.background = 'var(--ide-hover)';
        btn.onmouseout = () => btn.style.background = 'transparent';
        btn.onclick = onClick;
        return btn;
    };
    
    // Undo/Redo 按钮
    const undoBtn = createToolBtn('↩️', 'Ctrl+Z 撤销', () => doUndo());
    const redoBtn = createToolBtn('↪️', 'Ctrl+Y 重做', () => doRedo());
    toolbar.append(undoBtn, redoBtn);
    
    header.append(titleGroup, toolbar);
    dialog.appendChild(header);

    // 编辑区域容器
    const editorContainer = document.createElement('div');
    Object.assign(editorContainer.style, {
        flex: '1', display: 'flex', overflow: 'hidden',
        border: '1px solid var(--ide-border)',
        borderRadius: '8px', background: 'var(--ide-hint-bg)'
    });

    // 行号
    const lineNumbers = document.createElement('div');
    Object.assign(lineNumbers.style, {
        padding: '12px 8px 12px 12px',
        textAlign: 'right',
        color: 'var(--ide-text-secondary)',
        userSelect: 'none',
        borderRight: '1px solid var(--ide-border)',
        background: 'rgba(0, 0, 0, 0.1)',
        minWidth: '40px',
        fontFamily: '"JetBrains Mono", Consolas, monospace',
        fontSize: '13px', lineHeight: '1.6',
        overflowY: 'hidden'
    });

    // 代码编辑区
    const codeArea = document.createElement('div');
    codeArea.contentEditable = 'plaintext-only';
    Object.assign(codeArea.style, {
        flex: '1', padding: '12px',
        fontFamily: '"JetBrains Mono", Consolas, monospace',
        fontSize: '13px', lineHeight: '1.6',
        whiteSpace: 'pre',
        outline: 'none',
        overflowY: 'auto',
        color: 'var(--ide-text)'
    });
    codeArea.textContent = content;

    // 更新行号
    const updateLineNumbers = () => {
        const lines = codeArea.textContent.split('\n');
        while (lineNumbers.firstChild) lineNumbers.removeChild(lineNumbers.firstChild);
        lines.forEach((_, idx) => {
            const lineDiv = document.createElement('div');
            lineDiv.textContent = String(idx + 1);
            lineNumbers.appendChild(lineDiv);
        });
    };

    // 更新按钮状态
    const updateButtons = () => {
        undoBtn.style.opacity = undoStack.canUndo() ? '1' : '0.4';
        redoBtn.style.opacity = undoStack.canRedo() ? '1' : '0.4';
    };

    // 撤销操作
    const doUndo = () => {
        const state = undoStack.undo();
        if (state) {
            codeArea.textContent = state.content;
            editorSetCaretPosition(codeArea, state.cursor);
            updateLineNumbers();
            updateButtons();
        }
    };

    // 重做操作
    const doRedo = () => {
        const state = undoStack.redo();
        if (state) {
            codeArea.textContent = state.content;
            editorSetCaretPosition(codeArea, state.cursor);
            updateLineNumbers();
            updateButtons();
        }
    };

    // 保存状态到 undo 栈（防抖）
    let saveTimeout = null;
    const saveState = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const cursor = editorGetCaretPosition(codeArea);
            undoStack.push({ content: codeArea.textContent, cursor });
            updateButtons();
        }, 300);
    };

    // 同步滚动
    codeArea.addEventListener('scroll', () => {
        lineNumbers.scrollTop = codeArea.scrollTop;
    });

    // 中文输入法兼容
    codeArea.addEventListener('compositionstart', () => { isComposing = true; });
    codeArea.addEventListener('compositionend', () => { 
        isComposing = false; 
        saveState();
        updateLineNumbers();
    });

    // 监听编辑
    codeArea.addEventListener('input', () => {
        if (!isComposing) {
            saveState();
            updateLineNumbers();
        }
    });

    // 键盘事件
    codeArea.addEventListener('keydown', (e) => {
        // Tab 键插入空格
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }
        // Shift+Tab 反缩进（删除行首 4 空格）
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const text = codeArea.textContent;
            const pos = editorGetCaretPosition(codeArea);
            // 找到当前行开头
            let lineStart = text.lastIndexOf('\n', pos - 1) + 1;
            // 检查行首是否有空格
            if (text.substring(lineStart, lineStart + 4) === '    ') {
                codeArea.textContent = text.substring(0, lineStart) + text.substring(lineStart + 4);
                editorSetCaretPosition(codeArea, Math.max(lineStart, pos - 4));
                updateLineNumbers();
                saveState();
            }
        }
        // Ctrl+Z 撤销
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            doUndo();
        }
        // Ctrl+Y 或 Ctrl+Shift+Z 重做
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            doRedo();
        }
    });

    // 初始化
    updateLineNumbers();
    updateButtons();

    editorContainer.append(lineNumbers, codeArea);
    dialog.appendChild(editorContainer);

    // 底部按钮
    const footer = document.createElement('div');
    Object.assign(footer.style, {
        display: 'flex', justifyContent: 'flex-end', gap: '12px',
        marginTop: '16px', paddingTop: '12px',
        borderTop: '1px solid var(--ide-border)'
    });

    const closeAll = () => { 
        document.removeEventListener('keydown', handleGlobalKey);
        backdrop.remove(); 
        dialog.remove(); 
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    Object.assign(cancelBtn.style, {
        padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
        background: 'transparent', border: '1px solid var(--ide-border)',
        color: 'var(--ide-text)', fontSize: '14px'
    });
    cancelBtn.onmouseover = () => cancelBtn.style.background = 'var(--ide-hover)';
    cancelBtn.onmouseout = () => cancelBtn.style.background = 'transparent';
    cancelBtn.onclick = closeAll;

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 保存';
    Object.assign(saveBtn.style, {
        padding: '8px 24px', borderRadius: '6px', cursor: 'pointer',
        background: 'var(--ide-accent)', color: '#fff',
        border: 'none', fontSize: '14px', fontWeight: '600'
    });
    saveBtn.onclick = async () => {
        saveBtn.textContent = '保存中...';
        saveBtn.disabled = true;
        
        const success = await fs.writeFile(filePath, codeArea.textContent);
        if (success) {
            showToast('已保存: ' + fileName);
            closeAll();
        } else {
            showToast('保存失败', 'error');
            saveBtn.textContent = '💾 保存';
            saveBtn.disabled = false;
        }
    };

    footer.append(cancelBtn, saveBtn);
    dialog.appendChild(footer);

    // 全局快捷键
    const handleGlobalKey = (e) => {
        if (e.key === 'Escape') closeAll();
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveBtn.click();
        }
    };
    document.addEventListener('keydown', handleGlobalKey);

    document.body.append(backdrop, dialog);
    codeArea.focus();
}
