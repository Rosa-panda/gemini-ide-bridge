/**
 * Gemini IDE Bridge - 入口文件
 * V0.0.1 模块化重构版
 * 
 * 注意：此文件的启动逻辑由 build.js 在构建时添加
 * 这里只导出必要的对象供调试使用
 */

import { fs } from './core/fs.js';
import { ui } from './ui/index.js';
import { gemini } from './gemini/index.js';

// 导出供调试
window.IDE_BRIDGE = { fs, ui, gemini };

console.log('%c[IDE Bridge] V0.0.1 模块加载完成', 'color: #00ff00; font-size: 14px; font-weight: bold;');
