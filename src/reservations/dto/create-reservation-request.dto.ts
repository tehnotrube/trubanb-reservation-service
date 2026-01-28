import { IsUUID, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReservationRequestDto {
  @ApiProperty({ description: 'UUID of the accommodation' })
  @IsUUID()
  accommodationId: string;

  @ApiProperty({ description: 'Start date (ISO 8601)', example: '2025-02-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO 8601)', example: '2025-02-05' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Number of guests', minimum: 1, example: 2 })
  @IsInt()
  @Min(1)
  numberOfGuests: number;
}
