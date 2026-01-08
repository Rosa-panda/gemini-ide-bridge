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
        sql: 'sql', sh: 'bash', vue: 'vue', svelte: 'svelte',
        xml: 'xml', env: 'bash', toml: 'toml', ini: 'ini',
        dockerfile: 'dockerfile', docker: 'dockerfile'
    };
    return map[ext] || 'text';
}

export function estimateTokens(text) {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 3.5);
}

export function formatTokens(count) {
    if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'k';
    }
    return count.toString();
}

/**
* 防抖函数 - 限制高频事件触发
*/
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

let activeToasts = [];

export function showToast(message, type = 'success') {
    const MAX_TOASTS = 5;
    const TOAST_GAP = 12;
    
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
        bottom: '80px',
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

    const updatePositions = () => {
        activeToasts.forEach((el, index) => {
            const offset = (activeToasts.length - 1 - index) * (45 + TOAST_GAP);
            el.style.setProperty('--offset', `-${offset}px`);
            el.style.opacity = '1';
            el.style.transform = `translateY(var(--offset)) scale(var(--scale, 1))`;
        });
    };

    requestAnimationFrame(() => updatePositions());

    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.style.setProperty('--scale', '0.9');
        toast.style.opacity = '0';
        
        setTimeout(() => {
            const index = activeToasts.indexOf(toast);
            if (index > -1) {
                activeToasts.splice(index, 1);
                toast.remove();
                updatePositions(); 
            }
        }, 400);
    }, duration);
}
