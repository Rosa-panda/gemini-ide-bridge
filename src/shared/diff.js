/**
 * Diff 算法模块 - 行级和字符级差异计算
 * 
 * 基于动态规划的编辑距离算法（类 Myers Diff）
 */

/**
 * @typedef {Object} LineDiff
 * @property {'equal'|'delete'|'insert'|'modify'} type - 差异类型
 * @property {string} [oldLine] - 原始行内容
 * @property {string} [newLine] - 新行内容
 */

/**
 * @typedef {Object} CharDiff
 * @property {'equal'|'delete'|'insert'} type - 差异类型
 * @property {string} value - 字符内容
 */

/**
 * @typedef {Object} DiffColors
 * @property {string} deleteBg - 删除行背景色
 * @property {string} deleteText - 删除行文字色
 * @property {string} deleteCharBg - 删除字符背景色
 * @property {string} deleteCharText - 删除字符文字色
 * @property {string} insertBg - 新增行背景色
 * @property {string} insertText - 新增行文字色
 * @property {string} insertCharBg - 新增字符背景色
 * @property {string} insertCharText - 新增字符文字色
 * @property {string} modifyBg - 修改行背景色
 * @property {string} emptyBg - 空白行背景色
 * @property {string} equalOpacity - 相同行透明度
 */

/**
 * 行级 Diff - 计算两个文本的行级差异
 * @param {string[]} oldLines - 原始文本的行数组
 * @param {string[]} newLines - 新文本的行数组
 * @returns {LineDiff[]} 差异数组
 */
export function computeLineDiff(oldLines, newLines) {
    const m = oldLines.length;
    const n = newLines.length;
    
    // 动态规划表：dp[i][j] 表示 oldLines[0..i-1] 和 newLines[0..j-1] 的最小编辑距离
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    // 初始化第一行和第一列
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // 填充 DP 表
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1]; // 相同，不需要操作
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // 删除
                    dp[i][j - 1],     // 插入
                    dp[i - 1][j - 1]  // 替换
                );
            }
        }
    }
    
    // 回溯构建差异序列
    const diffs = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            // 相同行
            diffs.unshift({ type: 'equal', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
            i--;
            j--;
        } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
            // 修改行（替换）
            diffs.unshift({ type: 'modify', oldLine: oldLines[i - 1], newLine: newLines[j - 1] });
            i--;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            // 删除行
            diffs.unshift({ type: 'delete', oldLine: oldLines[i - 1] });
            i--;
        } else {
            // 插入行
            diffs.unshift({ type: 'insert', newLine: newLines[j - 1] });
            j--;
        }
    }
    
    return diffs;
}

/**
 * 字符级 Diff - 用于高亮修改行内的具体差异
 * @param {string} oldText - 原始文本
 * @param {string} newText - 新文本
 * @returns {CharDiff[]} 差异数组
 */
export function computeCharDiff(oldText, newText) {
    // 使用 Array.from 处理 Unicode 代理对，防止中文/Emoji 乱码
    const oldChars = Array.from(oldText);
    const newChars = Array.from(newText);
    const m = oldChars.length;
    const n = newChars.length;
    
    const dp = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (oldChars[i - 1] === newChars[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    
    const diffs = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
            diffs.unshift({ type: 'equal', value: oldChars[i - 1] });
            i--;
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            diffs.unshift({ type: 'delete', value: oldChars[i - 1] });
            i--;
        } else {
            diffs.unshift({ type: 'insert', value: newChars[j - 1] });
            j--;
        }
    }
    
    return diffs;
}

/**
 * 计算字符级差异的变化比例
 * @param {CharDiff[]} charDiffs - 字符级差异数组
 * @returns {number} 变化比例 (0-1)
 */
export function getChangeRatio(charDiffs) {
    let totalChars = 0;
    let changedChars = 0;
    charDiffs.forEach(diff => {
        totalChars += diff.value.length;
        if (diff.type !== 'equal') changedChars += diff.value.length;
    });
    return totalChars > 0 ? changedChars / totalChars : 0;
}


/**
 * 获取主题相关的 Diff 配色方案
 * @param {'light'|'dark'} theme - 主题类型
 * @returns {DiffColors} 配色方案
 */
export function getDiffColors(theme) {
    if (theme === 'light') {
        return {
            // 删除行
            deleteBg: '#ffd7d5',
            deleteText: '#82071e',
            deleteCharBg: '#ff8182',
            deleteCharText: '#ffffff',
            // 新增行
            insertBg: '#d1f4d1',
            insertText: '#055d20',
            insertCharBg: '#4fb04f',
            insertCharText: '#ffffff',
            // 修改行
            modifyBg: '#fff4ce',
            // 空白行
            emptyBg: '#f6f8fa',
            // 相同行透明度
            equalOpacity: '0.5'
        };
    } else {
        return {
            // 删除行
            deleteBg: '#4b1818',
            deleteText: '#ffa8a8',
            deleteCharBg: '#c44444',
            deleteCharText: '#ffffff',
            // 新增行
            insertBg: '#1a4d1a',
            insertText: '#a8ffa8',
            insertCharBg: '#44c444',
            insertCharText: '#ffffff',
            // 修改行
            modifyBg: '#3d2a1a',
            // 空白行
            emptyBg: 'rgba(0, 0, 0, 0.1)',
            // 相同行透明度
            equalOpacity: '0.6'
        };
    }
}
