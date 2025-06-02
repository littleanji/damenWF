// src/service/tenant.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { BusinessError } from '../../common/error';
import { asyncLocalStorage } from '../../db/context';
import { BaseService } from '../base.service';

@Provide()
export class TenantService extends BaseService {
    @Inject()
    db: DbService;

    // 创建租户（主机操作）
    async createTenant(data: {
        name: string;
        description?: string;
        endTime: Date;
    }) {
        return this.db.ignoreFilter(async (client) => {
            return client.tenant.create({
                data: {
                    ...data,
                    isActive: true,
                    startTime: new Date(),
                },
            });
        });
    }

    async updateTenant(id: string, data: {
        name?: string;
        description?: string;
        endTime?: Date;
        isActive?: boolean;
    }) {
        return this.db.ignoreFilter(async (client) => {
            return client.tenant.update({
                where: { id },
                data,
            });
        });
    }

    async deleteTenant(id: string) {
        return this.db.ignoreFilter(async (client) => {
            return client.tenant.update({
                where: { id },
                data: { isDel: true },
            });
        });
    }

    async getTenantById(id: string) {
        return this.db.ignoreFilter(async (client) => {
            const tenant = await client.tenant.findUnique({
                where: { id },
            });

            if (!tenant) {
                throw new BusinessError('租户不存在');
            }

            return tenant;
        });
    }

    // 分页查询租户（主机操作）
    async getTenants(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        isActive?: boolean;
    } = {}) {
        const {
            page = 1,
            pageSize = 10,
            search,
            startDate,
            endDate,
            isActive
        } = options;

        return this.db.ignoreFilter(async (client) => {
            const where: any = {};

            if (search) {
                where.name = { contains: search };
            }

            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            // 日期范围查询
            if (startDate && endDate) {
                where.createdAt = {
                    gte: startDate,
                    lte: endDate
                };
            }

            const [items, total] = await Promise.all([
                client.tenant.findMany({
                    where,
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                    orderBy: { createdAt: 'desc' }
                }),
                client.tenant.count({ where })
            ]);

            return {
                items,
                total
            };
        });
    }

    async checkTenantStatus(tenantId: string): Promise<boolean> {
        if (!asyncLocalStorage.getStore()?.tenantId) return true;

        const tenant = await this.db.ignoreFilter(async (client) => {
            return client.tenant.findUnique({
                where: { id: tenantId },
                select: { isActive: true, endTime: true, isDel: true },
            });
        });

        if (!tenant || tenant.isDel) {
            throw new BusinessError('租户不存在');
        }

        if (!tenant.isActive) {
            throw new BusinessError('租户已停用');
        }

        if (tenant.endTime < new Date()) {
            throw new BusinessError('租户已过期');
        }

        return true;
    }
}