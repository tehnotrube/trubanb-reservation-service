import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsModule } from './metrics';

@Module({
  imports: [MetricsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
