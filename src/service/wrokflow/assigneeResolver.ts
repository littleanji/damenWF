// src/service/assigneeResolver.ts
import { Provide, Inject } from '@midwayjs/core';
import { WorkflowInstance } from '../../generated/prisma';
import { UserService } from '../auth/user.service';
import { ExpressionParser } from './expressionParser';
import { DbService } from '../db/db.service';
import { BusinessError } from '../../common/error';
import { BaseService } from '../base.service';
/**
 * 处理人解析器 - 根据配置解析节点处理人
 */
@Provide()
export class AssigneeResolver extends BaseService {
    @Inject()
    userService: UserService;

    @Inject()
    expressionParser: ExpressionParser;

    @Inject()
    db: DbService;

    /**
     * 解析处理人
     * @param resolverConfig 解析器配置
     * @param instance 流程实例
     * @param nodeConfig 节点配置
     * @returns 处理人ID数组
     */
    async resolve(
        resolverConfig: string | any,
        instance: WorkflowInstance,
        nodeConfig: any
    ): Promise<string[]> {
        if (!resolverConfig) {
            return nodeConfig.assignees || [];
        }

        if (typeof resolverConfig === 'string') {
            return this.resolveStringConfig(resolverConfig, instance);
        }

        if (typeof resolverConfig === 'object') {
            return this.resolveObjectConfig(resolverConfig, instance);
        }

        throw new BusinessError('无效的处理人解析器配置');
    }

    /**
     * 解析字符串配置
     * @param config 配置字符串
     * @param instance 流程实例
     * @returns 处理人ID数组
     */
    private async resolveStringConfig(
        config: string,
        instance: WorkflowInstance
    ): Promise<string[]> {
        const [type, value] = config.split(':');

        console.log('解析字符串配置', type, value);

        switch (type) {
            case 'user':
                return [value];

            case 'role':
                return this.userService.findUsersByRole(value);

            case 'creator':
                return [instance.creatorId];

            case 'previous':
                return this.getPreviousNodeAssignees(instance);

            default:
                throw new Error(`未知的处理人解析类型: ${type}`);
        }
    }

    /**
     * 解析对象配置
     * @param config 配置对象
     * @param instance 流程实例
     * @returns 处理人ID数组
     */
    private async resolveObjectConfig(
        config: any,
        instance: WorkflowInstance
    ): Promise<string[]> {
        const { type, value, condition } = config;

        const baseAssignees = await this.resolveStringConfig(`${type}:${value}`, instance);

        if (condition) {
            const context = this.createConditionContext(instance);
            return baseAssignees.filter(assignee => {
                try {
                    context.$assignee = assignee;
                    return this.expressionParser.evaluate(condition, context);
                } catch (e) {
                    console.error(`处理人条件过滤失败: ${condition}`, e);
                    return false;
                }
            });
        }

        return baseAssignees;
    }

    /**
     * 获取上一节点处理人
     * @param instance 流程实例
     * @returns 处理人ID数组
     */
    private async getPreviousNodeAssignees(instance: WorkflowInstance): Promise<string[]> {

        const previousNodes = await this.db.client.WorkflowNodeInstance.findFirst({
            where: {
                instanceId: instance.id
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!previousNodes) {
            return [instance.creatorId];
        }

        return previousNodes.assignees;
    }

    /**
     * 创建条件上下文
     * @param instance 流程实例
     * @returns 上下文对象
     */
    private createConditionContext(instance: WorkflowInstance): any {
        const formData = typeof instance.formData === 'object' && instance.formData !== null
            ? instance.formData
            : {};
        return {
            ...formData,
            $tenant: instance.tenantId,
            $creator: instance.creatorId
        };
    }
}