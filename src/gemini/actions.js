/**
 * 按钮注入和操作模块
 */

import { fs } from '../core/fs.js';
import { parseDelete, parseSearchReplace, parseMultipleFiles, parseRead } from '../core/parser.js';
import { tryReplace, checkJsSyntax } from '../core/patcher/index.js';
import { markAsApplied, unmarkAsApplied, getPatchKey } from '../core/state.js';
import { showPreviewDialog } from '../dialog/index.js';
import { showToast, getLanguage, estimateTokens, formatTokens } from '../shared/utils.js';
import { buildMismatchContext, buildSyntaxErrorContext, buildDuplicateContext, buildFileNotFoundContext, buildReadErrorContext } from './feedback.js';

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
 * 添加"发送当前文件"按钮
 */
function addSendFileButton(bar, filePath, insertToInput) {
    const fileName = filePath.split('/').pop();
    const sendBtn = createActionButton(`📤 发送 → ${fileName}`, async () => {
        const content = await fs.readFile(filePath);
        if (content === null) {
            showToast('读取失败', 'error');
            return;
        }
        const lang = getLanguage(filePath);
        const text = `📄 **文件最新状态** - \`${filePath}\`\n\n以下是该文件当前的完整内容（已应用所有修改）：\n\n\`\`\`${lang}\n${content}\n\`\`\``;
        insertToInput(text);
        showToast(`已发送: ${fileName} (~${formatTokens(estimateTokens(text))} tokens)`);
    });
    sendBtn.className = 'ide-send-btn';
    sendBtn.title = `发送 ${filePath} 的最新内容给 AI`;
    sendBtn.style.background = '#8b5cf6';
    bar.appendChild(sendBtn);
}

/**
 * 添加补丁撤销按钮
 * @param {HTMLElement} bar - 操作栏
 * @param {Object} patch - 补丁对象
 * @param {Function} insertToInput - 输入框插入函数
 * @param {HTMLElement} originalBtn - 原始的应用按钮（撤销后恢复它）
 * @param {number} idx - 补丁索引
 */
function addUndoButtonForPatch(bar, patch, insertToInput, originalBtn = null, idx = 0) {
    const fileName = patch.file.split('/').pop();
    const undoBtn = createActionButton(`↩️ 撤销 → ${fileName}`, async () => {
        const result = await fs.revertFile(patch.file);
        if (result.success) {
            showToast('已撤销: ' + patch.file);
            unmarkAsApplied(patch.file, patch.search);
            undoBtn.remove();
            
            // 恢复原按钮状态
            if (originalBtn) {
                const btnText = patch.isDelete 
                    ? `🗑️ 删除代码 #${idx + 1} → ${patch.file}`
                    : `🔧 应用修改 #${idx + 1} → ${patch.file}`;
                originalBtn.textContent = btnText;
                originalBtn.style.background = patch.isDelete ? '#f59e0b' : '#2563eb';
                originalBtn.title = '';
            }
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
    
    // 文件不存在 → 自动反馈
    if (!fs.hasFile(file)) {
        showToast('文件不存在: ' + file, 'error');
        btn.textContent = '❌ 文件不存在';
        btn.style.background = '#dc2626';
        insertToInput(buildFileNotFoundContext(file, fs.getAllFilePaths()));
        return;
    }
    
    const content = await fs.readFile(file);
    // 读取失败 → 自动反馈
    if (content === null) {
        showToast('读取失败', 'error');
        btn.textContent = '❌ 读取失败';
        btn.style.background = '#dc2626';
        insertToInput(buildReadErrorContext(file));
        return;
    }
    
    const result = tryReplace(content, search, replace, file);
    if (!result.success) {
        if (result.isSyntaxError) {
            const shortError = result.errorDetails.length > 20 
                ? result.errorDetails.slice(0, 20) + '...' 
                : result.errorDetails;
            showToast(`⚠️ 语法检查未通过`, 'error');
            insertToInput(buildSyntaxErrorContext(file, result.errorDetails, search, replace, result.content));
            
            btn.textContent = `⚠️ 强制预览 (${shortError})`;
            btn.title = `语法错误: ${result.errorDetails}\n点击可强制预览并应用`;
            btn.style.background = '#f59e0b';
            
            btn.onclick = async () => {
                const confirmed = await showPreviewDialog(file, search, replace, result.matchLine || 1, result.errorDetails);
                if (confirmed) {
                    btn.textContent = '应用中...';
                    const success = await fs.writeFile(file, result.content);
                    if (success) {
                        btn.textContent = '✅ 已应用';
                        btn.style.background = '#059669';
                        showToast('已修改: ' + file);
                        markAsApplied(file, search);
                        addUndoButtonForPatch(bar, patch, insertToInput, btn, patch._idx || 0);
                    } else {
                        btn.textContent = '❌ 写入失败';
                        btn.style.background = '#dc2626';
                    }
                }
            };
            return;
        }

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
        btn.title = `于 ${new Date().toLocaleTimeString()} 应用成功`;
        btn.style.background = '#059669';
        showToast('已修改: ' + file);
        markAsApplied(file, search);
        addUndoButtonForPatch(bar, patch, insertToInput, btn, patch._idx || 0);
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
                const cleanPath = del.file.replace(/\/$/, '');
                // 严谨校验：只有在目录句柄池中的才视为目录
                const isDir = fs.dirHandles.has(cleanPath);
                
                // 安全阀：严禁通过此指令删除项目根目录
                if (cleanPath === '.' || cleanPath === '' || cleanPath === fs.projectName) {
                    showToast('禁止删除项目根目录', 'error');
                    return;
                }

                const typeText = isDir ? '目录' : '文件';
                const confirmMsg = isDir 
                    ? `⚠️ 危险操作！\n确认递归删除目录 "${cleanPath}" 及其内部所有文件吗？\n此操作不可恢复！`
                    : `确认删除文件 "${cleanPath}" 吗？`;

                if (!confirm(confirmMsg)) return;
                
                btn.textContent = '正在删除...';
                const success = isDir 
                    ? await fs.deleteDirectory(cleanPath) 
                    : await fs.deleteFile(cleanPath);
                
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
        // 收集所有涉及的文件（去重）
        const involvedFiles = new Set();
        
        patches.forEach((patch, idx) => {
            patch._idx = idx; // 保存索引供撤销时使用
            if (patch.file) involvedFiles.add(patch.file);
            
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
        });
        
        // 按文件分组批量检查已应用状态（避免同一文件重复读取）
        const filePatches = new Map(); // file -> [{patch, btn, idx}]
        patches.forEach((patch, idx) => {
            if (patch.file) {
                if (!filePatches.has(patch.file)) {
                    filePatches.set(patch.file, []);
                }
                filePatches.get(patch.file).push({ 
                    patch, 
                    btn: bar.children[idx], 
                    idx 
                });
            }
        });
        
        // 每个文件只读取一次，批量检查其所有补丁
        filePatches.forEach(async (items, filePath) => {
            if (!fs.hasFile(filePath)) return;
            
            const content = await fs.readFile(filePath);
            if (content === null) return;
            
            const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
            const normalizedContent = normalize(content);
            
            for (const { patch, btn, idx } of items) {
                const normalizedSearch = normalize(patch.search);
                const searchExists = normalizedContent.includes(normalizedSearch);
                
                if (!searchExists) {
                    // search 不存在，可能已应用
                    const data = JSON.parse(localStorage.getItem('ide-applied-patches') || '{}');
                    const key = getPatchKey(patch.file, patch.search);
                    if (data[key]) {
                        btn.textContent = `✅ 已应用 #${idx + 1} → ${patch.file}`;
                        btn.style.background = '#059669';
                        addUndoButtonForPatch(bar, patch, insertToInput, btn, idx);
                    }
                }
            }
        });
        
        // 为每个涉及的文件添加发送按钮（只要文件存在）
        involvedFiles.forEach(filePath => {
            if (fs.hasFile(filePath)) {
                addSendFileButton(bar, filePath, insertToInput);
            }
        });
    } else if (text.includes('FILE:')) {
        const filesToProcess = parseMultipleFiles(text);
        
        // 收集所有涉及的文件（去重）
        const involvedFiles = new Set();
        
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
            if (exists) involvedFiles.add(file.path);
            
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
                        // 新建成功后添加发送按钮
                        addSendFileButton(bar, file.path, insertToInput);
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
        
        // 为每个已存在的文件添加发送按钮
        involvedFiles.forEach(filePath => {
            addSendFileButton(bar, filePath, insertToInput);
        });
    }

    // READ 指令（请求读取文件片段）
    const reads = parseRead(text);
    if (reads.length > 0) {
        reads.forEach(read => {
            const fileName = read.file.split('/').pop();
            const rangeText = read.startLine && read.endLine 
                ? ` (${read.startLine}-${read.endLine}行)` 
                : ' (全部)';
            
            const btn = createActionButton(`📖 读取 → ${fileName}${rangeText}`, async () => {
                if (!fs.hasFile(read.file)) {
                    showToast('文件不存在: ' + read.file, 'error');
                    btn.textContent = '❌ 文件不存在';
                    btn.style.background = '#dc2626';
                    return;
                }
                
                const content = await fs.readFile(read.file);
                if (content === null) {
                    showToast('读取失败', 'error');
                    return;
                }
                
                const lines = content.split('\n');
                const totalLines = lines.length;
                
                let selectedContent;
                let rangeInfo;
                
                if (read.startLine && read.endLine) {
                    // 指定行号范围
                    const start = Math.max(1, read.startLine) - 1;
                    const end = Math.min(totalLines, read.endLine);
                    selectedContent = lines.slice(start, end).join('\n');
                    rangeInfo = `第 ${read.startLine}-${read.endLine} 行（共 ${totalLines} 行）`;
                } else {
                    // 读取整个文件
                    selectedContent = content;
                    rangeInfo = `全部内容（共 ${totalLines} 行）`;
                }
                
                const lang = getLanguage(read.file);
                const responseText = `📄 **文件片段** - \`${read.file}\` ${rangeInfo}\n\n\`\`\`${lang}\n${selectedContent}\n\`\`\``;
                
                insertToInput(responseText);
                showToast(`已发送: ${fileName} (~${formatTokens(estimateTokens(responseText))} tokens)`);
                
                btn.textContent = `✅ 已发送 → ${fileName}`;
                btn.style.background = '#059669';
            });
            btn.style.background = '#10b981';
            bar.appendChild(btn);
        });
    }

    if (bar.children.length > 0) {
        container.style.position = 'relative';
        container.appendChild(bar);
    }
}
