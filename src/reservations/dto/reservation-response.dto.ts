import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReservationResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Accommodation ID' })
  @Expose()
  accommodationId: string;

  @ApiProperty({ description: 'Guest ID' })
  @Expose()
  guestId: string;
  @ApiProperty({ description: 'Host ID' })
  @Expose()
  hostId: string;
  @ApiProperty({ description: 'Start date of reservation' })
  @Expose()
  startDate: Date;

  @ApiProperty({ description: 'End date of reservation' })
  @Expose()
  endDate: Date;

  @ApiProperty({ description: 'Number of guests' })
  @Expose()
  numberOfGuests: number;

  @ApiProperty({ description: 'Total price for the reservation' })
  @Expose()
  price: number;

  @ApiProperty({ description: 'Original request ID' })
  @Expose()
  requestId: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Type of reservation' })
  @Expose()
  type: string;
}
