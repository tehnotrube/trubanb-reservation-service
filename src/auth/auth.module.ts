import { Module } from '@nestjs/common';
import { KongJwtGuard } from './guards/kong-jwt.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  providers: [KongJwtGuard, RolesGuard],
  exports: [KongJwtGuard, RolesGuard],
})
export class AuthModule {}
