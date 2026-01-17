import { IsUUID, IsDateString, IsInt, Min } from 'class-validator';

export class CreateReservationRequestDto {
  @IsUUID()
  accommodationId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt()
  @Min(1)
  numberOfGuests: number;
}
