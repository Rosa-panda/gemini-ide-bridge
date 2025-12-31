/**
 * Gemini 交互模块 - 处理与 Gemini 页面的交互
 */

import { fs } from './fs.js';
import { showToast, getLanguage, estimateTokens, formatTokens } from './utils.js';
import { showPreviewDialog } from './dialog.js';
import { extractFilePath, isOverwriteMode, parseDelete, parseSearchReplace, cleanContent, parseMultipleFiles } from './parser.js';
import { tryReplace, checkJsSyntax } from './patcher.js';
import { markAsApplied, unmarkAsApplied, checkIfApplied } from './state.js';

export const gemini = {
    observer: null,
    processedBlocks: new WeakSet(),

    // 插入文本到 Gemini 输入框
    insertToInput(text) {
        const selectors = [
            'rich-textarea .ql-editor',
            'rich-textarea [contenteditable="true"]',
            '.ql-editor[contenteditable="true"]',
            'div[contenteditable="true"]'
        ];
        
        let inputEl = null;
        for (const sel of selectors) {
            inputEl = document.querySelector(sel);
            if (inputEl) break;
        }
        
        if (!inputEl) {
            showToast('找不到输入框', 'error');
            return false;
        }
        
        inputEl.focus();
        // 使用 execCommand 或模拟更自然的输入，确保编辑器状态同步
        const existing = inputEl.innerText || '';
        const newContent = existing ? existing + '\n\n' + text : text;
        
        // 优先使用 innerText 触发编辑器的内部渲染逻辑
        inputEl.innerText = newContent;
        
        // 连续发送两个事件确保编辑器感应
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(inputEl);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // 返回新增的 token 数
        return { success: true, tokens: estimateTokens(text) };
    },

    sendFile(filePath, content) {
        const lang = getLanguage(filePath);
        const text = `文件 \`${filePath}\`:\n\n\`\`\`${lang}\n${content}\n\`\`\``;
        const result = this.insertToInput(text);
        if (result.success) {
            showToast(`已发送: ${filePath.split('/').pop()} (~${formatTokens(result.tokens)} tokens)`);
        }
        return result.success;
    },

    sendStructure(name, structure) {
        const text = `目录 \`${name}\` 结构:\n\n\`\`\`\n${structure}\`\`\``;
        const result = this.insertToInput(text);
        if (result.success) {
            showToast(`已发送目录 (~${formatTokens(result.tokens)} tokens)`);
        }
        return result.success;
    },

    // 开始监听 AI 输出
    startWatching() {
        if (this.observer) return;
        
        this.observer = new MutationObserver(() => {
            this._processCodeBlocks();
        });
        
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this._processCodeBlocks();
        console.log('[Gemini] 开始监听代码块');
    },

    _processCodeBlocks() {
        const codeBlocks = document.querySelectorAll('code-block, pre > code, .code-block');
        
        codeBlocks.forEach(block => {
            if (this.processedBlocks.has(block)) return;
            this.processedBlocks.add(block);
            
            const container = block.closest('code-block') || block.closest('pre') || block;
            if (container.querySelector('.ide-action-bar')) return;
            
            const text = block.textContent || '';
            
            // 防误触：只跳过明确标记忽略的
            if (text.includes('IGNORE_IDE_ACTION')) return;

            const fileMatch = extractFilePath(text);
            // 兼容 6-7 个符号的格式
            const hasSearchReplace = /<{6,7} SEARCH/.test(text) && />{6,7} REPLACE/.test(text);
            const hasDelete = /<{6,7} DELETE/.test(text) && />{6,7} END/.test(text);
            
            // 简化判断：有完整的 SEARCH/REPLACE 结构，或有 FILE: 标记，或有 DELETE 结构
            if (fileMatch || hasSearchReplace || hasDelete) {
                this._injectActionBar(container, text, fileMatch);
            }
        });
    },

    _injectActionBar(container, text, filePath) {
        const bar = document.createElement('div');
        bar.className = 'ide-action-bar';
        Object.assign(bar.style, {
            display: 'flex', gap: '8px', padding: '8px',
            background: 'var(--ide-hint-bg, #363739)', 
            borderRadius: '0 0 6px 6px',
            borderTop: '1px solid var(--ide-border, #444746)', 
            flexWrap: 'wrap'
        });

        // 解析删除指令
        const deletes = parseDelete(text);
        if (deletes.length > 0) {
            // 多文件时显示批量删除按钮
            if (deletes.length > 1) {
                const batchBtn = this._createButton(`🗑️ 批量删除 (${deletes.length}个文件)`, async () => {
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
            
            // 每个文件单独的删除按钮
            deletes.forEach(del => {
                const btn = this._createButton(`🗑️ 删除 → ${del.file}`, async () => {
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

        // 解析增量修改块
        const patches = parseSearchReplace(text);
        
        if (patches.length > 0) {
            // 单个修改按钮（同步创建，异步检查状态）
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
                    await this._applyPatch(patch, btn, bar);
                };
                
                bar.appendChild(btn);

                // 异步检查是否已应用（不阻塞按钮创建）
                if (patch.file) {
                    checkIfApplied(patch.file, patch.search, patch.replace, fs).then(status => {
                        if (status.applied) {
                            btn.textContent = `✅ 已应用 #${idx + 1} → ${patch.file}`;
                            btn.style.background = '#059669';
                            this._addUndoButtonForPatch(bar, patch);
                        }
                    });
                }
            });
        } else if (text.includes('FILE:')) {
            // 解析所有 FILE: 块
            const filesToProcess = parseMultipleFiles(text);
            
            if (filesToProcess.length > 1) {
                // 批量创建按钮
                const batchBtn = this._createButton(`➕ 批量创建/覆盖 (${filesToProcess.length}个文件)`, async () => {
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
                batchBtn.style.background = '#8b5cf6'; // 紫色区分
                bar.appendChild(batchBtn);
            }
            
            // 每个文件单独的按钮
            filesToProcess.forEach(file => {
                const exists = fs.hasFile(file.path);
                const btnText = file.isOverwrite && exists 
                    ? `📝 覆盖 → ${file.path}` 
                    : (exists ? `💾 保存 → ${file.path}` : `➕ 创建 → ${file.path}`);
                
                const btn = this._createButton(btnText, async () => {
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
                            this._addUndoButton(bar, file.path);
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
    },

    _createButton(text, onClick) {
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
    },

    // 应用增量修改
    async _applyPatch(patch, btn, bar) {
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
            showToast('未找到匹配内容', 'error');
            btn.textContent = '❌ 未匹配';
            btn.style.background = '#dc2626';
            return;
        }

        // 临时禁用按钮，防止重复点击触发多个对话框
        btn.disabled = true;
        btn.style.opacity = '0.5';

        // JS/TS 语法检查 - 防止 Gemini 生成的错误代码被应用
        const syntaxCheck = checkJsSyntax(result.content, file);
        if (!syntaxCheck.valid) {
            const shortError = syntaxCheck.error.length > 30 
                ? syntaxCheck.error.slice(0, 30) + '...' 
                : syntaxCheck.error;
            showToast(`❌ 语法错误: ${syntaxCheck.error}`, 'error');
            btn.textContent = `❌ ${shortError}`;
            btn.title = `语法错误: ${syntaxCheck.error}`; // 悬停显示完整错误
            btn.style.background = '#dc2626';
            console.error('[Gemini] 语法检查失败:', file, syntaxCheck.error);
            return;
        }

        const confirmed = await showPreviewDialog(file, search, replace);
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
            this._addUndoButtonForPatch(bar, patch);
        } else {
            btn.textContent = '❌ 写入失败';
            btn.style.background = '#dc2626';
        }
    },

    _addUndoButton(bar, filePath) {
        const fileName = filePath.split('/').pop();
        const undoBtn = this._createButton(`↩️ 撤销 → ${fileName}`, async () => {
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
    },

    _addUndoButtonForPatch(bar, patch) {
        const fileName = patch.file.split('/').pop();
        const undoBtn = this._createButton(`↩️ 撤销 → ${fileName}`, async () => {
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
    },

};
