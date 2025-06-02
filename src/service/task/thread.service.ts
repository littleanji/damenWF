import { Provide, Scope, ScopeEnum, Init, Destroy, Config, Logger } from '@midwayjs/core';
import { Worker } from 'worker_threads';
import os = require('os');
import { ILogger } from '@midwayjs/logger';
import path = require('path');

@Provide()
@Scope(ScopeEnum.Singleton)
export class TaskService {
    private workers: Array<{
        id: number;
        worker: Worker;
        status: 'idle' | 'busy';
        currentTask: any;
        lastUsed: number;
    }> = [];

    private taskQueue: any[] = [];
    private idleTimers = new Map<number, NodeJS.Timeout>();
    private options: any;
    private size: number;

    @Config('threadPool')
    private threadConfig: any;

    @Logger()
    logger: ILogger;

    @Init()
    async init() {
        // 从配置获取线程池大小，默认使用 CPU 核心数
        this.size = this.threadConfig?.size || os.cpus().length;

        // 设置线程池选项
        this.options = Object.assign({
            idleTimeout: 30000,
            maxIdleThreads: Math.max(2, Math.floor(this.size * 0.5))
        }, this.threadConfig?.options || {});

        this.logger.info(`正在初始化线程池，大小: ${this.size}`);

        // 初始化线程池 - 实际启动位置
        for (let i = 0; i < this.size; i++) {
            this.addWorker();
        }

        this.logger.info(`线程池已初始化，工作线程数: ${this.workers.length}`);
    }

    @Destroy()
    async destroy() {
        this.logger.info('正在销毁线程池...');

        // 清理所有工作线程
        this.idleTimers.forEach(timer => clearTimeout(timer));
        this.idleTimers.clear();

        // 安全终止所有工作线程
        const terminationPromises = this.workers.map(workerInfo => {
            return new Promise<void>((resolve) => {
                workerInfo.worker.once('exit', () => {
                    this.logger.info(`工作线程 #${workerInfo.id} 已终止`);
                    resolve();
                });
                workerInfo.worker.terminate();
            });
        });

        await Promise.all(terminationPromises);

        this.workers = [];
        this.taskQueue = [];

        this.logger.info('线程池已完全销毁');
    }

    private addWorker() {
        // 使用编译后的 JS 文件路径
        const workerPath = path.resolve(__dirname, 'pool.worker.js');

        // 确保路径正确
        this.logger.debug(`创建工作线程，路径: ${workerPath}`);

        const worker = new Worker(workerPath, {
            workerData: {
                isWorker: true, // 明确标记为工作线程
                workerId: this.workers.length + 1
            }
        });

        const workerId = this.workers.length + 1;

        worker.on('message', (message: any) => {
            if (message.type === 'task_completed') {
                this.handleTaskCompleted(worker, message);
            }

            if (message.type === 'task_error') {
                this.handleTaskError(worker, message);
            }
        });

        worker.on('error', (err: Error) => {
            this.logger.error(`工作线程 #${workerId} 错误: ${err.message}`);
            this.replaceWorker(worker);
        });

        worker.on('exit', (code: number) => {
            if (code !== 0) {
                this.logger.warn(`工作线程 #${workerId} 异常退出，代码: ${code}`);
                this.replaceWorker(worker);
            } else {
                this.logger.info(`工作线程 #${workerId} 正常退出`);
            }
        });

        const workerInfo = {
            id: worker.threadId,
            worker,
            status: 'idle' as 'idle' | 'busy',
            currentTask: null as any,
            lastUsed: Date.now()
        };

        this.workers.push(workerInfo);
        this.resetIdleTimer(workerInfo);

        this.logger.info(`工作线程 #${workerId} 已创建`);

        return workerId;
    }

    private handleTaskCompleted(worker: Worker, message: any) {
        const workerInfo = this.workers.find(w => w.worker === worker);
        if (!workerInfo) return;

        // 调用任务的resolve
        if (workerInfo.currentTask && workerInfo.currentTask.resolve) {
            workerInfo.currentTask.resolve(message.result);
        }

        workerInfo.status = 'idle';
        workerInfo.currentTask = null;
        workerInfo.lastUsed = Date.now();

        this.logger.debug(`工作线程 #${workerInfo.id} 完成任务，耗时: ${message.duration}ms`);

        this.resetIdleTimer(workerInfo);
        this.processQueue();
    }

    private handleTaskError(worker: Worker, message: any) {
        const workerInfo = this.workers.find(w => w.worker === worker);
        if (!workerInfo) return;

        // 调用任务的reject
        if (workerInfo.currentTask && workerInfo.currentTask.reject) {
            workerInfo.currentTask.reject(new Error(message.error));
        }

        workerInfo.status = 'idle';
        workerInfo.currentTask = null;
        workerInfo.lastUsed = Date.now();

        this.logger.error(`工作线程 #${workerInfo.id} 任务失败: ${message.error}`);

        this.resetIdleTimer(workerInfo);
        this.processQueue();
    }

    private replaceWorker(oldWorker: Worker) {
        const index = this.workers.findIndex(w => w.worker === oldWorker);
        if (index !== -1) {
            const oldWorkerInfo = this.workers[index];
            this.workers.splice(index, 1);
            this.logger.warn(`替换工作线程 #${oldWorkerInfo.id}`);
            this.addWorker();
        }
    }

    private resetIdleTimer(workerInfo: any) {
        // 清除现有计时器
        if (this.idleTimers.has(workerInfo.id)) {
            clearTimeout(this.idleTimers.get(workerInfo.id));
            this.idleTimers.delete(workerInfo.id);
        }

        // 设置新计时器
        if (this.workers.length > this.options.maxIdleThreads) {
            const timer = setTimeout(() => {
                this.cleanupIdleWorker(workerInfo);
            }, this.options.idleTimeout);

            this.idleTimers.set(workerInfo.id, timer);
        }
    }

    private cleanupIdleWorker(workerInfo: any) {
        if (workerInfo.status !== 'idle') return;
        if (this.workers.length <= this.options.maxIdleThreads) return;

        const index = this.workers.findIndex(w => w.id === workerInfo.id);
        if (index !== -1) {
            this.logger.info(`清理空闲工作线程 #${workerInfo.id}`);
            workerInfo.worker.terminate();
            this.workers.splice(index, 1);
            this.idleTimers.delete(workerInfo.id);
        }
    }


    private processQueue() {
        const idleWorker = this.workers.find(w => w.status === 'idle');

        if (idleWorker && this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            this.assignTask(idleWorker, task);
            this.logger.debug(`分配任务给工作线程 #${idleWorker.id}`);
            console.log(`分配任务给工作线程 #${idleWorker.id}`)
        }
    }

    private assignTask(workerInfo: any, task: any) {
        workerInfo.status = 'busy';
        workerInfo.currentTask = task;

        if (this.idleTimers.has(workerInfo.id)) {
            clearTimeout(this.idleTimers.get(workerInfo.id));
            this.idleTimers.delete(workerInfo.id);
        }

        workerInfo.worker.postMessage({
            type: 'run_task',
            task: {
                taskFunc: task.taskFunc,
                args: task.args,
                taskId: task.taskId
            }
        });
    }

    /**
     * 在线程池中运行任务
     */
    run<T = any>(func: (...args: any[]) => T | Promise<T>, ...args: any[]): Promise<T> {
        return new Promise((resolve, reject) => {
            const task = {
                taskId: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                taskFunc: func.toString(),
                args: JSON.parse(JSON.stringify(args)),
                resolve,
                reject
            };

            this.taskQueue.push(task);
            this.logger.debug(`新任务入队: ${task.taskId}`);
            this.processQueue();
        });
    }

    /**
     * 等待所有任务完成
     */
    all(tasks: Promise<any>[]): Promise<any[]> {
        return Promise.all(tasks);
    }

    /**
     * 等待任意一个任务完成
     */
    one(tasks: Promise<any>[]): Promise<any> {
        return new Promise(resolve => {
            const wrapTask = (task: Promise<any>) =>
                task.then(
                    result => ({ status: 'fulfilled', result }),
                    error => ({ status: 'rejected', error })
                );

            Promise.race(tasks.map(wrapTask)).then(resolve);
        });
    }

    /**
     * 获取线程池状态
     */
    getStatus() {
        return {
            totalWorkers: this.workers.length,
            idleWorkers: this.workers.filter(w => w.status === 'idle').length,
            busyWorkers: this.workers.filter(w => w.status === 'busy').length,
            queuedTasks: this.taskQueue.length,
            idleTimers: this.idleTimers.size
        };
    }
}