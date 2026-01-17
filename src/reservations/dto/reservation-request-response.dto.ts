import { Expose } from 'class-transformer';
import { ReservationRequestStatus } from '../enums';

export class ReservationRequestResponseDto {
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
  status: ReservationRequestStatus;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
