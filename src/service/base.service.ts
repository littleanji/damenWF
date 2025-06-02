// src/service/base.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from './db/db.service';
import { asyncLocalStorage } from '../db/context';

@Provide()
export class BaseService {
    @Inject()
    protected db: DbService;

    // 获取当前租户ID（可能为空）
    protected getCurrentTenantId(): string | null {
        return asyncLocalStorage.getStore()?.tenantId || null;
    }

    // 检查是否是主机（无租户上下文）
    protected isHostContext(): boolean {
        return !this.getCurrentTenantId();
    }

    // 执行主机级操作（绕过所有过滤）
    protected async withHostContext<T>(operation: (client: any) => Promise<T>): Promise<T> {
        return this.db.ignoreFilter(operation);
    }

    /**
   * 统一分页查询方法
   * @param model 模型名称
   * @param options 查询选项
   */
    protected async getAll<T>(
        model: string,
        options: {
            page?: number;
            pageSize?: number;
            where?: any; // 动态查询条件
            dateField?: string; // 日期字段名
            startDate?: Date; // 开始日期
            endDate?: Date; // 结束日期
            orderBy?: any; // 排序方式
            include?: any; // 关联查询
        } = {}
    ) {
        const {
            page = 1,
            pageSize = 10,
            where = {},
            dateField,
            startDate,
            endDate,
            orderBy = { createdAt: 'desc' },
            include
        } = options;

        const skip = (page - 1) * pageSize;
        const take = pageSize;

        // 构建最终查询条件
        const finalWhere: any = { ...where };

        // 添加日期范围条件
        if (dateField && startDate && endDate) {
            finalWhere[dateField] = {
                gte: startDate,
                lte: endDate
            };
        }

        const [items, total] = await Promise.all([
            this.db.client[model.toLowerCase()].findMany({
                where: finalWhere,
                skip,
                take,
                orderBy,
                include
            }),
            this.db.client[model.toLowerCase()].count({
                where: finalWhere
            })
        ]);

        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        };
    }
}