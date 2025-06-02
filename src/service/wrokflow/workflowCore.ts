// src/service/workflowEngineService.ts
import { Provide, Inject } from '@midwayjs/core';
import { RedisService } from '@midwayjs/redis';
import {
    WorkflowDefinition, WorkflowInstance, NodeStatus, ActionType,
    InstanceStatus
} from '../../generated/prisma';
import { ExpressionParser } from './expressionParser';
import { AssigneeResolver } from './assigneeResolver';
import { DbService } from '../db/db.service';
import { BusinessError } from '../../common/error';
import { BaseService } from '../base.service';

/**
 * 流程引擎服务 - 提供流程管理核心功能
 * 包括流程定义、实例管理、节点处理等
 */
@Provide()
export class WorkflowEngineService extends BaseService {
    @Inject()
    redisService: RedisService;

    @Inject()
    expressionParser: ExpressionParser;

    @Inject()
    assigneeResolver: AssigneeResolver;

    @Inject()
    db: DbService;

    // --- 流程定义管理 ---

    /**
     * 创建流程定义
     * @param name 流程名称
     * @param config 流程配置
     * @returns 创建的流程定义
     */
    async createDefinition(
        name: string,
        description: string,
        config: any
    ): Promise<WorkflowDefinition> {
        // 验证配置
        this.validateDefinition(config);

        //创建新定义
        return this.db.client.WorkflowDefinition.create({
            data: {
                name,
                description,
                config
            },
        });
    }

    /**
     * 激活流程定义版本
     * @param tenantId 租户ID
     * @param definitionId 定义ID
     * @param version 版本号
     */
    async activateDefinitionVersion(
        id: string,
        version: number
    ) {
        // 停用当前激活版本
        await this.db.client.WorkflowDefinition.updateMany({
            where: {
                id,
                isActive: true
            },
            data: { isActive: false }
        });

        // 激活指定版本
        await this.db.client.WorkflowDefinition.update({
            where: {
                id,
                version
            },
            data: { isActive: true }
        });
    }

    // --- 流程实例管理 ---

    /**
     * 发起流程实例
     * @param id 定义ID
     * @param creatorId 创建人ID
     * @param formData 表单数据
     * @param attachments 附件
     * @returns 创建的流程实例
     */
    async startInstance(
        id: string,
        creatorId: string,
        formData?: any,
        attachments?: string[]
    ): Promise<WorkflowInstance> {
        // 获取激活的流程定义
        const definition = await this.db.client.WorkflowDefinition.findFirst({
            where: {
                id,
                isActive: true
            }
        });

        if (!definition) {
            throw new BusinessError('找不到激活的流程定义');
        }

        return await this.db.client.WorkflowInstance.create({
            data: {
                version: definition.version,
                definitionId: id,
                creatorId,
                formData,
                attachments,
                status: InstanceStatus.PENDING
            }
        });

    }

    /**
     * 获取流程实例
     * @param id 实例ID
     * @returns 流程实例
     */
    async getWorkflowInstance(
        id: string
    ): Promise<WorkflowInstance> {
        return this.db.client.WorkflowInstance.findFirst({
            where: {
                id
            }
            // relations: ['definition']
        });
    }

    // --- 节点管理 ---

    /**
     * 创建初始节点
     * @param instance 流程实例
     */
    async createInitialNode(instance: WorkflowInstance) {
        const definition = await this.db.client.WorkflowDefinition.findFirst({
            where: {
                id: instance.definitionId,
                version: instance.version
            }
        });

        const startNode = definition.config.nodes.find((n: any) => n.type === 'start');

        if (!startNode) throw new BusinessError('流程定义缺少开始节点');

        // 解析处理人
        const assignees = await this.resolveAssignees(startNode, instance);

        await this.db.client.workflowNodeInstance.create({
            data: {
                instanceId: instance.id,
                nodeId: startNode.id,
                status: NodeStatus.PENDING,
                assignees
            }
        })

        // 更新当前步骤
        await this.db.client.WorkflowInstance.update({
            where: { id: instance.id },
            data: {
                currentStep: startNode.id
            }
        })
    }

    /**
     * 更新当前节点状态
     * @param instance 流程实例
     * @param status 节点状态
     * @param operatorId 操作人ID
     * @param comment 审批意见
     */
    async updateCurrentNode(
        instance: WorkflowInstance,
        status: NodeStatus,
        comment?: string
    ) {

        if (!instance.currentStep) throw new BusinessError('当前流程已结束');

        const node = await this.db.client.WorkflowNodeInstance.findFirst({
            where: {
                instanceId: instance.id,
                nodeId: instance.currentStep
            }
        });

        if (!node) throw new BusinessError('当前节点不存在');

        await this.db.client.WorkflowNodeInstance.update({
            where: {
                id: node.id
            },
            data: {
                status,
                comments: comment,
                resolvedAt: new Date()
            }
        });

    }

    /**
     * 移动到下一节点
     * @param instance 流程实例
     * @param operatorId 操作人ID
     */
    async moveToNextNode(instance: WorkflowInstance, operatorId: string) {
        const definition = await this.db.client.WorkflowDefinition.findFirst({
            where: {
                id: instance.definitionId,
                version: instance.version
            }
        });

        // 获取当前节点的所有出边
        const edges = definition.config.edges.filter((e: any) => e.source === instance.currentStep);

        if (!edges.length) throw new BusinessError('找不到下一个节点');

        let nextEdge = null;

        // 如果有条件边，尝试匹配条件
        const conditionalEdges = edges.filter((e: any) => e.condition);
        if (conditionalEdges.length) {
            // 创建上下文数据
            const context = this.createExpressionContext(instance, operatorId);

            // 查找满足条件的边
            for (const edge of conditionalEdges) {
                try {
                    // 验证并执行表达式
                    const result = this.expressionParser.evaluate(edge.condition, context);

                    // 如果条件为真，选择此边
                    if (result) {
                        nextEdge = edge;
                        break;
                    }
                } catch (e) {
                    console.error(`条件表达式执行失败: ${edge.condition}`, e);
                    // 继续尝试其他条件
                }
            }
        }

        // 如果没有匹配的条件边，选择默认边（无条件边）
        if (!nextEdge) {
            nextEdge = edges.find((e: any) => !e.condition) || edges[0];
        }

        const nextNode = definition.config.nodes.find((n: any) => n.id === nextEdge.target);

        if (!nextNode) throw new BusinessError('下一个节点不存在');

        // 解析处理人
        const assignees = await this.resolveAssignees(nextNode, instance);

        await this.db.client.WorkflowNodeInstance.create({
            data: {
                instanceId: instance.id,
                nodeId: nextNode.id,
                status: NodeStatus.PENDING,
                assignees: assignees.map((e: any) => e.id)
            }
        });

        await this.db.client.WorkflowInstance.update({
            where: { id: instance.id },
            data: {
                currentStep: nextNode.id
            }
        });


        // 记录历史
        await this.logHistory(
            instance,
            ActionType.SUBMIT,
            operatorId,
            `流程推进到: ${nextNode.name}`
        );
    }

    /**
     * 退回到指定节点
     * @param instance 流程实例
     * @param targetNodeId 目标节点ID
     * @param operatorId 操作人ID
     */
    async returnToNode(
        instance: WorkflowInstance,
        targetNodeId: string
    ) {
        const definition = await this.db.client.WorkflowDefinition.findFirst({
            where: {
                id: instance.definitionId,
                version: instance.version
            }
        });

        const targetNode = definition.config.nodes.find(n => n.id === targetNodeId);

        if (!targetNode) throw new BusinessError('目标节点不存在');

        // 解析处理人
        const assignees = await this.resolveAssignees(targetNode, instance);

        await this.db.client.WorkflowNodeInstance.create({
            data: {
                instanceId: instance.id,
                nodeId: targetNode.id,
                status: NodeStatus.PENDING,
                assignees: assignees
            }
        })

        await this.db.client.WorkflowInstance.update({
            where: {
                id: instance.id
            },
            data: {
                currentStep: targetNode.id
            }
        });

    }

    /**
     * 保存WorkflowInstance
     * @param instance 
     */
    async saveInstance(instance: WorkflowInstance) {
        await this.db.client.WorkflowInstance.update({
            where: { id: instance.id },
            data: instance,
        });
    }

    /**
     * 转签处理
     * @param instance 流程实例
     * @param nodeId 节点ID
     * @param newAssigneeId 新处理人ID
     * @param operatorId 操作人ID
     */
    async transferAssignee(
        instance: WorkflowInstance,
        nodeId: string,
        newAssigneeId: string
    ) {
        const node = await this.db.client.WorkflowNodeInstance.findFirst({
            where: {
                instanceId: instance.id,
                nodeId
            }
        });

        if (!node) throw new BusinessError('节点不存在');

        if (node.status !== NodeStatus.PENDING) {
            throw new BusinessError('只能转签待处理节点');
        }

        await this.db.client.WorkflowNodeInstance.update({
            where: {
                id: node.id
            },
            data: {
                assignees: [newAssigneeId]
            }
        });
    }

    // --- 辅助方法 ---

    /**
     * 判断是否是最后节点
     * @param instance 流程实例
     * @returns 是否最后节点
     */
    async isLastNode(instance: WorkflowInstance): Promise<boolean> {
        const definition = await this.db.client.WorkflowDefinition.findFirst({
            where: {
                id: instance.definitionId,
                version: instance.version
            }
        });

        const edges = definition.config.edges || [];

        const nextNodes = edges.filter((e: any) => e.source === instance.currentStep);

        return !nextNodes.length ||
            nextNodes.every((e: any) => definition.config.nodes.find((n: any) => n.id === e.target)?.type === 'end');
    }

    /**
     * 记录操作历史
     * @param instance 流程实例
     * @param action 操作类型
     * @param operatorId 操作人ID
     * @param comment 备注
     * @param data 附加数据
     */
    async logHistory(
        instance: WorkflowInstance,
        action: ActionType,
        operatorId: string,
        comment?: string,
        data?: any
    ) {
        await this.db.client.WorkflowHistory.create({
            data: {
                instanceId: instance.id,
                action: action,
                operatorId: operatorId,
                comment: comment,
                data: data
            }
        });
    }

    /**
     * 创建表达式上下文
     * @param instance 流程实例
     * @param operatorId 当前操作人
     * @returns 表达式上下文
     */
    private createExpressionContext(
        instance: WorkflowInstance,
        operatorId: string
    ): any {

        const formData = typeof instance.formData === 'string'
            ? JSON.parse(instance.formData)
            : instance.formData || {};

        return {
            // 表单数据
            ...formData,
            // 系统变量
            $creator: instance.creatorId,
            $currentUser: operatorId,
            $currentStep: instance.currentStep,
            $currentTime: new Date().toISOString(),

            // 常用函数
            $contains: (str: string, substr: string) => str.includes(substr),
            $startsWith: (str: string, prefix: string) => str.startsWith(prefix),
            $endsWith: (str: string, suffix: string) => str.endsWith(suffix),
            $length: (arr: any[]) => arr?.length || 0,
            $toNumber: (val: any) => Number(val) || 0
        };
    }

    /**
     * 解析节点处理人
     * @param nodeConfig 节点配置
     * @param instance 流程实例
     * @returns 处理人ID数组
     */
    private async resolveAssignees(
        nodeConfig: any,
        instance: WorkflowInstance
    ): Promise<string[]> {
        // 使用处理人解析器
        return await this.assigneeResolver.resolve(
            nodeConfig.assigneeResolver,
            instance,
            nodeConfig
        );
    }

    /**
     * 验证流程定义
     * @param config 流程配置
     */
    private validateDefinition(config: any) {
        // 检查必需字段
        if (!config.nodes || !Array.isArray(config.nodes)) {
            throw new BusinessError('流程定义缺少nodes数组');
        }

        // 检查开始和结束节点
        const startNodes = config.nodes.filter((n: any) => n.type === 'start');
        const endNodes = config.nodes.filter((n: any) => n.type === 'end');

        if (!startNodes.length) {
            throw new BusinessError('流程定义缺少开始节点');
        }

        if (!endNodes.length) {
            throw new BusinessError('流程定义缺少结束节点');
        }

        // 验证表达式安全性
        const edges = config.edges || [];
        edges.forEach((e: any) => {
            if (e.condition && !this.expressionParser.validate(e.condition)) {
                throw new BusinessError(`不安全的表达式: ${e.condition}`);
            }
        });
    }

    /**
     * 触发事件
     * @param eventName 事件名称
     * @param data 事件数据
     */
    emitEvent(eventName: string, data: any) {
        // 实际项目中应使用事件发射器
        console.log(`[事件触发] ${eventName}`, data);
    }
}