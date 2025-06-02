// src/service/menu.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { TenantService } from './tenant.service';
import { BusinessError } from '../../common/error';
import { BaseService } from '../base.service';

@Provide()
export class MenuService extends BaseService {
    @Inject()
    db: DbService;

    @Inject()
    tenantService: TenantService;

    // 创建菜单
    async createMenu(data: {
        name: string;
        path: string;
        icon?: string;
        order?: number;
        parentId?: string;
    }) {

        return this.db.client.menu.create({ data });
    }

    // 更新菜单
    async updateMenu(id: string, data: {
        name?: string;
        path?: string;
        icon?: string;
        order?: number;
        parentId?: string | null;
    }) {

        return this.db.client.menu.update({
            where: { id },
            data
        });
    }

    // 删除菜单（软删除）
    async deleteMenu(id: string) {
        return this.db.client.menu.update({
            where: { id },
            data: { isDel: true }
        });
    }

    // 获取菜单详情
    async getMenuById(id: string) {
        const menu = await this.db.client.menu.findUnique({
            where: { id },
            include: {
                children: true
            }
        });

        if (!menu) {
            throw new BusinessError('菜单不存在');
        }

        return menu;
    }

    // 分页查询菜单
    async getMenus(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        parentId?: string | null;
    } = {}) {
        const {
            page = 1,
            pageSize = 10,
            search,
            startDate,
            endDate,
            parentId
        } = options;

        // 构建查询条件
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { path: { contains: search } }
            ];
        }

        if (parentId !== undefined) {
            where.parentId = parentId;
        }

        // 日期范围查询
        if (startDate && endDate) {
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        const [items, total] = await Promise.all([
            this.db.client.menu.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { order: 'asc' }
            }),
            this.db.client.menu.count({ where })
        ]);

        return {
            items,
            total
        };
    }

    // 获取菜单树（整个租户）
    async getMenuTree() {
        const menus = await this.db.client.menu.findMany({
            orderBy: { order: 'asc' },
        });

        return this.buildMenuTree(menus);
    }

    // 构建菜单树结构
    private buildMenuTree(menus: any[], parentId: string | null = null): any[] {
        return menus
            .filter(menu => menu.parentId === parentId)
            .map(menu => ({
                ...menu,
                children: this.buildMenuTree(menus, menu.id),
            }));
    }
}