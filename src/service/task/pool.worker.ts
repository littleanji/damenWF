import { workerData, parentPort } from 'worker_threads';
import { VM } from 'vm2';

const isWorker = workerData?.isWorker ?? false;

if (isWorker) {
    // 创建安全的执行环境
    const sandbox = {
        require: require,
        console: console,
        __filename: __filename,
        __dirname: __dirname,
        process: process,
        Buffer: Buffer,
        setImmediate: setImmediate,
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearImmediate: clearImmediate,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval
    };

    const vm = new VM({
        timeout: 30000,
        sandbox
    });

    // 安全执行函数
    const executeFunction = (funcString: string, args: any[]) => {
        try {
            // 方法1: 使用 VM2 执行
            try {
                const func = vm.run(`(${funcString})`);
                return func(...args);
            } catch (vmError: any) {
                // 方法2: 回退到 Function 构造器
                if (vmError.code === 'MODULE_NOT_FOUND') {
                    const func = new Function(`return ${funcString}`)();
                    return func(...args);
                }
                throw vmError;
            }
        } catch (error: any) {
            throw new Error(`Function execution failed: ${error.message}`);
        }
    };

    // 主工作线程逻辑
    parentPort?.on('message', async (message: any) => {
        if (message.type === 'run_task') {
            const { task } = message;
            const startTime = Date.now();

            try {
                // 执行任务函数
                const result = await executeFunction(task.taskFunc, task.args);
                const duration = Date.now() - startTime;

                parentPort?.postMessage({
                    type: 'task_completed',
                    task: message.task,
                    result,
                    duration
                });
            } catch (error: any) {
                parentPort?.postMessage({
                    type: 'task_error',
                    task: message.task,
                    error: error.message || error.toString()
                });
            }
        }
    });

    // 内存优化
    const minimizeMemory = () => {
        if (typeof global.gc === 'function') {
            global.gc(); // 需要 --expose-gc 标志
        }
    };

    // 定期优化内存
    setInterval(minimizeMemory, 600000); // 每10分钟
    minimizeMemory();
} else {
    console.error('Error: This worker script should only be executed in a worker thread');
}