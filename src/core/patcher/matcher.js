/**
 * 匹配器模块 - 逻辑签名匹配算法
 */

/**
 * 核心：将代码转化为纯粹的逻辑行序列（忽略缩进、空行、换行符差异）
 */
export function getLogicSignature(code) {
    return code.replace(/\r\n/g, '\n')
               .replace(/\r/g, '\n')
               .split('\n')
               .map((line, index) => ({ 
                   content: line.trim().replace(/[\u200B-\u200D\uFEFF]/g, ''), 
                   originalIndex: index 
               }))
               .filter(item => item.content.length > 0);
}

/**
 * 极致鲁棒的计数器：支持直接传入逻辑签名或原始代码进行滑动窗口匹配
 */
export function countMatches(content, search) {
    const contentSigs = typeof content === 'string' ? getLogicSignature(content) : content;
    const searchSigs = typeof search === 'string' ? getLogicSignature(search) : search;
    
    if (searchSigs.length === 0) return 0;
    
    let count = 0;
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
        let match = true;
        for (let j = 0; j < searchSigs.length; j++) {
            if (contentSigs[i + j].content !== searchSigs[j].content) {
                match = false;
                break;
            }
        }
        if (match) count++;
    }
    return count;
}

/**
 * 检测补丁是否已经应用过
 * 核心逻辑：使用逻辑签名进行比对，若目标状态已达成则跳过
 */
export function isAlreadyApplied(content, search, replace) {
    const contentSigs = getLogicSignature(content);
    const searchSigs = getLogicSignature(search);
    const replaceSigs = getLogicSignature(replace);
    
    const searchContent = searchSigs.map(s => s.content).join('\n');
    const replaceContent = replaceSigs.map(s => s.content).join('\n');
    
    if (searchContent === replaceContent) return false;

    const replaceMatchCount = countMatches(contentSigs, replaceSigs);
    const searchMatchCount = countMatches(contentSigs, searchSigs);

    // 情况1：REPLACE 逻辑已存在且 SEARCH 逻辑已完全消失 -> 已应用
    if (replaceMatchCount > 0 && searchMatchCount === 0) return true;
    
    // 情况2：REPLACE 包含 SEARCH (嵌套情况)，且 REPLACE 数量 >= SEARCH 数量 -> 已应用
    if (replaceMatchCount > 0 && replaceMatchCount >= searchMatchCount && replaceContent.includes(searchContent)) {
        return true;
    }
    
    return false;
}

/**
 * 查找逻辑匹配的物理位置
 * @returns {number} 匹配的物理起始行索引，未找到返回 -1
 */
export function findMatchPosition(contentSigs, searchSigs) {
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
        let match = true;
        for (let j = 0; j < searchSigs.length; j++) {
            if (contentSigs[i + j].content !== searchSigs[j].content) {
                match = false;
                break;
            }
        }
        if (match) {
            return contentSigs[i].originalIndex;
        }
    }
    return -1;
}
