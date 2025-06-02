// src/controller/permission.controller.ts
import { Controller, Post, Body, Get, Param, Del, Inject, Query } from '@midwayjs/core';
import { PermissionService } from '../../service/auth/permission.service';


@Controller('/api/permissions')
export class PermissionController {
    @Inject()
    permissionService: PermissionService;

    /**
     * 为用户分配权限
     * @param userId 用户ID
     * @param menuId 菜单ID
     * @param actions 操作列表
     */
    @Post('/assign-user')
    async assignUserPermission(
        @Body('userId') userId: string,
        @Body('menuId') menuId: string,
        @Body('actions') actions: string[]
    ) {
        return this.permissionService.assignUserPermission(userId, menuId, actions);
    }

    /**
     * 为角色分配权限
     * @param roleId 角色ID
     * @param menuId 菜单ID
     * @param actions 操作列表
     */
    @Post('/assign-role')
    async assignRolePermission(
        @Body('roleId') roleId: string,
        @Body('menuId') menuId: string,
        @Body('actions') actions: string[]
    ) {
        return this.permissionService.assignRolePermission(roleId, menuId, actions);
    }

    /**
     * 移除用户权限
     * @param userId 用户ID
     * @param menuId 菜单ID
     */
    @Del('/user')
    async removeUserPermission(
        @Body('userId') userId: string,
        @Body('menuId') menuId: string
    ) {
        return this.permissionService.removeUserPermission(userId, menuId);
    }

    /**
     * 移除角色权限
     * @param roleId 角色ID
     * @param menuId 菜单ID
     */
    @Del('/role')
    async removeRolePermission(
        @Body('roleId') roleId: string,
        @Body('menuId') menuId: string
    ) {
        return this.permissionService.removeRolePermission(roleId, menuId);
    }

    /**
     * 获取权限详情
     * @param id 权限ID
     */
    @Get('/:id')
    async getPermission(@Param('id') id: string) {
        return this.permissionService.getPermissionById(id);
    }

    /**
     * 分页查询权限
     * @param page 页码
     * @param pageSize 每页数量
     * @param userId 用户ID
     * @param roleId 角色ID
     * @param menuId 菜单ID
     * @param type 权限类型 (USER/ROLE)
     * @param startDate 创建开始时间
     * @param endDate 创建结束时间
     */
    @Get('/')
    async getPermissions(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('userId') userId?: string,
        @Query('roleId') roleId?: string,
        @Query('menuId') menuId?: string,
        @Query('type') type?: 'USER' | 'ROLE',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.permissionService.getPermissions({
            page,
            pageSize,
            userId,
            roleId,
            menuId,
            type,
            startDate: start,
            endDate: end
        });
    }

    /**
     * 获取用户的所有权限
     * @param userId 用户ID
     */
    @Get('/user/:userId')
    async getUserPermissions(@Param('userId') userId: string) {
        return this.permissionService.getUserPermissions(userId);
    }
}