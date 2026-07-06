import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/workspace.decorator';
import type { User } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('clerk')
  @ApiOperation({ summary: 'Exchange Clerk session token for API JWT' })
  async clerkLogin(@Body('sessionToken') sessionToken: string) {
    return this.authService.verifyClerkToken(sessionToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }
}
