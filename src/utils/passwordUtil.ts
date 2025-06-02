// src/utils/password.util.ts
import * as bcrypt from 'bcryptjs';

export class PasswordUtil {
    /**
     * 加密密码
     * @param password 明文密码
     * @returns 加密后的密码
     */
    static async hash(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }

    /**
     * 验证密码
     * @param password 明文密码
     * @param hashedPassword 加密后的密码
     * @returns 是否匹配
     */
    static async compare(password: string, hashedPassword: string): Promise<boolean> {
        return bcrypt.compare(password, hashedPassword);
    }
}