import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { ReservationCreatedEvent } from '../reservations/events/reservation-created.event';

@Injectable()
export class ReservationEventsPublisher {
  private readonly logger = new Logger(ReservationEventsPublisher.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async reservationCreated(event: ReservationCreatedEvent) {
    this.logger.log(`Publishing reservation.created: ${event.reservationId}`);

    await this.amqpConnection.publish(
      'reservation.events',
      'reservation.created',
      event,
    );
  }

  async reservationRemoved(reservationId: string) {
    await this.amqpConnection.publish(
      'reservation.events',
      'reservation.removed',
      { reservationId },
    );
  }
}
