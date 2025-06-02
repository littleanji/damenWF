
// src/db/prisma.ts
import { PrismaClient } from '../generated/prisma/client';
import { asyncLocalStorage } from './context';

console.log('Prisma模块加载 - 开始初始化');

// 使用单例模式确保只初始化一次
let prismaInstance: any = null;

export function getPrismaClient() {
    if (!prismaInstance) {
        console.log('创建基础Prisma客户端');
        const basePrisma = new PrismaClient({
            log: process.env.NODE_ENV === 'production'
                ? ['error']
                : ['query', 'warn', 'error']
        });

        console.log('扩展Prisma客户端');
        prismaInstance = basePrisma.$extends((client: any) => {
            return client.$use(async (params: any, next: any) => {
                try {
                    const context = asyncLocalStorage.getStore();

                    // 1. 完全绕过全局过滤
                    if (context?.bypassGlobalFilter) {
                        return next(params);
                    }

                    const tenantId = context?.tenantId;

                    // [保持原有的扩展逻辑] // 2. 处理创建操作 - 自动设置租户ID
                    if (params.action === 'create' && tenantId && params.model !== 'Tenant') {
                        params.args.data = {
                            ...params.args.data,
                            tenantId: params.args.data.tenantId || tenantId,
                        };
                    }

                    // 3. 处理 createMany 操作
                    if (params.action === 'createMany' && tenantId && Array.isArray(params.args.data)) {
                        params.args.data = params.args.data.map(item => ({
                            ...item,
                            tenantId: item.tenantId || tenantId,
                        }));
                    }

                    // 4. 处理查询/更新/删除操作
                    if (['find', 'update', 'delete', 'count', 'aggregate'].some(prefix =>
                        params.action.startsWith(prefix)) &&
                        params.model !== 'Tenant') {

                        // 初始化 where 对象
                        if (!params.args.where) {
                            params.args.where = {};
                        }

                        // 构建新的过滤条件
                        const newConditions: any = {};

                        // 添加租户隔离条件
                        if (tenantId) {
                            newConditions.tenantId = tenantId;
                        }

                        // 添加软删除条件（排除特定模型）
                        const softDeleteModels = ['Role', 'Menu', 'Permission'];
                        if (softDeleteModels.includes(params.model as string)) {
                            newConditions.isDel = false;
                        }

                        // 合并条件到现有 where
                        if (Object.keys(newConditions).length > 0) {
                            if (params.args.where.AND) {
                                params.args.where.AND.push(newConditions);
                            } else if (params.args.where.OR) {
                                params.args.where = {
                                    AND: [params.args.where, newConditions]
                                };
                            } else {
                                params.args.where = {
                                    ...params.args.where,
                                    ...newConditions
                                };
                            }
                        }
                    }

                    return next(params);
                } catch (error) {
                    console.error('Prisma中间件错误:', error);
                    throw error;
                }
            });
        });

        console.log('Prisma客户端扩展完成');
    }
    return prismaInstance;
}

export type ExtendedPrismaClient = ReturnType<typeof getPrismaClient>;