/**
 * 简单的构建脚本 - 合并模块为单文件
 * 运行: node build.js
 */

const fs = require('fs');
const path = require('path');

const files = [
    'src/utils.js',
    'src/history.js',
    'src/fs.js',
    'src/theme.js',
    'src/dialog.js',
    'src/parser.js',
    'src/patcher.js',
    'src/state.js',
    'src/prompt.js',
    'src/gemini.js',
    'src/ui.js',
    'src/main.js'
];

let output = `/**
 * Gemini IDE Bridge Core (V1.0.0)
 * 自动构建于 ${new Date().toISOString()}
 */

(function() {
'use strict';

`;

// 读取并处理每个文件
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 移除 import/export 语句
    content = content.replace(/^import .+$/gm, '');
    content = content.replace(/^export (async )?(const|class|function)/gm, '$1$2');
    content = content.replace(/^export \{ .+ \};?$/gm, '');
    
    output += `// ========== ${file} ==========\n`;
    output += content + '\n\n';
});

output += `
// 启动
if (document.body) {
    ui.init();
    const observer = new MutationObserver(() => {
        if (!document.getElementById('ide-bridge-root')) ui.init();
    });
    observer.observe(document.body, { childList: true });
} else {
    window.onload = () => ui.init();
}

window.IDE_BRIDGE = { fs, ui, gemini };
console.log('%c[IDE Bridge] V1.0.0', 'color: #00ff00; font-size: 14px;');

})();
`;

fs.writeFileSync('ide_core.js', output);
console.log('构建完成: ide_core.js');
