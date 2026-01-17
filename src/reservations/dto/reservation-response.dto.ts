import { Expose } from 'class-transformer';

export class ReservationResponseDto {
  @Expose()
  id: string;

  @Expose()
  accommodationId: string;

  @Expose()
  guestId: string;

  @Expose()
  startDate: Date;

  @Expose()
  endDate: Date;

  @Expose()
  numberOfGuests: number;

  @Expose()
  requestId: string;

  @Expose()
  createdAt: Date;
}
