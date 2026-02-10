import { Test, TestingModule } from '@nestjs/testing';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ReservationEventsPublisher } from './reservation-events.publisher';
import * as notificationEvents from './events/notification-events';

describe('ReservationEventsPublisher', () => {
  let publisher: ReservationEventsPublisher;
  let mockAmqpConnection: jest.Mocked<AmqpConnection>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationEventsPublisher,
        {
          provide: AmqpConnection,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    publisher = module.get<ReservationEventsPublisher>(
      ReservationEventsPublisher,
    );
    mockAmqpConnection = module.get(AmqpConnection);

    jest.clearAllMocks();

    jest
      .spyOn(notificationEvents, 'createNotificationEventId')
      .mockReturnValue('test-event-id');
    jest
      .spyOn(notificationEvents, 'createTimestamp')
      .mockReturnValue('2026-01-15T10:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('reservationCreated', () => {
    it('should publish reservation created event to reservation.events exchange', async () => {
      const event = {
        reservationId: 'res_123',
        accommodationId: 'acc_456',
        startDate: '2026-01-10T00:00:00.000Z',
        endDate: '2026-01-15T00:00:00.000Z',
        reason: 'RESERVATION',
      };

      await publisher.reservationCreated(event);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'reservation.events',
        'reservation.created',
        event,
      );
    });

    it('should publish manual block event', async () => {
      const event = {
        reservationId: 'res_789',
        accommodationId: 'acc_456',
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-05T00:00:00.000Z',
        reason: 'MANUAL',
      };

      await publisher.reservationCreated(event);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'reservation.events',
        'reservation.created',
        event,
      );
    });
  });

  describe('reservationRemoved', () => {
    it('should publish reservation removed event to reservation.events exchange', async () => {
      await publisher.reservationRemoved('res_123');

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'reservation.events',
        'reservation.removed',
        { reservationId: 'res_123' },
      );
    });
  });

  describe('notifyReservationRequestCreated', () => {
    it('should publish request created notification to trubanb.notifications exchange', async () => {
      const payload = {
        requestId: 'req_123',
        accommodationId: 'acc_456',
        accommodationName: 'Beach House',
        hostId: 'host_789',
        guestId: 'guest_012',
        guestName: 'John Doe',
        startDate: '2026-01-10T00:00:00.000Z',
        endDate: '2026-01-15T00:00:00.000Z',
        numberOfGuests: 2,
        price: 500,
      };

      await publisher.notifyReservationRequestCreated(payload);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'trubanb.notifications',
        'reservation.request.created',
        {
          eventId: 'test-event-id',
          eventType: 'reservation.request.created',
          timestamp: '2026-01-15T10:00:00.000Z',
          payload,
        },
      );
    });
  });

  describe('notifyReservationRequestResponded', () => {
    it('should publish approved response notification', async () => {
      const payload = {
        requestId: 'req_123',
        accommodationId: 'acc_456',
        accommodationName: 'Beach House',
        hostId: 'host_789',
        guestId: 'guest_012',
        status: 'APPROVED' as const,
        startDate: '2026-01-10T00:00:00.000Z',
        endDate: '2026-01-15T00:00:00.000Z',
      };

      await publisher.notifyReservationRequestResponded(payload);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'trubanb.notifications',
        'reservation.request.responded',
        {
          eventId: 'test-event-id',
          eventType: 'reservation.request.responded',
          timestamp: '2026-01-15T10:00:00.000Z',
          payload,
        },
      );
    });

    it('should publish rejected response notification', async () => {
      const payload = {
        requestId: 'req_456',
        accommodationId: 'acc_789',
        accommodationName: 'Mountain Cabin',
        hostId: 'host_012',
        guestId: 'guest_345',
        status: 'REJECTED' as const,
        startDate: '2026-02-01T00:00:00.000Z',
        endDate: '2026-02-05T00:00:00.000Z',
      };

      await publisher.notifyReservationRequestResponded(payload);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'trubanb.notifications',
        'reservation.request.responded',
        {
          eventId: 'test-event-id',
          eventType: 'reservation.request.responded',
          timestamp: '2026-01-15T10:00:00.000Z',
          payload,
        },
      );
    });
  });

  describe('notifyReservationCancelled', () => {
    it('should publish cancellation notification to trubanb.notifications exchange', async () => {
      const payload = {
        reservationId: 'res_123',
        accommodationId: 'acc_456',
        accommodationName: 'Beach House',
        hostId: 'host_789',
        guestId: 'guest_012',
        guestName: 'John Doe',
        startDate: '2026-01-10T00:00:00.000Z',
        endDate: '2026-01-15T00:00:00.000Z',
      };

      await publisher.notifyReservationCancelled(payload);

      expect(mockAmqpConnection.publish).toHaveBeenCalledWith(
        'trubanb.notifications',
        'reservation.cancelled',
        {
          eventId: 'test-event-id',
          eventType: 'reservation.cancelled',
          timestamp: '2026-01-15T10:00:00.000Z',
          payload,
        },
      );
    });
  });
});
