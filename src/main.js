/**
 * Gemini IDE Bridge - 入口文件
 * 版本号从 manifest.json 读取
 * 
 * 注意：此文件的启动逻辑由 build.js 在构建时添加
 * 这里只导出必要的对象供调试使用
 */

import { fs } from './core/fs.js';
import { ui } from './ui/index.js';
import { gemini } from './gemini/index.js';

// 导出供调试
window.IDE_BRIDGE = { fs, ui, gemini };
