/**
 * 语法高亮模块 - 支持 30+ 编程语言
 * 
 * 使用 DOM 方式绕过 Trusted Types 限制
 */

import { KEYWORDS, LITERALS, BUILTINS, ALIASES, FILENAME_PATTERNS, COMMENT_STYLES } from './languages.js';

// ============ 语言检测 ============

/**
 * 根据文件名检测语言
 */
export function detectLanguage(filename) {
    const baseName = filename.split('/').pop();
    
    // 1. 检查完整文件名
    if (FILENAME_PATTERNS[baseName]) {
        return FILENAME_PATTERNS[baseName];
    }
    
    // 2. 检查扩展名
    const ext = baseName.split('.').pop().toLowerCase();
    if (ALIASES[ext]) {
        return ALIASES[ext];
    }
    
    // 3. 检查是否是原生支持的语言
    if (KEYWORDS[ext]) {
        return ext;
    }
    
    // 4. 默认 JavaScript
    return 'javascript';
}

/**
 * 根据代码内容猜测语言
 */
export function guessLanguageFromContent(code) {
    const firstLines = code.split('\n').slice(0, 15).join('\n');
    
    // Shebang 检测
    if (firstLines.startsWith('#!/')) {
        if (firstLines.includes('python')) return 'python';
        if (firstLines.includes('node') || firstLines.includes('deno')) return 'javascript';
        if (firstLines.includes('ruby')) return 'ruby';
        if (firstLines.includes('perl')) return 'perl';
        if (firstLines.includes('bash') || firstLines.includes('sh')) return 'bash';
        if (firstLines.includes('php')) return 'php';
    }

    // Python 特征
    if (/^(import |from |def |class |if __name__|@\w+)/.test(firstLines)) return 'python';
    
    // Rust 特征
    if (/^(use |mod |fn |impl |struct |enum |trait |pub )/.test(firstLines)) return 'rust';
    
    // Go 特征
    if (/^(package |import |func |type |var |const )/.test(firstLines)) return 'go';
    
    // Java 特征
    if (/^(package |import |public class |private |protected )/.test(firstLines)) return 'java';
    
    // C/C++ 特征
    if (/^(#include |#define |#ifndef |#ifdef |int main)/.test(firstLines)) return 'cpp';
    
    // Ruby 特征
    if (/^(require |gem |class |module |def |end$)/.test(firstLines)) return 'ruby';
    
    // PHP 特征
    if (/^(<\?php|namespace |use |class |function )/.test(firstLines)) return 'php';
    
    // HTML 特征
    if (/^(<!DOCTYPE|<html|<\?xml|<head|<body)/.test(firstLines)) return 'html';
    
    // CSS 特征
    if (/^(@import|@media|@keyframes|\*\s*\{|body\s*\{|\.[\w-]+\s*\{)/.test(firstLines)) return 'css';
    
    // JSON 特征
    if (/^\s*[\[{]/.test(firstLines) && !firstLines.includes('function')) return 'json';
    
    // SQL 特征
    if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|FROM|WHERE)/i.test(firstLines)) return 'sql';
    
    // Shell 特征
    if (/^(export |alias |source |echo |if \[|for |while |case )/.test(firstLines)) return 'bash';
    
    return 'javascript';
}

// ============ Tokenizer ============

/**
 * 获取语言的关键字正则
 */
function getKeywordRegex(lang) {
    const kw = KEYWORDS[lang] || KEYWORDS.javascript;
    return new RegExp(`^(${kw})$`);
}

/**
 * 获取语言的字面量正则
 */
function getLiteralRegex(lang) {
    const lit = LITERALS[lang] || LITERALS.javascript || '';
    if (!lit) return null;
    return new RegExp(`^(${lit})$`);
}

/**
 * 获取语言的内置函数正则
 */
function getBuiltinRegex(lang) {
    const builtin = BUILTINS[lang] || BUILTINS.javascript || '';
    if (!builtin) return null;
    return new RegExp(`^(${builtin})$`);
}


/**
 * 获取单行注释前缀
 */
function getLineCommentPrefix(lang) {
    return COMMENT_STYLES.line[lang] || '//';
}

/**
 * 行内 tokenizer - 将一行代码分解为 tokens
 */
function tokenizeLine(line, lang) {
    const tokens = [];
    let remaining = line;
    
    const kwRegex = getKeywordRegex(lang);
    const litRegex = getLiteralRegex(lang);
    const builtinRegex = getBuiltinRegex(lang);
    const commentPrefix = getLineCommentPrefix(lang);
    
    while (remaining.length > 0) {
        // 空白
        const wsMatch = remaining.match(/^(\s+)/);
        if (wsMatch) {
            tokens.push({ text: wsMatch[1], type: null });
            remaining = remaining.slice(wsMatch[1].length);
            continue;
        }
        
        // 单行注释检测（在行首或空白后）
        if (commentPrefix && remaining.startsWith(commentPrefix)) {
            tokens.push({ text: remaining, type: 'comment' });
            break;
        }
        
        // 字符串（双引号、单引号、反引号）
        const strMatch = remaining.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/);
        if (strMatch) {
            tokens.push({ text: strMatch[1], type: 'string' });
            remaining = remaining.slice(strMatch[1].length);
            continue;
        }
        
        // 数字（十六进制、二进制、八进制、浮点数）
        const numMatch = remaining.match(/^(0x[\da-fA-F_]+|0b[01_]+|0o[0-7_]+|\d[\d_]*\.?[\d_]*(?:e[+-]?[\d_]+)?[fFdDlLuU]*)/);
        if (numMatch) {
            tokens.push({ text: numMatch[1], type: 'number' });
            remaining = remaining.slice(numMatch[1].length);
            continue;
        }
        
        // 标识符
        const idMatch = remaining.match(/^([a-zA-Z_$@][\w$?!]*)/);
        if (idMatch) {
            const word = idMatch[1];
            let type = null;
            
            if (kwRegex && kwRegex.test(word)) {
                type = 'keyword';
            } else if (litRegex && litRegex.test(word)) {
                type = 'literal';
            } else if (builtinRegex && builtinRegex.test(word)) {
                type = 'builtin';
            } else if (remaining.slice(word.length).match(/^\s*[(\[{<]/)) {
                // 后面跟着括号，可能是函数调用
                type = 'function';
            }
            
            tokens.push({ text: word, type });
            remaining = remaining.slice(word.length);
            continue;
        }
        
        // 运算符和标点（可以扩展高亮）
        tokens.push({ text: remaining[0], type: null });
        remaining = remaining.slice(1);
    }
    
    return tokens;
}


// ============ DOM 高亮 ============

/**
 * 高亮代码到 DOM（绕过 Trusted Types）
 */
export function highlightToDOM(code, language, container) {
    const lang = ALIASES[language] || language;
    const commentPrefix = getLineCommentPrefix(lang);
    const lines = code.split('\n');
    
    // 使用 DocumentFragment 减少重绘
    const fragment = document.createDocumentFragment();
    
    // 多行注释状态
    let inBlockComment = false;
    const blockComment = COMMENT_STYLES.block[lang];
    
    lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) {
            fragment.appendChild(document.createTextNode('\n'));
        }
        
        if (line.length === 0) return;
        
        // 复杂状态处理：支持单行内混合代码和多行注释
        let remaining = line;
        
        while (remaining.length > 0) {
            if (inBlockComment) {
                // 在多行注释中，寻找结束符
                const endIdx = blockComment ? remaining.indexOf(blockComment[1]) : -1;
                
                if (endIdx !== -1) {
                    // 找到了结束符
                    const commentPart = remaining.slice(0, endIdx + blockComment[1].length);
                    const span = document.createElement('span');
                    span.className = 'ide-hl-comment';
                    span.textContent = commentPart;
                    fragment.appendChild(span);
                    
                    remaining = remaining.slice(endIdx + blockComment[1].length);
                    inBlockComment = false;
                } else {
                    // 没找到结束符，整段都是注释
                    const span = document.createElement('span');
                    span.className = 'ide-hl-comment';
                    span.textContent = remaining;
                    fragment.appendChild(span);
                    remaining = '';
                }
            } else {
                // 不在注释中，寻找多行注释开始符
                const startIdx = blockComment ? remaining.indexOf(blockComment[0]) : -1;
                const lineCommentIdx = commentPrefix ? remaining.indexOf(commentPrefix) : -1;
                
                // 检查单行注释是否更早出现（优先级最高）
                if (lineCommentIdx !== -1 && (startIdx === -1 || lineCommentIdx < startIdx)) {
                    // 先处理前面的代码
                    if (lineCommentIdx > 0) {
                        const codePart = remaining.slice(0, lineCommentIdx);
                        const tokens = tokenizeLine(codePart, lang);
                        tokens.forEach(t => renderToken(t, fragment));
                    }
                    // 处理剩下的整行注释
                    const span = document.createElement('span');
                    span.className = 'ide-hl-comment';
                    span.textContent = remaining.slice(lineCommentIdx);
                    fragment.appendChild(span);
                    remaining = '';
                    break;
                }
                
                if (startIdx !== -1) {
                    // 发现了多行注释开始
                    // 先渲染前面的代码
                    if (startIdx > 0) {
                        const codePart = remaining.slice(0, startIdx);
                        const tokens = tokenizeLine(codePart, lang);
                        tokens.forEach(t => renderToken(t, fragment));
                    }
                    remaining = remaining.slice(startIdx);
                    inBlockComment = true;
                } else {
                    // 只有代码
                    const tokens = tokenizeLine(remaining, lang);
                    tokens.forEach(t => renderToken(t, fragment));
                    remaining = '';
                }
            }
        }
    });

    // 一次性挂载
    container.appendChild(fragment);

    /* 辅助渲染函数 */
    function renderToken(token, target) {
        if (token.type) {
            const span = document.createElement('span');
            span.className = `ide-hl-${token.type}`;
            span.textContent = token.text;
            target.appendChild(span);
        } else {
            target.appendChild(document.createTextNode(token.text));
        }
    }
}


// ============ 工具函数 ============

/**
 * 获取支持的语言列表
 */
export function getSupportedLanguages() {
    return {
        native: Object.keys(KEYWORDS),
        aliases: Object.keys(ALIASES),
        filenamePatterns: Object.keys(FILENAME_PATTERNS),
    };
}

/**
 * 获取高亮样式 CSS
 */
export function getHighlightStyles() {
    return `
        .ide-hl-comment { color: #6a9955; font-style: italic; }
        .ide-hl-string { color: #ce9178; }
        .ide-hl-keyword { color: #569cd6; font-weight: 500; }
        .ide-hl-builtin { color: #4ec9b0; }
        .ide-hl-literal { color: #569cd6; }
        .ide-hl-number { color: #b5cea8; }
        .ide-hl-function { color: #dcdcaa; }
        .ide-hl-selector { color: #d7ba7d; }
        .ide-hl-property { color: #9cdcfe; }
        .ide-hl-tag { color: #569cd6; }
        .ide-hl-attr { color: #9cdcfe; }
        .ide-hl-operator { color: #d4d4d4; }
        .ide-hl-punctuation { color: #d4d4d4; }
        .ide-hl-type { color: #4ec9b0; }
        .ide-hl-decorator { color: #dcdcaa; }
        .ide-hl-namespace { color: #4ec9b0; }
        .ide-hl-constant { color: #4fc1ff; }
        .ide-hl-variable { color: #9cdcfe; }
        .ide-hl-parameter { color: #9cdcfe; }
        .ide-hl-label { color: #c586c0; }
        .ide-hl-preprocessor { color: #c586c0; }
        .ide-hl-macro { color: #dcdcaa; }
        .ide-hl-regex { color: #d16969; }
    `;
}
