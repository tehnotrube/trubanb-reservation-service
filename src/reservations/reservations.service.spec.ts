import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeleteResult, Repository } from 'typeorm';
import { ReservationsService } from './reservations.service';
import { ReservationRequest, Reservation } from './entities';
import { ReservationRequestStatus } from './enums';
import {
  AccommodationClientService,
  AccommodationInfo,
} from '../accommodation-client';
import { ReservationEventsPublisher } from '../messaging/reservation-events.publisher';
import { UserRole } from '../auth';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let requestRepo: jest.Mocked<Repository<ReservationRequest>>;
  let reservationRepo: jest.Mocked<Repository<Reservation>>;
  let accommodationClient: jest.Mocked<AccommodationClientService>;
  let eventsPublisher: jest.Mocked<ReservationEventsPublisher>;

  const baseRequest = (overrides = {}) =>
    ({
      id: 'req_1',
      accommodationId: 'acc_1',
      guestId: 'guest_1',
      hostId: 'host_1',
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-01-15'),
      numberOfGuests: 2,
      price: 500,
      status: ReservationRequestStatus.PENDING,
      createdAt: new Date(),
      ...overrides,
    }) as ReservationRequest;

  const baseReservation = (overrides = {}) =>
    ({
      id: 'res_1',
      accommodationId: 'acc_1',
      guestId: 'guest_1',
      hostId: 'host_1',
      startDate: new Date('2026-01-10'),
      endDate: new Date('2026-01-15'),
      numberOfGuests: 2,
      price: 500,
      createdAt: new Date(),
      ...overrides,
    }) as Reservation;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: getRepositoryToken(ReservationRequest),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Reservation),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: AccommodationClientService,
          useValue: {
            getAccommodationInfo: jest.fn(),
          },
        },
        {
          provide: ReservationEventsPublisher,
          useValue: {
            reservationCreated: jest.fn(),
            reservationRemoved: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ReservationsService);
    requestRepo = module.get(getRepositoryToken(ReservationRequest));
    reservationRepo = module.get(getRepositoryToken(Reservation));
    accommodationClient = module.get(AccommodationClientService);
    eventsPublisher = module.get(ReservationEventsPublisher);

    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    beforeEach(() => {
      // Set "today" to Jan 1, 2026 for all createRequest tests
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01'));
    });

    it('creates pending request when autoApprove=false', async () => {
      accommodationClient.getAccommodationInfo.mockResolvedValue({
        exists: true,
        basePrice: 100,
        autoApprove: false,
        hostId: 'host_1',
        minGuests: 1,
        maxGuests: 5,
        isPerUnit: true,
      } as AccommodationInfo);

      reservationRepo.findOne.mockResolvedValue(null);
      requestRepo.create.mockReturnValue(baseRequest());
      requestRepo.save.mockResolvedValue(baseRequest());

      const result = await service.createRequest(
        {
          accommodationId: 'acc_1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          numberOfGuests: 2,
        },
        'guest_1',
      );

      expect(result.request.status).toBe(ReservationRequestStatus.PENDING);
      expect(result.reservation).toBeUndefined();
    });

    it('auto-approves and creates reservation when autoApprove=true', async () => {
      requestRepo.find.mockResolvedValue([]);

      accommodationClient.getAccommodationInfo.mockResolvedValue({
        exists: true,
        basePrice: 100,
        autoApprove: true,
        hostId: 'host_1',
        minGuests: 1,
        maxGuests: 5,
        isPerUnit: true,
      } as AccommodationInfo);

      reservationRepo.findOne.mockResolvedValue(null);
      requestRepo.create.mockReturnValue(
        baseRequest({ status: ReservationRequestStatus.APPROVED }),
      );
      requestRepo.save.mockResolvedValue(
        baseRequest({ status: ReservationRequestStatus.APPROVED }),
      );
      reservationRepo.create.mockReturnValue(baseReservation());
      reservationRepo.save.mockResolvedValue(baseReservation());

      const result = await service.createRequest(
        {
          accommodationId: 'acc_1',
          startDate: '2026-01-10',
          endDate: '2026-01-15',
          numberOfGuests: 2,
        },
        'guest_1',
      );

      expect(result.reservation).toBeDefined();
      expect(eventsPublisher.reservationCreated).toHaveBeenCalled();
    });

    it('throws when accommodation does not exist', async () => {
      accommodationClient.getAccommodationInfo.mockResolvedValue({
        exists: false,
      } as AccommodationInfo);

      await expect(
        service.createRequest(
          {
            accommodationId: 'acc_x',
            startDate: '2026-01-10',
            endDate: '2026-01-15',
            numberOfGuests: 2,
          },
          'guest_1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelRequest', () => {
    it('cancels pending request', async () => {
      requestRepo.findOne.mockResolvedValue(baseRequest());
      requestRepo.save.mockResolvedValue(
        baseRequest({ status: ReservationRequestStatus.CANCELLED }),
      );

      const result = await service.cancelRequest('req_1', 'guest_1');

      expect(result.status).toBe(ReservationRequestStatus.CANCELLED);
    });

    it('forbids cancelling others request', async () => {
      requestRepo.findOne.mockResolvedValue(baseRequest({ guestId: 'other' }));

      await expect(service.cancelRequest('req_1', 'guest_1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('approveRequest', () => {
    it('approves request and creates reservation', async () => {
      requestRepo.findOne.mockResolvedValue(baseRequest());
      requestRepo.find.mockResolvedValue([]);
      reservationRepo.findOne.mockResolvedValue(null);
      requestRepo.save.mockResolvedValue(
        baseRequest({ status: ReservationRequestStatus.APPROVED }),
      );
      reservationRepo.create.mockReturnValue(baseReservation());
      reservationRepo.save.mockResolvedValue(baseReservation());

      const result = await service.approveRequest(
        'req_1',
        'host_1',
        UserRole.HOST,
      );

      expect(result.reservation).toBeDefined();
      expect(eventsPublisher.reservationCreated).toHaveBeenCalled();
    });

    it('forbids non-owner host', async () => {
      requestRepo.findOne.mockResolvedValue(baseRequest());

      await expect(
        service.approveRequest('req_1', 'host_x', UserRole.HOST),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectRequest', () => {
    it('rejects pending request', async () => {
      requestRepo.findOne.mockResolvedValue(baseRequest());
      requestRepo.save.mockResolvedValue(
        baseRequest({ status: ReservationRequestStatus.REJECTED }),
      );

      const result = await service.rejectRequest(
        'req_1',
        'host_1',
        UserRole.HOST,
      );

      expect(result.status).toBe(ReservationRequestStatus.REJECTED);
    });
  });

  describe('getRequestById', () => {
    it('returns request for guest', async () => {
      requestRepo.findOne.mockResolvedValue(baseRequest());

      const result = await service.getRequestById(
        'req_1',
        'guest_1',
        UserRole.GUEST,
      );

      expect(result.id).toBe('req_1');
    });

    it('forbids unrelated user', async () => {
      requestRepo.findOne.mockResolvedValue(baseRequest());

      await expect(
        service.getRequestById('req_1', 'other', UserRole.GUEST),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createManualBlock', () => {
    it('creates manual block', async () => {
      reservationRepo.findOne.mockResolvedValue(null);
      reservationRepo.create.mockReturnValue(
        baseReservation({ type: 'MANUAL' }),
      );
      reservationRepo.save.mockResolvedValue(
        baseReservation({ type: 'MANUAL' }),
      );

      const result = await service.createManualBlock(
        'acc_1',
        new Date('2026-02-01'),
        new Date('2026-02-05'),
        'host_1',
      );

      expect(result.type).toBe('MANUAL');
      expect(eventsPublisher.reservationCreated).toHaveBeenCalled();
    });
  });

  describe('removeManualBlock', () => {
    it('removes manual block', async () => {
      reservationRepo.findOne.mockResolvedValue(
        baseReservation({ type: 'MANUAL' }),
      );
      reservationRepo.delete.mockResolvedValue({} as DeleteResult);

      await service.removeManualBlock('res_1', 'host_1');

      expect(eventsPublisher.reservationRemoved).toHaveBeenCalledWith('res_1');
    });

    it('forbids removing others block', async () => {
      reservationRepo.findOne.mockResolvedValue(
        baseReservation({ type: 'MANUAL', hostId: 'other' }),
      );

      await expect(
        service.removeManualBlock('res_1', 'host_1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getGuestCancellationCount', () => {
    it('should return count of cancelled requests for a guest', async () => {
      requestRepo.count.mockResolvedValue(3);

      const result = await service.getGuestCancellationCount('guest_1');

      expect(requestRepo.count).toHaveBeenCalledWith({
        where: {
          guestId: 'guest_1',
          status: ReservationRequestStatus.CANCELLED,
        },
      });
      expect(result).toBe(3);
    });
  });
  describe('cancelReservation', () => {
    it('successfully cancels if it is more than 24h before start', async () => {
      // Current time is 2026-01-01
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01'));

      // Reservation starts 2026-01-10
      const res = baseReservation({ startDate: new Date('2026-01-10') });
      reservationRepo.findOne.mockResolvedValue(res);

      await service.cancelReservation('res_1', 'guest_1');

      expect(reservationRepo.delete).toHaveBeenCalledWith('res_1');
      expect(eventsPublisher.reservationRemoved).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('throws BadRequestException if it is less than 24h before start', async () => {
      // Current time: Jan 9th, 2:00 PM
      jest.useFakeTimers().setSystemTime(new Date('2026-01-09T14:00:00'));

      // Reservation starts: Jan 10th, 12:00 PM
      const res = baseReservation({
        startDate: new Date('2026-01-10T12:00:00'),
      });
      reservationRepo.findOne.mockResolvedValue(res);

      await expect(
        service.cancelReservation('res_1', 'guest_1'),
      ).rejects.toThrow(BadRequestException);

      expect(reservationRepo.delete).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('throws ForbiddenException if unrelated guest tries to cancel', async () => {
      reservationRepo.findOne.mockResolvedValue(
        baseReservation({ guestId: 'other_guest' }),
      );

      await expect(
        service.cancelReservation('res_1', 'guest_1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
