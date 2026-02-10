import { randomUUID } from 'crypto';

export interface ReservationRequestCreatedNotificationEvent {
  eventId: string;
  eventType: 'reservation.request.created';
  timestamp: string;
  payload: {
    requestId: string;
    accommodationId: string;
    accommodationName: string;
    hostId: string;
    guestId: string;
    guestName: string;
    startDate: string;
    endDate: string;
    numberOfGuests: number;
    price: number;
  };
}

export interface ReservationRequestRespondedNotificationEvent {
  eventId: string;
  eventType: 'reservation.request.responded';
  timestamp: string;
  payload: {
    requestId: string;
    accommodationId: string;
    accommodationName: string;
    hostId: string;
    guestId: string;
    status: 'APPROVED' | 'REJECTED';
    startDate: string;
    endDate: string;
  };
}

export interface ReservationCancelledNotificationEvent {
  eventId: string;
  eventType: 'reservation.cancelled';
  timestamp: string;
  payload: {
    reservationId: string;
    accommodationId: string;
    accommodationName: string;
    hostId: string;
    guestId: string;
    guestName: string;
    startDate: string;
    endDate: string;
  };
}

export function createNotificationEventId(): string {
  return randomUUID();
}

export function createTimestamp(): string {
  return new Date().toISOString();
}
