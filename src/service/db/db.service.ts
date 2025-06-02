// src/service/prisma.service.ts
import { Provide, Scope, ScopeEnum, Inject } from '@midwayjs/core';
import { asyncLocalStorage } from '../../db/context';
import { ExtendedPrismaClient } from '../../db/prisma';
import { PrismaClient } from '../../generated/prisma/client';


@Provide()
@Scope(ScopeEnum.Singleton)
export class PrismaService {
    private client: PrismaClient;

    constructor() {
        this.client = new PrismaClient({
            log: ['query', 'info', 'warn', 'error']
        })
        console.log('Prisma客户端已创建');
    }

    getClient() {
        return this.client;
    }

    async onStop() {
        await this.client.$disconnect();
    }
}


@Provide()
@Scope(ScopeEnum.Singleton)
export class DbService {
    // private _client: ExtendedPrismaClient | null = null;

    @Inject()
    prismaService: PrismaService;

    get client(): ExtendedPrismaClient {
        return this.prismaService.getClient();
    }

    /**
     * 在绕过全局过滤的上下文中执行操作
     */
    async ignoreFilter<T>(
        operation: (client: ExtendedPrismaClient) => Promise<T>,
        options: { tenantId?: string } = {}
    ): Promise<T> {
        const currentContext = asyncLocalStorage.getStore();

        return asyncLocalStorage.run(
            {
                ...currentContext,
                tenantId: options.tenantId || currentContext?.tenantId || null,
                userId: options.tenantId || currentContext?.userId || null,
                bypassGlobalFilter: true
            },
            async () => {
                // 确保使用getter获取客户端
                return operation(this.client);
            }
        );
    }

    /**
     * 在特定租户上下文中执行操作
     */
    async withTenant<T>(
        tenantId: string,
        userId: string,
        operation: (client: ExtendedPrismaClient) => Promise<T>
    ): Promise<T> {
        return asyncLocalStorage.run(
            { tenantId, userId, bypassGlobalFilter: false },
            async () => {
                return operation(this.client);
            }
        );
    }
}