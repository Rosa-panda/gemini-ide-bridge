/**
 * 状态管理模块 - 补丁应用状态持久化
 */

const STORAGE_KEY = 'ide-applied-patches';

/**
 * 生成修改块的唯一标识
 */
export function getPatchKey(file, search) {
    const content = file + ':' + search.slice(0, 100);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i);
        hash = hash & hash;
    }
    return 'patch_' + Math.abs(hash).toString(36);
}

/**
 * 记录已应用的修改
 */
export function markAsApplied(file, search) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = getPatchKey(file, search);
        data[key] = { file, timestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[IDE] 保存应用记录失败', e);
    }
}

/**
 * 移除应用记录（撤销时）
 */
export function unmarkAsApplied(file, search) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = getPatchKey(file, search);
        delete data[key];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('[IDE] 移除应用记录失败', e);
    }
}

/**
 * 检查修改是否已应用
 */
export async function checkIfApplied(file, search, replace, fsModule) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = getPatchKey(file, search);
        const hasRecord = !!data[key];
        
        if (fsModule.hasFile(file)) {
            const content = await fsModule.readFile(file);
            if (content !== null) {
                const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
                const normalizedContent = normalize(content);
                const normalizedSearch = normalize(search);
                const normalizedReplace = normalize(replace);
                
                const searchExists = normalizedContent.includes(normalizedSearch);
                const replaceExists = normalizedContent.includes(normalizedReplace);
                
                // 核心逻辑：只有当 SEARCH 不存在 且 REPLACE 存在时，才认为已应用
                // 如果 SEARCH 还存在，无论 REPLACE 是否存在，都认为未应用
                if (searchExists) {
                    // 如果 localStorage 有记录但文件未应用，清除脏数据
                    if (hasRecord) {
                        unmarkAsApplied(file, search);
                    }
                    return { applied: false, confident: true };
                }
                
                // SEARCH 不存在，检查 REPLACE 是否存在
                if (replaceExists) {
                    // 确保 localStorage 有记录
                    if (!hasRecord) {
                        markAsApplied(file, search);
                    }
                    return { applied: true, confident: true };
                }
                
                // 如果 search 和 replace 都不存在，但 localStorage 有记录
                // 说明文件被外部修改（如 git 回退），清除脏数据
                if (hasRecord) {
                    unmarkAsApplied(file, search);
                }
            }
        }
        
        return { applied: false, confident: false };
    } catch (e) {
        return { applied: false, confident: false };
    }
}
