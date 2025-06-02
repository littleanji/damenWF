import { Provide, Inject } from '@midwayjs/core';
import { RedisService } from '@midwayjs/redis';

@Provide()
export class RedisServiceManage {
    @Inject()
    redisService: RedisService;

    /**
     * 获取缓存数据
     */
    async get(key: string): Promise<string | null> {
        return this.redisService.get(key);
    }

    /**
     * 设置缓存数据
     */
    async set(key: string, value: string, ttl?: number): Promise<void> {
        if (ttl) {
            await this.redisService.set(key, value, 'EX', ttl);
        } else {
            await this.redisService.set(key, value);
        }
    }

    /**
     * 删除缓存
     */
    async del(key: string): Promise<void> {
        await this.redisService.del(key);
    }

    /**
     * 获取 JSON 数据
     */
    async getJson<T>(key: string): Promise<T | null> {
        const data = await this.get(key);
        return data ? JSON.parse(data) : null;
    }

    /**
     * 设置 JSON 数据
     */
    async setJson(key: string, value: any, ttl?: number): Promise<void> {
        await this.set(key, JSON.stringify(value), ttl);
    }
}