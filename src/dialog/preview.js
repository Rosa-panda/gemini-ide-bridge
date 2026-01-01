/**
 * 预览对话框 - 变更确认
 */

/**
 * 显示预览对话框
 * @param {string} file - 文件路径
 * @param {string} oldText - SEARCH 块内容
 * @param {string} newText - REPLACE 块内容
 * @param {number} startLine - 匹配位置的起始行号
 */
export function showPreviewDialog(file, oldText, newText, startLine = 1) {
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
            width: '90vw', maxWidth: '1200px', height: '85vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            animation: 'ideScaleIn 0.2s ease-out'
        });

        // 头部
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '20px', paddingBottom: '16px',
            borderBottom: '1px solid var(--ide-border)'
        });
        
        const titleGroup = document.createElement('div');
        const titleIcon = document.createElement('span');
        titleIcon.textContent = '📝';
        titleIcon.style.marginRight = '8px';
        const titleText = document.createElement('span');
        titleText.textContent = `变更预览: ${file}`;
        titleText.style.fontSize = '18px';
        titleText.style.fontWeight = '600';
        
        titleGroup.appendChild(titleIcon);
        titleGroup.appendChild(titleText);
        header.appendChild(titleGroup);

        // Diff 内容区
        const diffBody = document.createElement('div');
        Object.assign(diffBody.style, {
            flex: '1', display: 'flex', gap: '16px', 
            overflow: 'hidden', minHeight: '0'
        });

        const createPane = (content, type, lineStart) => {
            const pane = document.createElement('div');
            Object.assign(pane.style, {
                flex: '1', display: 'flex', flexDirection: 'column',
                border: '1px solid var(--ide-border)', borderRadius: '8px',
                overflow: 'hidden', background: 'var(--ide-hint-bg)'
            });

            const isAdd = type === 'add';
            const paneHeader = document.createElement('div');
            paneHeader.textContent = isAdd ? '🟢 REPLACE (新增/修改)' : '🔴 SEARCH (原始/删除)';
            Object.assign(paneHeader.style, {
                padding: '10px 16px', fontSize: '12px', fontWeight: 'bold',
                background: isAdd ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: isAdd ? '#22c55e' : '#ef4444',
                borderBottom: '1px solid var(--ide-border)'
            });

            const codeContainer = document.createElement('div');
            Object.assign(codeContainer.style, {
                flex: '1', display: 'flex', overflow: 'auto',
                fontFamily: '"JetBrains Mono", Consolas, monospace',
                fontSize: '13px', lineHeight: '1.6'
            });

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

            const codeArea = document.createElement('pre');
            Object.assign(codeArea.style, {
                flex: '1', margin: '0', padding: '16px',
                overflow: 'visible', color: 'var(--ide-text)',
                whiteSpace: 'pre'
            });

            const lines = content.split('\n');
            lines.forEach((_, i) => {
                const lineNumDiv = document.createElement('div');
                lineNumDiv.textContent = String(lineStart + i);
                lineNumbers.appendChild(lineNumDiv);
            });
            codeArea.textContent = content;

            codeContainer.appendChild(lineNumbers);
            codeContainer.appendChild(codeArea);

            pane.appendChild(paneHeader);
            pane.appendChild(codeContainer);
            return pane;
        };

        diffBody.appendChild(createPane(oldText, 'del', startLine));
        diffBody.appendChild(createPane(newText, 'add', startLine));

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

        dialog.appendChild(header);
        dialog.appendChild(diffBody);
        dialog.appendChild(footer);

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
    });
}
