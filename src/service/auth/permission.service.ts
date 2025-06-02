// src/service/permission.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { TenantService } from './tenant.service';
import { BusinessError } from '../../common/error';
import { BaseService } from '../base.service';

@Provide()
export class PermissionService extends BaseService {
    @Inject()
    db: DbService;

    @Inject()
    tenantService: TenantService;

    // 为用户分配权限
    async assignUserPermission(userId: string, menuId: string, actions: string[]) {

        return this.db.client.permission.upsert({
            where: {
                type_userId_menuId: {
                    type: 'USER',
                    userId,
                    menuId,
                },
            },
            create: {
                type: 'USER',
                userId,
                menuId,
                actions,
            },
            update: { actions },
        });
    }

    // 为角色分配权限
    async assignRolePermission(roleId: string, menuId: string, actions: string[]) {

        return this.db.client.permission.upsert({
            where: {
                type_roleId_menuId: {
                    type: 'ROLE',
                    roleId,
                    menuId,
                },
            },
            create: {
                type: 'ROLE',
                roleId,
                menuId,
                actions,
            },
            update: { actions },
        });
    }

    // 删除用户权限
    async removeUserPermission(userId: string, menuId: string) {
        return this.db.client.permission.delete({
            where: {
                type_userId_menuId: {
                    type: 'USER',
                    userId,
                    menuId,
                },
            },
        });
    }

    // 删除角色权限
    async removeRolePermission(roleId: string, menuId: string) {
        return this.db.client.permission.delete({
            where: {
                type_roleId_menuId: {
                    type: 'ROLE',
                    roleId,
                    menuId,
                },
            },
        });
    }

    // 获取权限详情
    async getPermissionById(id: string) {
        const permission = await this.db.client.permission.findUnique({
            where: { id },
            include: {
                menu: true,
                user: true,
                role: true
            }
        });

        if (!permission) {
            throw new BusinessError('权限不存在');
        }

        return permission;
    }

    // 分页查询权限
    async getPermissions(options: {
        page?: number;
        pageSize?: number;
        userId?: string;
        roleId?: string;
        menuId?: string;
        type?: 'USER' | 'ROLE';
        startDate?: Date;
        endDate?: Date;
    } = {}) {
        const {
            page = 1,
            pageSize = 10,
            userId,
            roleId,
            menuId,
            type,
            startDate,
            endDate
        } = options;

        // 构建查询条件
        const where: any = {};

        if (userId) where.userId = userId;
        if (roleId) where.roleId = roleId;
        if (menuId) where.menuId = menuId;
        if (type) where.type = type;

        // 日期范围查询
        if (startDate && endDate) {
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        const [items, total] = await Promise.all([
            this.db.client.permission.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: {
                    menu: true,
                    user: true,
                    role: true
                }
            }),
            this.db.client.permission.count({ where })
        ]);

        return {
            items,
            total
        };
    }

    // 获取用户所有权限（直接权限 + 角色权限）
    async getUserPermissions(userId: string) {
        const [directPermissions, rolePermissions] = await Promise.all([
            this.db.client.permission.findMany({
                where: {
                    userId,
                    type: 'USER',
                },
            }),
            this.db.client.permission.findMany({
                where: {
                    role: {
                        users: {
                            some: { id: userId },
                        },
                    },
                    type: 'ROLE',
                },
            }),
        ]);

        return [...directPermissions, ...rolePermissions];
    }
}