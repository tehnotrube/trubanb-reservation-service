import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  In,
} from 'typeorm';
import { ReservationRequest, Reservation } from './entities';
import { ReservationRequestStatus } from './enums';
import { CreateReservationRequestDto } from './dto';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationRequest)
    private readonly requestRepository: Repository<ReservationRequest>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  /**
   * Create a new reservation request (Guest only)
   */
  async createRequest(
    dto: CreateReservationRequestDto,
    guestId: string,
  ): Promise<ReservationRequest> {
    // Validate date range
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

    // Check if there's already an approved reservation for this period
    const existingReservation = await this.reservationRepository.findOne({
      where: {
        accommodationId: dto.accommodationId,
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });

    if (existingReservation) {
      throw new BadRequestException(
        'This accommodation is already reserved for the selected dates',
      );
    }

    const request = this.requestRepository.create({
      accommodationId: dto.accommodationId,
      guestId,
      startDate,
      endDate,
      numberOfGuests: dto.numberOfGuests,
      status: ReservationRequestStatus.PENDING,
    });

    return this.requestRepository.save(request);
  }

  /**
   * Cancel a pending reservation request (Guest only - own requests)
   */
  async cancelRequest(requestId: string, guestId: string): Promise<ReservationRequest> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Reservation request not found');
    }

    if (request.guestId !== guestId) {
      throw new ForbiddenException('You can only cancel your own requests');
    }

    if (request.status !== ReservationRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    request.status = ReservationRequestStatus.CANCELLED;
    return this.requestRepository.save(request);
  }

  /**
   * Approve a reservation request (Host only)
   * Creates a reservation and auto-rejects overlapping pending requests
   */
  async approveRequest(
    requestId: string,
    hostId: string,
  ): Promise<{ request: ReservationRequest; reservation: Reservation }> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Reservation request not found');
    }

    if (request.status !== ReservationRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    // TODO: Verify hostId owns the accommodation (requires call to accommodation service)
    // For now, we trust the host role check at controller level

    // Check for conflicting approved reservations (race condition protection)
    const conflictingReservation = await this.reservationRepository.findOne({
      where: {
        accommodationId: request.accommodationId,
        startDate: LessThanOrEqual(request.endDate),
        endDate: MoreThanOrEqual(request.startDate),
      },
    });

    if (conflictingReservation) {
      throw new BadRequestException(
        'Another reservation was already approved for these dates',
      );
    }

    // Update request status
    request.status = ReservationRequestStatus.APPROVED;
    const savedRequest = await this.requestRepository.save(request);

    // Create the reservation
    const reservation = this.reservationRepository.create({
      accommodationId: request.accommodationId,
      guestId: request.guestId,
      startDate: request.startDate,
      endDate: request.endDate,
      numberOfGuests: request.numberOfGuests,
      requestId: request.id,
    });
    const savedReservation = await this.reservationRepository.save(reservation);

    // Auto-reject overlapping pending requests
    await this.rejectOverlappingRequests(
      request.accommodationId,
      request.startDate,
      request.endDate,
      request.id,
    );

    return { request: savedRequest, reservation: savedReservation };
  }

  /**
   * Reject a reservation request (Host only)
   */
  async rejectRequest(requestId: string, hostId: string): Promise<ReservationRequest> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Reservation request not found');
    }

    if (request.status !== ReservationRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    // TODO: Verify hostId owns the accommodation

    request.status = ReservationRequestStatus.REJECTED;
    return this.requestRepository.save(request);
  }

  /**
   * Auto-reject all pending requests that overlap with the approved reservation
   */
  private async rejectOverlappingRequests(
    accommodationId: string,
    startDate: Date,
    endDate: Date,
    excludeRequestId: string,
  ): Promise<void> {
    const overlappingRequests = await this.requestRepository.find({
      where: {
        accommodationId,
        status: ReservationRequestStatus.PENDING,
        id: Not(excludeRequestId),
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });

    if (overlappingRequests.length > 0) {
      const ids = overlappingRequests.map((r) => r.id);
      await this.requestRepository.update(
        { id: In(ids) },
        { status: ReservationRequestStatus.REJECTED },
      );
    }
  }

  /**
   * Get all pending requests for a specific accommodation (Host)
   */
  async getPendingRequestsForAccommodation(
    accommodationId: string,
  ): Promise<ReservationRequest[]> {
    return this.requestRepository.find({
      where: {
        accommodationId,
        status: ReservationRequestStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get all requests by guest
   */
  async getRequestsByGuest(guestId: string): Promise<ReservationRequest[]> {
    return this.requestRepository.find({
      where: { guestId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all reservations by guest
   */
  async getReservationsByGuest(guestId: string): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { guestId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single request by ID
   */
  async getRequestById(requestId: string): Promise<ReservationRequest> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('Reservation request not found');
    }

    return request;
  }

  /**
   * Get a single reservation by ID
   */
  async getReservationById(reservationId: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException('Reservation not found');
    }

    return reservation;
  }
}
