import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Not, In } from 'typeorm';
import { ReservationRequest, Reservation } from './entities';
import { ReservationRequestStatus } from './enums';
import { CreateReservationRequestDto } from './dto';
import { AccommodationClientService } from '../accommodation-client';
import { ReservationCreatedEvent } from './events/reservation-created.event';
import { ReservationEventsPublisher } from '../messaging/reservation-events.publisher';
import { UserRole } from '../auth';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationRequest)
    private readonly requestRepository: Repository<ReservationRequest>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly accommodationClient: AccommodationClientService,
    private readonly eventsPublisher: ReservationEventsPublisher,
  ) {}

  async createRequest(dto: CreateReservationRequestDto, guestId: string) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (startDate < today) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    const accommodation = await this.accommodationClient.getAccommodationInfo(
      dto.accommodationId,
    );

    if (!accommodation.exists) {
      throw new NotFoundException('Accommodation not found');
    }

    if (dto.numberOfGuests < accommodation.minGuests) {
      throw new BadRequestException(
        `Minimum number of guests is ${accommodation.minGuests}`,
      );
    }

    if (dto.numberOfGuests < accommodation.minGuests) {
      throw new BadRequestException(
        `Minimum number of guests is ${accommodation.minGuests}`,
      );
    }

    const calc = await this.accommodationClient.validateAndCalculatePrice(
      dto.accommodationId,
      dto.startDate,
      dto.endDate,
      dto.numberOfGuests,
    );

    if (!calc.success) {
      throw new BadRequestException(
        calc.message || 'Cannot create reservation',
      );
    }

    const price = calc.totalPrice;

    const existing = await this.reservationRepository.findOne({
      where: {
        accommodationId: dto.accommodationId,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });

    if (existing) {
      throw new BadRequestException('Accommodation is already booked');
    }

    const request = this.requestRepository.create({
      accommodationId: dto.accommodationId,
      guestId,
      hostId: accommodation.hostId,
      startDate,
      endDate,
      numberOfGuests: dto.numberOfGuests,
      price,
      status: accommodation.autoApprove
        ? ReservationRequestStatus.APPROVED
        : ReservationRequestStatus.PENDING,
    });

    const savedRequest = await this.requestRepository.save(request);
    console.log(
      `[createRequest] created request=${savedRequest.id}, hostId=${savedRequest.hostId}, status=${savedRequest.status}`,
    );

    if (!accommodation.autoApprove) {
      // Notify host about new reservation request
      await this.eventsPublisher.notifyReservationRequestCreated({
        requestId: savedRequest.id,
        accommodationId: dto.accommodationId,
        accommodationName: accommodation.name || 'Accommodation',
        hostId: accommodation.hostId,
        guestId,
        guestName: 'Guest', // TODO: Fetch from user service
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        numberOfGuests: dto.numberOfGuests,
        price,
      });
      return { request: savedRequest };
    }

    const reservation = this.reservationRepository.create({
      accommodationId: dto.accommodationId,
      guestId,
      hostId: accommodation.hostId,
      startDate,
      endDate,
      numberOfGuests: dto.numberOfGuests,
      price,
      requestId: savedRequest.id,
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    await this.emitReservationCreated(savedReservation);

    await this.rejectOverlappingRequests(
      dto.accommodationId,
      startDate,
      endDate,
      savedRequest.id,
    );

    return { request: savedRequest, reservation: savedReservation };
  }

  async cancelRequest(requestId: string, guestId: string) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.guestId !== guestId)
      throw new ForbiddenException('Not authorized to cancel this request');
    if (request.status !== ReservationRequestStatus.PENDING)
      throw new BadRequestException('Request is not pending');

    request.status = ReservationRequestStatus.CANCELLED;
    return this.requestRepository.save(request);
  }

  async approveRequest(requestId: string, actorId: string, role: UserRole) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException();
    if (request.status !== ReservationRequestStatus.PENDING)
      throw new BadRequestException('Request is not pending');

    if (role !== UserRole.ADMIN && request.hostId !== actorId) {
      throw new ForbiddenException('Not authorized to approve this request');
    }

    const conflict = await this.reservationRepository.findOne({
      where: {
        accommodationId: request.accommodationId,
        startDate: LessThanOrEqual(request.endDate),
        endDate: MoreThanOrEqual(request.startDate),
      },
    });

    if (conflict)
      throw new BadRequestException('Accommodation is already booked');

    request.status = ReservationRequestStatus.APPROVED;
    await this.requestRepository.save(request);

    const reservation = this.reservationRepository.create({
      accommodationId: request.accommodationId,
      guestId: request.guestId,
      hostId: request.hostId,
      startDate: request.startDate,
      endDate: request.endDate,
      numberOfGuests: request.numberOfGuests,
      price: request.price,
      requestId: request.id,
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    await this.rejectOverlappingRequests(
      request.accommodationId,
      request.startDate,
      request.endDate,
      request.id,
    );

    await this.emitReservationCreated(savedReservation);

    // Notify guest that their request was approved
    const accommodation = await this.accommodationClient.getAccommodationInfo(
      request.accommodationId,
    );
    await this.eventsPublisher.notifyReservationRequestResponded({
      requestId: request.id,
      accommodationId: request.accommodationId,
      accommodationName: accommodation.name || 'Accommodation',
      hostId: request.hostId,
      guestId: request.guestId,
      status: 'APPROVED',
      startDate: this.toISOString(request.startDate),
      endDate: this.toISOString(request.endDate),
    });

    return { request, reservation: savedReservation };
  }

  async rejectRequest(requestId: string, actorId: string, role: UserRole) {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundException();
    if (request.status !== ReservationRequestStatus.PENDING)
      throw new BadRequestException('Request is not pending');

    if (role !== UserRole.ADMIN && request.hostId !== actorId) {
      throw new ForbiddenException('Not authorized to reject this request');
    }

    request.status = ReservationRequestStatus.REJECTED;
    const savedRequest = await this.requestRepository.save(request);

    // Notify guest that their request was rejected
    const accommodation = await this.accommodationClient.getAccommodationInfo(
      request.accommodationId,
    );
    await this.eventsPublisher.notifyReservationRequestResponded({
      requestId: request.id,
      accommodationId: request.accommodationId,
      accommodationName: accommodation.name || 'Accommodation',
      hostId: request.hostId,
      guestId: request.guestId,
      status: 'REJECTED',
      startDate: this.toISOString(request.startDate),
      endDate: this.toISOString(request.endDate),
    });

    return savedRequest;
  }

  async getPendingRequestsForAccommodation(
    accommodationId: string,
    actorId: string,
    role: UserRole,
  ) {
    if (role !== UserRole.ADMIN) {
      const probe = await this.requestRepository.findOne({
        where: { accommodationId },
        select: ['hostId'],
      });

      if (!probe || probe.hostId !== actorId) {
        throw new ForbiddenException(
          'Not authorized to access this accommodation',
        );
      }
    }

    return this.requestRepository.find({
      where: {
        accommodationId,
        status: ReservationRequestStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async getAllPendingRequestsForHost(hostId: string, role: UserRole) {
    if (role !== UserRole.ADMIN && role !== UserRole.HOST) {
      throw new ForbiddenException('Not authorized to access pending requests');
    }

    return this.requestRepository.find({
      where: {
        hostId: role === UserRole.ADMIN ? undefined : hostId,
        status: ReservationRequestStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }

  async getRequestsByGuest(guestId: string) {
    return this.requestRepository.find({
      where: { guestId },
      order: { createdAt: 'DESC' },
    });
  }

  async getReservationsByGuest(guestId: string) {
    return this.reservationRepository.find({
      where: { guestId },
      order: { createdAt: 'DESC' },
    });
  }

  async getRequestById(id: string, actorId: string, role: UserRole) {
    const request = await this.requestRepository.findOne({
      where: { id },
    });

    if (!request) throw new NotFoundException('Request not found');

    if (
      role !== UserRole.ADMIN &&
      request.guestId !== actorId &&
      request.hostId !== actorId
    ) {
      throw new ForbiddenException('Not authorized to access this request');
    }

    return request;
  }

  async getReservationById(id: string, actorId: string, role: UserRole) {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
    });

    if (!reservation) throw new NotFoundException('Reservation not found');

    if (
      role !== UserRole.ADMIN &&
      reservation.guestId !== actorId &&
      reservation.hostId !== actorId
    ) {
      throw new ForbiddenException('Not authorized to access this reservation');
    }

    return reservation;
  }

  async createManualBlock(
    accommodationId: string,
    startDate: Date,
    endDate: Date,
    hostId: string,
  ) {
    const existing = await this.reservationRepository.findOne({
      where: {
        accommodationId,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });

    if (existing)
      throw new BadRequestException('Accommodation is already booked');

    const block = this.reservationRepository.create({
      accommodationId,
      guestId: hostId,
      hostId,
      startDate,
      endDate,
      numberOfGuests: 0,
      price: 0,
      type: 'MANUAL',
    });

    const saved = await this.reservationRepository.save(block);
    await this.emitReservationCreated(saved);
    return saved;
  }

  async cancelReservation(reservationId: string, guestId: string) {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) throw new NotFoundException('Reservation not found');
    if (reservation.guestId !== guestId) {
      throw new ForbiddenException('You do not own this reservation');
    }

    const now = new Date();
    const deadline = new Date(reservation.startDate);
    deadline.setDate(deadline.getDate() - 1);

    if (now >= deadline) {
      throw new BadRequestException(
        'Reservations can only be cancelled up to 24 hours before the start date',
      );
    }

    // Get accommodation info for notification
    const accommodation = await this.accommodationClient.getAccommodationInfo(
      reservation.accommodationId,
    );

    await this.reservationRepository.delete(reservationId);

    await this.eventsPublisher.reservationRemoved(reservationId);

    // Notify host about the cancellation
    await this.eventsPublisher.notifyReservationCancelled({
      reservationId: reservation.id,
      accommodationId: reservation.accommodationId,
      accommodationName: accommodation.name || 'Accommodation',
      hostId: reservation.hostId,
      guestId: reservation.guestId,
      guestName: 'Guest', // TODO: Fetch from user service
      startDate: this.toISOString(reservation.startDate),
      endDate: this.toISOString(reservation.endDate),
    });
  }

  async getGuestCancellationCount(guestId: string): Promise<number> {
    return this.requestRepository.count({
      where: {
        guestId,
        status: ReservationRequestStatus.CANCELLED,
      },
    });
  }

  async removeManualBlock(reservationId: string, hostId: string) {
    const block = await this.reservationRepository.findOne({
      where: { id: reservationId, type: 'MANUAL' },
    });

    if (!block) throw new NotFoundException('Block not found');
    if (block.hostId !== hostId)
      throw new ForbiddenException('Not authorized to remove this block');

    await this.reservationRepository.delete(reservationId);
    await this.eventsPublisher.reservationRemoved(reservationId);
  }

  private async rejectOverlappingRequests(
    accommodationId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId: string,
  ) {
    const requests = await this.requestRepository.find({
      where: {
        accommodationId,
        status: ReservationRequestStatus.PENDING,
        id: Not(excludeRequestId),
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });

    if (requests.length) {
      await this.requestRepository.update(
        { id: In(requests.map((r) => r.id)) },
        { status: ReservationRequestStatus.REJECTED },
      );
    }
  }

  private async emitReservationCreated(reservation: Reservation) {
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);

    const event: ReservationCreatedEvent = {
      reservationId: reservation.id,
      accommodationId: reservation.accommodationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      reason: reservation.type,
    };

    await this.eventsPublisher.reservationCreated(event);
  }

  async validateForRating(reservationId: string, guestId: string) {
    const resv = await this.reservationRepository.findOne({
      where: { id: reservationId, guestId },
    });

    if (!resv) {
      return {
        canRate: false,
        hostId: '',
        accommodationId: '',
        isPast: false,
        guestName: '',
        accommodationName: '',
      };
    }

    const today = new Date();
    const endDate = new Date(resv.endDate);
    const isPast = endDate < today;

    // Fetch accommodation name
    const accommodation = await this.accommodationClient.getAccommodationInfo(
      resv.accommodationId,
    );

    return {
      canRate: isPast,
      hostId: resv.hostId,
      accommodationId: resv.accommodationId,
      isPast,
      guestName: 'Guest', // TODO: Fetch from user service
      accommodationName: accommodation.name || 'Accommodation',
    };
  }

  private toISOString(date: Date | string): string {
    if (typeof date === 'string') {
      return new Date(date).toISOString();
    }
    return date.toISOString();
  }

  async hasActiveOrFutureReservations(
    userIdentifier: string,
    isHostCheck: boolean,
  ) {
    // Get today's date in YYYY-MM-DD format (local timezone)
    const todayDate = new Date();
    const todayString = todayDate.toISOString().split('T')[0];
    const todayForQuery = new Date(todayString);

    console.log(
      `[hasActiveOrFutureReservations] hostCheck=${isHostCheck}, identifier=${userIdentifier}, today=${todayString}`,
    );

    const reservationCount = await this.reservationRepository.count({
      where: {
        ...(isHostCheck
          ? { hostId: userIdentifier }
          : { guestId: userIdentifier }),
        endDate: MoreThanOrEqual(todayForQuery),
        type: 'RESERVATION',
      },
    });

    console.log(
      `[hasActiveOrFutureReservations] reservationCount=${reservationCount}`,
    );

    if (reservationCount > 0) {
      return {
        hasBlockingReservations: true,
        message: isHostCheck
          ? 'Cannot delete account: you have active or future reservations on your accommodations.'
          : 'Cannot delete account: you have active or future reservations.',
      };
    }

    const pendingRequestCount = await this.requestRepository.count({
      where: {
        ...(isHostCheck
          ? { hostId: userIdentifier }
          : { guestId: userIdentifier }),
        status: In([
          ReservationRequestStatus.PENDING,
          ReservationRequestStatus.APPROVED,
        ]),
        endDate: MoreThanOrEqual(todayForQuery),
      },
    });

    console.log(
      `[hasActiveOrFutureReservations] pendingRequestCount=${pendingRequestCount}`,
    );

    // DEBUG: Log all requests matching hostId to see what's in DB
    if (isHostCheck) {
      const allRequestsForHost = await this.requestRepository.find({
        where: { hostId: userIdentifier },
      });
      console.log(
        `[DEBUG] All requests for hostId=${userIdentifier}:`,
        JSON.stringify(
          allRequestsForHost.map((r) => ({
            id: r.id,
            status: r.status,
            endDate: r.endDate,
            checkEndDateGTE: r.endDate >= todayForQuery,
          })),
          null,
          2,
        ),
      );

      // Check each condition separately
      const allPending = await this.requestRepository.find({
        where: {
          hostId: userIdentifier,
          status: ReservationRequestStatus.PENDING,
        },
      });
      console.log(`[DEBUG] PENDING requests: ${allPending.length}`);

      const allApproved = await this.requestRepository.find({
        where: {
          hostId: userIdentifier,
          status: ReservationRequestStatus.APPROVED,
        },
      });
      console.log(`[DEBUG] APPROVED requests: ${allApproved.length}`);

      const futureRequests = await this.requestRepository.find({
        where: {
          hostId: userIdentifier,
          endDate: MoreThanOrEqual(todayForQuery),
        },
      });
      console.log(
        `[DEBUG] Requests with endDate >= ${todayString}: ${futureRequests.length}`,
      );
    }

    if (pendingRequestCount > 0) {
      return {
        hasBlockingReservations: true,
        message: isHostCheck
          ? 'Cannot delete account: you have pending reservation requests on your accommodations.'
          : 'Cannot delete account: you have pending reservation requests.',
      };
    }

    return { hasBlockingReservations: false };
  }
}
