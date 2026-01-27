export class ReservationCreatedEvent {
  reservationId: string;
  accommodationId: string;
  startDate: string;
  endDate: string;
  reason: 'RESERVATION' | 'MANUAL';
}
