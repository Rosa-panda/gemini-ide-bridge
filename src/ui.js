/**
 * UI 模块 - 侧边栏和文件树渲染
 */

import { fs } from './fs.js';
import { gemini } from './gemini.js';
import { getLanguage, showToast, estimateTokens, formatTokens } from './utils.js';
import { initThemeStyle, updateTheme } from './theme.js';
import { showHistoryDialog } from './dialog.js';
import { getSystemPrompt } from './prompt.js';
import { depsAnalyzer } from './deps.js';

class UI {
    constructor() {
        this.folderStates = new Map();
        this.currentTree = null;
    }

    init() {
        if (document.getElementById('ide-bridge-root')) return;
        
        const root = document.createElement('div');
        root.id = 'ide-bridge-root';
        
        root.appendChild(this._createSidebar());
        root.appendChild(this._createTrigger());
        root.appendChild(this._createContextMenu());
        
        // 🎨 注入主题样式 (使用 theme.js 模块)
        root.appendChild(initThemeStyle());

        document.body.appendChild(root);
        
        // 监听主题变化（定时检测，因为 Gemini 可能动态切换）
        setInterval(() => updateTheme(), 2000);
        
        document.addEventListener('click', () => {
            const menu = document.getElementById('ide-context-menu');
            if (menu) menu.style.display = 'none';
        });

        // 监听文件树刷新事件
        window.addEventListener('ide-refresh-tree', () => {
            if (this.currentTree) {
                this.refreshTree(); // 👈 改为调用静默刷新
            }
        });
    }

    // 🔄 新增：静默刷新 UI
    async refreshTree() {
        const result = await fs.refreshProject();
        if (result.success) {
            this.currentTree = result.tree;
            this._renderTree(result.tree);
            // 更新触发器状态
            const trigger = document.getElementById('ide-trigger');
            if (trigger && result.rootName) {
                trigger.textContent = '✅ ' + result.rootName;
            }
        }
    }

    // 🛡️ 安全的 SVG 图标生成器 (Trusted Types Safe)
    _createIcon(name, size = 14, color = 'currentColor') {
        const icons = {
            folder: 'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z',
            file: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7',
            logo: 'M16 18l6-6-6-6 M8 6l-6 6 6 6 M12.5 4l-3 16',
            close: 'M18 6L6 18M6 6l12 12',
            arrowRight: 'M9 18l6-6-6-6',
            arrowDown: 'M6 9l6 6 6-6'
        };

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', color);
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.classList.add('ide-icon');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', icons[name] || icons.file);
        svg.appendChild(path);
        
        return svg;
    }

    _createTrigger() {
        const trigger = document.createElement('div');
        trigger.id = 'ide-trigger';
        trigger.textContent = '⚡️';
        Object.assign(trigger.style, {
            position: 'fixed', bottom: '20px', right: '20px', // 改到右下角，符合工具直觉
            zIndex: '2147483646', width: '40px', height: '40px',
            background: 'var(--ide-bg)', color: 'var(--ide-text)',
            border: '1px solid var(--ide-border)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: 'var(--ide-shadow)',
            fontSize: '18px', transition: 'all 0.2s', userSelect: 'none'
        });
        
        trigger.classList.add('ide-glass'); // 添加毛玻璃

        // 悬停展开效果
        trigger.onmouseover = () => {
            trigger.style.width = 'auto';
            trigger.style.borderRadius = '20px';
            trigger.style.padding = '0 12px';
            trigger.textContent = '⚡️ IDE Bridge';
        };
        trigger.onmouseout = () => {
            // 如果没连接项目，恢复原状
            if (!this.currentTree) {
                trigger.style.width = '40px';
                trigger.style.padding = '0';
                trigger.style.borderRadius = '50%';
                trigger.textContent = '⚡️';
            }
        };

        trigger.onclick = () => {
            const sidebar = document.getElementById('ide-sidebar');
            // 切换显示状态
            const isHidden = sidebar.style.transform === 'translateX(100%)';
            sidebar.style.transform = isHidden ? 'translateX(0)' : 'translateX(100%)';
        };
        return trigger;
    }

    _createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'ide-sidebar';
        sidebar.classList.add('ide-glass'); // 使用 CSS 类控制背景
        
        Object.assign(sidebar.style, {
            position: 'fixed', right: '0', top: '0',
            width: '360px', height: '100vh',
            background: 'var(--ide-bg)', // 使用变量
            borderLeft: '1px solid var(--ide-border)',
            zIndex: '2147483647', 
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // 更平滑的动画
            transform: 'translateX(100%)', // 默认隐藏 (使用 transform 性能更好)
            color: 'var(--ide-text)', display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--ide-shadow)', 
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px', lineHeight: '1.5'
        });

        // 标题栏
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '12px 16px', borderBottom: '1px solid var(--ide-border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'transparent' // 透明背景，透出 sidebar 的 glass 效果
        });
        
        const title = document.createElement('div');
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.gap = '8px';
        title.style.fontWeight = '600';
        title.style.color = 'var(--ide-text)';
        title.style.fontSize = '14px';
        
        const logoIcon = this._createIcon('logo', 16, 'var(--ide-accent)');
        const titleText = document.createElement('span');
        titleText.textContent = 'Gemini IDE';
        
        // 新增：在线状态指示灯
        const statusDot = document.createElement('div');
        Object.assign(statusDot.style, {
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#059669', marginLeft: '4px',
            boxShadow: '0 0 8px #059669',
            display: this.currentTree ? 'block' : 'none'
        });
        statusDot.id = 'ide-status-dot';
        
        title.appendChild(logoIcon);
        title.appendChild(titleText);
        title.appendChild(statusDot);
        
        const closeBtn = document.createElement('button');
        closeBtn.style.display = 'flex';
        closeBtn.appendChild(this._createIcon('close', 18, 'var(--ide-text-secondary)'));
        Object.assign(closeBtn.style, {
            background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px', opacity: '0.7', transition: 'opacity 0.2s'
        });
        closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
        closeBtn.onmouseout = () => closeBtn.style.opacity = '0.7';
        closeBtn.onclick = () => { sidebar.style.transform = 'translateX(100%)'; };
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        sidebar.appendChild(header);

        // 操作栏
        const actionBar = document.createElement('div');
        actionBar.id = 'ide-action-bar';
        Object.assign(actionBar.style, {
            padding: '10px', borderBottom: '1px solid var(--ide-border)',
            display: 'none', gap: '8px'
        });
        sidebar.appendChild(actionBar);

        // 文件树
        const treeContainer = document.createElement('div');
        treeContainer.id = 'ide-tree-container';
        Object.assign(treeContainer.style, {
            flex: '1', overflowY: 'auto', padding: '8px', fontSize: '13px'
        });
        
        // 空状态
        const emptyState = this._createEmptyState();
        treeContainer.appendChild(emptyState);
        sidebar.appendChild(treeContainer);

        // 底部
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '8px', borderTop: '1px solid var(--ide-border)',
            fontSize: '10px', color: 'var(--ide-text-secondary)', textAlign: 'center'
        });
        footer.textContent = 'V1.0.0 | 支持版本回退';
        sidebar.appendChild(footer);

        return sidebar;
    }

    _createEmptyState() {
        const emptyState = document.createElement('div');
        Object.assign(emptyState.style, { textAlign: 'center', marginTop: '100px', color: '#6b7280' });
        
        const icon = document.createElement('div');
        icon.textContent = '📁';
        icon.style.fontSize = '40px';
        icon.style.marginBottom = '16px';
        
        const text = document.createElement('p');
        text.textContent = '未连接本地项目';
        
        const connectBtn = document.createElement('button');
        connectBtn.id = 'ide-action-connect';
        connectBtn.textContent = '连接文件夹';
        Object.assign(connectBtn.style, {
            marginTop: '16px', background: '#2563eb', color: 'white',
            border: 'none', padding: '10px 24px', borderRadius: '6px',
            cursor: 'pointer', fontWeight: 'bold'
        });
        connectBtn.onclick = () => this.handleConnect();
        
        emptyState.appendChild(icon);
        emptyState.appendChild(text);
        emptyState.appendChild(connectBtn);
        return emptyState;
    }

    _createContextMenu() {
        const menu = document.createElement('div');
        menu.id = 'ide-context-menu';
        // 🎨 移除固定色值，改用主题变量适配亮/暗模式
        Object.assign(menu.style, {
            position: 'fixed', display: 'none', 
            background: 'var(--ide-bg)', 
            border: '1px solid var(--ide-border)', 
            borderRadius: '6px',
            boxShadow: 'var(--ide-shadow)', 
            zIndex: '2147483648',
            minWidth: '160px', padding: '4px 0',
            backdropFilter: 'blur(12px)'
        });
        return menu;
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

            // 更新状态灯
            const dot = document.getElementById('ide-status-dot');
            if (dot) dot.style.display = 'block';
            
            // 开始监听 AI 输出
            gemini.startWatching();
        } else {
            if (connectBtn) connectBtn.textContent = '连接文件夹';
        }
    }

    _renderActionBar() {
        const actionBar = document.getElementById('ide-action-bar');
        if (!actionBar) return;
        
        // 容器样式优化
        Object.assign(actionBar.style, {
            display: 'flex', gap: '8px', padding: '12px 16px',
            borderBottom: '1px solid var(--ide-border)',
            background: 'transparent'
        });

        while (actionBar.firstChild) actionBar.removeChild(actionBar.firstChild);
        
        // 1. 提示词
        const promptBtn = this._createButton('🤖 提示词', () => {
            const result = gemini.insertToInput(getSystemPrompt());
            if (result.success) {
                showToast(`已发送系统协议 (~${formatTokens(result.tokens)} tokens)`);
            }
        });
        // 移除 primary 类，回归统一的 Ghost 风格
        actionBar.appendChild(promptBtn);

        // 2. 发送目录
        const sendBtn = this._createButton('📋 发送目录', () => {
            const structure = fs.generateFullStructure(this.currentTree);
            const text = `项目 "${fs.projectName}" 目录:\n\n\`\`\`\n${structure}\`\`\``;
            const result = gemini.insertToInput(text);
            if (result.success) {
                showToast(`已发送目录 (~${formatTokens(result.tokens)} tokens)`);
            }
        });
        actionBar.appendChild(sendBtn);
        
        // 3. 刷新
        const refreshBtn = this._createButton('🔄 刷新', () => this.refreshTree());
        actionBar.appendChild(refreshBtn);
    }

    // 使用纯 CSS 类控制样式，避免 JS 闪烁
    _createButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = 'ide-btn'; // 应用 CSS 类
        btn.onclick = onClick;
        return btn;
    }

    _renderTree(tree) {
        const container = document.getElementById('ide-tree-container');
        if (!container) return;
        
        while (container.firstChild) container.removeChild(container.firstChild);
        
        const hint = document.createElement('div');
        Object.assign(hint.style, {
            padding: '6px 8px', marginBottom: '8px', background: 'var(--ide-hint-bg)',
            borderRadius: '4px', fontSize: '11px', color: 'var(--ide-hint-text)'
        });
        hint.textContent = '💡 点击文件发送 | 右键文件夹更多';
        container.appendChild(hint);
        
        this._buildTreeNodes(container, tree, 0);
    }

    _buildTreeNodes(container, nodes, level) {
        nodes.forEach(node => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '5px 4px', paddingLeft: (level * 14 + 4) + 'px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                cursor: 'pointer', borderRadius: '3px', margin: '1px 0',
                display: 'flex', alignItems: 'center', gap: '4px'
            });
            item.title = node.path;
            item.classList.add('ide-tree-item'); // 使用 class 控制 hover
            // 移除原本的 JS hover 逻辑
            // item.onmouseover = ... 
            // item.onmouseout = ...

            if (node.kind === 'directory') {
                const isExpanded = this.folderStates.get(node.path) || false;
                
                const arrow = this._createIcon(isExpanded ? 'arrowDown' : 'arrowRight', 12, 'var(--ide-text-secondary)');
                Object.assign(arrow.style, { width: '16px', minWidth: '16px' });
                
                const icon = this._createIcon('folder', 14, 'var(--ide-text-folder)');
                
                const name = document.createElement('span');
                name.textContent = node.name;
                name.style.color = 'var(--ide-text)';
                name.style.fontWeight = '500';
                
                item.appendChild(arrow);
                item.appendChild(icon);
                item.appendChild(name);
                
                item.onclick = () => {
                    this.folderStates.set(node.path, !isExpanded);
                    this._renderTree(this.currentTree);
                };
                
                item.oncontextmenu = (e) => this._showContextMenu(e, node);
                
                container.appendChild(item);
                
                if (isExpanded && node.children) {
                    this._buildTreeNodes(container, node.children, level + 1);
                }
            } else {
                const spacer = document.createElement('span');
                spacer.style.width = '16px'; 
                spacer.style.minWidth = '16px';
                
                const icon = this._createIcon('file', 14, 'var(--ide-text-secondary)');
                
                const name = document.createElement('span');
                name.textContent = node.name;
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
                        // sendFile 内部已经 showToast 了
                    }
                };

                // 文件右键菜单
                item.oncontextmenu = (e) => this._showFileContextMenu(e, node);
                
                container.appendChild(item);
            }
        });
    }

    _showContextMenu(e, node) {
        e.preventDefault();
        e.stopPropagation();
        
        const menu = document.getElementById('ide-context-menu');
        if (!menu) return;
        
        while (menu.firstChild) menu.removeChild(menu.firstChild);
        
        // 发送目录结构
        menu.appendChild(this._createMenuItem('📋 发送目录结构', () => {
            const structure = fs.generateStructure(node);
            gemini.sendStructure(node.path, structure);
        }));
        
        // 发送所有文件
        menu.appendChild(this._createMenuItem('📦 发送所有文件', async () => {
            showToast('读取中...', 'info');
            const content = await this._collectFiles(node);
            const result = gemini.insertToInput(content);
            if (result.success) {
                showToast(`已发送 (~${formatTokens(result.tokens)} tokens)`);
            }
        }));

        // 分隔线
        menu.appendChild(this._createMenuDivider());

        // 新建文件
        menu.appendChild(this._createMenuItem('➕ 新建文件', async () => {
            const fileName = prompt('输入文件名:');
            if (!fileName || !fileName.trim()) return;
            const newPath = node.path + '/' + fileName.trim();
            if (await fs.createFile(newPath, '')) {
                showToast('已创建: ' + fileName);
                await this.refreshTree(); // 👈 修复：静默刷新
            } else {
                showToast('创建失败', 'error');
            }
        }));

        // 新建文件夹
        menu.appendChild(this._createMenuItem('📁 新建文件夹', async () => {
            const folderName = prompt('输入文件夹名:');
            if (!folderName || !folderName.trim()) return;
            const newPath = node.path + '/' + folderName.trim() + '/.gitkeep';
            if (await fs.createFile(newPath, '')) {
                showToast('已创建: ' + folderName);
                await this.refreshTree(); // 👈 修复：静默刷新
            } else {
                showToast('创建失败', 'error');
            }
        }));

        // 分隔线
        menu.appendChild(this._createMenuDivider());

        // 删除目录
        menu.appendChild(this._createMenuItem('🗑️ 删除目录', async () => {
            if (!confirm(`确定删除目录 "${node.name}" 及其所有内容？\n\n⚠️ 此操作不可撤销！`)) return;
            if (await fs.deleteDirectory(node.path)) {
                showToast('已删除: ' + node.name);
                await this.refreshTree(); // 👈 修复：静默刷新
            } else {
                showToast('删除失败', 'error');
            }
        }, '#dc2626'));
        
        menu.style.display = 'block';
        menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
        menu.style.top = Math.min(e.clientY, window.innerHeight - 150) + 'px';
    }

    /**
     * 文件右键菜单
     */
    _showFileContextMenu(e, node) {
        e.preventDefault();
        e.stopPropagation();
        
        const menu = document.getElementById('ide-context-menu');
        if (!menu) return;
        
        while (menu.firstChild) menu.removeChild(menu.firstChild);

        // 发送文件
        menu.appendChild(this._createMenuItem('📤 发送到对话', async () => {
            const content = await fs.readFile(node.path);
            if (content !== null) {
                gemini.sendFile(node.path, content);
            }
        }));

        // 发送文件及依赖
        const fileType = depsAnalyzer.getFileType(node.path);
        if (fileType) {
            menu.appendChild(this._createMenuItem('🔗 发送文件+依赖', async () => {
                showToast('分析依赖中...', 'info');
                const { all } = await depsAnalyzer.getFileWithDeps(node.path);
                
                if (all.length === 1) {
                    // 没有依赖，直接发送
                    const content = await fs.readFile(node.path);
                    if (content !== null) {
                        gemini.sendFile(node.path, content);
                    }
                    return;
                }
                
                // 有依赖，打包发送
                let text = `文件 \`${node.path}\` 及其 ${all.length - 1} 个依赖:\n\n`;
                for (const filePath of all) {
                    const content = await fs.readFile(filePath);
                    if (content !== null) {
                        const lang = getLanguage(filePath);
                        text += `### ${filePath}\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
                    }
                }
                
                const result = gemini.insertToInput(text);
                if (result.success) {
                    showToast(`已发送 ${all.length} 个文件 (~${formatTokens(result.tokens)} tokens)`);
                }
            }));
        }

        // 分隔线
        menu.appendChild(this._createMenuDivider());

        // 查看历史版本
        menu.appendChild(this._createMenuItem('⏪ 历史版本', async () => {
            // 直接调用，不再传递已删除的 showCodeReader 回调
            await showHistoryDialog(node.path);
        }));

        // 快速撤销
        menu.appendChild(this._createMenuItem('↩️ 撤销上次修改', async () => {
            const result = await fs.revertFile(node.path);
            if (result.success) {
                showToast('已撤销');
            } else {
                showToast(result.error || '撤销失败', 'error');
            }
        }));

        // 分隔线
        menu.appendChild(this._createMenuDivider());

        // 删除文件
        menu.appendChild(this._createMenuItem('🗑️ 删除文件', async () => {
            if (!confirm(`确定删除文件 "${node.name}"？`)) return;
            if (await fs.deleteFile(node.path)) {
                showToast('已删除: ' + node.name);
                await this.refreshTree(); // 👈 修复：静默刷新
            } else {
                showToast('删除失败', 'error');
            }
        }, '#dc2626'));

        menu.style.display = 'block';
        menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
        menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
    }

    _createMenuDivider() {
        const divider = document.createElement('div');
        Object.assign(divider.style, {
            height: '1px', background: 'var(--ide-border)', margin: '4px 0'
        });
        return divider;
    }

    _createMenuItem(text, onClick, bgColor = null) {
        const item = document.createElement('div');
        item.textContent = text;
        Object.assign(item.style, {
            padding: '8px 12px', cursor: 'pointer', fontSize: '12px', 
            // 🎨 使用变量适配文字颜色
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

    async _collectFiles(node, maxFiles = 20) {
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
    }
}

export const ui = new UI();
