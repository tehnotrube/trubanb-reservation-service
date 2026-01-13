import { Controller, Get } from '@nestjs/common';

@Controller('api/reservations/health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'reservation-service',
      timestamp: new Date().toISOString(),
    };
  }
}
