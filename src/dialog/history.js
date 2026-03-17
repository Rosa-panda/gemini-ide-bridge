/**
 * 历史版本对话框
 */

import { fs } from '../core/fs.js';
import { showToast } from '../shared/utils.js';
import { computeLineDiff } from '../shared/diff.js';
import { CODE_FONT } from '../shared/code-style.js';
import { makeDraggable } from '../shared/draggable.js';

function formatTime(timestamp) {
    const d = new Date(timestamp);
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
}

/**
 * 显示历史版本对话框
 */
export function showHistoryDialog(filePath) {
    return new Promise(async (resolve) => {
        const versions = await fs.getFileHistory(filePath);
        if (versions.length === 0) {
            showToast('暂无历史版本', 'info');
            return resolve(null);
        }

        const existing = document.getElementById('ide-history-dialog');
        if (existing) existing.remove();
        
        // 背景遮罩
        const backdrop = document.createElement('div');
        backdrop.id = 'ide-history-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)',
            zIndex: '2147483600', animation: 'ideFadeIn 0.2s ease-out'
        });
        
        const closeAll = () => { backdrop.remove(); dialog.remove(); resolve(null); };
        backdrop.onclick = closeAll;

        const dialog = document.createElement('div');
        dialog.id = 'ide-history-dialog';
        Object.assign(dialog.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--ide-bg)', border: '1px solid var(--ide-border)',
            borderRadius: '12px', zIndex: '2147483601',
            width: '400px', maxHeight: '60vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', animation: 'ideScaleIn 0.2s ease-out',
            overflow: 'hidden'  // 防止内容溢出
        });
        dialog.onclick = (e) => e.stopPropagation();

        // 头部（固定高度）
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--ide-border)',
            flexShrink: '0',  // 不压缩
            cursor: 'move'    // 拖拽光标
        });
        
        const title = document.createElement('span');
        title.textContent = '📜 历史回溯 - ' + filePath.split('/').pop();
        Object.assign(title.style, { fontWeight: 'bold', color: 'var(--ide-text)', fontSize: '15px' });
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.title = '关闭';
        Object.assign(closeBtn.style, {
            background: 'transparent', border: 'none', color: 'var(--ide-text-secondary)',
            fontSize: '16px', cursor: 'pointer', padding: '2px 6px'
        });
        closeBtn.onmouseover = () => closeBtn.style.color = 'var(--ide-text)';
        closeBtn.onmouseout = () => closeBtn.style.color = 'var(--ide-text-secondary)';
        closeBtn.onclick = closeAll;
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const list = document.createElement('div');
        Object.assign(list.style, { 
            flex: '1', 
            overflowY: 'auto', 
            padding: '8px 16px',
            minHeight: '0'  // 允许收缩
        });

        versions.forEach((v) => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '10px', margin: '6px 0', background: 'var(--ide-hint-bg)',
                borderRadius: '6px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s'
            });
            item.className = 'ide-tree-item';

            const info = document.createElement('div');
            info.style.display = 'flex';
            info.style.flexDirection = 'column';
            
            const time = document.createElement('span');
            time.textContent = formatTime(v.timestamp);
            time.style.color = 'var(--ide-text)';
            time.style.fontSize = '13px';
            time.style.fontWeight = '500';

            const size = document.createElement('span');
            size.textContent = formatSize(v.content.length);
            size.style.color = 'var(--ide-text-secondary)';
            size.style.fontSize = '11px';
            
            info.appendChild(time);
            info.appendChild(size);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '8px';

            const viewBtn = document.createElement('button');
            viewBtn.textContent = '🆚 对比';
            viewBtn.title = '与当前本地版本对比';
            viewBtn.className = 'ide-btn';
            Object.assign(viewBtn.style, { padding: '4px 8px', fontSize: '11px', flex: 'none' });
            
            viewBtn.onclick = async () => {
                const currentContent = await fs.readFile(filePath);
                if (currentContent === null) {
                    showToast('无法读取当前文件', 'error');
                    return;
                }
                showHistoryDiff(filePath, v, currentContent);
            };

            const revertBtn = document.createElement('button');
            revertBtn.textContent = '回退';
            revertBtn.title = '回退到此版本';
            Object.assign(revertBtn.style, {
                background: 'var(--ide-accent)', color: '#fff', border: 'none',
                padding: '4px 10px', borderRadius: '4px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 'bold'
            });
            revertBtn.onclick = async () => {
                if (!confirm(`确定回退到 ${formatTime(v.timestamp)} 的版本？`)) return;
                const result = await fs.revertToVersion(filePath, v.timestamp);
                if (result.success) {
                    showToast('✅ 已回退');
                    closeAll();
                }
            };

            actions.appendChild(viewBtn);
            actions.appendChild(revertBtn);
            
            item.appendChild(info);
            item.appendChild(actions);
            list.appendChild(item);
        });
        dialog.appendChild(list);

        document.body.appendChild(backdrop);
        document.body.appendChild(dialog);
        
        // 使对话框可拖拽和调整大小
        const cleanupDraggable = makeDraggable(dialog, header, {
            dialogId: 'history-list',
            minWidth: 350,
            minHeight: 300
        });
        
        // 更新 closeAll 以清理事件监听
        const originalCloseAll = closeAll;
        backdrop.onclick = () => { cleanupDraggable(); originalCloseAll(); };
        closeBtn.onclick = () => { cleanupDraggable(); originalCloseAll(); };
    });
}

/**
 * 历史对比视图（带 Diff 高亮）
 */
export function showHistoryDiff(filePath, version, currentContent) {
    const backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', zIndex: '2147483602',
        animation: 'ideFadeIn 0.2s ease-out'
    });
    
    // 点击背景关闭
    const closeAll = () => { backdrop.remove(); container.remove(); };
    backdrop.onclick = closeAll;

    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90vw', height: '85vh',
        background: 'var(--ide-bg)', border: '1px solid var(--ide-border)',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', zIndex: '2147483603',
        animation: 'ideScaleIn 0.2s ease-out',
        overflow: 'hidden'  // 防止内容溢出
    });
    // 阻止点击容器时关闭
    container.onclick = (e) => e.stopPropagation();

    // 当前字体大小
    let currentFontSize = parseInt(CODE_FONT.size);
    const minFontSize = 12, maxFontSize = 20;

    // 头部（固定高度）
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '12px 20px',
        borderBottom: '1px solid var(--ide-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: '0',  // 不压缩
        cursor: 'move'    // 拖拽光标
    });

    const titleText = document.createElement('div');
    titleText.textContent = `🆚 版本对比: ${filePath.split('/').pop()}`;
    Object.assign(titleText.style, { fontWeight: '600', color: 'var(--ide-text)', fontSize: '16px' });
    
    // 右侧控制按钮组
    const controls = document.createElement('div');
    Object.assign(controls.style, { display: 'flex', gap: '8px', alignItems: 'center' });
    
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
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = '关闭 (点击空白处也可关闭)';
    Object.assign(closeBtn.style, {
        background: 'transparent', border: 'none', color: 'var(--ide-text-secondary)',
        fontSize: '18px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px'
    });
    closeBtn.onmouseover = () => closeBtn.style.color = 'var(--ide-text)';
    closeBtn.onmouseout = () => closeBtn.style.color = 'var(--ide-text-secondary)';
    closeBtn.onclick = closeAll;
    
    controls.appendChild(fontSmallBtn);
    controls.appendChild(fontLargeBtn);
    controls.appendChild(closeBtn);
    
    header.appendChild(titleText);
    header.appendChild(controls);

    // 主题配色
    const isDark = document.body.style.backgroundColor?.includes('rgb(') || 
                   getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)';
    const colors = isDark ? {
        deleteBg: '#4b1818', deleteText: '#ffa8a8',
        insertBg: '#1a4d1a', insertText: '#a8ffa8',
        emptyBg: 'rgba(0, 0, 0, 0.1)', equalOpacity: '0.6'
    } : {
        deleteBg: '#ffd7d5', deleteText: '#82071e',
        insertBg: '#d1f4d1', insertText: '#055d20',
        emptyBg: '#f6f8fa', equalOpacity: '0.5'
    };

    // 计算 diff
    const oldLines = version.content.split('\n');
    const newLines = currentContent.split('\n');
    const lineDiffs = computeLineDiff(oldLines, newLines);

    const body = document.createElement('div');
    Object.assign(body.style, {
        flex: '1', display: 'flex', overflow: 'hidden'
    });
    
    // 更新字体大小的函数
    const updateFontSize = () => {
        const codeContainers = body.querySelectorAll('[style*="monospace"]');
        codeContainers.forEach(el => {
            el.style.fontSize = `${currentFontSize}px`;
        });
    };
    
    // 绑定字体按钮事件
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

    // 创建面板
    const createPane = (side) => {
        const pane = document.createElement('div');
        Object.assign(pane.style, {
            flex: '1', display: 'flex', flexDirection: 'column',
            borderRight: side === 'left' ? '1px solid var(--ide-border)' : 'none',
            overflow: 'hidden', background: 'var(--ide-hint-bg)'
        });

        const paneHeader = document.createElement('div');
        paneHeader.textContent = side === 'left' 
            ? `🕰️ 历史版本 (${formatTime(version.timestamp)})` 
            : '💻 当前本地版本';
        Object.assign(paneHeader.style, {
            padding: '10px 16px', fontSize: '12px', fontWeight: 'bold',
            background: side === 'left' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            color: side === 'left' ? '#eab308' : '#3b82f6',
            borderBottom: '1px solid var(--ide-border)'
        });

        const codeContainer = document.createElement('div');
        Object.assign(codeContainer.style, {
            flex: '1', display: 'flex', overflow: 'auto',
            fontFamily: CODE_FONT.family,
            fontSize: CODE_FONT.size,
            lineHeight: CODE_FONT.lineHeight
        });

        const lineNumbers = document.createElement('div');
        Object.assign(lineNumbers.style, {
            padding: '16px 12px 16px 16px', textAlign: 'right',
            color: 'var(--ide-text-secondary)', userSelect: 'none',
            borderRight: '1px solid var(--ide-border)',
            background: 'rgba(0, 0, 0, 0.1)', minWidth: '50px'
        });

        const codeArea = document.createElement('div');
        Object.assign(codeArea.style, {
            flex: '1', padding: '16px', whiteSpace: 'pre',
            color: 'var(--ide-text)'
        });

        pane.appendChild(paneHeader);
        codeContainer.appendChild(lineNumbers);
        codeContainer.appendChild(codeArea);
        pane.appendChild(codeContainer);

        return { pane, lineNumbers, codeArea };
    };

    const leftPane = createPane('left');
    const rightPane = createPane('right');

    // 渲染 diff（带连续行折叠）
    let leftLineNum = 1, rightLineNum = 1;
    let lastWasInsert = false;  // 追踪上一行是否是 insert
    let lastWasDelete = false;  // 追踪上一行是否是 delete
    
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
            
            // 右边：连续 delete 只显示一行提示
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
                rightLineDiv.textContent = '\u00A0'; // 不换行空格，防止空白折叠导致高度塔陌
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
            
            // 左边：连续 insert 只显示一行提示
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
                leftLineDiv.textContent = '\u00A0'; // 不换行空格，防止空白折叠导致高度塔陌
                leftCodeDiv.textContent = '\u00A0';
                leftLineDiv.style.visibility = 'hidden';
                leftCodeDiv.style.visibility = 'hidden';
            }
            lastWasInsert = true;
            lastWasDelete = false;
        } else if (diff.type === 'modify') {
            leftLineDiv.textContent = String(leftLineNum++);
            rightLineDiv.textContent = String(rightLineNum++);
            leftCodeDiv.textContent = diff.oldLine;
            rightCodeDiv.textContent = diff.newLine;
            leftCodeDiv.style.backgroundColor = colors.deleteBg;
            leftCodeDiv.style.color = colors.deleteText;
            rightCodeDiv.style.backgroundColor = colors.insertBg;
            rightCodeDiv.style.color = colors.insertText;
            lastWasInsert = false;
            lastWasDelete = false;
        }

        leftPane.lineNumbers.appendChild(leftLineDiv);
        leftPane.codeArea.appendChild(leftCodeDiv);
        rightPane.lineNumbers.appendChild(rightLineDiv);
        rightPane.codeArea.appendChild(rightCodeDiv);
    });

    body.appendChild(leftPane.pane);
    body.appendChild(rightPane.pane);
    container.appendChild(header);
    container.appendChild(body);

    document.body.appendChild(backdrop);
    document.body.appendChild(container);
    
    // 使对话框可拖拽和调整大小
    const cleanupDraggable = makeDraggable(container, header, {
        dialogId: 'history-diff',
        minWidth: 600,
        minHeight: 400
    });
    
    // 更新 closeAll 以清理事件监听
    const originalCloseAll = closeAll;
    backdrop.onclick = () => { cleanupDraggable(); originalCloseAll(); };
    closeBtn.onclick = () => { cleanupDraggable(); originalCloseAll(); };
}
