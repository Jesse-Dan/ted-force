import { Injectable } from 'fragment-ts';
import type { Request } from 'express';

@Injectable()
export class AgentRuntimeKeyGuard {
  canActivate(req: Request): boolean {
    const apiKey = req.headers['x-agent-key'];
    return typeof apiKey === 'string' && apiKey.trim().length > 0;
  }
}
