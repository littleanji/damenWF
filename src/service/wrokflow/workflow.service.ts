// src/service/workflowCore.ts
import { Provide, Inject, Scope, ScopeEnum } from '@midwayjs/core';
import { WorkflowInstance, ActionType, NodeStatus, InstanceStatus } from '../../generated/prisma'
import { WorkflowEngineService } from './workflowCore';
import { asyncLocalStorage } from '../../db/context';
import { BusinessError } from '../../common/error';
import { lockUtil } from '../../utils/lockUtil';
import { BaseService } from '../base.service';

/**
 * 流程引擎核心 - 状态机引擎
 * 负责流程状态转移和节点操作
 */
@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true }) // 每个请求独立实例
export class WorkflowCoreEngine extends BaseService {
    @Inject()
    workflowEngineService: WorkflowEngineService;

    @Inject()
    lock: lockUtil

    /**
     * 处理流程操作
     * @param instanceId 实例ID
     * @param action 操作类型
     * @param payload 操作数据
     */
    async processAction(
        instanceId: string,
        action: ActionType,
        payload: any
    ): Promise<WorkflowInstance> {

        const tenantId = asyncLocalStorage.getStore()?.tenantId;
        const lockKey = `wf_lock:${tenantId || 'host'}:${instanceId}`;
        const lock = await this.lock.lock(lockKey);

        try {

            const instance = await this.workflowEngineService.getWorkflowInstance(instanceId);

            if (!instance) throw new BusinessError('工作流实例不存在');

            switch (action) {
                case ActionType.SUBMIT:
                    return await this.handleSubmit(instance, payload);
                case ActionType.APPROVE:
                    return await this.handleApprove(instance, payload);
                case ActionType.REJECT:
                    return await this.handleReject(instance, payload);
                case ActionType.RETURN:
                    return await this.handleReturn(instance, payload);
                case ActionType.TRANSFER:
                    return await this.handleTransfer(instance, payload);
                default:
                    throw new BusinessError(`无效操作: ${action}`);
            }
        } finally {
            await this.lock.unLock(lock);
        }
    }

    // --- 操作处理函数 ---

    /**
     * 处理提交操作
     * @param instance 流程实例
     * @param payload 操作数据
     */
    private async handleSubmit(instance: WorkflowInstance, payload: any) {

        await this.workflowEngineService.createInitialNode(instance);


        await this.workflowEngineService.logHistory(
            instance,
            ActionType.SUBMIT,
            payload.operatorId,
            "流程提交"
        );

        this.workflowEngineService.emitEvent('workflow.submitted', { instance });

        return instance;
    }

    /**
     * 处理通过操作
     * @param instance 流程实例
     * @param payload 操作数据
     */
    private async handleApprove(instance: WorkflowInstance, payload: any) {


        await this.workflowEngineService.updateCurrentNode(
            instance,
            NodeStatus.APPROVED,
            payload.comment
        );


        await this.workflowEngineService.logHistory(
            instance,
            ActionType.APPROVE,
            payload.operatorId,
            payload.comment || "审批通过"
        );


        if (await this.workflowEngineService.isLastNode(instance)) {

            instance.status = InstanceStatus.APPROVED;
            instance.currentStep = null;
            await this.workflowEngineService.saveInstance(instance);

            this.workflowEngineService.emitEvent('workflow.completed', {
                instance,
                status: InstanceStatus.APPROVED
            });
        } else {

            await this.workflowEngineService.moveToNextNode(instance, payload.operatorId);

            this.workflowEngineService.emitEvent('node.advanced', { instance });
        }

        return instance;
    }

    /**
     * 处理拒绝操作
     * @param instance 流程实例
     * @param payload 操作数据
     */
    private async handleReject(instance: WorkflowInstance, payload: any) {
        // 更新当前节点状态
        await this.workflowEngineService.updateCurrentNode(
            instance,
            NodeStatus.REJECTED,
            payload.comment
        );

        // 记录操作历史
        await this.workflowEngineService.logHistory(
            instance,
            ActionType.REJECT,
            payload.operatorId,
            payload.comment || "审批拒绝"
        );

        // 流程结束
        instance.status = InstanceStatus.REJECTED;
        instance.currentStep = null;
        await this.workflowEngineService.saveInstance(instance);

        // 触发完成事件
        this.workflowEngineService.emitEvent('workflow.completed', {
            instance,
            status: InstanceStatus.REJECTED
        });

        return instance;
    }

    /**
     * 处理退回操作
     * @param instance 流程实例
     * @param payload 操作数据
     */
    private async handleReturn(instance: WorkflowInstance, payload: any) {
        // 更新当前节点状态
        await this.workflowEngineService.updateCurrentNode(
            instance,
            NodeStatus.RETURNED,
            payload.comment
        );

        // 记录操作历史
        await this.workflowEngineService.logHistory(
            instance,
            ActionType.RETURN,
            payload.operatorId,
            payload.comment || `退回到节点: ${payload.targetNode}`
        );

        // 退回到指定节点
        await this.workflowEngineService.returnToNode(
            instance,
            payload.targetNode
        );

        // 触发退回事件
        this.workflowEngineService.emitEvent('node.returned', {
            instance,
            targetNode: payload.targetNode
        });

        return instance;
    }

    /**
     * 处理转签操作
     * @param instance 流程实例
     * @param payload 操作数据
     */
    private async handleTransfer(instance: WorkflowInstance, payload: any) {
        // 更新处理人
        await this.workflowEngineService.transferAssignee(
            instance,
            payload.nodeId,
            payload.newAssigneeId
        );

        // 记录操作历史
        await this.workflowEngineService.logHistory(
            instance,
            ActionType.TRANSFER,
            payload.operatorId,
            `转签给: ${payload.newAssigneeId}`
        );

        // 触发转签事件
        this.workflowEngineService.emitEvent('node.transferred', {
            instance,
            nodeId: payload.nodeId,
            newAssigneeId: payload.newAssigneeId
        });

        return instance;
    }
}