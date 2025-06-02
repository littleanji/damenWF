import { MidwayConfig } from '@midwayjs/core';

export default {
  // use for cookie sign key, should change to your own and keep security
  keys: '1748616378351_1977',
  koa: {
    port: 7001,
  },
  jwt: {
    secret: 'damen_jflafeihgoei_agae24723648_dahg',
    expiresIn: '3d'
  },
  threadPool: {
    size: 0,
    options: {
      idleTimeout: 12000,
      maxIdleThreads: 2
    }
  },
  process: {
    execArgv: [
      '--expose-gc',
      '--max-old-space-size=4096'
    ]
  },
  redis: {
    client: {
      port: 6379,
      host: "127.0.0.1",
      db: 0,
    },
  },
} as MidwayConfig;
