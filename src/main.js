/**
 * Gemini IDE Bridge - 入口文件
 * 
 * esbuild 会将此文件作为入口，打包所有依赖
 * 导出的对象会挂载到 window.IDE_BRIDGE
 */

import { fs } from './core/fs.js';
import { ui } from './ui/index.js';
import { gemini } from './gemini/index.js';

// 导出供 esbuild 使用（会挂载到 globalName 指定的变量）
export { fs, ui, gemini };
