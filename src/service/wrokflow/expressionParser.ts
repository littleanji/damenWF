// src/service/expressionParser.ts
import { Provide } from '@midwayjs/core';
import * as vm from 'vm';
import { BusinessError } from '../../common/error';
import { BaseService } from '../base.service';

/**
 * 表达式解析器 - 安全执行动态表达式
 */
@Provide()
export class ExpressionParser extends BaseService {
    /**
     * 安全执行表达式
     */
    evaluate(expression: string, context: Record<string, any>): any {
        if (!this.validate(expression)) {
            throw new BusinessError(`表达式不安全: ${expression}`);
        }

        try {
            const sandbox = {
                ...context,
                Math: Math,
                Date: Date,
                JSON: JSON,
                parseInt,
                parseFloat,
                isNaN,
                isFinite,
                // 禁止危险函数
                eval: undefined,
                Function: undefined,
                process: undefined,
                require: undefined,
            };

            const script = new vm.Script(`(${expression})`);
            return script.runInNewContext(sandbox, { timeout: 100 });
        } catch (e) {
            throw new Error(`表达式执行失败: ${expression}。错误: ${e.message}`);
        }
    }

    /**
     * 验证表达式安全性
     */
    validate(expression: string): boolean {

        if (expression.length > 500) return false;

        const unsafeKeywords = [
            'process', 'require', 'eval', 'Function',
            'constructor', '__proto__', 'this', 'import',
            'global', 'window', 'document', 'XMLHttpRequest'
        ];

        if (unsafeKeywords.some(kw => expression.includes(kw))) {
            return false;
        }

        // 检查危险模式
        const unsafePatterns = [
            /\(.*?\)/g,
            /=>/g,
            /new\s+\w+/g
        ];

        return !unsafePatterns.some(pattern => pattern.test(expression));
    }
}