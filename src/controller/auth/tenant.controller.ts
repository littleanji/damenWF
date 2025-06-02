// src/controller/tenant.controller.ts
import { Controller, Post, Body, Get, Param, Put, Del, Inject, Query } from '@midwayjs/core';
import { TenantService } from '../../service/auth/tenant.service';


@Controller('/api/tenant')
export class TenantController {
    @Inject()
    tenantService: TenantService;

    /**
     * 创建租户
     * @param data 租户数据
     */
    @Post('/')
    async createTenant(@Body() data: any) {
        return this.tenantService.createTenant(data);
    }

    /**
     * 更新租户
     * @param id 租户ID
     * @param data 更新数据
     */
    @Put('/:id')
    async updateTenant(@Param('id') id: string, @Body() data: any) {
        return this.tenantService.updateTenant(id, data);
    }

    /**
     * 删除租户
     * @param id 租户ID
     */
    @Del('/:id')
    async deleteTenant(@Param('id') id: string) {
        return this.tenantService.deleteTenant(id);
    }

    /**
     * 获取租户详情
     * @param id 租户ID
     */
    @Get('/:id')
    async getTenant(@Param('id') id: string) {
        return this.tenantService.getTenantById(id);
    }

    /**
     * 分页查询租户
     * @param page 页码
     * @param pageSize 每页数量
     * @param search 搜索关键字
     * @param startDate 创建开始时间
     * @param endDate 创建结束时间
     * @param isActive 是否激活
     */
    @Get('/')
    async getTenants(
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 20,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('isActive') isActive?: boolean
    ) {
        // 转换日期字符串为Date对象
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;

        return this.tenantService.getTenants({
            page,
            pageSize,
            search,
            startDate: start,
            endDate: end,
            isActive
        });
    }
}