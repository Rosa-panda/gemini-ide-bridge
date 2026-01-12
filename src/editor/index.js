/**
 * 编辑器主模块 - 组装各组件
 */

import { fs } from '../core/fs.js';
import { showToast } from '../shared/utils.js';
import { UndoStack, getLineCol } from './core.js';
import { highlightToDOM, detectLanguage, getHighlightStyles } from './highlight.js';
import { createMinimap } from './minimap.js';
import { createFoldingManager, getFoldingStyles } from './folding.js';
import { injectEditorStyles } from './styles.js';
import { insertToInput } from '../gemini/input.js';

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
    const language = detectLanguage(fileName);
    
    // 状态
    const undoStack = new UndoStack();
    undoStack.push({ content, cursor: 0 });
    const foldingManager = createFoldingManager();
    let isComposing = false;
    let isDragging = false;
    let resizeEdge = null; // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
    let dragOffset = { x: 0, y: 0 };
    let resizeStart = { x: 0, y: 0, w: 0, h: 0, top: 0, left: 0 };
    
    // === 注入样式 ===
    injectEditorStyles(getHighlightStyles(), getFoldingStyles());
    
    // === 创建 UI ===
    const backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
        position: 'fixed', inset: '0',
        background: 'rgba(0, 0, 0, 0.3)',
        zIndex: '2147483648',
    });
    
    const win = document.createElement('div');
    win.className = 'ide-editor-window';
    Object.assign(win.style, {
        top: '8%', left: '15%',
        width: '70%', height: '84%',
    });
    
    // 四边调整大小手柄
    const edges = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    edges.forEach(edge => {
        const handle = document.createElement('div');
        handle.className = `ide-resize-edge ide-resize-${edge}`;
        handle.dataset.edge = edge;
        win.appendChild(handle);
    });
    
    // 标题栏
    const titlebar = document.createElement('div');
    titlebar.className = 'ide-editor-titlebar';
    
    const title = document.createElement('div');
    title.className = 'ide-editor-title';
    const titleIcon = document.createElement('span');
    titleIcon.textContent = '📄';
    const titleName = document.createElement('span');
    titleName.textContent = fileName;
    const titlePath = document.createElement('span');
    titlePath.className = 'ide-editor-title-path';
    titlePath.textContent = filePath;
    title.append(titleIcon, titleName, titlePath);
    
    const controls = document.createElement('div');
    controls.className = 'ide-editor-controls';
    
    const undoBtn = document.createElement('button');
    undoBtn.textContent = '↩';
    undoBtn.title = 'Ctrl+Z 撤销';
    
    const redoBtn = document.createElement('button');
    redoBtn.textContent = '↪';
    redoBtn.title = 'Ctrl+Y 重做';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'ESC 关闭';
    closeBtn.style.color = '#f48771';
    
    controls.append(undoBtn, redoBtn, closeBtn);
    titlebar.append(title, controls);
    
    // 编辑区域
    const body = document.createElement('div');
    body.className = 'ide-editor-body';
    
    // 行号
    const gutter = document.createElement('div');
    gutter.className = 'ide-editor-gutter';
    
    // 主编辑区（包含内容和小地图）
    const main = document.createElement('div');
    main.className = 'ide-editor-main';
    
    // 内容区
    const contentArea = document.createElement('div');
    contentArea.className = 'ide-editor-content';
    
    // 当前行高亮
    const lineHighlight = document.createElement('div');
    lineHighlight.className = 'ide-editor-line-highlight';
    
    // 语法高亮层
    const highlightLayer = document.createElement('div');
    highlightLayer.className = 'ide-editor-highlight';
    
    // 实际输入的 textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'ide-editor-textarea';
    textarea.value = content;
    textarea.spellcheck = false;
    
    contentArea.append(lineHighlight, highlightLayer, textarea);
    main.appendChild(contentArea);
    
    // 小地图
    const minimap = createMinimap(main, {
        width: 100,
        onSeek: (scrollRatio) => {
            // scrollRatio 是滚动比例（0-1），对应 scrollTop 在 0 到 maxScroll 之间的位置
            const maxScroll = textarea.scrollHeight - textarea.clientHeight;
            textarea.scrollTop = scrollRatio * maxScroll;
        }
    });
    
    body.append(gutter, main);
    
    // 状态栏
    const statusbar = document.createElement('div');
    statusbar.className = 'ide-editor-statusbar';
    
    const statusLeft = document.createElement('span');
    statusLeft.textContent = 'Ln 1, Col 1';
    
    const statusRight = document.createElement('div');
    statusRight.style.cssText = 'display:flex;gap:10px;align-items:center';
    
    const langLabel = document.createElement('span');
    langLabel.textContent = language.toUpperCase();
    
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 保存';
    
    statusRight.append(langLabel, saveBtn);
    statusbar.append(statusLeft, statusRight);
    
    win.append(titlebar, body, statusbar);
    
    // === 功能实现 ===
    let currentLine = 1;
    
    // 初始化折叠
    foldingManager.update(content, language);
    
    // 更新行号（带折叠图标）
    const updateGutter = () => {
        const lines = textarea.value.split('\n');
        const ranges = foldingManager.getRanges();
        const rangeStarts = new Map(ranges.map(r => [r.startLine, r]));
        
        while (gutter.firstChild) gutter.removeChild(gutter.firstChild);
        
        let visibleLineIndex = 0;
        lines.forEach((_, i) => {
            const lineNum = i + 1;
            
            // 检查是否被折叠隐藏
            if (foldingManager.isLineHidden(i)) {
                return; // 跳过隐藏的行，不创建 DOM 元素
            }
            
            const div = document.createElement('div');
            
            // 检查是否是折叠区域起始行
            const range = rangeStarts.get(i);
            if (range) {
                const foldIcon = document.createElement('span');
                foldIcon.className = 'ide-fold-icon' + (range.collapsed ? ' collapsed' : '');
                foldIcon.textContent = range.collapsed ? '▶' : '▼';
                foldIcon.onclick = (e) => {
                    e.stopPropagation();
                    foldingManager.toggle(i);
                    foldingManager.clearCache(); // 强制重新计算
                    updateGutter();
                    updateHighlight();
                    syncScroll();
                };
                div.appendChild(foldIcon);
            }
            
            const numSpan = document.createElement('span');
            numSpan.textContent = String(lineNum);
            div.appendChild(numSpan);
            
            if (lineNum === currentLine) div.classList.add('active');
            gutter.appendChild(div);
            visibleLineIndex++;
        });
    };
    
    // 更新高亮（DOM 方式，绕过 Trusted Types）
    const updateHighlight = () => {
        while (highlightLayer.firstChild) highlightLayer.removeChild(highlightLayer.firstChild);
        
        const lines = textarea.value.split('\n');
        const ranges = foldingManager.getRanges();
        const collapsedStarts = new Map(
            ranges.filter(r => r.collapsed).map(r => [r.startLine, r])
        );
        
        // 构建可见代码，处理折叠
        // 核心修正：
        // 1. 如果有折叠，我们只渲染可见部分到高亮层
        // 2. 注意：Textarea 依然保持全文（这是光标错位的根源，但为了数据安全暂时保留）
        // 3. 增加占位符样式
        
        const visibleLines = [];
        for (let i = 0; i < lines.length; i++) {
            if (foldingManager.isLineHidden(i)) {
                continue;
            }
            
            let line = lines[i];
            const collapsedRange = collapsedStarts.get(i);
            
            // 构建高亮 DOM
            if (collapsedRange) {
                const hiddenCount = collapsedRange.endLine - collapsedRange.startLine;
                // 使用特殊的占位符，并在 highlight.js 中处理（或直接作为文本显示）
                line = line.trimEnd() + ` ... ⟪ ${hiddenCount} lines ⟫`;
            }
            visibleLines.push(line);
        }
        
        // 渲染可见部分
        const visibleCode = visibleLines.join('\n');
        highlightToDOM(visibleCode, language, highlightLayer);
        
        // 更新折叠区域（但不清除缓存，避免循环）
        foldingManager.update(textarea.value, language);
        minimap.update(textarea.value);
    };
    
    // 更新当前行高亮
    const updateLineHighlight = () => {
        const pos = textarea.selectionStart;
        const { line } = getLineCol(textarea.value, pos);
        currentLine = line;
        const lineHeight = 18; // 12px * 1.5
        lineHighlight.style.top = `${4 + (line - 1) * lineHeight}px`;
        
        // 更新行号高亮
        const gutterDivs = gutter.children;
        for (let i = 0; i < gutterDivs.length; i++) {
            gutterDivs[i].className = (i + 1 === line) ? 'active' : '';
        }
    };
    
    // 更新状态栏
    const updateStatus = () => {
        const pos = textarea.selectionStart;
        const { line, col } = getLineCol(textarea.value, pos);
        const stats = foldingManager.getStats();
        
        let statusText = `Ln ${line}, Col ${col}`;
        if (stats.collapsedCount > 0) {
            statusText += ` | 折叠: ${stats.collapsedCount} 区域, ${stats.hiddenLines} 行`;
        }
        statusLeft.textContent = statusText;
    };
    
    // 更新按钮状态
    const updateButtons = () => {
        undoBtn.style.opacity = undoStack.canUndo() ? '1' : '0.3';
        redoBtn.style.opacity = undoStack.canRedo() ? '1' : '0.3';
    };
    
    // 同步滚动
    const syncScroll = () => {
        gutter.scrollTop = textarea.scrollTop;
        highlightLayer.style.transform = `translateY(${-textarea.scrollTop}px)`;
        lineHighlight.style.transform = `translateY(${-textarea.scrollTop}px)`;
        minimap.updateViewport(textarea.scrollTop, textarea.clientHeight, textarea.scrollHeight);
    };
    
    // 撤销/重做
    const doUndo = () => {
        const state = undoStack.undo();
        if (state) {
            textarea.value = state.content;
            textarea.selectionStart = textarea.selectionEnd = state.cursor;
            updateAll();
        }
    };
    
    const doRedo = () => {
        const state = undoStack.redo();
        if (state) {
            textarea.value = state.content;
            textarea.selectionStart = textarea.selectionEnd = state.cursor;
            updateAll();
        }
    };
    
    // 保存状态（防抖）
    let saveTimeout = null;
    const saveState = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            undoStack.push({ content: textarea.value, cursor: textarea.selectionStart });
            updateButtons();
        }, 300);
    };
    
    // 全部更新
    const updateAll = () => {
        updateGutter();
        updateHighlight();
        updateLineHighlight();
        updateStatus();
        updateButtons();
        syncScroll();
    };
    
    // 关闭
    const closeAll = () => {
        document.removeEventListener('keydown', handleGlobalKey);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (floatingBtn) floatingBtn.remove();
        backdrop.remove();
        win.remove();
    };
    
    // === 事件绑定 ===
    
    textarea.addEventListener('input', () => {
        if (!isComposing) {
            saveState();
            updateGutter();
            updateHighlight();
        }
    });
    
    textarea.addEventListener('scroll', syncScroll);
    textarea.addEventListener('click', () => { updateLineHighlight(); updateStatus(); });
    textarea.addEventListener('keyup', () => { updateLineHighlight(); updateStatus(); });
    
    textarea.addEventListener('compositionstart', () => { isComposing = true; });
    textarea.addEventListener('compositionend', () => {
        isComposing = false;
        saveState();
        updateGutter();
        updateHighlight();
    });
    
    textarea.addEventListener('keydown', (e) => {
        // === 自动闭合括号（VSCode 风格，带上下文判断）===
        const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
        const closingChars = new Set(Object.values(pairs));
        
        // autoCloseBefore: 光标后面必须是这些字符才能自动闭合
        // 参考 VSCode 的 languageDefined 策略：空白、闭括号、非一元运算符等
        const autoCloseBefore = ' \t\n\r)}];,.:';
        
        // 检查是否在字符串或注释中（简化版 notIn 检测）
        const isInStringOrComment = (pos) => {
            const before = textarea.value.substring(0, pos);
            const lines = before.split('\n');
            const currentLine = lines[lines.length - 1];
            
            // 检测是否在单行注释中
            if (language === 'javascript' || language === 'typescript' || language === 'java') {
                if (currentLine.includes('//')) {
                    const commentStart = currentLine.indexOf('//');
                    if (currentLine.substring(0, commentStart).length < currentLine.length) {
                        return true; // 在注释中
                    }
                }
            } else if (language === 'python') {
                if (currentLine.includes('#')) {
                    const commentStart = currentLine.indexOf('#');
                    if (currentLine.substring(0, commentStart).length < currentLine.length) {
                        return true;
                    }
                }
            }
            
            // 检测是否在字符串中（简化版：统计引号数量）
            const singleQuotes = (before.match(/'/g) || []).length;
            const doubleQuotes = (before.match(/"/g) || []).length;
            const backticks = (before.match(/`/g) || []).length;
            
            // 如果引号数量是奇数，说明在字符串中
            if (e.key === "'" && singleQuotes % 2 === 1) return true;
            if (e.key === '"' && doubleQuotes % 2 === 1) return true;
            if (e.key === '`' && backticks % 2 === 1) return true;
            
            return false;
        };
        
        if (pairs[e.key]) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const after = textarea.value.substring(end);
            
            // 智能判断：只有在合适的上下文中才自动闭合
            const shouldAutoClose = 
                // 1. 光标后面是允许的字符（或文件末尾）
                (after.length === 0 || autoCloseBefore.includes(after[0])) &&
                // 2. 不在字符串或注释中（引号除外，引号总是成对的）
                (e.key === '"' || e.key === "'" || !isInStringOrComment(start));
            
            if (shouldAutoClose) {
                // 输入左括号，自动补右括号
                e.preventDefault();
                const before = textarea.value.substring(0, start);
                
                textarea.value = before + e.key + pairs[e.key] + after;
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                saveState();
                updateGutter();
                updateHighlight();
            }
        } else if (closingChars.has(e.key)) {
            // 智能跳过（autoClosingOvertype）：输入右括号时，如果后面已有则跳过
            const start = textarea.selectionStart;
            const after = textarea.value.substring(start);
            if (after[0] === e.key) {
                e.preventDefault();
                textarea.selectionStart = textarea.selectionEnd = start + 1;
            }
        } else if (e.key === 'Backspace') {
            // 智能退格删除（autoClosingDelete）：删除左括号时同时删除右括号
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            if (start === end && start > 0) {
                const before = textarea.value[start - 1];
                const after = textarea.value[start];
                if (pairs[before] === after) {
                    e.preventDefault();
                    textarea.value = textarea.value.substring(0, start - 1) + textarea.value.substring(start + 1);
                    textarea.selectionStart = textarea.selectionEnd = start - 1;
                    saveState();
                    updateGutter();
                    updateHighlight();
                }
            }
        }
        
        // === Tab 缩进 ===
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            
            if (e.shiftKey) {
                const before = textarea.value.substring(0, start);
                const lineStart = before.lastIndexOf('\n') + 1;
                if (textarea.value.substring(lineStart, lineStart + 4) === '    ') {
                    textarea.value = textarea.value.substring(0, lineStart) + textarea.value.substring(lineStart + 4);
                    textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4);
                }
            } else {
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
            saveState();
            updateGutter();
            updateHighlight();
        }
        
        // === Undo/Redo ===
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            doUndo();
        }
        
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            doRedo();
        }
    });
    
    undoBtn.onclick = doUndo;
    redoBtn.onclick = doRedo;
    closeBtn.onclick = closeAll;
    
    saveBtn.onclick = async () => {
        saveBtn.textContent = '保存中...';
        saveBtn.disabled = true;
        
        const success = await fs.writeFile(filePath, textarea.value);
        if (success) {
            showToast('已保存: ' + fileName);
            closeAll();
        } else {
            showToast('保存失败', 'error');
            saveBtn.textContent = '💾 保存';
            saveBtn.disabled = false;
        }
    };
    
    // 拖拽移动
    titlebar.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        const rect = win.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        // 转换为像素值
        win.style.top = `${rect.top}px`;
        win.style.left = `${rect.left}px`;
        win.style.width = `${rect.width}px`;
        win.style.height = `${rect.height}px`;
    });
    
    // 四边调整大小
    win.addEventListener('mousedown', (e) => {
        const edge = e.target.dataset?.edge;
        if (!edge) return;
        
        resizeEdge = edge;
        const rect = win.getBoundingClientRect();
        resizeStart = {
            x: e.clientX,
            y: e.clientY,
            w: rect.width,
            h: rect.height,
            top: rect.top,
            left: rect.left,
        };
        // 转换为像素值
        win.style.top = `${rect.top}px`;
        win.style.left = `${rect.left}px`;
        win.style.width = `${rect.width}px`;
        win.style.height = `${rect.height}px`;
        e.preventDefault();
    });
    
    const handleMouseMove = (e) => {
        if (isDragging) {
            win.style.left = `${e.clientX - dragOffset.x}px`;
            win.style.top = `${e.clientY - dragOffset.y}px`;
            // 移动窗口时隐藏悬浮按钮，防止"按钮漂移"
            if (floatingBtn) {
                floatingBtn.remove();
                floatingBtn = null;
            }
        }
        
        if (resizeEdge) {
            const dx = e.clientX - resizeStart.x;
            const dy = e.clientY - resizeStart.y;
            
            let newW = resizeStart.w;
            let newH = resizeStart.h;
            let newTop = resizeStart.top;
            let newLeft = resizeStart.left;
            
            if (resizeEdge.includes('e')) newW = Math.max(500, resizeStart.w + dx);
            if (resizeEdge.includes('w')) {
                newW = Math.max(500, resizeStart.w - dx);
                newLeft = resizeStart.left + (resizeStart.w - newW);
            }
            if (resizeEdge.includes('s')) newH = Math.max(350, resizeStart.h + dy);
            if (resizeEdge.includes('n')) {
                newH = Math.max(350, resizeStart.h - dy);
                newTop = resizeStart.top + (resizeStart.h - newH);
            }
            
            win.style.width = `${newW}px`;
            win.style.height = `${newH}px`;
            win.style.top = `${newTop}px`;
            win.style.left = `${newLeft}px`;
            
            syncScroll();
            minimap.update(textarea.value);
        }
    };
    
    const handleMouseUp = () => {
        isDragging = false;
        resizeEdge = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    const handleGlobalKey = (e) => {
        if (e.key === 'Escape') closeAll();
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveBtn.click();
        }
    };
    document.addEventListener('keydown', handleGlobalKey);
    
    backdrop.addEventListener('click', closeAll);
    
    // === 选中文本悬浮按钮（基于 textarea 的 selection API）===
    let floatingBtn = null;
    let selectionDebounce = null;
    
    const showFloatingButton = () => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end).trim();
        
        // 如果没有选中文本，隐藏按钮
        if (!selectedText || start === end) {
            if (floatingBtn) {
                floatingBtn.remove();
                floatingBtn = null;
            }
            return;
        }
        
        // 计算选中文本的位置（基于 textarea 的位置和行列）
        const textareaRect = textarea.getBoundingClientRect();
        const lineHeight = 18; // 与 CSS 一致
        const charWidth = 7.2; // 等宽字体的字符宽度估算
        
        // 计算选中起始位置的行列
        const textBefore = textarea.value.substring(0, start);
        const lines = textBefore.split('\n');
        const startLine = lines.length - 1;
        const startCol = lines[lines.length - 1].length;
        
        // 计算选中结束位置的行列
        const textToEnd = textarea.value.substring(0, end);
        const linesEnd = textToEnd.split('\n');
        const endLine = linesEnd.length - 1;
        
        // 计算按钮位置（在选中区域上方中间）
        const avgLine = (startLine + endLine) / 2;
        const scrollTop = textarea.scrollTop;
        
        // 创建或更新悬浮按钮
        if (!floatingBtn) {
            floatingBtn = document.createElement('button');
            floatingBtn.textContent = '✨ Ask AI';
            Object.assign(floatingBtn.style, {
                position: 'fixed',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                zIndex: '2147483649',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'transform 0.1s, opacity 0.1s',
                whiteSpace: 'nowrap',
            });
            
            floatingBtn.onmouseenter = () => {
                floatingBtn.style.transform = 'scale(1.05)';
            };
            floatingBtn.onmouseleave = () => {
                floatingBtn.style.transform = 'scale(1)';
            };
            
            floatingBtn.onclick = (e) => {
                e.stopPropagation();
                
                // 构建更好的提示词，包含文件路径和语言信息
                const prompt = `📄 文件: \`${filePath}\` (${language})
第 ${startLine + 1} - ${endLine + 1} 行

请分析这段代码：

\`\`\`${language}
${selectedText}
\`\`\``;
                
                const result = insertToInput(prompt);
                if (result.success) {
                    showToast('已发送到 Gemini');
                } else {
                    showToast('发送失败', 'error');
                }
                
                // 隐藏按钮
                if (floatingBtn) {
                    floatingBtn.remove();
                    floatingBtn = null;
                }
            };
            
            document.body.appendChild(floatingBtn);
        }
        
        // 智能定位按钮
        const btnWidth = 90;
        const btnHeight = 32;
        const gap = 8;
        
        // 计算按钮位置（相对于 textarea）
        let left = textareaRect.left + startCol * charWidth + 50;
        let top = textareaRect.top + (startLine * lineHeight) - scrollTop - btnHeight - gap + 4;
        
        // 边界检测
        if (left < textareaRect.left + 10) left = textareaRect.left + 10;
        if (left + btnWidth > textareaRect.right - 10) {
            left = textareaRect.right - btnWidth - 10;
        }
        if (top < textareaRect.top + 10) {
            // 上方空间不够，放到下方
            top = textareaRect.top + (endLine * lineHeight) - scrollTop + lineHeight + gap + 4;
        }
        
        floatingBtn.style.left = `${left}px`;
        floatingBtn.style.top = `${top}px`;
    };
    
    // 监听 textarea 的选中变化（mouseup 和 keyup）
    textarea.addEventListener('mouseup', () => {
        if (selectionDebounce) clearTimeout(selectionDebounce);
        selectionDebounce = setTimeout(showFloatingButton, 150);
    });
    
    textarea.addEventListener('keyup', (e) => {
        // 只在 Shift+方向键选中时触发
        if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (selectionDebounce) clearTimeout(selectionDebounce);
            selectionDebounce = setTimeout(showFloatingButton, 150);
        }
    });
    
    // 滚动时隐藏按钮
    textarea.addEventListener('scroll', () => {
        if (floatingBtn) {
            floatingBtn.remove();
            floatingBtn = null;
        }
    });
    
    // === 初始化 ===
    document.body.append(backdrop, win);
    updateAll();
    textarea.focus();
}
