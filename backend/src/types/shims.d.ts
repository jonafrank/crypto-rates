declare module '@nestjs/common' {
  export const Injectable: any;
  export const Logger: any;
  export const Module: any;
  export const Controller: any;
  export const Get: any;
  export const Query: any;
  export const Sse: any;
  export type MessageEvent = any;
  export interface OnModuleInit {}
  export interface OnModuleDestroy {}
}

declare module '@nestjs/core' {
  export const NestFactory: any;
}

declare module '@nestjs/platform-express' {
  const x: any;
  export = x;
}

declare module '@nestjs/config' {
  export const ConfigModule: any;
}

declare module '@nestjs/schedule' {
  export const ScheduleModule: any;
  export const Cron: any;
  export const CronExpression: any;
}

declare module 'rxjs' {
  export type Observable<T = any> = any;
  export function interval(ms: number): any;
  export function merge(...inputs: any[]): any;
  export function map(fn: any): any;
  export function of(...values: any[]): any;
  export class Subject<T = any> {
    asObservable(): any;
    next(v: any): void;
  }
}

declare module 'ws' {
  export const WebSocket: any;
}

declare const Buffer: any;
declare const process: any;

interface WebSocket {
  on(event: string, cb: (...args: any[]) => void): void;
  send(data: any): void;
  close(): void;
}
