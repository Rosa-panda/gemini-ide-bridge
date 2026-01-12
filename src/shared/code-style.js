/**
 * 代码显示样式统一配置
 * 用于 diff 对比、编辑器等场景
 */

// 代码字体配置
export const CODE_FONT = {
    family: '"JetBrains Mono", Consolas, monospace',
    size: '15px',
    lineHeight: '1.5'
};

/**
 * 应用代码字体样式到元素
 * @param {HTMLElement} element 
 */
export function applyCodeFont(element) {
    element.style.fontFamily = CODE_FONT.family;
    element.style.fontSize = CODE_FONT.size;
    element.style.lineHeight = CODE_FONT.lineHeight;
}
