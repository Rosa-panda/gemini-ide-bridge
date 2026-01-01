/**
 * 主题模块 - 检测和管理主题样式
 */

export function detectTheme() {
    const bg = getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/\d+/g);
    if (match) {
        const [r, g, b] = match.map(Number);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128 ? 'dark' : 'light';
    }
    return 'dark';
}

export function getThemeCSS(theme) {
    const common = `
        .ide-glass { backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
        .ide-tree-item { transition: background 0.1s ease; border-radius: 4px; }
        .ide-tree-item:hover { background: var(--ide-hover) !important; }
        #ide-tree-container::-webkit-scrollbar { width: 4px; }
        #ide-tree-container::-webkit-scrollbar-track { background: transparent; }
        #ide-tree-container::-webkit-scrollbar-thumb { background: var(--ide-border); border-radius: 2px; }
        .ide-icon { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        
        @keyframes ideFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ideScaleIn { from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }

        .ide-highlight {
            background: rgba(255, 255, 0, 0.3);
            color: inherit;
            border-radius: 2px;
            font-weight: bold;
        }

        .ide-btn {
            background: transparent;
            color: var(--ide-text);
            border: 1px solid var(--ide-border);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            white-space: nowrap;
            display: flex; align-items: center; justify-content: center; gap: 6px;
            flex: 1;
        }
        .ide-btn:hover {
            background: var(--ide-hover);
            border-color: var(--ide-text-secondary);
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .ide-btn:active { transform: translateY(0); }
        
        .ide-btn.primary {
            color: var(--ide-accent);
            border-color: var(--ide-accent);
        }
        .ide-btn.primary:hover {
            background: var(--ide-accent);
            color: #fff !important;
        }
    `;
    
    if (theme === 'light') {
        return `
            :root { 
                --ide-bg: #f0f4f9;
                --ide-border: #dfe4ec;
                --ide-text: #1f1f1f;
                --ide-text-secondary: #444746;
                --ide-text-file: #1f1f1f;
                --ide-text-folder: #0b57d0;
                --ide-hover: rgba(0, 0, 0, 0.06);
                --ide-shadow: 0 4px 24px rgba(0,0,0,0.08);
                --ide-hint-bg: #e3e3e3; 
                --ide-hint-text: #0b57d0;
                --ide-accent: #0b57d0;
            }
            ${common}
        `;
    }
    return `
        :root { 
            --ide-bg: rgba(30, 31, 32, 0.88); 
            --ide-border: #444746; 
            --ide-text: #e3e3e3;
            --ide-text-secondary: #c4c7c5;
            --ide-text-file: #e3e3e3;
            --ide-text-folder: #a8c7fa;
            --ide-hover: rgba(255, 255, 255, 0.08);
            --ide-shadow: 0 4px 24px rgba(0,0,0,0.4);
            --ide-hint-bg: #363739;
            --ide-hint-text: #d3e3fd;
            --ide-accent: #a8c7fa;
        }
        ${common}
    `;
}

export function updateTheme() {
    const style = document.getElementById('ide-theme-style');
    if (style) {
        const theme = detectTheme();
        const newCSS = getThemeCSS(theme);
        if (style.textContent !== newCSS) {
            style.textContent = newCSS;
        }
    }
}

export function initThemeStyle() {
    const style = document.createElement('style');
    style.id = 'ide-theme-style';
    style.textContent = getThemeCSS(detectTheme());
    return style;
}

/**
 * 初始化主题监听器
 * - MutationObserver 监听 body 的 style/class 变化
 * - matchMedia 监听系统主题偏好变化
 * - 轮询作为 fallback（10秒一次）
 */
export function initThemeWatcher() {
    // 1. MutationObserver 监听 body 变化
    const observer = new MutationObserver(() => {
        updateTheme();
    });
    
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['style', 'class', 'data-theme']
    });

    // 2. 监听系统主题偏好变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => updateTheme();
    
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
    } else {
        // 兼容旧浏览器
        mediaQuery.addListener(handleMediaChange);
    }

    // 3. Fallback 轮询（某些情况下 MutationObserver 可能不触发）
    const fallbackInterval = setInterval(() => updateTheme(), 10000);

    // 返回清理函数
    return () => {
        observer.disconnect();
        if (mediaQuery.removeEventListener) {
            mediaQuery.removeEventListener('change', handleMediaChange);
        } else {
            mediaQuery.removeListener(handleMediaChange);
        }
        clearInterval(fallbackInterval);
    };
}
