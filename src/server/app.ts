import fs from 'node:fs';
import path from 'node:path';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { hashText } from '../shared/encoding.js';
import { templateSchema, type SignedAction } from '../shared/types.js';
import { getTemplate, templates } from '../shared/templates.js';
import { agreementDocx, agreementMarkdown } from './documents.js';
import { SessionStore } from './database.js';
import {
  applyPartyAction,
  authenticateParty,
  createSession,
  getMediatorIdentity,
  joinSession,
  partyView,
} from './protocol.js';
import type { ServerConfig } from './config.js';

const createBodySchema = z.object({
  title: z.string().min(1).max(160),
  templateId: z.string().optional(),
  template: templateSchema.optional(),
  displayName: z.string().min(1).max(120),
  publicKey: z.string().min(40).max(200),
  expiresInHours: z.number().int().min(1).max(168).default(72),
});

const joinBodySchema = z.object({
  inviteCode: z.string().min(8).max(100),
  displayName: z.string().min(1).max(120),
  publicKey: z.string().min(40).max(200),
});

function bearerToken(request: FastifyRequest): string {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) throw new Error('Party credential required.');
  return authorization.slice('Bearer '.length);
}

function publicSession(state: ReturnType<SessionStore['getSession']>) {
  if (!state) throw new Error('Session not found.');
  return {
    id: state.id,
    title: state.title,
    template: state.template,
    candidates: state.candidates,
    stage: state.stage,
    result: state.result,
    createdAt: state.createdAt,
    expiresAt: state.expiresAt,
    parties: {
      a: state.parties.a?.displayName ?? null,
      b: state.parties.b?.displayName ?? null,
    },
    selectedCandidateId:
      state.stage === 'collecting_approval_commits' ||
      state.stage === 'collecting_approval_reveals' ||
      state.stage === 'complete'
        ? state.selectedCandidateId
        : null,
    receipt: state.receipt,
  };
}

export async function buildApp(config: ServerConfig): Promise<{
  app: FastifyInstance;
  store: SessionStore;
}> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: 4 * 1024 * 1024,
    trustProxy: config.trustProxy,
  });
  const store = new SessionStore(config.databasePath);
  const mediator = getMediatorIdentity(store);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'development' ? config.baseUrl.replace('3000', '5173') : false,
  });
  await app.register(rateLimit, {
    max: 240,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      const authorization = request.headers.authorization;
      return authorization ? hashText(`cgp-rate-limit-v1:${authorization}`) : request.ip;
    },
  });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const suppliedStatus =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : null;
    const statusCode =
      suppliedStatus && suppliedStatus >= 400 && suppliedStatus < 600
        ? suppliedStatus
        : message.includes('not found') || message.includes('not registered')
          ? 404
          : message.includes('Invalid') ||
              message.includes('required') ||
              message.includes('not valid') ||
              message.includes('already')
            ? 400
            : 500;
    void reply.status(statusCode).send({
      error: statusCode === 500 ? 'Internal protocol error.' : message,
    });
  });

  app.get('/api/health', () => ({
    status: 'ok',
    protocol: 'common-ground-protocol',
    version: '1.0',
  }));

  app.get('/api/templates', () => templates);

  app.post(
    '/api/sessions',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.ip,
        },
      },
    },
    (request, reply) => {
      const body = createBodySchema.parse(request.body);
      const template =
        body.template ?? (body.templateId ? getTemplate(body.templateId) : undefined);
      if (!template) throw new Error('Invalid negotiation template.');
      const created = createSession({ ...body, template });
      store.createSession(created.state);
      return reply.status(201).send({
        session: publicSession(created.state),
        credential: created.credential,
        inviteCode: created.inviteCode,
      });
    },
  );

  app.post(
    '/api/sessions/:id/join',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: (request) => request.ip,
        },
      },
    },
    (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = joinBodySchema.parse(request.body);
      const credential = store.mutateSession(params.id, (state) => joinSession(state, body));
      const state = store.getSession(params.id);
      return { session: publicSession(state), credential };
    },
  );

  app.get('/api/sessions/:id', (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const state = store.getSession(params.id);
    if (!state) throw new Error('Session not found.');
    authenticateParty(state, bearerToken(request));
    return publicSession(state);
  });

  app.get('/api/sessions/:id/party', (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const state = store.getSession(params.id);
    if (!state) throw new Error('Session not found.');
    const party = authenticateParty(state, bearerToken(request));
    return partyView(state, party.role);
  });

  app.post('/api/sessions/:id/actions/:action', (request, reply) => {
    const params = z
      .object({ id: z.string().uuid(), action: z.string().min(1).max(80) })
      .parse(request.params);
    const signed = request.body as SignedAction;
    store.mutateSession(params.id, (state) => {
      const party = authenticateParty(state, bearerToken(request));
      applyPartyAction(state, party.role, params.action, signed, mediator);
    });
    return reply.status(204).send();
  });

  app.get('/api/sessions/:id/receipt', (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const state = store.getSession(params.id);
    if (!state) throw new Error('Session not found.');
    authenticateParty(state, bearerToken(request));
    if (!state.receipt) throw new Error('Receipt is not available.');
    return state.receipt;
  });

  app.get('/api/sessions/:id/export/agreement.md', (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const state = store.getSession(params.id);
    if (!state) throw new Error('Session not found.');
    authenticateParty(state, bearerToken(request));
    return reply
      .header('Content-Type', 'text/markdown; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${state.id}-agreement.md"`)
      .send(agreementMarkdown(state));
  });

  app.get('/api/sessions/:id/export/agreement.docx', async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const state = store.getSession(params.id);
    if (!state) throw new Error('Session not found.');
    authenticateParty(state, bearerToken(request));
    return reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      .header('Content-Disposition', `attachment; filename="${state.id}-agreement.docx"`)
      .send(await agreementDocx(state));
  });

  const clientDirectory = path.resolve('dist/client');
  if (fs.existsSync(clientDirectory)) {
    await app.register(fastifyStatic, {
      root: clientDirectory,
      wildcard: false,
    });
    app.get('/*', (_request, reply) => reply.sendFile('index.html'));
  }

  app.addHook('onClose', () => {
    store.close();
  });

  return { app, store };
}
