import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallerEventsService } from './caller-events.service';

type AuthenticatedRequest = {
  user: {
    restaurantId: string;
  };
};

@Controller('caller-events')
@UseGuards(JwtAuthGuard)
export class CallerEventsController {
  constructor(private readonly callerEventsService: CallerEventsService) {}

  @Post('incoming')
  createIncomingCall(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      branchId?: string | null;
      phone?: string | null;
      source?: string | null;
      payload?: unknown;
    },
  ) {
    return this.callerEventsService.createIncomingCall(request.user.restaurantId, body);
  }

  @Get('latest')
  findLatest(@Req() request: AuthenticatedRequest) {
    return this.callerEventsService.findLatest(request.user.restaurantId);
  }

  @Get()
  findRecent(@Req() request: AuthenticatedRequest) {
    return this.callerEventsService.findRecent(request.user.restaurantId);
  }

  @Patch(':id/seen')
  markSeen(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.callerEventsService.markSeen(request.user.restaurantId, id);
  }
}
