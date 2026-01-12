/**
 * 构建脚本 - 使用 esbuild 打包
 * 运行: node build.js
 */

const esbuild = require('esbuild');
const fs = require('fs');

// 从 manifest.json 读取版本号
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const VERSION = manifest.version;

esbuild.buildSync({
    entryPoints: ['src/main.js'],
    bundle: true,
    outfile: 'ide_core.js',
    format: 'iife',  // 立即执行函数，避免污染全局
    globalName: 'IDE_BRIDGE',  // 暴露的全局变量名
    define: {
        'IDE_VERSION': JSON.stringify(VERSION),  // 注入版本号常量
    },
    banner: {
        js: `/**
 * Gemini IDE Bridge Core (V${VERSION})
 * 自动构建于 ${new Date().toISOString()}
 */`
    },
    footer: {
        js: `
// 启动
if (document.body) {
    IDE_BRIDGE.ui.init();
    const observer = new MutationObserver(() => {
        if (!document.getElementById('ide-bridge-root')) IDE_BRIDGE.ui.init();
    });
    observer.observe(document.body, { childList: true });
} else {
    window.onload = () => IDE_BRIDGE.ui.init();
}
console.log('%c[IDE Bridge] V${VERSION}', 'color: #00ff00; font-size: 14px;');
`
    },
    target: ['chrome90'],  // 目标浏览器
    minify: false,  // 开发时不压缩，方便调试
    sourcemap: false,
});

console.log(`构建完成: ide_core.js (V${VERSION})`);
