// src/service/user.service.ts
import { Provide, Inject } from '@midwayjs/core';
import { DbService } from '../db/db.service';
import { TenantService } from './tenant.service';
import { BusinessError } from '../../common/error';
import { PasswordUtil } from '../../utils/passwordUtil';
import { BaseService } from '../base.service';

@Provide()
export class UserService extends BaseService {
    @Inject()
    db: DbService;

    @Inject()
    tenantService: TenantService;

    /**
     * 创建用户
     * @param data 用户数据
     */
    async createUser(data: {
        username: string;
        password: string;
        email?: string;
        phone?: string;
        roleIds?: string[];
        isAdmin?: boolean;
    }) {
        // 密码加密
        const hashedPassword = await PasswordUtil.hash(data.password);

        return this.db.client.user.create({
            data: {
                ...data,
                password: hashedPassword,
                roles: data.roleIds ? {
                    connect: data.roleIds.map(id => ({ id }))
                } : undefined,
            },
        });
    }

    /**
     * 更新用户
     * @param id 用户ID
     * @param data 更新数据
     */
    async updateUser(id: string, data: {
        username?: string;
        password?: string;
        email?: string;
        phone?: string;
        roleIds?: string[];
        isAdmin?: boolean;
    }) {

        // 如果需要更新密码，进行加密
        let hashedPassword = undefined;
        if (data.password) {
            hashedPassword = await PasswordUtil.hash(data.password);
        }

        return this.db.client.user.update({
            where: { id },
            data: {
                ...data,
                password: hashedPassword,
                roles: data.roleIds ? {
                    set: data.roleIds.map(id => ({ id }))
                } : undefined,
            },
        });
    }

    /**
     * 删除用户（软删除）
     * @param id 用户ID
     */
    async deleteUser(id: string) {
        return this.db.client.user.update({
            where: { id },
            data: { isDel: true },
        });
    }


    /**
     * 根据角色名获取用户
     * @param role  角色数据
     * @returns 
     */
    async findUsersByRole(role: string) {
        const users = await this.db.client.user.findMany({
            where: { roles: { some: { name: role } } }
        });
        return users;
    }

    /**
     * 根据ID获取用户详情
     * @param id 用户ID
     */
    async getUserById(id: string) {
        const user = await this.db.client.user.findUnique({
            where: { id },
            include: { roles: true, permissions: true }
        });

        if (!user) {
            throw new BusinessError('用户不存在');
        }

        delete user.password;

        return user;
    }

    /**
     * 根据用户名获取用户
     * @param username 用户名
     */
    async findUserByUsername(username: string) {
        return this.db.client.user.findFirst({
            where: { username }
        });
    }

    /**
     * 分页查询用户
     * @param options 分页和筛选选项
     */
    async getUsers(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        startDate?: Date;
        endDate?: Date;
        isAdmin?: boolean;
    } = {}) {
        const {
            page = 1,
            pageSize = 10,
            search,
            startDate,
            endDate,
            isAdmin
        } = options;

        // 构建查询条件
        const where: any = {};

        if (search) {
            where.OR = [
                { username: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        if (isAdmin !== undefined) {
            where.isAdmin = isAdmin;
        }

        // 日期范围查询
        if (startDate && endDate) {
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        const [items, total] = await Promise.all([
            this.db.client.user.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: {
                    roles: true
                }
            }),
            this.db.client.user.count({ where })
        ]);

        return {
            items,
            total
        };
    }

    /**
     * 检查用户是否是管理员
     * @param userId 用户ID
     */
    async isAdmin(userId: string): Promise<boolean> {
        const user = await this.db.client.user.findUnique({
            where: { id: userId },
            select: { isAdmin: true },
        });

        if (!user) {
            throw new BusinessError('用户不存在');
        }

        return user.isAdmin ?? false;
    }
}