import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';

type FastifyInstanceLike = {
  get(
    path: string,
    handler: (request: FastifyRequest, reply: FastifyReply) => unknown,
  ): unknown;
  inject(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
  }): Promise<{ statusCode: number; body: string }>;
  ready(): Promise<void>;
};

interface NestFastifyFixture {
  app: NestFastifyApplication;
  fastify: FastifyInstanceLike;
  inject: FastifyInstanceLike['inject'];
  close(): Promise<void>;
}

class FixtureModule {}

Module({})(FixtureModule);

export async function createNestFastifyFixture(
  registerRoutes: (
    app: NestFastifyApplication,
    fastify: FastifyInstanceLike,
  ) => void | Promise<void>,
): Promise<NestFastifyFixture> {
  const app = await NestFactory.create<NestFastifyApplication>(
    FixtureModule,
    new FastifyAdapter(),
    { logger: false, abortOnError: false },
  );
  const fastify = app
    .getHttpAdapter()
    .getInstance() as unknown as FastifyInstanceLike;

  await registerRoutes(app, fastify);
  await app.init();
  await fastify.ready();

  return {
    app,
    fastify,
    inject: fastify.inject.bind(fastify),
    async close() {
      await app.close();
    },
  };
}
