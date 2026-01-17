import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ReservationRequestStatus } from '../enums';

export class ReservationRequestResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Accommodation ID' })
  @Expose()
  accommodationId: string;

  @ApiProperty({ description: 'Guest ID who made the request' })
  @Expose()
  guestId: string;

  @ApiProperty({ description: 'Start date of reservation' })
  @Expose()
  startDate: Date;

  @ApiProperty({ description: 'End date of reservation' })
  @Expose()
  endDate: Date;

  @ApiProperty({ description: 'Number of guests' })
  @Expose()
  numberOfGuests: number;

  @ApiProperty({ description: 'Request status', enum: ReservationRequestStatus })
  @Expose()
  status: ReservationRequestStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @Expose()
  updatedAt: Date;
}
