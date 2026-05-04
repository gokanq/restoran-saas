import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CallerDeviceEventsService } from './caller-device-events.service';

@Controller('caller-events/device')
export class CallerDeviceEventsController {
  constructor(private readonly callerDeviceEventsService: CallerDeviceEventsService) {}

  @Post('incoming')
  createIncomingEvent(
    @Headers('x-caller-device-key') deviceKey: string | undefined,
    @Body()
    body: {
      phone?: string;
      source?: string;
      payload?: unknown;
    },
  ) {
    return this.callerDeviceEventsService.createIncomingEvent(deviceKey, body);
  }
}
