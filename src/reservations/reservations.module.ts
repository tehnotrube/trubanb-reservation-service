import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationRequest, Reservation } from './entities';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { AccommodationClientModule } from '../accommodation-client';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReservationRequest, Reservation]),
    AccommodationClientModule,
    MessagingModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
