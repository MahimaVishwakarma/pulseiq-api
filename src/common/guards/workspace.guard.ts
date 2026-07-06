import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.params.workspaceId || request.headers['x-workspace-id'];

    if (!workspaceId) throw new ForbiddenException('Workspace ID required');

    // Demo bypass: demo user always has access to demo workspace
    if (process.env.NODE_ENV !== 'production' && user?.isDemo) {
      request.workspaceId = workspaceId;
      request.workspaceRole = 'OWNER';
      return true;
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });

    if (!member) throw new NotFoundException('Workspace not found or access denied');

    request.workspaceId = workspaceId;
    request.workspaceRole = member.role;
    return true;
  }
}
