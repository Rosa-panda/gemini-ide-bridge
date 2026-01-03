/**
 * 语义掩码模块 - 保护多行字符串不被缩进处理破坏
 */

/**
 * 提取并保护多行字符串（语义掩码）
 * 返回 { masked: 处理后的代码, literals: 原始字符串映射 }
 */
export function extractLiterals(code) {
    const literals = new Map();
    let counter = 0;
    let result = '';
    let i = 0;
    const len = code.length;
    
    while (i < len) {
        // Python 三引号字符串 """ 或 '''
        if ((code.slice(i, i + 3) === '"""' || code.slice(i, i + 3) === "'''")) {
            const quote = code.slice(i, i + 3);
            const start = i;
            i += 3;
            
            // 找到结束引号
            while (i < len - 2) {
                if (code.slice(i, i + 3) === quote) {
                    i += 3;
                    break;
                }
                if (code[i] === '\\') i++; // 跳过转义
                i++;
            }
            
            const literal = code.slice(start, i);
            const placeholder = '__LITERAL_' + counter++ + '__';
            literals.set(placeholder, literal);
            result += placeholder;
            continue;
        }
        
        // JS 模板字符串 ` （包含换行的才保护）
        if (code[i] === '`') {
            const start = i;
            i++;
            let hasNewline = false;
            let depth = 1;
            
            while (i < len && depth > 0) {
                if (code[i] === '\n') hasNewline = true;
                if (code[i] === '\\') {
                    i += 2;
                    continue;
                }
                // 检测 ${ (插值开始) 或普通 { (插值内部的对象)
                if (code[i] === '$' && code[i + 1] === '{') {
                    depth++;
                    i += 2;
                    continue;
                }
                if (code[i] === '{' && depth > 1) {
                    depth++;
                    i++;
                    continue;
                }
                // 只有在插值深度内才减少深度
                if (code[i] === '}' && depth > 1) {
                    depth--;
                    i++;
                    continue;
                }
                if (code[i] === '`') {
                    depth--;
                    if (depth === 0) {
                        i++;
                        break;
                    }
                }
                i++;
            }
            
            const literal = code.slice(start, i);
            if (hasNewline) {
                const placeholder = '__LITERAL_' + counter++ + '__';
                literals.set(placeholder, literal);
                result += placeholder;
            } else {
                result += literal;
            }
            continue;
        }
        
        result += code[i];
        i++;
    }
    
    return { masked: result, literals };
}

/**
* 还原被保护的字符串
*/
export function restoreLiterals(code, literals) {
    let result = code;
    for (const [placeholder, original] of literals) {
        // 安全修复：使用 split/join 替代 replace
        // 理由：String.prototype.replace(str, str) 会解析 original 中的 $ 符号
        // 这在代码替换场景下极易导致内容损毁（如把 $1 误当成正则分组）
        result = result.split(placeholder).join(original);
    }
    return result;
}
