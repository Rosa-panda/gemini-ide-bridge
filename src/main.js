/**
 * Gemini IDE Bridge - 入口文件
 * V1.0.0 模块化重构版
 */

import { fs } from './fs.js';
import { ui } from './ui.js';
import { gemini } from './gemini.js';

(function() {
    console.log('%c[IDE Bridge] V1.0.0 启动', 'color: #00ff00; font-size: 14px; font-weight: bold;');

    // 暴露到全局方便调试
    window.IDE_BRIDGE = { fs, ui, gemini };

    // 守护进程
    function startGuardian() {
        ui.init();
        
        const observer = new MutationObserver(() => {
            if (!document.getElementById('ide-bridge-root')) {
                ui.init();
            }
        });
        observer.observe(document.body, { childList: true });
    }

    if (document.body) {
        startGuardian();
    } else {
        window.onload = startGuardian;
    }
})();
