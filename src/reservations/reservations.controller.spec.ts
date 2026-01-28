import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { ReservationRequestStatus } from './enums';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { Reservation, ReservationRequest } from './entities';
import { UserRole } from '../auth';
import { BadRequestException } from '@nestjs/common';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  let mockReservationService: jest.Mocked<ReservationsService>;

  const guestUser = (): AuthenticatedUser => ({
    id: 'usr_guest_1',
    email: 'guest@test.com',
    role: UserRole.GUEST,
  });

  const hostUser = (): AuthenticatedUser => ({
    id: 'usr_host_1',
    email: 'host@test.com',
    role: UserRole.HOST,
  });

  const mockRequest = (overrides = {}) =>
    ({
      id: 'req_1',
      accommodationId: 'acc_1',
      guestId: guestUser().id,
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-01-15'),
      numberOfGuests: 2,
      price: 500,
      status: ReservationRequestStatus.PENDING,
      createdAt: new Date(),
      ...overrides,
    }) as ReservationRequest;

  const mockReservation = (overrides = {}) =>
    ({
      id: 'res_1',
      accommodationId: 'acc_1',
      guestId: guestUser().id,
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-01-15'),
      numberOfGuests: 2,
      price: 500,
      createdAt: new Date(),
      ...overrides,
    }) as Reservation;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        {
          provide: ReservationsService,
          useValue: {
            createRequest: jest.fn(),
            getRequestsByGuest: jest.fn(),
            getRequestById: jest.fn(),
            cancelRequest: jest.fn(),
            getPendingRequestsForAccommodation: jest.fn(),
            approveRequest: jest.fn(),
            rejectRequest: jest.fn(),
            getReservationsByGuest: jest.fn(),
            getReservationById: jest.fn(),
            createManualBlock: jest.fn(),
            removeManualBlock: jest.fn(),
            cancelReservation: jest.fn(),
            getGuestCancellationCount: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(ReservationsController);
    mockReservationService = module.get(ReservationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createRequest', () => {
    it('should create reservation request', async () => {
      mockReservationService.createRequest.mockResolvedValue({
        request: mockRequest(),
      });

      const dto = {
        accommodationId: 'acc_1',
        startDate: '2026-01-10',
        endDate: '2026-01-15',
        numberOfGuests: 2,
      };

      const result = await controller.createRequest(dto, guestUser());

      expect(mockReservationService.createRequest).toHaveBeenCalledWith(
        dto,
        guestUser().id,
      );
      expect(result.request.id).toBe('req_1');
      expect(result.reservation).toBeUndefined();
    });

    it('should return reservation when auto-approved', async () => {
      mockReservationService.createRequest.mockResolvedValue({
        request: mockRequest({ status: ReservationRequestStatus.APPROVED }),
        reservation: mockReservation(),
      });

      const dto = {
        accommodationId: 'acc_1',
        startDate: '2026-01-10',
        endDate: '2026-01-15',
        numberOfGuests: 2,
      };

      const result = await controller.createRequest(dto, guestUser());

      expect(result.request.status).toBe(ReservationRequestStatus.APPROVED);
      expect(result.reservation).toBeDefined();
      expect(result.reservation!.id).toBe('res_1');
    });
  });

  describe('getMyRequests', () => {
    it('should return guest requests', async () => {
      mockReservationService.getRequestsByGuest.mockResolvedValue([
        mockRequest(),
        mockRequest({ id: 'req_2' }),
      ]);

      const result = await controller.getMyRequests(guestUser());

      expect(mockReservationService.getRequestsByGuest).toHaveBeenCalledWith(
        guestUser().id,
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('getRequestById', () => {
    it('should return single request', async () => {
      mockReservationService.getRequestById.mockResolvedValue(mockRequest());

      const result = await controller.getRequestById('req_1', guestUser());

      expect(mockReservationService.getRequestById).toHaveBeenCalledWith(
        'req_1',
        guestUser().id,
        guestUser().role,
      );
      expect(result.id).toBe('req_1');
    });
  });

  describe('cancelRequest', () => {
    it('should cancel request', async () => {
      mockReservationService.cancelRequest.mockResolvedValue(
        mockRequest({ status: ReservationRequestStatus.CANCELLED }),
      );

      const result = await controller.cancelRequest('req_1', guestUser());

      expect(mockReservationService.cancelRequest).toHaveBeenCalledWith(
        'req_1',
        guestUser().id,
      );
      expect(result.status).toBe(ReservationRequestStatus.CANCELLED);
    });
  });

  describe('getPendingRequests', () => {
    it('should return pending requests with guest cancellation count', async () => {
      const request = mockRequest();
      mockReservationService.getPendingRequestsForAccommodation.mockResolvedValue(
        [request],
      );
      mockReservationService.getGuestCancellationCount.mockResolvedValue(5); // Mocking 5 previous flakes

      const result = await controller.getPendingRequests('acc_1', hostUser());

      expect(
        mockReservationService.getPendingRequestsForAccommodation,
      ).toHaveBeenCalled();
      expect(
        mockReservationService.getGuestCancellationCount,
      ).toHaveBeenCalledWith(request.guestId);
      expect(result[0]).toHaveProperty('guestCancellationCount', 5);
    });

    it('should return empty array when no pending requests exist', async () => {
      mockReservationService.getPendingRequestsForAccommodation.mockResolvedValue(
        [],
      );

      const result = await controller.getPendingRequests('acc_1', hostUser());

      expect(result).toEqual([]);
      expect(
        mockReservationService.getPendingRequestsForAccommodation,
      ).toHaveBeenCalledWith('acc_1', hostUser().id, hostUser().role);
    });
  });

  describe('approveRequest', () => {
    it('should approve request and return reservation', async () => {
      mockReservationService.approveRequest.mockResolvedValue({
        request: mockRequest({ status: ReservationRequestStatus.APPROVED }),
        reservation: mockReservation(),
      });

      const result = await controller.approveRequest('req_1', hostUser());

      expect(mockReservationService.approveRequest).toHaveBeenCalledWith(
        'req_1',
        hostUser().id,
        hostUser().role,
      );
      expect(result.reservation.id).toBe('res_1');
    });
  });

  describe('rejectRequest', () => {
    it('should reject request', async () => {
      mockReservationService.rejectRequest.mockResolvedValue(
        mockRequest({ status: ReservationRequestStatus.REJECTED }),
      );

      const result = await controller.rejectRequest('req_1', hostUser());

      expect(mockReservationService.rejectRequest).toHaveBeenCalledWith(
        'req_1',
        hostUser().id,
        hostUser().role,
      );
      expect(result.status).toBe(ReservationRequestStatus.REJECTED);
    });
  });
  describe('cancelReservation', () => {
    it('should successfully cancel an active reservation', async () => {
      mockReservationService.cancelReservation.mockResolvedValue(undefined);

      const result = await controller.cancelReservation('res_1', guestUser());

      expect(mockReservationService.cancelReservation).toHaveBeenCalledWith(
        'res_1',
        guestUser().id,
      );
      expect(result).toEqual({ success: true });
    });

    it('should propagate errors (like 24h deadline breach) from service', async () => {
      mockReservationService.cancelReservation.mockRejectedValue(
        new BadRequestException('Too late to cancel'),
      );

      await expect(
        controller.cancelReservation('res_1', guestUser()),
      ).rejects.toThrow(BadRequestException);
    });
  });
  describe('getMyReservations', () => {
    it('should return guest reservations', async () => {
      mockReservationService.getReservationsByGuest.mockResolvedValue([
        mockReservation(),
      ]);

      const result = await controller.getMyReservations(guestUser());

      expect(
        mockReservationService.getReservationsByGuest,
      ).toHaveBeenCalledWith(guestUser().id);
      expect(result).toHaveLength(1);
    });
  });

  describe('getReservationById', () => {
    it('should return reservation', async () => {
      mockReservationService.getReservationById.mockResolvedValue(
        mockReservation(),
      );

      const result = await controller.getReservationById('res_1', guestUser());

      expect(mockReservationService.getReservationById).toHaveBeenCalledWith(
        'res_1',
        guestUser().id,
        guestUser().role,
      );
      expect(result.id).toBe('res_1');
    });
  });

  describe('createBlock', () => {
    it('should create manual block', async () => {
      mockReservationService.createManualBlock.mockResolvedValue(
        mockReservation({ type: 'MANUAL' }),
      );

      const dto = {
        accommodationId: 'acc_1',
        startDate: '2026-02-01',
        endDate: '2026-02-05',
      };

      const result = await controller.createBlock(dto, hostUser());

      expect(mockReservationService.createManualBlock).toHaveBeenCalledWith(
        'acc_1',
        new Date(dto.startDate),
        new Date(dto.endDate),
        hostUser().id,
      );
      expect(result.id).toBe('res_1');
    });
  });

  describe('removeBlock', () => {
    it('should remove manual block', async () => {
      mockReservationService.removeManualBlock.mockResolvedValue(undefined);

      const result = await controller.removeBlock('res_1', hostUser());

      expect(mockReservationService.removeManualBlock).toHaveBeenCalledWith(
        'res_1',
        hostUser().id,
      );
      expect(result).toEqual({ success: true });
    });
  });
});
