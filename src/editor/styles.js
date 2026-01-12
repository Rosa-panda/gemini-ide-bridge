/**
 * 编辑器样式模块 - 集中管理所有 CSS 样式
 */

/**
 * 获取编辑器窗口样式
 */
export function getEditorStyles() {
    return `
        .ide-editor-window {
            position: fixed;
            background: var(--ide-bg, #1e1e1e);
            color: var(--ide-text, #d4d4d4);
            border: 1px solid var(--ide-border, #3c3c3c);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            min-width: 500px;
            min-height: 350px;
            z-index: 2147483649;
        }
        .ide-editor-titlebar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            background: rgba(0,0,0,0.3);
            border-radius: 8px 8px 0 0;
            cursor: move;
            user-select: none;
        }
        .ide-editor-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 500;
        }
        .ide-editor-title-path {
            opacity: 0.5;
            font-size: 11px;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ide-editor-controls {
            display: flex;
            gap: 2px;
        }
        .ide-editor-controls button {
            width: 22px;
            height: 22px;
            border: none;
            border-radius: 4px;
            background: transparent;
            color: var(--ide-text, #d4d4d4);
            cursor: pointer;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ide-editor-controls button:hover {
            background: rgba(255,255,255,0.1);
        }
        .ide-editor-body {
            flex: 1;
            display: flex;
            overflow: hidden;
            position: relative;
        }
        .ide-editor-gutter {
            padding: 4px 6px 4px 20px;
            text-align: right;
            color: rgba(255,255,255,0.3);
            user-select: none;
            background: rgba(0,0,0,0.2);
            min-width: 50px;
            font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
            font-size: 12px;
            line-height: 1.5;
            overflow-y: hidden;
            position: relative;
        }
        .ide-editor-gutter div {
            height: 1.5em;
            position: relative;
            padding-right: 4px;
        }
        .ide-editor-gutter div.active {
            color: rgba(255,255,255,0.8);
            background: rgba(255,255,255,0.05);
        }
        .ide-editor-main {
            flex: 1;
            display: flex;
            overflow: hidden;
            border-left: 1px solid var(--ide-border, #3c3c3c);
        }
        .ide-editor-content {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        .ide-editor-highlight {
            position: absolute;
            top: 0; left: 0; right: 0;
            padding: 4px 8px;
            font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre;
            pointer-events: none;
        }
        .ide-editor-textarea {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            padding: 4px 8px;
            font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre;
            background: transparent;
            color: transparent;
            caret-color: #fff;
            border: none;
            outline: none;
            resize: none;
            overflow: auto;
        }
        .ide-editor-line-highlight {
            position: absolute;
            left: 0; right: 0;
            height: 1.5em;
            background: rgba(255,255,255,0.04);
            pointer-events: none;
        }
        .ide-editor-statusbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 10px;
            font-size: 11px;
            color: rgba(255,255,255,0.5);
            background: rgba(0,0,0,0.2);
            border-radius: 0 0 8px 8px;
        }
        .ide-editor-statusbar button {
            padding: 2px 10px;
            border-radius: 3px;
            border: none;
            background: #0e639c;
            color: #fff;
            cursor: pointer;
            font-size: 11px;
        }
        .ide-editor-statusbar button:hover {
            background: #1177bb;
        }
    `;
}

/**
 * 获取调整大小手柄样式
 */
export function getResizeStyles() {
    return `
        .ide-resize-edge {
            position: absolute;
            z-index: 10;
        }
        .ide-resize-n { top: -3px; left: 8px; right: 8px; height: 6px; cursor: n-resize; }
        .ide-resize-s { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: s-resize; }
        .ide-resize-e { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: e-resize; }
        .ide-resize-w { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: w-resize; }
        .ide-resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: ne-resize; }
        .ide-resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nw-resize; }
        .ide-resize-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: se-resize; }
        .ide-resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: sw-resize; }
    `;
}

/**
 * 注入编辑器样式到页面
 */
export function injectEditorStyles(highlightStyles, foldingStyles) {
    if (document.getElementById('ide-editor-styles')) {
        return; // 已注入
    }
    
    const style = document.createElement('style');
    style.id = 'ide-editor-styles';
    style.textContent = highlightStyles + foldingStyles + getEditorStyles() + getResizeStyles();
    document.head.appendChild(style);
}
