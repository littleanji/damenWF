import { RedisService } from '@midwayjs/redis';
import { BusinessError } from '../common/error';
import { Inject, Provide } from '@midwayjs/core';

@Provide()
export class lockUtil {
    @Inject()
    redisService: RedisService;

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

    async unLock(lockKey: string) {
        await this.redisService.del(lockKey);
    }
}