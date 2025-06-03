import { Provide, Inject } from '@midwayjs/core';
import { RedisService } from '@midwayjs/redis';
import { BusinessError } from '../../common/error';

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

    /**
     * 分布式锁
     * @param lockKey 
     * @param timeout 
     * @returns 
     */
    async lock(lockKey: string, timeout = 5000): Promise<string> {
            const lockValue = Date.now() + timeout + 1;
            const acquired = await this.redisService.set(
                lockKey,
                lockValue,
                'PX',
                timeout,
                'NX'
            );
    
            if (acquired !== 'OK') {
                throw new BusinessError('获取锁失败，流程正在处理中');
            }
            return lockValue.toString();
        }
    
        /**
         * 移除锁
         * @param lockKey 
         */
    async unLock(lockKey: string) {
        await this.redisService.del(lockKey);
    }
}