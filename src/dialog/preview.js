/**
 * 预览对话框 - 变更确认（Side-by-Side Diff）
 * 
 * 编辑模式增强（参考调研文档）：
 * - Undo/Redo 栈（参考 Firefox devtools undo.js）
 * - Tab/Shift+Tab 缩进/反缩进
 * - 中文输入法兼容（compositionstart/end）
 * - 光标位置保存/恢复（zserge 方案）
 */

import { detectTheme } from '../shared/theme.js';
import { insertToInput } from '../gemini/input.js';
import { showToast } from '../shared/utils.js';
import { computeLineDiff, computeCharDiff, getChangeRatio, getDiffColors } from '../shared/diff.js';
import { UndoStack } from '../shared/undo.js';
import { getCaretPosition, setCaretPosition } from '../shared/caret.js';
import { CODE_FONT } from '../shared/code-style.js';
import { makeDraggable } from '../shared/draggable.js';



/**
* 渲染带字符级高亮的行
* @param {Array} charDiffs - 字符级差异数组
* @param {string} type - 'old' 或 'new'
* @param {Object} colors - 主题配色方案
* @param {string} fullText - 完整行文本（用于整行标记模式）
* @returns {HTMLElement} 渲染后的行元素
*/
function renderHighlightedLine(charDiffs, type, colors, fullText = '') {
    const span = document.createElement('span');
    
    // 如果变化超过 50%，整行标记而不是逐字符高亮
    const changeRatio = getChangeRatio(charDiffs);
    if (changeRatio > 0.5 && fullText) {
        span.textContent = fullText;
        span.style.color = type === 'old' ? colors.deleteText : colors.insertText;
        return span;
    }
    
    charDiffs.forEach(diff => {
        // 核心修复：左侧面板(old)只渲染 equal 和 delete；右侧面板(new)只渲染 equal 和 insert
        if (type === 'old' && diff.type === 'insert') return;
        if (type === 'new' && diff.type === 'delete') return;

        const part = document.createElement('span');
        part.textContent = diff.value;
        
        if (type === 'old' && diff.type === 'delete') {
            part.style.backgroundColor = colors.deleteCharBg;
            part.style.color = colors.deleteCharText;
            part.style.fontWeight = '700';
            part.style.padding = '0 1px';
            part.style.borderRadius = '2px';
        } else if (type === 'new' && diff.type === 'insert') {
            part.style.backgroundColor = colors.insertCharBg;
            part.style.color = colors.insertCharText;
            part.style.fontWeight = '700';
            part.style.padding = '0 1px';
            part.style.borderRadius = '2px';
        } else {
            part.style.color = type === 'old' ? colors.deleteText : colors.insertText;
            // 降低未变化字符的亮度，突出变化点
            part.style.opacity = colors.equalOpacity;
        }
        
        span.appendChild(part);
    });
    
    return span;
}

/**
 * 显示预览对话框
 * @param {string} file - 文件路径
 * @param {string} oldText - SEARCH 块内容
 * @param {string} newText - REPLACE 块内容
 * @param {number} startLine - 匹配位置的起始行号
 * @param {string} syntaxError - 可选的语法错误信息
 * @returns {Promise<{confirmed: boolean, content?: string}>} 确认状态和编辑后的内容
 */
export function showPreviewDialog(file, oldText, newText, startLine = 1, syntaxError = null) {
    return new Promise((resolve) => {
        // 用于追踪用户编辑后的内容
        let editedContent = newText;
        
        // Undo/Redo 栈（编辑模式用）
        const undoStack = new UndoStack();
        undoStack.push({ content: newText, cursor: 0 });
        
        // 更新 Undo/Redo 按钮状态的函数（稍后绑定）
        let updateUndoButtons = () => {};
        
        const backdrop = document.createElement('div');
        backdrop.id = 'ide-modal-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0', 
            background: 'rgba(0, 0, 0, 0.6)', 
            backdropFilter: 'blur(4px)',
            zIndex: '2147483600',
            animation: 'ideFadeIn 0.2s ease-out'
        });

        const dialog = document.createElement('div');
        dialog.id = 'ide-preview-dialog';
        Object.assign(dialog.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--ide-bg)', 
            color: 'var(--ide-text)',
            border: '1px solid var(--ide-border)',
            borderRadius: '12px', 
            zIndex: '2147483601',
            width: '90vw', maxWidth: '1400px', height: '85vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            animation: 'ideScaleIn 0.2s ease-out',
            overflow: 'hidden'  // 防止内容溢出
        });

        // 头部（固定高度）
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 20px',
            borderBottom: '1px solid var(--ide-border)',
            flexShrink: '0',  // 不压缩
            cursor: 'move'    // 拖拽光标
        });
        
        const titleGroup = document.createElement('div');
        const titleIcon = document.createElement('span');
        titleIcon.textContent = syntaxError ? '⚠️' : '📝';
        titleIcon.style.marginRight = '8px';
        const titleText = document.createElement('span');
        titleText.textContent = `${syntaxError ? '强制预览' : '变更预览'}: ${file}`;
        titleText.style.fontSize = '18px';
        titleText.style.fontWeight = '600';
        
        titleGroup.appendChild(titleIcon);
        titleGroup.appendChild(titleText);
        
        // 模式切换按钮组
        const modeGroup = document.createElement('div');
        Object.assign(modeGroup.style, { display: 'flex', gap: '8px', alignItems: 'center' });
        
        const diffModeBtn = document.createElement('button');
        diffModeBtn.textContent = '📊 Diff';
        const editModeBtn = document.createElement('button');
        editModeBtn.textContent = '✏️ 编辑';
        
        [diffModeBtn, editModeBtn].forEach(btn => {
            Object.assign(btn.style, {
                padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                border: '1px solid var(--ide-border)', fontSize: '12px'
            });
        });
        // 默认 diff 模式激活
        diffModeBtn.style.background = 'var(--ide-accent)';
        diffModeBtn.style.color = '#fff';
        editModeBtn.style.background = 'transparent';
        editModeBtn.style.color = 'var(--ide-text)';
        
        // Undo/Redo 按钮（编辑模式可用）
        const undoBtn = document.createElement('button');
        undoBtn.textContent = '↩️';
        undoBtn.title = 'Ctrl+Z 撤销';
        const redoBtn = document.createElement('button');
        redoBtn.textContent = '↪️';
        redoBtn.title = 'Ctrl+Y 重做';
        
        [undoBtn, redoBtn].forEach(btn => {
            Object.assign(btn.style, {
                padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                border: '1px solid var(--ide-border)', fontSize: '12px',
                background: 'transparent', color: 'var(--ide-text)',
                opacity: '0.4', display: 'none'  // 默认隐藏，编辑模式显示
            });
        });
        
        // 更新 Undo/Redo 按钮状态
        updateUndoButtons = () => {
            undoBtn.style.opacity = undoStack.canUndo() ? '1' : '0.4';
            redoBtn.style.opacity = undoStack.canRedo() ? '1' : '0.4';
        };
        
        // 字体缩放按钮
        const fontSmallBtn = document.createElement('button');
        fontSmallBtn.textContent = 'A-';
        fontSmallBtn.title = '缩小字体';
        const fontLargeBtn = document.createElement('button');
        fontLargeBtn.textContent = 'A+';
        fontLargeBtn.title = '放大字体';
        
        [fontSmallBtn, fontLargeBtn].forEach(btn => {
            Object.assign(btn.style, {
                padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                border: '1px solid var(--ide-border)', fontSize: '10px',
                background: 'transparent', color: 'var(--ide-text)'
            });
        });
        
        // 当前字体大小（从 CODE_FONT 获取默认值）
        let currentFontSize = parseInt(CODE_FONT.size);
        const minFontSize = 12, maxFontSize = 20;
        
        // 更新所有代码区域的字体大小
        const updateFontSize = () => {
            const codeContainers = dialog.querySelectorAll('[style*="monospace"]');
            codeContainers.forEach(el => {
                el.style.fontSize = `${currentFontSize}px`;
            });
        };
        
        fontSmallBtn.onclick = () => {
            if (currentFontSize > minFontSize) {
                currentFontSize--;
                updateFontSize();
            }
        };
        fontLargeBtn.onclick = () => {
            if (currentFontSize < maxFontSize) {
                currentFontSize++;
                updateFontSize();
            }
        };
        
        modeGroup.appendChild(diffModeBtn);
        modeGroup.appendChild(editModeBtn);
        modeGroup.appendChild(undoBtn);
        modeGroup.appendChild(redoBtn);
        modeGroup.appendChild(fontSmallBtn);
        modeGroup.appendChild(fontLargeBtn);
        
        header.appendChild(titleGroup);
        header.appendChild(modeGroup);
        dialog.appendChild(header);
        
        // 当前模式
        let currentMode = 'diff';

        // 语法警告横幅
        if (syntaxError) {
            const warningBanner = document.createElement('div');
            Object.assign(warningBanner.style, {
                padding: '12px 16px', marginBottom: '16px',
                background: 'rgba(220, 38, 38, 0.15)',
                border: '1px solid #dc2626', borderRadius: '8px',
                color: '#ef4444', fontSize: '13px'
            });
            
            const strongEl = document.createElement('strong');
            strongEl.textContent = '🚨 语法校验警告：';
            warningBanner.appendChild(strongEl);
            
            const errorText = document.createTextNode(syntaxError);
            warningBanner.appendChild(errorText);
            
            warningBanner.appendChild(document.createElement('br'));
            
            const hintSpan = document.createElement('span');
            hintSpan.style.color = 'var(--ide-text-secondary)';
            hintSpan.style.fontSize = '12px';
            hintSpan.textContent = '请仔细核对代码完整性后再确认应用。';
            warningBanner.appendChild(hintSpan);
            
            dialog.appendChild(warningBanner);
        }

        // Diff 内容区（Side-by-Side，填充中间区域）
        const diffBody = document.createElement('div');
        Object.assign(diffBody.style, {
            flex: '1', display: 'flex', gap: '0', 
            overflow: 'hidden', minHeight: '0',
            margin: '0 20px',
            border: '1px solid var(--ide-border)',
            borderRadius: '8px'
        });

        // 获取主题配色
        const colors = getDiffColors(detectTheme());

        // 创建左右两个面板
        const createSidePanel = (side, mode) => {
            const panel = document.createElement('div');
            Object.assign(panel.style, {
                flex: '1', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', background: 'var(--ide-hint-bg)',
                borderRight: side === 'left' ? '1px solid var(--ide-border)' : 'none'
            });

            // 面板头部 - 根据模式显示不同文字
            const panelHeader = document.createElement('div');
            if (mode === 'diff') {
                panelHeader.textContent = side === 'left' 
                    ? '🔴 原始代码 (SEARCH)' 
                    : '🟢 修改后代码 (REPLACE)';
            } else {
                panelHeader.textContent = side === 'left' 
                    ? '🔴 原始代码 (只读)' 
                    : '🟢 修改后代码 (可编辑) ✏️';
            }
            Object.assign(panelHeader.style, {
                padding: '10px 16px', fontSize: '12px', fontWeight: 'bold',
                background: side === 'left' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                color: side === 'left' ? '#ef4444' : '#22c55e',
                borderBottom: '1px solid var(--ide-border)'
            });

            // 代码容器
            const codeContainer = document.createElement('div');
            Object.assign(codeContainer.style, {
                flex: '1', display: 'flex', overflow: 'auto',
                fontFamily: CODE_FONT.family,
                fontSize: CODE_FONT.size,
                lineHeight: CODE_FONT.lineHeight
            });

            // 行号列
            const lineNumbers = document.createElement('div');
            Object.assign(lineNumbers.style, {
                padding: '16px 12px 16px 16px',
                textAlign: 'right',
                color: 'var(--ide-text-secondary)',
                userSelect: 'none',
                borderRight: '1px solid var(--ide-border)',
                background: 'rgba(0, 0, 0, 0.1)',
                minWidth: '50px'
            });

            // 代码列
            const codeArea = document.createElement('div');
            Object.assign(codeArea.style, {
                flex: '1', padding: '16px',
                overflow: 'visible', color: 'var(--ide-text)',
                whiteSpace: 'pre'
            });
            
            // 编辑模式下右侧面板可编辑（增强版）
            if (mode === 'edit' && side === 'right') {
                codeArea.contentEditable = 'plaintext-only';
                codeArea.style.outline = 'none';
                codeArea.style.cursor = 'text';
                codeArea.style.minHeight = '100%';
                
                // 中文输入法状态
                let isComposing = false;
                
                // 保存状态到 undo 栈（防抖）
                let saveTimeout = null;
                const saveState = () => {
                    if (saveTimeout) clearTimeout(saveTimeout);
                    saveTimeout = setTimeout(() => {
                        const cursor = getCaretPosition(codeArea);
                        undoStack.push({ content: codeArea.textContent, cursor });
                        updateUndoButtons();
                    }, 300);
                };
                
                // 中文输入法兼容
                codeArea.addEventListener('compositionstart', () => { isComposing = true; });
                codeArea.addEventListener('compositionend', () => { 
                    isComposing = false; 
                    saveState();
                    editedContent = codeArea.textContent;
                    updateLineNumbers(lineNumbers, editedContent, startLine);
                });
                
                // 监听编辑
                codeArea.addEventListener('input', () => {
                    if (!isComposing) {
                        saveState();
                        editedContent = codeArea.textContent;
                        updateLineNumbers(lineNumbers, editedContent, startLine);
                    }
                });
                
                // 键盘事件：Tab/Shift+Tab/Ctrl+Z/Ctrl+Y
                codeArea.addEventListener('keydown', (e) => {
                    // Tab 键插入空格
                    if (e.key === 'Tab' && !e.shiftKey) {
                        e.preventDefault();
                        if (window.getSelection().toString().includes('\n')) return; // 防误触：跨行选中不处理，避免选中内容被替换
                        document.execCommand('insertText', false, '    ');
                    }
                    // Shift+Tab 反缩进（删除行首 4 空格）
                    if (e.key === 'Tab' && e.shiftKey) {
                        e.preventDefault();
                        // 简单实现：删除光标前的空格
                        const sel = window.getSelection();
                        if (sel.toString().includes('\n')) return; // 防误触：跨行选中不处理
                        if (sel.rangeCount) {
                            const range = sel.getRangeAt(0);
                            const text = codeArea.textContent;
                            const pos = getCaretPosition(codeArea);
                            // 找到当前行开头
                            let lineStart = text.lastIndexOf('\n', pos - 1) + 1;
                            // 检查行首是否有空格
                            if (text.substring(lineStart, lineStart + 4) === '    ') {
                                codeArea.textContent = text.substring(0, lineStart) + text.substring(lineStart + 4);
                                setCaretPosition(codeArea, Math.max(lineStart, pos - 4));
                                editedContent = codeArea.textContent;
                                updateLineNumbers(lineNumbers, editedContent, startLine);
                                saveState();
                            }
                        }
                    }
                    // Ctrl+Z 撤销
                    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        const state = undoStack.undo();
                        if (state) {
                            codeArea.textContent = state.content;
                            setCaretPosition(codeArea, state.cursor);
                            editedContent = state.content;
                            updateLineNumbers(lineNumbers, editedContent, startLine);
                            updateUndoButtons();
                        }
                    }
                    // Ctrl+Y 或 Ctrl+Shift+Z 重做
                    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
                        e.preventDefault();
                        const state = undoStack.redo();
                        if (state) {
                            codeArea.textContent = state.content;
                            setCaretPosition(codeArea, state.cursor);
                            editedContent = state.content;
                            updateLineNumbers(lineNumbers, editedContent, startLine);
                            updateUndoButtons();
                        }
                    }
                });
            }

            panel.appendChild(panelHeader);
            codeContainer.appendChild(lineNumbers);
            codeContainer.appendChild(codeArea);
            panel.appendChild(codeContainer);
            
            // 选中文本悬浮按钮
            const floatingBtn = document.createElement('button');
            floatingBtn.textContent = '✨ 询问 AI';
            Object.assign(floatingBtn.style, {
                position: 'absolute',
                padding: '4px 10px',
                borderRadius: '4px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'none',
                zIndex: '10'
            });
            panel.style.position = 'relative';
            panel.appendChild(floatingBtn);
            
            // 监听选中文本
            let hideTimeout = null;
            codeContainer.addEventListener('mouseup', () => {
                clearTimeout(hideTimeout);
                const sel = window.getSelection();
                const selectedText = sel.toString().trim();
                
                if (selectedText.length > 0) {
                    // 获取选区位置
                    const range = sel.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    const panelRect = panel.getBoundingClientRect();
                    
                    // 定位按钮到选区上方
                    floatingBtn.style.display = 'block';
                    floatingBtn.style.left = `${rect.left - panelRect.left + rect.width / 2 - 40}px`;
                    floatingBtn.style.top = `${rect.top - panelRect.top - 30}px`;
                    
                    // 点击发送选中内容
                    floatingBtn.onclick = (e) => {
                        e.stopPropagation();
                        const prompt = `📄 文件: \`${file}\`

**选中的代码片段:**
\`\`\`
${selectedText}
\`\`\`

请帮我分析这段代码。`;
                        
                        const result = insertToInput(prompt);
                        if (result.success) {
                            showToast('已发送到 Gemini');
                            floatingBtn.style.display = 'none';
                        }
                    };
                } else {
                    floatingBtn.style.display = 'none';
                }
            });
            
            // 点击其他地方隐藏按钮（延迟，避免点击按钮时被隐藏）
            codeContainer.addEventListener('mousedown', () => {
                hideTimeout = setTimeout(() => {
                    floatingBtn.style.display = 'none';
                }, 200);
            });

            return { panel, lineNumbers, codeArea };
        };
        
        // 更新行号的辅助函数
        const updateLineNumbers = (lineNumbersEl, content, baseLineNum) => {
            const lines = content.split('\n');
            // 现代 API：极速清空并批量插入节点，避免大量 removeChild 的重排
            lineNumbersEl.replaceChildren();
            const fragment = document.createDocumentFragment();
            lines.forEach((_, idx) => {
                const lineDiv = document.createElement('div');
                lineDiv.textContent = String(baseLineNum + idx);
                fragment.appendChild(lineDiv);
            });
            lineNumbersEl.appendChild(fragment);
        };

        // 渲染内容的函数
        const renderContent = (mode) => {
            // 动态计算行级差异：以 editedContent 为新内容，保证编辑后切回 Diff 模式时显示最新对比
            const oldLines = oldText.split('\n');
            const newLines = editedContent.split('\n');
            const lineDiffs = computeLineDiff(oldLines, newLines);

            // 清空 diffBody
            diffBody.replaceChildren();
            
            const leftPanel = createSidePanel('left', mode);
            const rightPanel = createSidePanel('right', mode);
            
            if (mode === 'diff') {
                // Diff 模式：左右都渲染 diff 高亮
                let leftLineNum = startLine;
                let rightLineNum = startLine;
                let lastWasInsert = false;  
                let lastWasDelete = false;  

                // 使用 DocumentFragment 批量挂载，减少大文件渲染时的 DOM 重排
                const leftLineFrag = document.createDocumentFragment();
                const rightLineFrag = document.createDocumentFragment();
                const leftCodeFrag = document.createDocumentFragment();
                const rightCodeFrag = document.createDocumentFragment();

                lineDiffs.forEach(diff => {
                    const leftLineDiv = document.createElement('div');
                    const rightLineDiv = document.createElement('div');
                    const leftCodeDiv = document.createElement('div');
                    const rightCodeDiv = document.createElement('div');

                    if (diff.type === 'equal') {
                        leftLineDiv.textContent = String(leftLineNum++);
                        rightLineDiv.textContent = String(rightLineNum++);
                        leftCodeDiv.textContent = diff.oldLine;
                        rightCodeDiv.textContent = diff.newLine;
                        leftCodeDiv.style.opacity = colors.equalOpacity;
                        rightCodeDiv.style.opacity = colors.equalOpacity;
                        lastWasInsert = false;
                        lastWasDelete = false;
                    } else if (diff.type === 'delete') {
                        // 左边正常显示删除行
                        leftLineDiv.textContent = String(leftLineNum++);
                        leftCodeDiv.textContent = diff.oldLine;
                        leftCodeDiv.style.backgroundColor = colors.deleteBg;
                        leftCodeDiv.style.color = colors.deleteText;
                        
                        // 右边：连续 delete 只显示一行空白占位
                        if (!lastWasDelete) {
                            rightLineDiv.textContent = '...';
                            rightLineDiv.style.color = 'var(--ide-text-secondary)';
                            rightLineDiv.style.fontSize = '10px';
                            rightCodeDiv.textContent = '// ↑ 删除内容';
                            rightCodeDiv.style.color = 'var(--ide-text-secondary)';
                            rightCodeDiv.style.fontStyle = 'italic';
                            rightCodeDiv.style.backgroundColor = colors.emptyBg;
                        } else {
                            // 连续 delete，右边占位以保证物理高度绝对对齐，避免行错位 Bug
                            rightLineDiv.textContent = '\u00A0'; // 不换行空格，防止空白折叠指高塔陌
                            rightCodeDiv.textContent = '\u00A0';
                            rightLineDiv.style.visibility = 'hidden';
                            rightCodeDiv.style.visibility = 'hidden';
                        }
                        lastWasDelete = true;
                        lastWasInsert = false;
                    } else if (diff.type === 'insert') {
                        // 右边正常显示新增行
                        rightLineDiv.textContent = String(rightLineNum++);
                        rightCodeDiv.textContent = diff.newLine;
                        rightCodeDiv.style.backgroundColor = colors.insertBg;
                        rightCodeDiv.style.color = colors.insertText;
                        
                        // 左边：连续 insert 只显示一行空白占位
                        if (!lastWasInsert) {
                            leftLineDiv.textContent = '...';
                            leftLineDiv.style.color = 'var(--ide-text-secondary)';
                            leftLineDiv.style.fontSize = '10px';
                            leftCodeDiv.textContent = '// ↓ 新增内容';
                            leftCodeDiv.style.color = 'var(--ide-text-secondary)';
                            leftCodeDiv.style.fontStyle = 'italic';
                            leftCodeDiv.style.backgroundColor = colors.emptyBg;
                        } else {
                            // 连续 insert，左边占位以保证物理高度绝对对齐，避免行错位 Bug
                            leftLineDiv.textContent = '\u00A0'; // 不换行空格，防止空白折叠指高塔陌
                            leftCodeDiv.textContent = '\u00A0';
                            leftLineDiv.style.visibility = 'hidden';
                            leftCodeDiv.style.visibility = 'hidden';
                        }
                        lastWasInsert = true;
                        lastWasDelete = false;
                    } else if (diff.type === 'modify') {
                        leftLineDiv.textContent = String(leftLineNum++);
                        rightLineDiv.textContent = String(rightLineNum++);
                        const charDiffs = computeCharDiff(diff.oldLine, diff.newLine);
                        leftCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'old', colors, diff.oldLine));
                        rightCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'new', colors, diff.newLine));
                        leftCodeDiv.style.backgroundColor = colors.deleteBg;
                        rightCodeDiv.style.backgroundColor = colors.insertBg;
                        lastWasInsert = false;
                        lastWasDelete = false;
                    }

                    leftLineFrag.appendChild(leftLineDiv);
                    leftCodeFrag.appendChild(leftCodeDiv);
                    rightLineFrag.appendChild(rightLineDiv);
                    rightCodeFrag.appendChild(rightCodeDiv);
                });

                // 一次性挂载所有行，避免频繁触发重排
                leftPanel.lineNumbers.appendChild(leftLineFrag);
                leftPanel.codeArea.appendChild(leftCodeFrag);
                rightPanel.lineNumbers.appendChild(rightLineFrag);
                rightPanel.codeArea.appendChild(rightCodeFrag);
            } else {
                // 编辑模式：左侧保持 diff 高亮，右侧可编辑
                let leftLineNum = startLine;
                let lastWasInsert = false;

                // 使用 DocumentFragment 批量挂载
                const leftLineFrag = document.createDocumentFragment();
                const leftCodeFrag = document.createDocumentFragment();

                lineDiffs.forEach(diff => {
                    const leftLineDiv = document.createElement('div');
                    const leftCodeDiv = document.createElement('div');

                    if (diff.type === 'equal') {
                        leftLineDiv.textContent = String(leftLineNum++);
                        leftCodeDiv.textContent = diff.oldLine;
                        leftCodeDiv.style.opacity = colors.equalOpacity;
                        lastWasInsert = false;
                    } else if (diff.type === 'delete') {
                        leftLineDiv.textContent = String(leftLineNum++);
                        leftCodeDiv.textContent = diff.oldLine;
                        leftCodeDiv.style.backgroundColor = colors.deleteBg;
                        leftCodeDiv.style.color = colors.deleteText;
                        lastWasInsert = false;
                    } else if (diff.type === 'insert') {
                        // 连续 insert 只显示一行提示
                        if (!lastWasInsert) {
                            leftLineDiv.textContent = '...';
                            leftLineDiv.style.color = 'var(--ide-text-secondary)';
                            leftLineDiv.style.fontSize = '10px';
                            leftCodeDiv.textContent = '// ↓ 新增内容';
                            leftCodeDiv.style.color = 'var(--ide-text-secondary)';
                            leftCodeDiv.style.fontStyle = 'italic';
                            leftCodeDiv.style.backgroundColor = colors.emptyBg;
                        } else {
                            // 连续 insert，左侧占位以保证行高一致
                            leftLineDiv.textContent = '\u00A0'; // 不换行空格，防止空白折叠指高塔陌
                            leftCodeDiv.textContent = '\u00A0';
                            leftLineDiv.style.visibility = 'hidden';
                            leftCodeDiv.style.visibility = 'hidden';
                        }
                        lastWasInsert = true;
                    } else if (diff.type === 'modify') {
                        leftLineDiv.textContent = String(leftLineNum++);
                        const charDiffs = computeCharDiff(diff.oldLine, diff.newLine);
                        leftCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'old', colors, diff.oldLine));
                        leftCodeDiv.style.backgroundColor = colors.deleteBg;
                        lastWasInsert = false;
                    }

                    leftLineFrag.appendChild(leftLineDiv);
                    leftCodeFrag.appendChild(leftCodeDiv);
                });

                // 一次性挂载
                leftPanel.lineNumbers.appendChild(leftLineFrag);
                leftPanel.codeArea.appendChild(leftCodeFrag);
                
                // 右侧可编辑
                rightPanel.codeArea.textContent = editedContent;
                updateLineNumbers(rightPanel.lineNumbers, editedContent, startLine);
            }
            
            diffBody.appendChild(leftPanel.panel);
            diffBody.appendChild(rightPanel.panel);
        };
        
        // 模式切换逻辑
        const switchMode = (mode) => {
            currentMode = mode;
            // 更新按钮样式
            if (mode === 'diff') {
                diffModeBtn.style.background = 'var(--ide-accent)';
                diffModeBtn.style.color = '#fff';
                editModeBtn.style.background = 'transparent';
                editModeBtn.style.color = 'var(--ide-text)';
                // 隐藏 Undo/Redo 按钮
                undoBtn.style.display = 'none';
                redoBtn.style.display = 'none';
            } else {
                diffModeBtn.style.background = 'transparent';
                diffModeBtn.style.color = 'var(--ide-text)';
                editModeBtn.style.background = 'var(--ide-accent)';
                editModeBtn.style.color = '#fff';
                // 显示 Undo/Redo 按钮
                undoBtn.style.display = 'block';
                redoBtn.style.display = 'block';
                updateUndoButtons();
            }
            renderContent(mode);
        };
        
        diffModeBtn.onclick = () => switchMode('diff');
        editModeBtn.onclick = () => switchMode('edit');
        
        // 初始渲染 diff 模式
        renderContent('diff');

        // 底部按钮（固定高度）
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '12px',
            padding: '12px 20px',
            borderTop: '1px solid var(--ide-border)',
            flexShrink: '0'  // 不压缩
        });

        const closeAll = () => { backdrop.remove(); dialog.remove(); };

        // 询问 AI 按钮
        const askAiBtn = document.createElement('button');
        askAiBtn.textContent = '✨ 询问 AI';
        Object.assign(askAiBtn.style, {
            padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff', border: 'none', fontSize: '14px',
            marginRight: 'auto'  // 推到左边
        });
        askAiBtn.onclick = () => {
            const prompt = `📄 文件: \`${file}\`
第 ${startLine} 行开始

**原始代码 (SEARCH):**
\`\`\`
${oldText}
\`\`\`

**修改后代码 (REPLACE):**
\`\`\`
${editedContent}
\`\`\`

请分析这个代码变更：
1. 这段修改做了什么？
2. 有没有潜在问题？
3. 有没有更好的写法？`;
            
            const result = insertToInput(prompt);
            if (result.success) {
                showToast('已发送到 Gemini');
            }
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
        cancelBtn.onclick = () => { closeAll(); resolve({ confirmed: false }); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确认应用修改';
        Object.assign(confirmBtn.style, {
            padding: '8px 24px', borderRadius: '6px', cursor: 'pointer',
            background: 'var(--ide-accent)', color: '#fff', 
            border: 'none', fontSize: '14px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
        });
        confirmBtn.onclick = () => { 
            closeAll(); 
            resolve({ confirmed: true, content: editedContent }); 
        };

        footer.appendChild(askAiBtn);
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        dialog.appendChild(diffBody);
        dialog.appendChild(footer);

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
        
        // 使对话框可拖拽和调整大小
        const cleanupDraggable = makeDraggable(dialog, header, {
            dialogId: 'preview',
            minWidth: 600,
            minHeight: 400
        });
        
        // 修改 closeAll 以清理事件监听
        const originalCloseAll = closeAll;
        const closeAllWithCleanup = () => {
            cleanupDraggable();
            originalCloseAll();
        };
        
        // 点击背景关闭
        backdrop.onclick = () => { closeAllWithCleanup(); resolve({ confirmed: false }); };
        
        // 更新按钮的 onclick
        cancelBtn.onclick = () => { closeAllWithCleanup(); resolve({ confirmed: false }); };
        confirmBtn.onclick = () => { closeAllWithCleanup(); resolve({ confirmed: true, content: editedContent }); };
    });
}
