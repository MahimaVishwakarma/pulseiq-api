import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';

// Demo workspace/user IDs (fixed in prisma/seed.ts) — requests scoped to this
// workspace bypass JWT in non-production so the app works without Clerk keys
const DEMO_WORKSPACE_ID = 'demo-workspace';
const DEMO_USER_ID = 'demo-user';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Allow unauthenticated access to demo workspace in non-production
    if (process.env.NODE_ENV !== 'production') {
      const req = context.switchToHttp().getRequest<{ params?: { workspaceId?: string }; user?: unknown }>();
      if (req.params?.workspaceId === DEMO_WORKSPACE_ID) {
        req.user = { id: DEMO_USER_ID, isDemo: true, workspaceId: DEMO_WORKSPACE_ID };
        return true;
      }
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: Error, user: TUser): TUser {
    if (err || !user) throw err || new UnauthorizedException('Invalid or expired token');
    return user;
  }
}
