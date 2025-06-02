// src/service/auth.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { UserService } from './user.service';
import { MenuService } from './menu.service';
import { PermissionService } from './permission.service';
import { TenantService } from './tenant.service';
import { asyncLocalStorage } from '../../db/context';
import { DbService } from '../db/db.service';
import { BaseService } from '../base.service';


@Provide()
export class AuthService extends BaseService {
    @Inject()
    userService: UserService;

    @Inject()
    menuService: MenuService;

    @Inject()
    permissionService: PermissionService;

    @Inject()
    tenantService: TenantService;

    @Inject()
    db: DbService;


    async checkTenantStatus() {
        // 获取当前租户ID
        const context = asyncLocalStorage.getStore();
        if (context?.tenantId) {
            await this.tenantService.checkTenantStatus(context.tenantId);
        }
    }

    // 获取用户可见菜单（考虑管理员权限和租户状态）
    async getUserMenuTree(userId: string) {
        // 1. 检查租户状态（如果不是主机）
        const context = asyncLocalStorage.getStore();
        if (context?.tenantId) {
            await this.tenantService.checkTenantStatus(context.tenantId);
        }

        // 2. 检查是否是管理员
        const isAdmin = await this.userService.isAdmin(userId);

        // 3. 获取完整菜单树
        const fullMenuTree = await this.menuService.getMenuTree();

        // 4. 管理员直接返回完整菜单
        if (isAdmin) {
            return fullMenuTree;
        }

        // 5. 非管理员：获取用户权限
        const userPermissions = await this.permissionService.getUserPermissions(userId);
        const allowedMenuIds = userPermissions.map(p => p.menuId);

        // 6. 过滤菜单树
        return this.filterMenuTree(fullMenuTree, allowedMenuIds);
    }

    // 过滤菜单树（只保留有权限的菜单）
    private filterMenuTree(menuTree: any[], allowedMenuIds: string[]): any[] {
        return menuTree
            .filter(menu => {
                const hasPermission = allowedMenuIds.includes(menu.id);
                const children = this.filterMenuTree(menu.children, allowedMenuIds);
                return hasPermission || children.length > 0;
            })
            .map(menu => ({
                ...menu,
                children: this.filterMenuTree(menu.children, allowedMenuIds),
            }));
    }

    // 检查用户是否有操作权限
    async checkPermission(userId: string, menuPath: string, action: string): Promise<boolean> {
        // 1. 管理员拥有所有权限
        if (await this.userService.isAdmin(userId)) {
            return true;
        }

        // 2. 获取菜单ID
        const menu = await this.db.client.menu.findFirst({
            where: { path: menuPath },
            select: { id: true },
        });

        if (!menu) return false;

        // 3. 获取用户所有权限
        const permissions = await this.permissionService.getUserPermissions(userId);

        // 4. 检查权限
        return permissions.some(p =>
            p.menuId === menu.id &&
            Array.isArray(p.actions) &&
            p.actions?.includes?.(action)
        );
    }
}