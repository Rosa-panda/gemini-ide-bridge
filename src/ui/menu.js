/**
 * 右键菜单模块
 */

import { fs } from '../core/fs.js';
import { gemini } from '../gemini/index.js';
import { depsAnalyzer } from '../core/deps.js';
import { showHistoryDialog, showEditorDialog } from '../dialog/index.js';
import { showToast, getLanguage, formatTokens } from '../shared/utils.js';
import { generateSkeleton } from '../core/skeleton.js';

/**
 * 创建菜单项
 */
export function createMenuItem(text, onClick, bgColor = null) {
    const item = document.createElement('div');
    item.textContent = text;
    Object.assign(item.style, {
        padding: '8px 12px', cursor: 'pointer', fontSize: '12px', 
        color: bgColor ? '#ef4444' : 'var(--ide-text)'
    });
    item.onmouseover = () => { 
        item.style.background = bgColor || 'var(--ide-hover)'; 
    };
    item.onmouseout = () => { item.style.background = 'transparent'; };
    item.onclick = (e) => {
        e.stopPropagation();
        document.getElementById('ide-context-menu').style.display = 'none';
        onClick();
    };
    return item;
}

/**
 * 创建菜单分隔线
 */
export function createMenuDivider() {
    const divider = document.createElement('div');
    Object.assign(divider.style, {
        height: '1px', background: 'var(--ide-border)', margin: '4px 0'
    });
    return divider;
}

/**
 * 显示文件夹右键菜单
 */
export function showFolderContextMenu(e, node, refreshTree, collectFiles) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = document.getElementById('ide-context-menu');
    if (!menu) return;
    
    while (menu.firstChild) menu.removeChild(menu.firstChild);
    
    // 发送目录结构
    menu.appendChild(createMenuItem('📋 发送目录结构', () => {
        const structure = fs.generateStructure(node);
        gemini.sendStructure(node.path, structure);
    }));
    
    // 发送所有文件
    menu.appendChild(createMenuItem('📦 发送所有文件', async () => {
        showToast('读取中...', 'info');
        const content = await collectFiles(node);
        const result = gemini.insertToInput(content);
        if (result.success) {
            showToast(`已发送 (~${formatTokens(result.tokens)} tokens)`);
        }
    }));

    // 发送骨架图
    menu.appendChild(createMenuItem('🗺️ 发送骨架图', async () => {
        showToast('生成骨架图中...', 'info');
        try {
            // 收集该文件夹下的所有文件路径
            const collectFilePaths = (n) => {
                const paths = [];
                if (n.kind === 'file') {
                    paths.push(n.path);
                } else if (n.children) {
                    for (const child of n.children) {
                        paths.push(...collectFilePaths(child));
                    }
                }
                return paths;
            };
            
            const filePaths = collectFilePaths(node);
            const skeletons = [];
            
            for (const path of filePaths) {
                // 跳过二进制文件和大文件
                if (path.match(/\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|zip|gz)$/i)) continue;
                
                const content = await fs.readFile(path);
                if (content === null || content.length > 100000) continue;
                
                const skeleton = generateSkeleton(content, path);
                if (skeleton.trim()) {
                    skeletons.push(skeleton);
                }
            }
            
            if (skeletons.length === 0) {
                showToast('该目录下没有可分析的代码文件', 'error');
                return;
            }
            
            const fullMap = skeletons.join('\n\n');
            const result = gemini.insertToInput(`# ${node.name} 目录骨架图\n\n${fullMap}\n\n---\n请分析这个目录的结构和功能。`);
            if (result.success) {
                showToast(`已发送骨架图 (~${formatTokens(result.tokens)} tokens)`);
            }
        } catch (err) {
            showToast('生成失败: ' + err.message, 'error');
        }
    }));

    menu.appendChild(createMenuDivider());

    // 新建文件
    menu.appendChild(createMenuItem('➕ 新建文件', async () => {
        const fileName = prompt('输入文件名:');
        if (!fileName || !fileName.trim()) return;
        const newPath = node.path + '/' + fileName.trim();
        if (await fs.createFile(newPath, '')) {
            showToast('已创建: ' + fileName);
            await refreshTree();
        } else {
            showToast('创建失败', 'error');
        }
    }));

    // 新建文件夹
    menu.appendChild(createMenuItem('📁 新建文件夹', async () => {
        const folderName = prompt('输入文件夹名:');
        if (!folderName || !folderName.trim()) return;
        const newPath = node.path + '/' + folderName.trim() + '/.gitkeep';
        if (await fs.createFile(newPath, '')) {
            showToast('已创建: ' + folderName);
            await refreshTree();
        } else {
            showToast('创建失败', 'error');
        }
    }));

    menu.appendChild(createMenuDivider());

    // 删除目录
    menu.appendChild(createMenuItem('🗑️ 删除目录', async () => {
        if (!confirm(`确定删除目录 "${node.name}" 及其所有内容？\n\n⚠️ 此操作不可撤销！`)) return;
        if (await fs.deleteDirectory(node.path)) {
            showToast('已删除: ' + node.name);
            await refreshTree();
        } else {
            showToast('删除失败', 'error');
        }
    }, '#dc2626'));
    
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 150) + 'px';
}

/**
 * 显示文件右键菜单
 */
export function showFileContextMenu(e, node, refreshTree) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = document.getElementById('ide-context-menu');
    if (!menu) return;
    
    while (menu.firstChild) menu.removeChild(menu.firstChild);

    // 发送文件
    menu.appendChild(createMenuItem('📤 发送到对话', async () => {
        const content = await fs.readFile(node.path);
        if (content !== null) {
            gemini.sendFile(node.path, content);
        }
    }));

    // 编辑文件
    menu.appendChild(createMenuItem('✏️ 编辑文件', async () => {
        await showEditorDialog(node.path);
    }));

    // 发送文件及依赖
    const fileType = depsAnalyzer.getFileType(node.path);
    if (fileType) {
        menu.appendChild(createMenuItem('🔗 发送文件+依赖', async () => {
            showToast('正在分析依赖关系...', 'info');
            const { all } = await depsAnalyzer.getFileWithDeps(node.path);
            
            if (all.length <= 1) {
                const content = await fs.readFile(node.path);
                if (content !== null) gemini.sendFile(node.path, content);
                return;
            }
            
            let text = `核心文件 \`${node.path}\` 及其关联依赖 (${all.length - 1} 个):\n\n`;
            for (const filePath of all) {
                const content = await fs.readFile(filePath);
                if (content !== null) {
                    const lang = getLanguage(filePath);
                    text += `### ${filePath}\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
                }
            }
            
            const result = gemini.insertToInput(text);
            if (result.success) {
                showToast(`已发送主文件及 ${all.length - 1} 个依赖 (~${formatTokens(result.tokens)} tokens)`);
            }
        }));
    }

    menu.appendChild(createMenuDivider());

    // 查看历史版本
    menu.appendChild(createMenuItem('⏪ 历史版本', async () => {
        await showHistoryDialog(node.path);
    }));

    // 快速撤销
    menu.appendChild(createMenuItem('↩️ 撤销上次修改', async () => {
        const result = await fs.revertFile(node.path);
        if (result.success) {
            showToast('已撤销');
        } else {
            showToast(result.error || '撤销失败', 'error');
        }
    }));

    menu.appendChild(createMenuDivider());

    // 删除文件
    menu.appendChild(createMenuItem('🗑️ 删除文件', async () => {
        if (!confirm(`确定删除文件 "${node.name}"？`)) return;
        if (await fs.deleteFile(node.path)) {
            showToast('已删除: ' + node.name);
            await refreshTree();
        } else {
            showToast('删除失败', 'error');
        }
    }, '#dc2626'));

    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
}
