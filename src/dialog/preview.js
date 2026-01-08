/**
 * 预览对话框 - 变更确认（Side-by-Side Diff）
 */

import { detectTheme } from '../shared/theme.js';

/**
 * 获取主题相关的 Diff 配色方案
 * @returns {Object} 包含各种状态的颜色配置
 */
function getDiffColors() {
    const theme = detectTheme();
    
    if (theme === 'light') {
        return {
            // 删除行
            deleteBg: '#ffd7d5',
            deleteText: '#82071e',
            deleteCharBg: '#ff8182',
            deleteCharText: '#ffffff',
            // 新增行
            insertBg: '#d1f4d1',
            insertText: '#055d20',
            insertCharBg: '#4fb04f',
            insertCharText: '#ffffff',
            // 修改行
            modifyBg: '#fff4ce',
            // 空白行
            emptyBg: '#f6f8fa',
            // 相同行透明度
            equalOpacity: '0.5'
        };
    } else {
        return {
            // 删除行
            deleteBg: '#4b1818',
            deleteText: '#ffa8a8',
            deleteCharBg: '#c44444',
            deleteCharText: '#ffffff',
            // 新增行
            insertBg: '#1a4d1a',
            insertText: '#a8ffa8',
            insertCharBg: '#44c444',
            insertCharText: '#ffffff',
            // 修改行
            modifyBg: '#3d2a1a',
            // 空白行
            emptyBg: 'rgba(0, 0, 0, 0.1)',
            // 相同行透明度
            equalOpacity: '0.6'
        };
    }
}

/**
 * Myers Diff 算法 - 计算两个文本的行级差异
 * @param {string[]} oldLines - 原始文本的行数组
 * @param {string[]} newLines - 新文本的行数组
 * @returns {Array} 差异数组，每项包含 {type: 'equal'|'delete'|'insert', oldLine?, newLine?}
 */
function computeLineDiff(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;
    
    // 动态规划表：dp[i][j] 表示 oldLines[0..i-1] 和 newLines[0..j-1] 的最小编辑距离
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    // 初始化第一行和第一列
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // 填充 DP 表
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1]; // 相同，不需要操作
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // 删除
                    dp[i][j - 1],     // 插入
                    dp[i - 1][j - 1]  // 替换
                );
            }
        }
    }
    
    // 回溯构建差异序列
    const diffs = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            // 相同行
            diffs.unshift({ type: 'equal', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
            i--;
            j--;
        } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
            // 修改行（替换）
            diffs.unshift({ type: 'modify', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
            i--;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            // 删除行
            diffs.unshift({ type: 'delete', oldLine: oldLines[i - 1] });
            i--;
        } else {
            // 插入行
            diffs.unshift({ type: 'insert', newLine: newLines[j - 1] });
            j--;
        }
    }
    
    return diffs;
}

/**
 * 字符级 Diff - 用于高亮修改行内的具体差异
 * @param {string} oldText - 原始文本
 * @param {string} newText - 新文本
 * @returns {Array} 差异数组，每项包含 {type: 'equal'|'delete'|'insert', value}
 */
function computeCharDiff(oldText, newText) {
    // 核心修复：使用 Array.from 处理 Unicode 代理对，防止中文/Emoji 乱码
    const oldChars = Array.from(oldText);
    const newChars = Array.from(newText);
    const m = oldChars.length;
    const n = newChars.length;
    
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldChars[i - 1] === newChars[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    
    const diffs = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
            diffs.unshift({ type: 'equal', value: oldChars[i - 1] });
            i--;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            diffs.unshift({ type: 'delete', value: oldChars[i - 1] });
            i--;
        } else {
            diffs.unshift({ type: 'insert', value: newChars[j - 1] });
            j--;
        }
    }
    
    return diffs;
}

/**
* 渲染带字符级高亮的行
* @param {Array} charDiffs - 字符级差异数组
* @param {string} type - 'old' 或 'new'
* @param {Object} colors - 主题配色方案
* @returns {HTMLElement} 渲染后的行元素
*/
function renderHighlightedLine(charDiffs, type, colors) {
    const span = document.createElement('span');
    
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
 */
export function showPreviewDialog(file, oldText, newText, startLine = 1, syntaxError = null) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.id = 'ide-modal-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0', 
            background: 'rgba(0, 0, 0, 0.6)', 
            backdropFilter: 'blur(4px)',
            zIndex: '2147483648',
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
            padding: '24px', 
            zIndex: '2147483649',
            width: '90vw', maxWidth: '1400px', height: '85vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            animation: 'ideScaleIn 0.2s ease-out'
        });

        // 头部
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: syntaxError ? '12px' : '20px', paddingBottom: '16px',
            borderBottom: '1px solid var(--ide-border)'
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
        header.appendChild(titleGroup);
        dialog.appendChild(header);

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

        // Diff 内容区（Side-by-Side）
        const diffBody = document.createElement('div');
        Object.assign(diffBody.style, {
            flex: '1', display: 'flex', gap: '0', 
            overflow: 'hidden', minHeight: '0',
            border: '1px solid var(--ide-border)',
            borderRadius: '8px'
        });

        // 计算行级差异
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const lineDiffs = computeLineDiff(oldLines, newLines);
        
        // 获取主题配色
        const colors = getDiffColors();

        // 创建左右两个面板
        const createSidePanel = (side) => {
            const panel = document.createElement('div');
            Object.assign(panel.style, {
                flex: '1', display: 'flex', flexDirection: 'column',
                overflow: 'hidden', background: 'var(--ide-hint-bg)',
                borderRight: side === 'left' ? '1px solid var(--ide-border)' : 'none'
            });

            // 面板头部
            const panelHeader = document.createElement('div');
            panelHeader.textContent = side === 'left' ? '🔴 原始代码 (SEARCH)' : '🟢 修改后代码 (REPLACE)';
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
                fontFamily: '"JetBrains Mono", Consolas, monospace',
                fontSize: '13px', lineHeight: '1.6'
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

            panel.appendChild(panelHeader);
            codeContainer.appendChild(lineNumbers);
            codeContainer.appendChild(codeArea);
            panel.appendChild(codeContainer);

            return { panel, lineNumbers, codeArea };
        };

        const leftPanel = createSidePanel('left');
        const rightPanel = createSidePanel('right');

        // 渲染差异
        let leftLineNum = startLine;
        let rightLineNum = startLine;

        lineDiffs.forEach(diff => {
            const leftLineDiv = document.createElement('div');
            const rightLineDiv = document.createElement('div');
            const leftCodeDiv = document.createElement('div');
            const rightCodeDiv = document.createElement('div');

            if (diff.type === 'equal') {
                // 相同行 - 正常显示
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = String(rightLineNum++);
                leftCodeDiv.textContent = diff.oldLine;
                rightCodeDiv.textContent = diff.newLine;
                leftCodeDiv.style.color = 'var(--ide-text)';
                rightCodeDiv.style.color = 'var(--ide-text)';
                leftCodeDiv.style.opacity = colors.equalOpacity;
                rightCodeDiv.style.opacity = colors.equalOpacity;
            } else if (diff.type === 'delete') {
                // 删除行 - 左侧红色背景，右侧空白
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = '';
                leftCodeDiv.textContent = diff.oldLine;
                leftCodeDiv.style.backgroundColor = colors.deleteBg;
                leftCodeDiv.style.color = colors.deleteText;
                rightCodeDiv.textContent = '';
                rightCodeDiv.style.backgroundColor = colors.emptyBg;
            } else if (diff.type === 'insert') {
                // 插入行 - 右侧绿色背景，左侧空白
                leftLineDiv.textContent = '';
                rightLineDiv.textContent = String(rightLineNum++);
                leftCodeDiv.textContent = '';
                leftCodeDiv.style.backgroundColor = colors.emptyBg;
                rightCodeDiv.textContent = diff.newLine;
                rightCodeDiv.style.backgroundColor = colors.insertBg;
                rightCodeDiv.style.color = colors.insertText;
            } else if (diff.type === 'modify') {
                // 修改行 - 两侧都显示，字符级高亮
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = String(rightLineNum++);
                
                const charDiffs = computeCharDiff(diff.oldLine, diff.newLine);
                leftCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'old', colors));
                rightCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'new', colors));
                
                leftCodeDiv.style.backgroundColor = colors.deleteBg;
                rightCodeDiv.style.backgroundColor = colors.insertBg;
            }

            leftPanel.lineNumbers.appendChild(leftLineDiv);
            leftPanel.codeArea.appendChild(leftCodeDiv);
            rightPanel.lineNumbers.appendChild(rightLineDiv);
            rightPanel.codeArea.appendChild(rightCodeDiv);
        });

        diffBody.appendChild(leftPanel.panel);
        diffBody.appendChild(rightPanel.panel);

        // 底部按钮
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '12px',
            marginTop: '20px', paddingTop: '16px',
            borderTop: '1px solid var(--ide-border)'
        });

        const closeAll = () => { backdrop.remove(); dialog.remove(); };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        Object.assign(cancelBtn.style, {
            padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--ide-border)',
            color: 'var(--ide-text)', fontSize: '14px'
        });
        cancelBtn.onmouseover = () => cancelBtn.style.background = 'var(--ide-hover)';
        cancelBtn.onmouseout = () => cancelBtn.style.background = 'transparent';
        cancelBtn.onclick = () => { closeAll(); resolve(false); };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确认应用修改';
        Object.assign(confirmBtn.style, {
            padding: '8px 24px', borderRadius: '6px', cursor: 'pointer',
            background: 'var(--ide-accent)', color: '#fff', 
            border: 'none', fontSize: '14px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
        });
        confirmBtn.onclick = () => { closeAll(); resolve(true); };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        dialog.appendChild(diffBody);
        dialog.appendChild(footer);

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
    });
}
