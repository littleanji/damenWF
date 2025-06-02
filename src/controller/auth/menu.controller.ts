// src/controller/menu.controller.ts
import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { MenuService } from '../../service/auth/menu.service';


@Controller('/api/menu')
export class MenuController {
    @Inject()
    menuService: MenuService;

    /**
     * 创建菜单
     * @param data 菜单数据
     */
    @Post('/')
    async createMenu(@Body() data: any) {
        return this.menuService.createMenu(data);
    }

    /**
     * 更新菜单
     * @param id 菜单ID
     * @param data 更新数据
     */
    @Put('/:id')
    async updateMenu(@Param('id') id: string, @Body() data: any) {
        return this.menuService.updateMenu(id, data);
    }

    /**
     * 删除菜单
     * @param id 菜单ID
     */
    @Del('/:id')
    async deleteMenu(@Param('id') id: string) {
        return this.menuService.deleteMenu(id);
    }

    /**
     * 获取菜单详情
     * @param id 菜单ID
     */
    @Get('/:id')
    async getMenu(@Param('id') id: string) {
        return this.menuService.getMenuById(id);
    }

    /**
     * 分页查询菜单
     * @param page 页码
     * @param pageSize 每页数量
     * @param search 搜索关键字
     * @param startDate 创建开始时间
     * @param endDate 创建结束时间
     * @param parentId 父菜单ID
     */
    @Get('/')
    async getMenus(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('parentId') parentId?: string
    ) {
        // 转换日期字符串为Date对象
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.menuService.getMenus({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end,
            parentId
        });
    }

    /**
     * 获取菜单树
     */
    @Get('/tree')
    async getMenuTree() {
        return this.menuService.getMenuTree();
    }
}