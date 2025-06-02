// src/db/context.ts
import { AsyncLocalStorage } from 'async_hooks';

// 定义全局上下文类型
export type PrismaContext = {
    tenantId: string;
    userId: string;
    bypassGlobalFilter: boolean;
};

// 创建异步本地存储实例
export const asyncLocalStorage = new AsyncLocalStorage<PrismaContext>();  