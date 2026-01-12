/**
 * 可拖拽/可调整大小的对话框模块
 * 简单直接，不做任何"智能"适应
 */

const STORAGE_PREFIX = 'ide-dialog-';

/**
 * 注入调整大小手柄的样式
 */
function injectResizeStyles() {
    if (document.getElementById('ide-resize-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ide-resize-styles';
    style.textContent = `
        .ide-resize-edge {
            position: absolute;
            z-index: 10;
        }
        .ide-resize-n, .ide-resize-s { left: 0; right: 0; height: 6px; cursor: ns-resize; }
        .ide-resize-e, .ide-resize-w { top: 0; bottom: 0; width: 6px; cursor: ew-resize; }
        .ide-resize-n { top: -3px; }
        .ide-resize-s { bottom: -3px; }
        .ide-resize-e { right: -3px; }
        .ide-resize-w { left: -3px; }
        .ide-resize-ne, .ide-resize-nw, .ide-resize-se, .ide-resize-sw {
            width: 12px; height: 12px;
        }
        .ide-resize-ne { top: -3px; right: -3px; cursor: nesw-resize; }
        .ide-resize-nw { top: -3px; left: -3px; cursor: nwse-resize; }
        .ide-resize-se { bottom: -3px; right: -3px; cursor: nwse-resize; }
        .ide-resize-sw { bottom: -3px; left: -3px; cursor: nesw-resize; }
    `;
    document.head.appendChild(style);
}

/**
 * 使对话框可拖拽和可调整大小
 */
export function makeDraggable(dialog, dragHandle, options = {}) {
    const {
        dialogId = null,
        minWidth = 400,
        minHeight = 300,
        onResize = null
    } = options;
    
    injectResizeStyles();
    
    // 创建 8 方向调整大小手柄
    const edges = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    edges.forEach(edge => {
        const handle = document.createElement('div');
        handle.className = `ide-resize-edge ide-resize-${edge}`;
        handle.dataset.edge = edge;
        dialog.appendChild(handle);
    });
    
    let isDragging = false;
    let resizeEdge = null;
    let dragOffset = { x: 0, y: 0 };
    let resizeStart = { x: 0, y: 0, w: 0, h: 0, top: 0, left: 0 };
    let initialized = false;
    
    // 初始化：把 transform 居中转换为绝对像素定位
    const initPosition = () => {
        if (initialized) return;
        initialized = true;
        
        const rect = dialog.getBoundingClientRect();
        dialog.style.top = `${rect.top}px`;
        dialog.style.left = `${rect.left}px`;
        dialog.style.width = `${rect.width}px`;
        dialog.style.height = `${rect.height}px`;
        dialog.style.transform = 'none';
    };
    
    // 拖拽开始
    const handleDragStart = (e) => {
        if (e.target.tagName === 'BUTTON') return;
        initPosition();
        isDragging = true;
        const rect = dialog.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
    };
    
    // 调整大小开始
    const handleResizeStart = (e) => {
        const edge = e.target.dataset?.edge;
        if (!edge) return;
        
        initPosition();
        resizeEdge = edge;
        const rect = dialog.getBoundingClientRect();
        resizeStart = {
            x: e.clientX,
            y: e.clientY,
            w: rect.width,
            h: rect.height,
            top: rect.top,
            left: rect.left
        };
        e.preventDefault();
    };
    
    // 鼠标移动
    const handleMouseMove = (e) => {
        if (isDragging) {
            dialog.style.left = `${e.clientX - dragOffset.x}px`;
            dialog.style.top = `${e.clientY - dragOffset.y}px`;
        }
        
        if (resizeEdge) {
            const dx = e.clientX - resizeStart.x;
            const dy = e.clientY - resizeStart.y;
            
            // 东边：增加宽度
            if (resizeEdge.includes('e')) {
                dialog.style.width = `${Math.max(minWidth, resizeStart.w + dx)}px`;
            }
            // 西边：减少宽度，同时移动左边
            if (resizeEdge.includes('w')) {
                const newW = Math.max(minWidth, resizeStart.w - dx);
                dialog.style.width = `${newW}px`;
                dialog.style.left = `${resizeStart.left + resizeStart.w - newW}px`;
            }
            // 南边：增加高度
            if (resizeEdge.includes('s')) {
                dialog.style.height = `${Math.max(minHeight, resizeStart.h + dy)}px`;
            }
            // 北边：减少高度，同时移动上边
            if (resizeEdge.includes('n')) {
                const newH = Math.max(minHeight, resizeStart.h - dy);
                dialog.style.height = `${newH}px`;
                dialog.style.top = `${resizeStart.top + resizeStart.h - newH}px`;
            }
            
            if (onResize) onResize();
        }
    };
    
    // 鼠标释放
    const handleMouseUp = () => {
        if ((isDragging || resizeEdge) && dialogId) {
            // 保存位置
            try {
                const rect = dialog.getBoundingClientRect();
                localStorage.setItem(STORAGE_PREFIX + dialogId, JSON.stringify({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                }));
            } catch (e) { /* ignore */ }
        }
        isDragging = false;
        resizeEdge = null;
    };
    
    // 恢复保存的位置（如果有）
    if (dialogId) {
        try {
            const saved = localStorage.getItem(STORAGE_PREFIX + dialogId);
            if (saved) {
                const bounds = JSON.parse(saved);
                dialog.style.top = `${bounds.top}px`;
                dialog.style.left = `${bounds.left}px`;
                dialog.style.width = `${bounds.width}px`;
                dialog.style.height = `${bounds.height}px`;
                dialog.style.transform = 'none';
                initialized = true;
            }
        } catch (e) { /* ignore */ }
    }
    
    // 绑定事件
    dragHandle.addEventListener('mousedown', handleDragStart);
    dialog.addEventListener('mousedown', handleResizeStart);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 返回清理函数
    return () => {
        dragHandle.removeEventListener('mousedown', handleDragStart);
        dialog.removeEventListener('mousedown', handleResizeStart);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
}
