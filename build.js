/**
 * 简单的构建脚本 - 合并模块为单文件
 * 运行: node build.js
 */

const fs = require('fs');
const path = require('path');

// 新的模块化目录结构
const files = [
    // shared
    'src/shared/utils.js',
    'src/shared/theme.js',
    'src/shared/prompt.js',
    
    // core
    'src/core/history.js',
    'src/core/fs.js',
    'src/core/parser.js',
    'src/core/state.js',
    'src/core/deps.js',
    
    // core/patcher
    'src/core/patcher/literals.js',
    'src/core/patcher/lineEnding.js',
    'src/core/patcher/matcher.js',
    'src/core/patcher/indent.js',
    'src/core/patcher/syntax.js',
    'src/core/patcher/index.js',
    
    // dialog
    'src/dialog/preview.js',
    'src/dialog/history.js',
    'src/dialog/index.js',
    
    // ui
    'src/ui/icons.js',
    'src/ui/menu.js',
    'src/ui/tree.js',
    'src/ui/sidebar.js',
    'src/ui/index.js',
    
    // gemini
    'src/gemini/feedback.js',
    'src/gemini/watcher.js',
    'src/gemini/actions.js',
    'src/gemini/index.js',
    
    // main
    'src/main.js'
];

let output = `/**
 * Gemini IDE Bridge Core (V2.0.0)
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
    content = content.replace(/^export \{[^}]+\}.*$/gm, '');  // 移除所有 export { } 语句（包括 from）
    
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
console.log('%c[IDE Bridge] V2.0.0', 'color: #00ff00; font-size: 14px;');

})();
`;

fs.writeFileSync('ide_core.js', output);
console.log('构建完成: ide_core.js');
