// apps/api/src/deliveries/courier-auth.controller.ts
import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CourierAuthService } from './courier-auth.service';

@Controller('courier-auth')
export class CourierAuthController {
  constructor(private readonly authService: CourierAuthService) {}

  @Post('login')
  login(@Body() body: { phone?: string; pin?: string; pinCode?: string }) {
    return this.authService.loginWithPin(body);
  }

  @Post('logout')
  logout(@Headers('x-courier-token') token: string) {
    return this.authService.logout(token);
  }
}
