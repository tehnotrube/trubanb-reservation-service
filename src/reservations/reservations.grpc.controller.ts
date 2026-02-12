import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ReservationsService } from './reservations.service';

interface RatingValidationRequest {
  reservationId: string;
  guestId: string;
}

interface HasActiveReservationsRequest {
  userIdentifier: string;
  isHostCheck: boolean;
}

interface HasActiveReservationsResponse {
  hasBlockingReservations: boolean;
  message?: string;
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

    return {
      canRate: resv.canRate,
      hostId: resv.hostId,
      accommodationId: resv.accommodationId,
      isPast: resv.isPast,
      guestName: resv.guestName,
      accommodationName: resv.accommodationName,
    };
  }

  @GrpcMethod('ReservationService', 'HasActiveOrFutureReservations')
  async hasActiveOrFutureReservations(
    data: HasActiveReservationsRequest,
  ): Promise<HasActiveReservationsResponse> {
    const { userIdentifier, isHostCheck } = data;
    Logger.log(
      `gRPC call: hasActiveOrFutureReservations for user ${userIdentifier} (host=${isHostCheck})`,
    );
    return await this.reservationsService.hasActiveOrFutureReservations(
      userIdentifier,
      isHostCheck,
    );
  }
}
