// src/service/role.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { TenantService } from './tenant.service';
import { BusinessError } from '../../common/error';
import { BaseService } from '../base.service';

@Provide()
export class RoleService extends BaseService {
    @Inject()
    db: DbService;

    @Inject()
    tenantService: TenantService;

    // 创建角色
    async createRole(data: {
        name: string;
        description?: string;
    }) {
        return this.db.client.role.create({ data });
    }

    // 更新角色
    async updateRole(id: string, data: {
        name?: string;
        description?: string;
    }) {

        return this.db.client.role.update({
            where: { id },
            data
        });
    }

    async deleteRole(id: string) {
        return this.db.client.role.update({
            where: { id },
            data: { isDel: true }
        });
    }

    async getRoleById(id: string) {
        const role = await this.db.client.role.findUnique({
            where: { id },
            include: {
                users: true,
                permissions: true
            }
        });

        if (!role) {
            throw new BusinessError('角色不存在');
        }

        return role;
    }

    // 分页查询角色
    async getRoles(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        startDate?: Date;
        endDate?: Date;
    } = {}) {
        const {
            page = 1,
            pageSize = 10,
            search,
            startDate,
            endDate
        } = options;

        // 构建查询条件
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } }
            ];
        }

        // 日期范围查询
        if (startDate && endDate) {
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        const [items, total] = await Promise.all([
            this.db.client.role.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: {
                    permissions: true
                }
            }),
            this.db.client.role.count({ where })
        ]);

        return {
            items,
            total
        };
    }
}