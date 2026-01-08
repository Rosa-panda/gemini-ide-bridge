/**
 * 预览对话框 - 变更确认（Side-by-Side Diff）
 */

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
    const m = oldText.length;
    const n = newText.length;
    
    // 动态规划表
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldText[i - 1] === newText[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    
    // 回溯
    const diffs = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldText[i - 1] === newText[j - 1]) {
            diffs.unshift({ type: 'equal', value: oldText[i - 1] });
            i--;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            diffs.unshift({ type: 'delete', value: oldText[i - 1] });
            i--;
        } else {
            diffs.unshift({ type: 'insert', value: newText[j - 1] });
            j--;
        }
    }
    
    return diffs;
}

/**
 * 渲染带字符级高亮的行
 * @param {Array} charDiffs - 字符级差异数组
 * @param {string} type - 'old' 或 'new'
 * @returns {HTMLElement} 渲染后的行元素
 */
function renderHighlightedLine(charDiffs, type) {
    const span = document.createElement('span');
    
    charDiffs.forEach(diff => {
        const part = document.createElement('span');
        part.textContent = diff.value;
        
        if (type === 'old' && diff.type === 'delete') {
            // 删除的字符用深红色背景
            part.style.backgroundColor = '#8b0000';
            part.style.color = '#fff';
        } else if (type === 'new' && diff.type === 'insert') {
            // 插入的字符用深绿色背景
            part.style.backgroundColor = '#006400';
            part.style.color = '#fff';
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
                // 相同行 - 灰色显示
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = String(rightLineNum++);
                leftCodeDiv.textContent = diff.oldLine;
                rightCodeDiv.textContent = diff.newLine;
                leftCodeDiv.style.color = 'var(--ide-text-secondary)';
                rightCodeDiv.style.color = 'var(--ide-text-secondary)';
            } else if (diff.type === 'delete') {
                // 删除行 - 左侧红色背景，右侧空白
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = '';
                leftCodeDiv.textContent = diff.oldLine;
                leftCodeDiv.style.backgroundColor = '#3d1a1a';
                leftCodeDiv.style.color = '#ff6b6b';
                rightCodeDiv.textContent = '';
                rightCodeDiv.style.backgroundColor = '#1a1a1a';
            } else if (diff.type === 'insert') {
                // 插入行 - 右侧绿色背景，左侧空白
                leftLineDiv.textContent = '';
                rightLineDiv.textContent = String(rightLineNum++);
                leftCodeDiv.textContent = '';
                leftCodeDiv.style.backgroundColor = '#1a1a1a';
                rightCodeDiv.textContent = diff.newLine;
                rightCodeDiv.style.backgroundColor = '#1a3d1a';
                rightCodeDiv.style.color = '#6bff6b';
            } else if (diff.type === 'modify') {
                // 修改行 - 两侧都显示，字符级高亮
                leftLineDiv.textContent = String(leftLineNum++);
                rightLineDiv.textContent = String(rightLineNum++);
                
                const charDiffs = computeCharDiff(diff.oldLine, diff.newLine);
                leftCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'old'));
                rightCodeDiv.appendChild(renderHighlightedLine(charDiffs, 'new'));
                
                leftCodeDiv.style.backgroundColor = '#3d2a1a';
                rightCodeDiv.style.backgroundColor = '#2a3d1a';
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
