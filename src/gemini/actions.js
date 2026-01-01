/**
 * 按钮注入和操作模块
 */

import { fs } from '../core/fs.js';
import { parseDelete, parseSearchReplace, parseMultipleFiles } from '../core/parser.js';
import { tryReplace, checkJsSyntax } from '../core/patcher/index.js';
import { markAsApplied, unmarkAsApplied, checkIfApplied } from '../core/state.js';
import { showPreviewDialog } from '../dialog/index.js';
import { showToast } from '../shared/utils.js';
import { buildMismatchContext, buildSyntaxErrorContext, buildDuplicateContext } from './feedback.js';

/**
* 创建操作按钮（用于代码块操作栏）
 */
function createActionButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
        background: '#2563eb', color: 'white', border: 'none',
        padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
        fontSize: '12px', fontWeight: 'bold'
    });
    btn.onmouseover = () => { btn.style.opacity = '0.8'; };
    btn.onmouseout = () => { btn.style.opacity = '1'; };
    btn.onclick = onClick;
    return btn;
}

/**
 * 添加撤销按钮
 */
function addUndoButton(bar, filePath, insertToInput) {
    const fileName = filePath.split('/').pop();
    const undoBtn = createActionButton(`↩️ 撤销 → ${fileName}`, async () => {
        const result = await fs.revertFile(filePath);
        if (result.success) {
            showToast('已撤销: ' + filePath);
            undoBtn.remove();
        } else {
            showToast(result.error || '撤销失败', 'error');
        }
    });
    undoBtn.className = 'ide-undo-btn';
    undoBtn.title = filePath;
    undoBtn.style.background = '#f59e0b';
    bar.appendChild(undoBtn);
}

/**
 * 添加补丁撤销按钮
 */
function addUndoButtonForPatch(bar, patch, insertToInput) {
    const fileName = patch.file.split('/').pop();
    const undoBtn = createActionButton(`↩️ 撤销 → ${fileName}`, async () => {
        const result = await fs.revertFile(patch.file);
        if (result.success) {
            showToast('已撤销: ' + patch.file);
            unmarkAsApplied(patch.file, patch.search);
            undoBtn.remove();
        } else {
            showToast(result.error || '撤销失败', 'error');
        }
    });
    undoBtn.className = 'ide-undo-btn';
    undoBtn.title = patch.file;
    undoBtn.style.background = '#f59e0b';
    bar.appendChild(undoBtn);
}

/**
 * 应用补丁
 */
async function applyPatch(patch, btn, bar, insertToInput) {
    const { file, search, replace } = patch;
    
    if (!fs.hasFile(file)) {
        showToast('文件不存在: ' + file, 'error');
        btn.textContent = '❌ 文件不存在';
        btn.style.background = '#dc2626';
        return;
    }
    
    const content = await fs.readFile(file);
    if (content === null) {
        showToast('读取失败', 'error');
        btn.textContent = '❌ 读取失败';
        btn.style.background = '#dc2626';
        return;
    }
    
    const result = tryReplace(content, search, replace);
    if (!result.success) {
        const reason = result.reason || '未知错误';
        showToast(reason, 'error');
        
        if (result.matchCount && result.matchCount > 1) {
            btn.textContent = `❌ ${result.matchCount}处重复`;
            insertToInput(buildDuplicateContext(file, content, search, result.matchCount));
        } else if (result.alreadyApplied) {
            btn.textContent = '✅ 已应用';
            btn.style.background = '#059669';
        } else {
            btn.textContent = '❌ 未匹配';
            insertToInput(buildMismatchContext(file, content, search));
        }
        
        btn.style.background = result.alreadyApplied ? '#059669' : '#dc2626';
        return;
    }

    btn.disabled = true;
    btn.style.opacity = '0.5';

    const syntaxCheck = checkJsSyntax(result.content, file);
    if (!syntaxCheck.valid) {
        const shortError = syntaxCheck.error.length > 30 
            ? syntaxCheck.error.slice(0, 30) + '...' 
            : syntaxCheck.error;
        showToast(`❌ 语法错误: ${syntaxCheck.error}`, 'error');
        btn.textContent = `❌ ${shortError}`;
        btn.title = `语法错误: ${syntaxCheck.error}`;
        btn.style.background = '#dc2626';
        btn.disabled = false;
        btn.style.opacity = '1';
        
        // 传递完整的补丁后内容，让反馈更准确
        insertToInput(buildSyntaxErrorContext(file, syntaxCheck.error, search, replace, result.content));
        return;
    }

    const confirmed = await showPreviewDialog(file, search, replace, result.matchLine || 1);
    if (!confirmed) {
        btn.disabled = false;
        btn.style.opacity = '1';
        return;
    }
    
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = '应用中...';
    const success = await fs.writeFile(file, result.content);
    if (success) {
        btn.textContent = '✅ 已应用';
        btn.style.background = '#059669';
        showToast('已修改: ' + file);
        markAsApplied(file, search);
        addUndoButtonForPatch(bar, patch, insertToInput);
    } else {
        btn.textContent = '❌ 写入失败';
        btn.style.background = '#dc2626';
    }
}

/**
 * 注入操作栏
 */
export function injectActionBar(container, text, filePath, insertToInput) {
    const bar = document.createElement('div');
    bar.className = 'ide-action-bar';
    Object.assign(bar.style, {
        display: 'flex', gap: '8px', padding: '8px',
        background: 'var(--ide-hint-bg, #363739)', 
        borderRadius: '0 0 6px 6px',
        borderTop: '1px solid var(--ide-border, #444746)', 
        flexWrap: 'wrap'
    });

    // 删除指令
    const deletes = parseDelete(text);
    if (deletes.length > 0) {
        if (deletes.length > 1) {
            const batchBtn = createActionButton(`🗑️ 批量删除 (${deletes.length}个文件)`, async () => {
                const confirmMsg = `确定要删除这 ${deletes.length} 个文件吗？\n\n${deletes.map(d => '• ' + d.file).join('\n')}`;
                if (!confirm(confirmMsg)) return;

                batchBtn.textContent = '正在处理...';
                let successCount = 0;
                
                for (const del of deletes) {
                    const success = await fs.deleteFile(del.file);
                    if (success) successCount++;
                }

                if (successCount === deletes.length) {
                    batchBtn.textContent = `✅ 已删除 ${successCount} 个文件`;
                    batchBtn.style.background = '#059669';
                    showToast(`删除成功: 共 ${successCount} 个文件`);
                } else {
                    batchBtn.textContent = `⚠️ 成功 ${successCount}/${deletes.length}`;
                    batchBtn.style.background = '#f59e0b';
                    showToast(`部分删除失败: 成功 ${successCount} 个`, 'error');
                }
                
                window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
            });
            batchBtn.style.background = '#dc2626';
            bar.appendChild(batchBtn);
        }
        
        deletes.forEach(del => {
            const btn = createActionButton(`🗑️ 删除 → ${del.file}`, async () => {
                if (!confirm(`确定删除文件 "${del.file}"？`)) return;
                
                btn.textContent = '正在删除...';
                const success = await fs.deleteFile(del.file);
                
                if (success) {
                    btn.textContent = '✅ 已删除';
                    btn.style.background = '#059669';
                    showToast(`已删除: ${del.file}`);
                    window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
                } else {
                    btn.textContent = '❌ 删除失败';
                    btn.style.background = '#f59e0b';
                    showToast(`删除失败: ${del.file}`, 'error');
                }
            });
            btn.style.background = '#dc2626';
            bar.appendChild(btn);
        });
    }

    // 增量修改
    const patches = parseSearchReplace(text);
    
    if (patches.length > 0) {
        patches.forEach((patch, idx) => {
            const btn = document.createElement('button');
            Object.assign(btn.style, {
                background: '#2563eb', color: 'white', border: 'none',
                padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 'bold'
            });
            btn.onmouseover = () => { btn.style.opacity = '0.8'; };
            btn.onmouseout = () => { btn.style.opacity = '1'; };

            const btnText = patch.isDelete 
                ? `🗑️ 删除代码 #${idx + 1} → ${patch.file || '?'}`
                : `🔧 应用修改 #${idx + 1} → ${patch.file || '?'}`;
            btn.textContent = btnText;
            
            if (patch.isDelete) {
                btn.style.background = '#f59e0b';
            }

            btn.onclick = async () => {
                if (!patch.file) {
                    const input = prompt('请输入目标文件路径:');
                    if (!input) return;
                    patch.file = input;
                }
                await applyPatch(patch, btn, bar, insertToInput);
            };
            
            bar.appendChild(btn);

            if (patch.file) {
                checkIfApplied(patch.file, patch.search, patch.replace, fs).then(status => {
                    if (status.applied) {
                        btn.textContent = `✅ 已应用 #${idx + 1} → ${patch.file}`;
                        btn.style.background = '#059669';
                        addUndoButtonForPatch(bar, patch, insertToInput);
                    }
                });
            }
        });
    } else if (text.includes('FILE:')) {
        const filesToProcess = parseMultipleFiles(text);
        
        if (filesToProcess.length > 1) {
            const batchBtn = createActionButton(`➕ 批量创建/覆盖 (${filesToProcess.length}个文件)`, async () => {
                batchBtn.textContent = '正在处理...';
                let successCount = 0;
                for (const file of filesToProcess) {
                    const exists = fs.hasFile(file.path);
                    const success = exists 
                        ? await fs.writeFile(file.path, file.content) 
                        : await fs.createFile(file.path, file.content);
                    if (success) successCount++;
                }
                if (successCount === filesToProcess.length) {
                    batchBtn.textContent = `✅ 已处理 ${successCount} 个文件`;
                    batchBtn.style.background = '#059669';
                } else {
                    batchBtn.textContent = `⚠️ 成功 ${successCount}/${filesToProcess.length}`;
                    batchBtn.style.background = '#f59e0b';
                }
                window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
            });
            batchBtn.style.background = '#8b5cf6';
            bar.appendChild(batchBtn);
        }
        
        filesToProcess.forEach(file => {
            const exists = fs.hasFile(file.path);
            const btnText = file.isOverwrite && exists 
                ? `📝 覆盖 → ${file.path}` 
                : (exists ? `💾 保存 → ${file.path}` : `➕ 创建 → ${file.path}`);
            
            const btn = createActionButton(btnText, async () => {
                if (file.isOverwrite && exists && !confirm(`确定覆盖 "${file.path}"？`)) return;
                btn.textContent = '处理中...';
                const success = exists 
                    ? await fs.writeFile(file.path, file.content) 
                    : await fs.createFile(file.path, file.content);
                if (success) {
                    btn.textContent = '✅ 已成功';
                    btn.style.background = '#059669';
                    if (!exists) {
                        window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
                    } else {
                        addUndoButton(bar, file.path, insertToInput);
                    }
                } else {
                    btn.textContent = '❌ 失败';
                    btn.style.background = '#dc2626';
                }
            });
            if (file.isOverwrite && exists) btn.style.background = '#f59e0b';
            bar.appendChild(btn);
        });
    }

    if (bar.children.length > 0) {
        container.style.position = 'relative';
        container.appendChild(bar);
    }
}
