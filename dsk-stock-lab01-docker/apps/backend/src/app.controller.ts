import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';

@Controller()
export class AppController {
  @Version(VERSION_NEUTRAL)
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
