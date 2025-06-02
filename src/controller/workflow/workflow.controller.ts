// src/controller/workflowController.ts
import { Controller, Post, Body, Inject } from '@midwayjs/core';
import { WorkflowCoreEngine } from '../../service/wrokflow/workflow.service';
import { WorkflowEngineService } from '../../service/wrokflow/workflowCore';
import { ActionType } from '../../generated/prisma';

@Controller('/api/workflow')
export class WorkflowController {
    @Inject()
    workflowCoreEngine: WorkflowCoreEngine;

    @Inject()
    workflowEngineService: WorkflowEngineService;

    // 创建流程定义
    @Post('/definition')
    async createDefinition(@Body() body: any) {
        const { name, description, config } = body;

        const definition = await this.workflowEngineService.createDefinition(
            name,
            description,
            config
        );

        // 激活此版本
        await this.workflowEngineService.activateDefinitionVersion(
            definition.id,
            config.version
        );

        return `${name}流程创建成功`;
    }

    // 发起流程实例
    @Post('/instance/start')
    async startInstance(@Body() body: any) {
        const { id, creatorId, formData, attachments } = body;

        const instance = await this.workflowEngineService.startInstance(
            id,
            creatorId,
            formData,
            attachments
        );

        // 使用核心引擎提交流程
        await this.workflowCoreEngine.processAction(
            instance.id,
            ActionType.SUBMIT,
            { operatorId: creatorId }
        );

        return "流程发起成功";
    }

    // 处理流程操作
    @Post('/process')
    async processAction(@Body() body: any) {
        const { instanceId, action, operatorId, ...payload } = body;

        await this.workflowCoreEngine.processAction(
            instanceId,
            action,
            { operatorId, ...payload }
        );

        return true;
    }

    // 查询流程实例
    @Post('/instance/get')
    async getInstance(@Body() body: any) {
        const { instanceId } = body;
        const instance = await this.workflowEngineService.getWorkflowInstance(
            instanceId
        );

        return instance;
    }


}