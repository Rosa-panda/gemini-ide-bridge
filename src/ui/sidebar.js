/**
 * 侧边栏模块
 */

import { createIcon } from './icons.js';
import { debounce } from '../shared/utils.js';

/**
     * 创建触发按钮（支持拖拽）
     */
export function createTrigger(currentTree) {
    const trigger = document.createElement('div');
    trigger.id = 'ide-trigger';
    trigger.textContent = '⚡️';
    Object.assign(trigger.style, {
        position: 'fixed', bottom: '20px', right: '20px',
        zIndex: '2147483646', width: '40px', height: '40px',
        background: 'var(--ide-bg)', color: 'var(--ide-text)',
        border: '1px solid var(--ide-border)', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'grab', boxShadow: 'var(--ide-shadow)',
        fontSize: '18px', transition: 'all 0.2s', userSelect: 'none'
    });
    
    trigger.classList.add('ide-glass');

    // 拖拽状态
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, startRight, startBottom;

    const applyPosition = (right, bottom) => {
        const maxRight = Math.max(10, window.innerWidth - 60);
        const maxBottom = Math.max(10, window.innerHeight - 60);
        const clampedRight = Math.max(10, Math.min(maxRight, right));
        const clampedBottom = Math.max(10, Math.min(maxBottom, bottom));
        trigger.style.right = `${clampedRight}px`;
        trigger.style.bottom = `${clampedBottom}px`;
    };

    trigger.onmousedown = (e) => {
        if (e.button !== 0) return; // 只响应左键
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startRight = parseInt(trigger.style.right) || 20;
        startBottom = parseInt(trigger.style.bottom) || 20;
        trigger.style.cursor = 'grabbing';
        trigger.style.transition = 'none'; // 拖拽时禁用过渡动画
        e.preventDefault();
    };

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = startX - e.clientX;
        const deltaY = startY - e.clientY;
        
        // 移动超过 5px 才算拖拽，避免误触
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved = true;
        }
        
        applyPosition(startRight + deltaX, startBottom + deltaY);
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            trigger.style.cursor = 'grab';
            trigger.style.transition = 'all 0.2s';
            
            // 保存位置到 localStorage
            localStorage.setItem('ide-trigger-pos', JSON.stringify({
                right: parseInt(trigger.style.right),
                bottom: parseInt(trigger.style.bottom)
            }));
        }
    });

    // 恢复保存的位置
    try {
        const savedPos = JSON.parse(localStorage.getItem('ide-trigger-pos'));
        if (savedPos) {
            applyPosition(savedPos.right, savedPos.bottom);
        } else {
            applyPosition(20, 20);
        }
    } catch (e) {
        applyPosition(20, 20);
    }

    window.addEventListener('resize', () => {
        applyPosition(parseInt(trigger.style.right) || 20, parseInt(trigger.style.bottom) || 20);
    });

    // hover 效果：简单的缩放，不展开文字
    trigger.onmouseover = () => {
        if (isDragging) return;
        trigger.style.transform = 'scale(1.1)';
    };
    trigger.onmouseout = () => {
        if (isDragging) return;
        trigger.style.transform = 'scale(1)';
    };

    trigger.onclick = (e) => {
        // 如果刚拖拽过，不触发点击
        if (hasMoved) {
            hasMoved = false;
            return;
        }
        const sidebar = document.getElementById('ide-sidebar');
        const isHidden = sidebar.style.transform === 'translateX(100%)';
        sidebar.style.transform = isHidden ? 'translateX(0)' : 'translateX(100%)';
    };
    return trigger;
}

/**
 * 创建侧边栏
 */
export function createSidebar(onSearch) {
    const sidebar = document.createElement('div');
    sidebar.id = 'ide-sidebar';
    sidebar.classList.add('ide-glass');
    
    Object.assign(sidebar.style, {
        position: 'fixed', right: '0', top: '0',
        width: '360px', height: '100vh',
        background: 'var(--ide-bg)',
        borderLeft: '1px solid var(--ide-border)',
        zIndex: '2147483647', 
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'translateX(100%)',
        color: 'var(--ide-text)', display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--ide-shadow)', 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '13px', lineHeight: '1.5'
    });

    // 标题栏
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '12px 16px', borderBottom: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'transparent'
    });

    // 搜索框
    const searchBar = document.createElement('div');
    Object.assign(searchBar.style, {
        padding: '0 16px 12px 16px',
        borderBottom: '1px solid var(--ide-border)'
    });
    
    const searchInput = document.createElement('input');
    searchInput.placeholder = '搜索文件... (Enter 发送结果)';
    Object.assign(searchInput.style, {
        width: '100%', padding: '6px 10px', borderRadius: '6px',
        background: 'var(--ide-hint-bg)', color: 'var(--ide-text)',
        border: '1px solid var(--ide-border)', fontSize: '12px',
        outline: 'none', boxSizing: 'border-box'
    });

    const debouncedSearch = debounce((val) => onSearch(val), 300);
    searchInput.oninput = (e) => debouncedSearch(e.target.value.toLowerCase());
    searchBar.appendChild(searchInput);
    
    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '8px';
    title.style.fontWeight = '600';
    title.style.color = 'var(--ide-text)';
    title.style.fontSize = '14px';
    
    const logoIcon = createIcon('logo', 16, 'var(--ide-accent)');
    const titleText = document.createElement('span');
    titleText.textContent = 'Gemini IDE';
    
    const statusDot = document.createElement('div');
    Object.assign(statusDot.style, {
        width: '8px', height: '8px', borderRadius: '50%',
        background: '#059669', marginLeft: '4px',
        boxShadow: '0 0 8px #059669',
        display: 'none'
    });
    statusDot.id = 'ide-status-dot';
    
    title.appendChild(logoIcon);
    title.appendChild(titleText);
    title.appendChild(statusDot);
    
    const closeBtn = document.createElement('button');
    closeBtn.style.display = 'flex';
    closeBtn.appendChild(createIcon('close', 18, 'var(--ide-text-secondary)'));
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
    sidebar.appendChild(searchBar);

    // 操作栏
    const actionBar = document.createElement('div');
    actionBar.id = 'ide-action-bar';
    Object.assign(actionBar.style, {
        padding: '10px', borderBottom: '1px solid var(--ide-border)',
        display: 'none', gap: '8px'
    });
    sidebar.appendChild(actionBar);

    // 文件树容器
    const treeContainer = document.createElement('div');
    treeContainer.id = 'ide-tree-container';
    Object.assign(treeContainer.style, {
        flex: '1', overflowY: 'auto', padding: '8px', fontSize: '13px'
    });
    sidebar.appendChild(treeContainer);

    // 底部
    const footer = document.createElement('div');
    Object.assign(footer.style, {
        padding: '8px', borderTop: '1px solid var(--ide-border)',
        fontSize: '10px', color: 'var(--ide-text-secondary)', textAlign: 'center'
    });
    footer.textContent = `V${typeof IDE_VERSION !== 'undefined' ? IDE_VERSION : '?'} | 支持版本回退`;
    sidebar.appendChild(footer);

    return sidebar;
}

/**
 * 创建空状态
 */
export function createEmptyState(onConnect) {
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
    connectBtn.onclick = onConnect;
    
    emptyState.appendChild(icon);
    emptyState.appendChild(text);
    emptyState.appendChild(connectBtn);
    return emptyState;
}

/**
 * 创建右键菜单容器
 */
export function createContextMenu() {
    const menu = document.createElement('div');
    menu.id = 'ide-context-menu';
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

/**
 * 创建按钮
 */
export function createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'ide-btn';
    btn.onclick = onClick;
    return btn;
}
