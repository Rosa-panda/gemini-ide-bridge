/**
 * 文件树渲染模块
 */

import { fs } from '../core/fs.js';
import { gemini } from '../gemini/index.js';
import { createIcon } from './icons.js';
import { showFolderContextMenu, showFileContextMenu } from './menu.js';
import { getLanguage } from '../shared/utils.js';

/**
 * 高亮文件名中的搜索词
 */
function highlightName(name, searchTerm) {
    if (!searchTerm) return document.createTextNode(name);

    // 转义正则特殊字符
    const safeTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, function(match) {
        return '\\' + match;
    });
    const regex = new RegExp('(' + safeTerm + ')', 'gi');
    const parts = name.split(regex);
    
    if (parts.length === 1) return document.createTextNode(name);

    const fragment = document.createDocumentFragment();
    parts.forEach(part => {
        if (part.toLowerCase() === searchTerm) {
            const highlight = document.createElement('span');
            highlight.className = 'ide-highlight';
            highlight.textContent = part;
            fragment.appendChild(highlight);
        } else if (part) {
            fragment.appendChild(document.createTextNode(part));
        }
    });

    return fragment;
}

/**
 * 渲染文件树
 */
export function renderTree(container, tree, folderStates, currentTree, matches = null, searchTerm = '', matchCount = 0) {
    while (container.firstChild) container.removeChild(container.firstChild);
    
    const hint = document.createElement('div');
    Object.assign(hint.style, {
        padding: '6px 8px', marginBottom: '8px', background: 'var(--ide-hint-bg)',
        borderRadius: '4px', fontSize: '11px', color: 'var(--ide-hint-text)'
    });
    hint.textContent = matches ? `🔍 找到 ${matchCount} 个匹配文件` : '💡 点击文件发送 | 右键文件夹更多';
    container.appendChild(hint);
    
    buildTreeNodes(container, tree, 0, folderStates, currentTree, matches, searchTerm);
}

/**
 * 构建树节点
 */
function buildTreeNodes(container, nodes, level, folderStates, currentTree, matches, searchTerm) {
    const refreshTree = () => window.dispatchEvent(new CustomEvent('ide-refresh-tree'));
    
    const collectFiles = async (node, maxFiles = 20) => {
        const files = [];
        const collect = (n) => {
            if (n.kind === 'file') files.push(n);
            if (n.children) n.children.forEach(collect);
        };
        collect(node);
        
        if (files.length > maxFiles) files.length = maxFiles;
        
        let result = `目录 \`${node.path}\` 文件内容:\n\n`;
        for (const file of files) {
            const content = await fs.readFile(file.path);
            if (content !== null) {
                const lang = getLanguage(file.name);
                result += `### ${file.path}\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
            }
        }
        return result;
    };

    nodes.forEach(node => {
        if (matches && !matches.has(node.path)) return;

        const item = document.createElement('div');
        Object.assign(item.style, {
            padding: '5px 4px', paddingLeft: (level * 14 + 4) + 'px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            cursor: 'pointer', borderRadius: '3px', margin: '1px 0',
            display: 'flex', alignItems: 'center', gap: '4px'
        });
        item.title = node.path;
        item.classList.add('ide-tree-item');

        if (node.kind === 'directory') {
            const isExpanded = folderStates.get(node.path) || false;
            
            const arrow = createIcon(isExpanded ? 'arrowDown' : 'arrowRight', 12, 'var(--ide-text-secondary)');
            Object.assign(arrow.style, { width: '16px', minWidth: '16px' });
            
            const icon = createIcon('folder', 14, 'var(--ide-text-folder)');
            
            const name = document.createElement('span');
            name.appendChild(highlightName(node.name, searchTerm));
            name.style.color = 'var(--ide-text)';
            name.style.fontWeight = '500';
            
            item.appendChild(arrow);
            item.appendChild(icon);
            item.appendChild(name);
            
            item.onclick = async () => {
                const willExpand = !isExpanded;
                
                // 懒加载核心：如果准备展开且子节点为空，则去读取
                if (willExpand && (!node.children || node.children.length === 0)) {
                    item.style.opacity = '0.5';
                    const children = await fs.readDirectory(node.path);
                    if (children) {
                        node.children = children;
                    }
                    item.style.opacity = '1';
                }

                folderStates.set(node.path, willExpand);
                renderTree(container, currentTree, folderStates, currentTree);
            };
            
            item.oncontextmenu = (e) => showFolderContextMenu(e, node, refreshTree, collectFiles);
            
            container.appendChild(item);
            
            if (isExpanded && node.children) {
                buildTreeNodes(container, node.children, level + 1, folderStates, currentTree, matches, searchTerm);
            }
        } else {
            const spacer = document.createElement('span');
            spacer.style.width = '16px'; 
            spacer.style.minWidth = '16px';
            
            const icon = createIcon('file', 14, 'var(--ide-text-secondary)');
            
            const name = document.createElement('span');
            name.appendChild(highlightName(node.name, searchTerm));
            name.style.color = 'var(--ide-text-secondary)';
            
            item.appendChild(spacer);
            item.appendChild(icon);
            item.appendChild(name);
            
            item.onclick = async () => {
                item.style.opacity = '0.5';
                const content = await fs.readFile(node.path);
                item.style.opacity = '1';
                
                if (content !== null) {
                    gemini.sendFile(node.path, content);
                }
            };

            item.oncontextmenu = (e) => showFileContextMenu(e, node, refreshTree);
            
            container.appendChild(item);
        }
    });
}

/**
 * 过滤文件树
 */
export function filterTree(term, currentTree, folderStates, renderCallback) {
    const searchTerm = term.trim().toLowerCase();
    
    if (!searchTerm) {
        renderCallback(currentTree, null, '', 0);
        return;
    }

    const matches = new Set();
    const parentsToExpand = new Set();
    let fileMatchCount = 0;

    const search = (nodes) => {
        let foundInBranch = false;
        for (const node of nodes) {
            const isMatch = node.name.toLowerCase().includes(searchTerm);
            let hasMatchedChild = false;

            if (node.kind === 'directory' && node.children) {
                hasMatchedChild = search(node.children);
            }

            if (isMatch || hasMatchedChild) {
                matches.add(node.path);
                foundInBranch = true;
                if (isMatch && node.kind === 'file') {
                    fileMatchCount++;
                }
                if (hasMatchedChild) {
                    parentsToExpand.add(node.path);
                }
            }
        }
        return foundInBranch;
    };

    search(currentTree);
    parentsToExpand.forEach(path => folderStates.set(path, true));
    renderCallback(currentTree, matches, searchTerm, fileMatchCount);
}
