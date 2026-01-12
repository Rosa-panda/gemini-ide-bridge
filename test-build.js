/**
 * 构建产物测试脚本
 * 检查 esbuild 打包后所有关键函数是否正确导出
 */

const fs = require('fs');
const vm = require('vm');

// 模拟浏览器环境
const mockDOM = {
    document: {
        body: null,
        createElement: () => ({ style: {}, appendChild: () => {}, remove: () => {} }),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
    },
    window: {
        getSelection: () => ({ rangeCount: 0 }),
        getComputedStyle: () => ({}),
        MutationObserver: class { observe() {} disconnect() {} },
        indexedDB: { open: () => ({ result: {} }) },
        localStorage: { getItem: () => null, setItem: () => {} },
        requestIdleCallback: (cb) => setTimeout(cb, 0),
    },
    navigator: { userAgent: 'test' },
    console: console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Node: { TEXT_NODE: 3 },
    Object, Array, String, Number, Boolean, Date, Math, JSON, RegExp, Error,
    Promise, Map, Set, WeakMap, WeakSet, Symbol, Proxy, Reflect,
};

// 读取构建产物
const code = fs.readFileSync('ide_core.js', 'utf8');

// 创建沙箱环境
const sandbox = { ...mockDOM, ...mockDOM.window, document: mockDOM.document };
vm.createContext(sandbox);

try {
    // 执行代码
    vm.runInContext(code, sandbox);
    
    const IDE = sandbox.IDE_BRIDGE;
    
    if (!IDE) {
        console.error('❌ IDE_BRIDGE 未定义');
        process.exit(1);
    }
    
    console.log('✅ IDE_BRIDGE 已导出\n');
    
    // 检查主要模块
    const checks = [
        // fs 模块
        ['fs', IDE.fs],
        ['fs.readFile', IDE.fs?.readFile],
        ['fs.writeFile', IDE.fs?.writeFile],
        ['fs.deleteFile', IDE.fs?.deleteFile],
        ['fs.createFile', IDE.fs?.createFile],
        ['fs.getFileHistory', IDE.fs?.getFileHistory],
        ['fs.revertFile', IDE.fs?.revertFile],
        
        // ui 模块
        ['ui', IDE.ui],
        ['ui.init', IDE.ui?.init],
        
        // gemini 模块
        ['gemini', IDE.gemini],
        ['gemini.sendFile', IDE.gemini?.sendFile],
        ['gemini.insertToInput', IDE.gemini?.insertToInput],
    ];
    
    let passed = 0, failed = 0;
    
    for (const [name, value] of checks) {
        if (value !== undefined) {
            console.log(`  ✅ ${name}`);
            passed++;
        } else {
            console.log(`  ❌ ${name} 未定义`);
            failed++;
        }
    }
    
    console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
    
    if (failed > 0) {
        process.exit(1);
    }
    
} catch (err) {
    console.error('❌ 执行错误:', err.message);
    console.error(err.stack);
    process.exit(1);
}
