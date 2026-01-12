/**
 * 小地图模块 - VSCode 风格实现
 * 
 * 核心逻辑：
 * 1. 小地图高度始终等于容器高度
 * 2. 文件内容按比例缩放绘制到小地图
 * 3. 视口指示器反映编辑器可视区域在整个文件中的位置和比例
 */

/**
 * 创建小地图组件
 */
export function createMinimap(container, options = {}) {
    const {
        width = 100,
        bgColor = 'rgba(30,30,30,0.5)',
        viewportColor = 'rgba(100,150,255,0.25)',
        viewportBorderColor = 'rgba(100,150,255,0.6)',
    } = options;
    
    // 创建容器
    const wrapper = document.createElement('div');
    wrapper.className = 'ide-minimap';
    Object.assign(wrapper.style, {
        width: `${width}px`,
        height: '100%',
        position: 'relative',
        background: bgColor,
        borderLeft: '1px solid var(--ide-border)',
        cursor: 'pointer',
        overflow: 'hidden',
        flexShrink: '0',
    });
    
    // Canvas 绘制代码
    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // 高清屏
    Object.assign(canvas.style, {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: '0',
        left: '0',
    });
    
    // 视口指示器（拖拽滑块）
    const viewport = document.createElement('div');
    Object.assign(viewport.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        background: viewportColor,
        borderTop: `1px solid ${viewportBorderColor}`,
        borderBottom: `1px solid ${viewportBorderColor}`,
        cursor: 'grab',
        minHeight: '20px',
        transition: 'background 0.1s',
    });
    
    // hover 效果
    viewport.addEventListener('mouseenter', () => {
        viewport.style.background = 'rgba(100,150,255,0.35)';
    });
    viewport.addEventListener('mouseleave', () => {
        if (!isDragging) {
            viewport.style.background = viewportColor;
        }
    });
    
    wrapper.append(canvas, viewport);
    container.appendChild(wrapper);
    
    const ctx = canvas.getContext('2d');
    
    // 状态
    let totalLines = 0;
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollRatio = 0;
    
    // 颜色映射（简化的语法高亮）
    const colors = {
        keyword: '#569cd6',
        string: '#ce9178',
        comment: '#6a9955',
        number: '#b5cea8',
        default: 'rgba(200,200,200,0.6)',
    };
    
    /**
     * 简单的 token 检测
     */
    function getLineColor(line) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            return colors.comment;
        }
        if (/^(import|export|function|class|const|let|var|if|else|for|while|return|def|async|await|from)\b/.test(trimmed)) {
            return colors.keyword;
        }
        if (/^["'`]/.test(trimmed) || /["'`]$/.test(trimmed)) {
            return colors.string;
        }
        return colors.default;
    }
    
    /**
     * 更新小地图内容
     * @param {string} code - 源代码
     */
    function update(code) {
        const lines = code.split('\n');
        totalLines = lines.length;
        
        // 获取容器实际高度
        const containerHeight = wrapper.clientHeight;
        if (containerHeight === 0) return;
        
        // 设置 canvas 高度为容器高度
        canvas.height = containerHeight * 2; // 高清屏
        
        // 计算每行在小地图中的高度
        // 如果文件很短，每行可以更高；如果文件很长，每行会被压缩
        const minLineHeight = 1;  // 最小行高（像素）
        const maxLineHeight = 4;  // 最大行高（像素）
        
        // 计算理想行高：让所有行刚好填满容器
        let lineHeight = containerHeight / totalLines;
        
        // 限制行高范围
        lineHeight = Math.max(minLineHeight, Math.min(maxLineHeight, lineHeight));
        
        // 计算实际绘制高度
        const totalDrawHeight = totalLines * lineHeight;
        
        // 如果内容高度小于容器高度，从顶部开始绘制
        // 如果内容高度大于容器高度，需要缩放（但我们已经限制了 minLineHeight，所以这里按比例绘制）
        const scale = Math.min(1, containerHeight / totalDrawHeight);
        const actualLineHeight = lineHeight * scale * 2; // *2 for retina
        
        // 清空
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制每行
        lines.forEach((line, idx) => {
            const y = idx * actualLineHeight;
            const trimmed = line.trimStart();
            const indent = line.length - trimmed.length;
            
            if (trimmed.length === 0) return;
            
            ctx.fillStyle = getLineColor(trimmed);
            
            // 绘制代码块
            const x = Math.min(indent, 20) * 1.5 + 4;
            const w = Math.min(trimmed.length * 1.2, width * 2 - x - 8);
            if (w > 0) {
                ctx.fillRect(x, y, w, Math.max(actualLineHeight - 1, 1));
            }
        });
    }
    
    /**
     * 更新视口位置
     * @param {number} scrollTop - 编辑器滚动位置
     * @param {number} clientHeight - 编辑器可视高度
     * @param {number} scrollHeight - 编辑器总滚动高度
     */
    function updateViewport(scrollTop, clientHeight, scrollHeight) {
        const containerHeight = wrapper.clientHeight;
        if (containerHeight === 0) return;
        
        // 如果内容不需要滚动，视口占满整个小地图
        if (scrollHeight <= clientHeight) {
            viewport.style.top = '0';
            viewport.style.height = '100%';
            return;
        }
        
        // 计算视口在小地图中的位置和大小
        // 视口高度比例 = 可视区域 / 总内容高度
        const viewportHeightRatio = clientHeight / scrollHeight;
        const viewportHeight = Math.max(containerHeight * viewportHeightRatio, 20);
        
        // 视口位置比例 = 滚动位置 / 最大滚动距离
        const maxScroll = scrollHeight - clientHeight;
        const scrollRatio = maxScroll > 0 ? scrollTop / maxScroll : 0;
        
        // 视口可移动的范围 = 容器高度 - 视口高度
        const maxViewportTop = containerHeight - viewportHeight;
        const viewportTop = scrollRatio * maxViewportTop;
        
        viewport.style.top = `${viewportTop}px`;
        viewport.style.height = `${viewportHeight}px`;
    }
    
    /**
     * 点击跳转
     */
    wrapper.addEventListener('click', (e) => {
        if (e.target === viewport) return; // 点击视口本身不触发
        
        const rect = wrapper.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const containerHeight = wrapper.clientHeight;
        
        // 计算点击位置对应的滚动比例
        // 点击位置应该成为视口的中心
        const viewportHeight = parseFloat(viewport.style.height) || 20;
        const targetViewportTop = clickY - viewportHeight / 2;
        const maxViewportTop = containerHeight - viewportHeight;
        const scrollRatio = Math.max(0, Math.min(1, targetViewportTop / maxViewportTop));
        
        if (options.onSeek) {
            options.onSeek(scrollRatio);
        }
    });
    
    /**
     * 拖拽滚动
     */
    viewport.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartY = e.clientY;
        
        // 记录拖拽开始时的视口位置
        const viewportTop = parseFloat(viewport.style.top) || 0;
        const containerHeight = wrapper.clientHeight;
        const viewportHeight = parseFloat(viewport.style.height) || 20;
        const maxViewportTop = containerHeight - viewportHeight;
        dragStartScrollRatio = maxViewportTop > 0 ? viewportTop / maxViewportTop : 0;
        
        viewport.style.cursor = 'grabbing';
        viewport.style.background = 'rgba(100,150,255,0.4)';
        e.preventDefault();
        e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const containerHeight = wrapper.clientHeight;
        const viewportHeight = parseFloat(viewport.style.height) || 20;
        const maxViewportTop = containerHeight - viewportHeight;
        
        if (maxViewportTop <= 0) return;
        
        // 计算拖拽距离对应的滚动比例变化
        const deltaY = e.clientY - dragStartY;
        const deltaRatio = deltaY / maxViewportTop;
        const newRatio = Math.max(0, Math.min(1, dragStartScrollRatio + deltaRatio));
        
        if (options.onSeek) {
            options.onSeek(newRatio);
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            viewport.style.cursor = 'grab';
            viewport.style.background = viewportColor;
        }
    });
    
    return { update, updateViewport, element: wrapper };
}
