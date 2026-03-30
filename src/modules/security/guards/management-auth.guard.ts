import { Injectable } from 'fragment-ts';
import type { Request } from 'express';

@Injectable()
export class ManagementAuthGuard {
  canActivate(req: Request): boolean {
    const authHeader = req.headers.authorization;
    return Boolean(authHeader && authHeader.startsWith('Bearer '));
  }
}
