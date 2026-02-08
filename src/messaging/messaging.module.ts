import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Module } from '@nestjs/common';
import { ReservationEventsPublisher } from './reservation-events.publisher';

@Module({
  imports: [
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'reservation.events',
          type: 'topic',
        },
        {
          name: 'trubanb.notifications',
          type: 'topic',
        },
      ],
      uri: process.env.RABBITMQ_URL!,
      connectionInitOptions: { wait: false },
    }),
  ],
  providers: [ReservationEventsPublisher],
  exports: [ReservationEventsPublisher],
})
export class MessagingModule {}
