import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { ReservationCreatedEvent } from '../reservations/events/reservation-created.event';
import {
  ReservationRequestCreatedNotificationEvent,
  ReservationRequestRespondedNotificationEvent,
  ReservationCancelledNotificationEvent,
  createNotificationEventId,
  createTimestamp,
} from './events/notification-events';

@Injectable()
export class ReservationEventsPublisher {
  private readonly logger = new Logger(ReservationEventsPublisher.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  // ========== Events for accommodation-service (blocked periods) ==========

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

  // ========== Events for notification-service ==========

  async notifyReservationRequestCreated(
    payload: ReservationRequestCreatedNotificationEvent['payload'],
  ) {
    const event: ReservationRequestCreatedNotificationEvent = {
      eventId: createNotificationEventId(),
      eventType: 'reservation.request.created',
      timestamp: createTimestamp(),
      payload,
    };

    this.logger.log(
      `Publishing notification: reservation.request.created for request ${payload.requestId}`,
    );

    await this.amqpConnection.publish(
      'trubanb.notifications',
      'reservation.request.created',
      event,
    );
  }

  async notifyReservationRequestResponded(
    payload: ReservationRequestRespondedNotificationEvent['payload'],
  ) {
    const event: ReservationRequestRespondedNotificationEvent = {
      eventId: createNotificationEventId(),
      eventType: 'reservation.request.responded',
      timestamp: createTimestamp(),
      payload,
    };

    this.logger.log(
      `Publishing notification: reservation.request.responded for request ${payload.requestId} (${payload.status})`,
    );

    await this.amqpConnection.publish(
      'trubanb.notifications',
      'reservation.request.responded',
      event,
    );
  }

  async notifyReservationCancelled(
    payload: ReservationCancelledNotificationEvent['payload'],
  ) {
    const event: ReservationCancelledNotificationEvent = {
      eventId: createNotificationEventId(),
      eventType: 'reservation.cancelled',
      timestamp: createTimestamp(),
      payload,
    };

    this.logger.log(
      `Publishing notification: reservation.cancelled for reservation ${payload.reservationId}`,
    );

    await this.amqpConnection.publish(
      'trubanb.notifications',
      'reservation.cancelled',
      event,
    );
  }
}
