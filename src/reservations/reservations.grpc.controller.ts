import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ReservationsService } from './reservations.service';

interface RatingValidationRequest {
  reservationId: string;
  guestId: string;
}

interface HasActiveReservationsRequest {
  userId: string;
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
    const { userId, isHostCheck } = data;
    Logger.log(`gRPC call: hasActiveOrFutureReservations for user ${userId} (host=${isHostCheck})`);
    const hasBlocking = await this.reservationsService.hasBlockingReservations(
      userId,
      isHostCheck,
    );

    return {
      hasBlockingReservations: hasBlocking,
      message: hasBlocking
        ? `${hasBlocking} future/active reservation(s) found`
        : undefined,
    };
  }
}