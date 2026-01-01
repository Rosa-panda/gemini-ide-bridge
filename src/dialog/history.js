/**
 * 历史版本对话框
 */

import { fs } from '../core/fs.js';
import { showToast } from '../shared/utils.js';

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

        const dialog = document.createElement('div');
        dialog.id = 'ide-history-dialog';
        Object.assign(dialog.style, {
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--ide-bg)', border: '1px solid var(--ide-border)',
            borderRadius: '12px', padding: '20px', zIndex: '2147483649',
            width: '400px', maxHeight: '60vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)'
        });

        const header = document.createElement('div');
        header.textContent = '📜 历史回溯 - ' + filePath.split('/').pop();
        Object.assign(header.style, {
            fontWeight: 'bold', marginBottom: '16px', color: 'var(--ide-text)',
            paddingBottom: '12px', borderBottom: '1px solid var(--ide-border)', fontSize: '15px'
        });
        dialog.appendChild(header);

        const list = document.createElement('div');
        Object.assign(list.style, { flex: '1', overflowY: 'auto', paddingRight: '4px' });

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
                    dialog.remove();
                }
            };

            actions.appendChild(viewBtn);
            actions.appendChild(revertBtn);
            
            item.appendChild(info);
            item.appendChild(actions);
            list.appendChild(item);
        });
        dialog.appendChild(list);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        Object.assign(closeBtn.style, {
            marginTop: '16px', width: '100%', background: 'transparent',
            color: 'var(--ide-text-secondary)', border: '1px solid var(--ide-border)', 
            padding: '10px', borderRadius: '6px', cursor: 'pointer'
        });
        closeBtn.onmouseover = () => closeBtn.style.color = 'var(--ide-text)';
        closeBtn.onmouseout = () => closeBtn.style.color = 'var(--ide-text-secondary)';
        closeBtn.onclick = () => { dialog.remove(); resolve(null); };
        dialog.appendChild(closeBtn);

        document.body.appendChild(dialog);
    });
}

/**
 * 历史对比视图
 */
export function showHistoryDiff(filePath, version, currentContent) {
    const backdrop = document.createElement('div');
    Object.assign(backdrop.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)', zIndex: '2147483650',
        animation: 'ideFadeIn 0.2s ease-out'
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90vw', maxWidth: '1200px', height: '85vh',
        background: 'var(--ide-bg)', border: '1px solid var(--ide-border)',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', zIndex: '2147483651',
        animation: 'ideScaleIn 0.2s ease-out'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '16px 24px', borderBottom: '1px solid var(--ide-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    });

    const titleText = document.createElement('div');
    titleText.textContent = `🆚 版本对比: ${filePath.split('/').pop()}`;
    Object.assign(titleText.style, { fontWeight: '600', color: 'var(--ide-text)', fontSize: '16px' });
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭预览';
    closeBtn.className = 'ide-btn';
    closeBtn.onclick = () => { backdrop.remove(); container.remove(); };
    
    header.appendChild(titleText);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    Object.assign(body.style, {
        flex: '1', display: 'flex', overflow: 'hidden',
        background: 'var(--ide-hint-bg)'
    });

    const createPane = (title, content, bgColor, borderColor) => {
        const pane = document.createElement('div');
        Object.assign(pane.style, {
            flex: '1', display: 'flex', flexDirection: 'column',
            borderRight: '1px solid var(--ide-border)', minWidth: '0'
        });

        const paneHeader = document.createElement('div');
        paneHeader.textContent = title;
        Object.assign(paneHeader.style, {
            padding: '8px 16px', fontSize: '12px', fontWeight: 'bold',
            background: bgColor, color: borderColor,
            borderBottom: `1px solid ${borderColor}`, opacity: '0.9'
        });

        const pre = document.createElement('pre');
        pre.textContent = content;
        Object.assign(pre.style, {
            flex: '1', margin: '0', padding: '16px', overflow: 'auto',
            fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: '13px',
            lineHeight: '1.5', color: 'var(--ide-text)', whiteSpace: 'pre'
        });

        pane.appendChild(paneHeader);
        pane.appendChild(pre);
        return pane;
    };

    const leftPane = createPane(`🕰️ 历史版本 (${formatTime(version.timestamp)})`, version.content, 'rgba(234, 179, 8, 0.1)', '#eab308');
    const rightPane = createPane('💻 当前本地版本', currentContent, 'rgba(59, 130, 246, 0.1)', '#3b82f6');
    rightPane.style.borderRight = 'none';

    body.appendChild(leftPane);
    body.appendChild(rightPane);
    container.appendChild(header);
    container.appendChild(body);

    document.body.appendChild(backdrop);
    document.body.appendChild(container);
}
