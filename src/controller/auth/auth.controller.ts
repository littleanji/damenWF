// src/controller/auth.controller.ts
import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { JwtService } from '@midwayjs/jwt';
import { UserService } from '../../service/auth/user.service';
import { AuthService } from '../../service/auth/auth.service';
import { UnauthorizedError } from '../../common/error';
import { PasswordUtil } from '../../utils/passwordUtil';

@Controller('/api/auth')
export class AuthController {
    @Inject()
    userService: UserService;

    @Inject()
    authService: AuthService;

    @Inject()
    jwtService: JwtService;

    /**
     * 用户登录
     * @param username 用户名
     * @param password 密码
     */
    @Post('/login')
    async login(
        @Body('username') username: string,
        @Body('password') password: string
    ) {

        await this.authService.checkTenantStatus();

        const user = await this.userService.findUserByUsername(username);

        if (!user) {
            throw new UnauthorizedError('用户不存在');
        }

        const passwordMatch = await PasswordUtil.compare(password, user.password);
        if (!passwordMatch) {
            throw new UnauthorizedError('密码错误');
        }

        const token = await this.jwtService.sign({
            userId: user.id
        });

        const menuTree = await this.authService.getUserMenuTree(user.id);

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                name: user.name,
                isAdmin: user.isAdmin,
                tenantId: user.tenantId
            },
            menuTree
        };
    }

    /**
     * 检查用户权限
     * @param userId 用户ID
     * @param menuPath 菜单路径
     * @param action 操作名称
     */
    @Post('/check-permission')
    async checkPermission(
        @Body('userId') userId: string,
        @Body('menuPath') menuPath: string,
        @Body('action') action: string
    ) {
        const hasPermission = await this.authService.checkPermission(
            userId,
            menuPath,
            action
        );

        return { hasPermission };
    }
}