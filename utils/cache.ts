// 简单的内存缓存系统
interface CacheItem<T> {
    value: T;
    expires: number;
}

class TranslationCache<T> {
    private cache = new Map<string, CacheItem<T>>();
    private readonly DEFAULT_TTL = 86400000; // 24小时（毫秒）

    // 获取缓存项
    get(key: string): T | null {
        const item = this.cache.get(key);

        // 如果没有项或已过期，返回null
        if (!item || Date.now() > item.expires) {
            if (item) this.delete(key); // 清除过期项
            return null;
        }

        return item.value;
    }

    // 设置缓存项
    set(key: string, value: T, ttl = this.DEFAULT_TTL): void {
        const expires = Date.now() + ttl;
        this.cache.set(key, { value, expires });

        // 定期清理缓存
        this.cleanup();
    }

    // 删除缓存项
    delete(key: string): void {
        this.cache.delete(key);
    }

    // 清空所有缓存
    clear(): void {
        this.cache.clear();
    }

    // 获取缓存大小
    size(): number {
        return this.cache.size;
    }

    // 清理过期缓存
    private cleanup(): void {
        const now = Date.now();

        // 每100次写入操作执行一次清理
        if (this.cache.size % 100 === 0) {
            this.cache.forEach((value, key) => {
                if (now > value.expires) {
                    this.cache.delete(key);
                }
            });
        }
    }
}

// 导出翻译缓存实例
export const translationCache = new TranslationCache<string>();
