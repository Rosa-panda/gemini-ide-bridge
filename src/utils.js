/**
 * 工具函数模块
 */

export function getLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
        js: 'javascript', ts: 'typescript', jsx: 'jsx', tsx: 'tsx',
        py: 'python', java: 'java', cpp: 'cpp', c: 'c', go: 'go',
        rs: 'rust', rb: 'ruby', php: 'php', html: 'html', css: 'css',
        json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown',
        sql: 'sql', sh: 'bash', vue: 'vue', svelte: 'svelte'
    };
    return map[ext] || 'text';
}

/**
 * 估算文本的 token 数量
 * 规则：英文 ~4字符/token，中文 ~1.5字符/token，代码 ~3字符/token
 */
export function estimateTokens(text) {
    if (!text) return 0;
    
    // 分离中文和非中文
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    // 中文约 1.5 字符/token，其他约 3.5 字符/token（代码偏多）
    const tokens = Math.ceil(chineseChars / 1.5 + otherChars / 3.5);
    return tokens;
}

/**
 * 格式化 token 数量显示
 */
export function formatTokens(count) {
    if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
}

// 存储当前活跃的 toast 元素
let activeToasts = [];

export function showToast(message, type = 'success') {
    const MAX_TOASTS = 5;
    const TOAST_GAP = 12; // toast 之间的间距
    
    // 如果超过最大数量，移除最旧的一个
    if (activeToasts.length >= MAX_TOASTS) {
        const oldest = activeToasts.shift();
        if (oldest) {
            oldest.style.opacity = '0';
            oldest.style.transform = `translateY(-20px)`;
            setTimeout(() => oldest.remove(), 300);
        }
    }

    const toast = document.createElement('div');
    toast.className = 'ide-toast-item';
    toast.textContent = message;
    
    const bgColor = type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#2563eb';
    
    Object.assign(toast.style, {
        position: 'fixed', 
        left: '30px',
        bottom: '80px', // 基础起始位置
        background: bgColor, 
        color: 'white', 
        padding: '10px 20px',
        borderRadius: '8px', 
        fontSize: '13px', 
        fontWeight: 'bold',
        zIndex: '2147483647', 
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        opacity: '0',
        transform: 'translateY(20px)'
    });

    document.body.appendChild(toast);
    activeToasts.push(toast);

    // 重新计算所有 toast 的位置 (使用 CSS 变量避免 transform 冲突)
    const updatePositions = () => {
        activeToasts.forEach((el, index) => {
            // 越新的 (index 越大) 越在下面
            const offset = (activeToasts.length - 1 - index) * (45 + TOAST_GAP); // 使用固定高度或 offsetHeight
            el.style.setProperty('--offset', `-${offset}px`);
            el.style.opacity = '1';
            // 统一 transform 逻辑
            el.style.transform = `translateY(var(--offset)) scale(var(--scale, 1))`;
        });
    };

    // 初始位置计算
    requestAnimationFrame(() => updatePositions());

    // 定时移除
    setTimeout(() => {
        // 设置缩放变量而不直接覆盖 transform
        toast.style.setProperty('--scale', '0.9');
        toast.style.opacity = '0';
        
        setTimeout(() => {
            const index = activeToasts.indexOf(toast);
            if (index > -1) {
                activeToasts.splice(index, 1);
                toast.remove();
                // 此时 updatePositions 只会影响还在数组里的元素
                updatePositions(); 
            }
        }, 400);
    }, 3000);
}
