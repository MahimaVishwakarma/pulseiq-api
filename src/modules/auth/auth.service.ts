import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/clerk-sdk-node';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async verifyClerkToken(sessionToken: string) {
    const secretKey = this.config.get<string>('clerk.secretKey');
    if (!secretKey) throw new UnauthorizedException('Clerk not configured');

    try {
      const clerkClient = createClerkClient({ secretKey });
      const payload = await clerkClient.verifyToken(sessionToken);
      const userId = payload.sub;
      const clerkUser = await clerkClient.users.getUser(userId);

      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;

      if (!primaryEmail) throw new UnauthorizedException('No email on Clerk account');

      let user = await this.prisma.user.findUnique({ where: { clerkId: clerkUser.id } });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            clerkId: clerkUser.id,
            email: primaryEmail,
            firstName: clerkUser.firstName ?? undefined,
            lastName: clerkUser.lastName ?? undefined,
            avatarUrl: clerkUser.imageUrl ?? undefined,
          },
        });
      }

      const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
      return { user, accessToken };
    } catch (err) {
      throw new UnauthorizedException(`Invalid Clerk session: ${String(err)}`);
    }
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });
  }
}
