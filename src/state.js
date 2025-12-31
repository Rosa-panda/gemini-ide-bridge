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
 * 检查修改是否已应用（双重确认：localStorage + 文件内容）
 */
export async function checkIfApplied(file, search, replace, fsModule) {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = getPatchKey(file, search);
        const hasRecord = !!data[key];
        
        if (fsModule.hasFile(file)) {
            const content = await fsModule.readFile(file);
            if (content !== null) {
                const searchExists = content.includes(search);
                const replaceExists = replace && content.includes(replace);
                
                // SEARCH 不存在 + REPLACE 存在 = 已应用
                if (!searchExists && replaceExists) {
                    return { applied: true, confident: true };
                }
                // SEARCH 存在 = 未应用
                if (searchExists) {
                    return { applied: false, confident: true };
                }
                // 都不存在，依赖 localStorage 记录
                if (hasRecord) {
                    return { applied: true, confident: false };
                }
            }
        }
        
        return { applied: hasRecord, confident: hasRecord };
    } catch (e) {
        return { applied: false, confident: false };
    }
}
