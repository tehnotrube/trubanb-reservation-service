import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ReservationsService } from './reservations.service';

interface RatingValidationRequest {
  reservationId: string;
  guestId: string;
}

@Controller()
export class ReservationGrpcController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @GrpcMethod('ReservationService', 'GetReservationForRating')
  async getReservationForRating(data: RatingValidationRequest) {
    const { reservationId, guestId } = data;

    const resv = await this.reservationsService.validateForRating(
      reservationId,
      guestId,
    );

    if (!resv) {
      return { canRate: false, hostId: '', accommodationId: '', isPast: false };
    }

    return {
      canRate: resv.isPast,
      hostId: resv.hostId,
      accommodationId: resv.accommodationId,
      isPast: resv.isPast,
    };
  }
}
