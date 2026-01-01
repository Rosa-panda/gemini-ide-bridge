/**
 * UI 模块入口
 */

import { fs } from '../core/fs.js';
import { gemini } from '../gemini/index.js';
import { getSystemPrompt } from '../shared/prompt.js';
import { showToast, formatTokens, getLanguage } from '../shared/utils.js';
import { initThemeStyle, updateTheme } from '../shared/theme.js';
import { createTrigger, createSidebar, createEmptyState, createContextMenu, createButton } from './sidebar.js';
import { renderTree, filterTree } from './tree.js';

class UI {
    constructor() {
        this.folderStates = new Map();
        this.currentTree = null;
    }

    init() {
        if (document.getElementById('ide-bridge-root')) return;
        
        const root = document.createElement('div');
        root.id = 'ide-bridge-root';
        
        root.appendChild(createSidebar((term) => this._filterTree(term)));
        root.appendChild(createTrigger(this.currentTree));
        root.appendChild(createContextMenu());
        root.appendChild(initThemeStyle());

        // 添加空状态
        const treeContainer = root.querySelector('#ide-tree-container');
        treeContainer.appendChild(createEmptyState(() => this.handleConnect()));

        document.body.appendChild(root);
        
        setInterval(() => updateTheme(), 2000);
        
        document.addEventListener('click', () => {
            const menu = document.getElementById('ide-context-menu');
            if (menu) menu.style.display = 'none';
        });

        window.addEventListener('ide-refresh-tree', () => {
            if (this.currentTree) {
                this.refreshTree();
            }
        });
    }

    async refreshTree() {
        const result = await fs.refreshProject();
        if (result.success) {
            this.currentTree = result.tree;
            this._renderTree(result.tree);
            const trigger = document.getElementById('ide-trigger');
            if (trigger && result.rootName) {
                trigger.textContent = '✅ ' + result.rootName;
            }
        }
    }

    _filterTree(term) {
        filterTree(term, this.currentTree, this.folderStates, (tree, matches, searchTerm, matchCount) => {
            this._renderTree(tree, matches, searchTerm, matchCount);
        });
    }

    _renderTree(tree, matches = null, searchTerm = '', matchCount = 0) {
        const container = document.getElementById('ide-tree-container');
        if (!container) return;
        renderTree(container, tree, this.folderStates, this.currentTree, matches, searchTerm, matchCount);
    }

    async handleConnect() {
        const connectBtn = document.getElementById('ide-action-connect');
        if (connectBtn) connectBtn.textContent = '连接中...';
        
        const result = await fs.openProject();
        
        if (result.success) {
            this.currentTree = result.tree;
            
            const trigger = document.getElementById('ide-trigger');
            if (trigger) {
                trigger.textContent = '✅ ' + result.rootName;
                trigger.style.background = '#059669';
                trigger.style.borderColor = '#34d399';
            }
            
            this._renderActionBar();
            this._renderTree(result.tree);

            const dot = document.getElementById('ide-status-dot');
            if (dot) dot.style.display = 'block';
            
            gemini.startWatching();
        } else {
            if (connectBtn) connectBtn.textContent = '连接文件夹';
        }
    }

    _renderActionBar() {
        const actionBar = document.getElementById('ide-action-bar');
        if (!actionBar) return;
        
        Object.assign(actionBar.style, {
            display: 'flex', gap: '8px', padding: '12px 16px',
            borderBottom: '1px solid var(--ide-border)',
            background: 'transparent'
        });

        while (actionBar.firstChild) actionBar.removeChild(actionBar.firstChild);
        
        // 提示词
        actionBar.appendChild(createButton('🤖 提示词', () => {
            const result = gemini.insertToInput(getSystemPrompt());
            if (result.success) {
                showToast(`已发送系统协议 (~${formatTokens(result.tokens)} tokens)`);
            }
        }));

        // 发送目录
        actionBar.appendChild(createButton('📋 发送目录', () => {
            const structure = fs.generateFullStructure(this.currentTree);
            const text = `项目 "${fs.projectName}" 目录:\n\n\`\`\`\n${structure}\`\`\``;
            const result = gemini.insertToInput(text);
            if (result.success) {
                showToast(`已发送目录 (~${formatTokens(result.tokens)} tokens)`);
            }
        }));
        
        // 刷新
        actionBar.appendChild(createButton('🔄 刷新', () => this.refreshTree()));
    }
}

export const ui = new UI();
