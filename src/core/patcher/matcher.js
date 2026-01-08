/**
 * 匹配器模块 - 逻辑签名匹配算法
 */

// 预编译正则 - 避免每次调用重复编译
const RE_CRLF = /\r\n/g;
const RE_CR = /\r/g;
const RE_ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const RE_LEADING_SPACE = /^(\s*)/;
const RE_TAB = /\t/g;

/**
* 核心：将代码转化为纯粹的逻辑行序列（忽略空行、换行符差异）
* 对于 Python 等缩进敏感语言，保留缩进深度信息
*/
export function getLogicSignature(code) {
    return code.replace(RE_CRLF, '\n')
                .replace(RE_CR, '\n')
                .split('\n')
                .map((line, index) => {
                    // 核心优化：只 trimRight，保留逻辑所需的左侧缩进意图
                    // 但 content 比较时使用全 trim 后的内容
                    const cleanLine = line.replace(RE_ZERO_WIDTH, '').replace(/\s+$/, '');
                    const trimmed = cleanLine.trim();
                    const indentMatch = cleanLine.match(RE_LEADING_SPACE);
                    const indentStr = indentMatch ? indentMatch[1].replace(RE_TAB, '    ') : '';
                    return { 
                        content: trimmed, 
                        indent: indentStr.length,
                        originalIndex: index 
                    };
                })
                .filter(item => item.content.length > 0);
}

/**
* 极致鲁棒的计数器：支持逻辑签名匹配
* @param {boolean} isStrictIndent 是否开启严格缩进校验（Python 建议开启）
*/
export function countMatches(content, search, isStrictIndent = false) {
    const contentSigs = typeof content === 'string' ? getLogicSignature(content) : content;
    const searchSigs = typeof search === 'string' ? getLogicSignature(search) : search;
    
    if (searchSigs.length === 0) return 0;
    
    let count = 0;
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
        if (checkMatchAt(contentSigs, searchSigs, i, isStrictIndent)) {
            count++;
        }
    }
    return count;
}

/**
* 内部函数：检查指定位置是否匹配
*/
function checkMatchAt(contentSigs, searchSigs, startIdx, isStrictIndent) {
    // 基础逻辑匹配
    for (let j = 0; j < searchSigs.length; j++) {
        if (contentSigs[startIdx + j].content !== searchSigs[j].content) {
            return false;
        }
    }
    
    // Python 语义缩进校验：检查相对缩进变化是否一致
    if (isStrictIndent && searchSigs.length > 1) {
        const fileBaseIndent = contentSigs[startIdx].indent;
        const searchBaseIndent = searchSigs[0].indent;
        
        // 改进：使用比例/深度校验，处理缩进单位不一致（如 2 vs 4 空格）的情况
        let indentRatio = null; // 修复：使用局部变量而不是 this
        
        for (let j = 1; j < searchSigs.length; j++) {
            const fileRel = contentSigs[startIdx + j].indent - fileBaseIndent;
            const searchRel = searchSigs[j].indent - searchBaseIndent;

            // 如果两者都为 0，说明缩进未变，匹配成功
            if (fileRel === 0 && searchRel === 0) continue;
            // 如果其中一个变了一个没变，或者方向相反，匹配失败
            if (fileRel * searchRel <= 0) return false;
            
            // 只要缩进的变化方向一致即可。更严谨的做法是校验比例是否恒定。
            // 这里采用简单的比例一致性校验
            if (indentRatio === null) {
                // 记录第一行的缩进比例作为基准
                indentRatio = fileRel / searchRel;
            } else if (Math.abs((fileRel / searchRel) - indentRatio) > 0.01) {
                // 使用浮点数容差比较，避免精度问题
                return false;
            }
        }
    }
    
    return true;
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
export function findMatchPosition(contentSigs, searchSigs, isStrictIndent = false) {
    for (let i = 0; i <= contentSigs.length - searchSigs.length; i++) {
        if (checkMatchAt(contentSigs, searchSigs, i, isStrictIndent)) {
            return contentSigs[i].originalIndex;
        }
    }
    return -1;
}
