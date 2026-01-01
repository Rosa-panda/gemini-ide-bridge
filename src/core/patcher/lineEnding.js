/**
 * 换行符处理模块 - 镜像风格回写
 */

/**
 * 检测文件的换行符风格
 */
export function detectLineEnding(content) {
    if (content.includes('\r\n')) return '\r\n';
    return '\n';
}

/**
 * 统一换行符为 LF（内部处理用）
 */
export function normalizeLineEnding(content) {
    return content.replace(/\r\n/g, '\n');
}

/**
 * 恢复原始换行符风格
 */
export function restoreLineEnding(content, originalEnding) {
    if (originalEnding === '\r\n') {
        return content.replace(/\n/g, '\r\n');
    }
    return content;
}
