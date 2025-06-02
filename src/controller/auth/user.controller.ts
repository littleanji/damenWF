// src/controller/user.controller.ts
import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { UserService } from '../../service/auth/user.service';
import { AuthService } from '../../service/auth/auth.service';


@Controller('/api/user')
export class UserController {
    @Inject()
    userService: UserService;

    @Inject()
    authService: AuthService;

    /**
     * 创建用户
     * @param data 用户数据
     */
    @Post('/')
    async createUser(@Body() data: any) {
        return this.userService.createUser(data);
    }

    /**
     * 更新用户
     * @param id 用户ID
     * @param data 更新数据
     */
    @Put('/:id')
    async updateUser(@Param('id') id: string, @Body() data: any) {
        return this.userService.updateUser(id, data);
    }

    /**
     * 删除用户
     * @param id 用户ID
     */
    @Del('/:id')
    async deleteUser(@Param('id') id: string) {
        return this.userService.deleteUser(id);
    }

    /**
     * 获取用户详情
     * @param id 用户ID
     */
    @Get('/:id')
    async getUser(@Param('id') id: string) {
        return this.userService.getUserById(id);
    }

    /**
     * 分页查询用户
     * @param page 页码
     * @param pageSize 每页数量
     * @param search 搜索关键字
     * @param startDate 创建开始时间
     * @param endDate 创建结束时间
     * @param isAdmin 是否管理员
     */
    @Get('/')
    async getUsers(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('isAdmin') isAdmin?: boolean
    ) {
        // 转换日期字符串为Date对象
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.userService.getUsers({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end,
            isAdmin
        });
    }

    /**
     * 获取用户的菜单树
     * @param id 用户ID
     */
    @Get('/:id/menus')
    async getUserMenus(@Param('id') id: string) {
        return this.authService.getUserMenuTree(id);
    }
}