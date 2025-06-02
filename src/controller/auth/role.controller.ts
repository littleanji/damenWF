// src/controller/role.controller.ts
import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { RoleService } from '../../service/auth/role.service';


@Controller('/api/role')
export class RoleController {
    @Inject()
    roleService: RoleService;

    /**
     * 创建角色
     * @param data 角色数据
     */
    @Post('/')
    async createRole(@Body() data: any) {
        return this.roleService.createRole(data);
    }

    /**
     * 更新角色
     * @param id 角色ID
     * @param data 更新数据
     */
    @Put('/:id')
    async updateRole(@Param('id') id: string, @Body() data: any) {
        return this.roleService.updateRole(id, data);
    }

    /**
     * 删除角色
     * @param id 角色ID
     */
    @Del('/:id')
    async deleteRole(@Param('id') id: string) {
        return this.roleService.deleteRole(id);
    }

    /**
     * 获取角色详情
     * @param id 角色ID
     */
    @Get('/:id')
    async getRole(@Param('id') id: string) {
        return this.roleService.getRoleById(id);
    }

    /**
     * 分页查询角色
     * @param page 页码
     * @param pageSize 每页数量
     * @param search 搜索关键字
     * @param startDate 创建开始时间
     * @param endDate 创建结束时间
     */
    @Get('/')
    async getRoles(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        // 转换日期字符串为Date对象
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.roleService.getRoles({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end
        });
    }
}