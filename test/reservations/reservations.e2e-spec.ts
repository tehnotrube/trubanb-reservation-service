import request from 'supertest';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { app, mockAccommodationGrpcService } from '../utils/setup-tests';
import {
  TEST_GUEST_TOKEN_HEADERS,
  TEST_HOST_TOKEN_HEADERS,
} from '../utils/auth/headers.utils';
import { ReservationRequestStatus } from '../../src/reservations/enums';
import {
  ReservationRequest,
  Reservation,
} from '../../src/reservations/entities';

import { ReservationResponseDto } from '../../src/reservations/dto/reservation-response.dto';
import { ReservationRequestResponseDto } from '../../src/reservations/dto/reservation-request-response.dto';
import { App } from 'supertest/types';

interface RequestWithReservation {
  request: ReservationRequestResponseDto;
  reservation?: ReservationResponseDto;
}

describe('Reservations Integration', () => {
  let dataSource: DataSource;
  const ACC_ID = '550e8400-e29b-41d4-a716-446655440000';

  beforeAll(() => {
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "reservations", "reservation_requests" CASCADE',
    );
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /reservations/requests', () => {
    it('should create pending request with correct price calculation', async () => {
      mockAccommodationGrpcService.getAccommodationInfo.mockReturnValue(
        of({
          exists: true,
          accommodationId: ACC_ID,
          basePrice: 150,
          autoApprove: false,
          minGuests: 1,
          maxGuests: 5,
          isPerUnit: false,
        }),
      );

      const res = await request(app.getHttpServer() as App)
        .post('/reservations/requests')
        .set(TEST_GUEST_TOKEN_HEADERS)
        .send({
          accommodationId: ACC_ID,
          startDate: '2026-05-01',
          endDate: '2026-05-04',
          numberOfGuests: 2,
        })
        .expect(201);

      const body = res.body as RequestWithReservation;
      expect(body.request.status).toBe(ReservationRequestStatus.PENDING);

      const saved = await dataSource
        .getRepository(ReservationRequest)
        .findOneBy({ id: body.request.id });
      expect(Number(saved?.price)).toBe(900);
    });

    it('should return 400 if numberOfGuests exceeds maxGuests', async () => {
      mockAccommodationGrpcService.getAccommodationInfo.mockReturnValue(
        of({
          exists: true,
          accommodationId: ACC_ID,
          minGuests: 1,
          maxGuests: 2,
        }),
      );

      await request(app.getHttpServer() as App)
        .post('/reservations/requests')
        .set(TEST_GUEST_TOKEN_HEADERS)
        .send({
          accommodationId: ACC_ID,
          startDate: '2026-05-01',
          endDate: '2026-05-04',
          numberOfGuests: 5,
        })
        .expect(400);
    });
  });

  describe('PUT /reservations/requests/:id/approve', () => {
    it('should approve request and automatically reject overlapping pending ones', async () => {
      const target = await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        guestId: 'guest-1',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-08-05'),
        numberOfGuests: 2,
        price: 400,
        status: ReservationRequestStatus.PENDING,
      });

      const overlapping = await dataSource
        .getRepository(ReservationRequest)
        .save({
          accommodationId: ACC_ID,
          guestId: 'guest-2',
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-07'),
          numberOfGuests: 1,
          price: 300,
          status: ReservationRequestStatus.PENDING,
        });

      const res = await request(app.getHttpServer() as App)
        .put(`/reservations/requests/${target.id}/approve`)
        .set(TEST_HOST_TOKEN_HEADERS)
        .expect(200);

      const body = res.body as RequestWithReservation;
      expect(body.request.status).toBe(ReservationRequestStatus.APPROVED);
      expect(body.reservation).toBeDefined();

      const updatedOverlapping = await dataSource
        .getRepository(ReservationRequest)
        .findOneBy({ id: overlapping.id });
      expect(updatedOverlapping?.status).toBe(
        ReservationRequestStatus.REJECTED,
      );
    });
  });

  describe('DELETE /reservations/requests/:id', () => {
    it('should allow guest to cancel their own pending request', async () => {
      const req = await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        guestId: 'test-guest-789', // Matches TEST_GUEST_TOKEN_HEADERS
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
        numberOfGuests: 2,
        price: 400,
        status: ReservationRequestStatus.PENDING,
      });

      await request(app.getHttpServer() as App)
        .delete(`/reservations/requests/${req.id}`)
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(200);

      const updated = await dataSource
        .getRepository(ReservationRequest)
        .findOneBy({ id: req.id });
      expect(updated?.status).toBe(ReservationRequestStatus.CANCELLED);
    });

    it('should return 403 when trying to cancel another guests request', async () => {
      const req = await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        guestId: 'different-guest-id',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-05'),
        numberOfGuests: 2,
        price: 400,
        status: ReservationRequestStatus.PENDING,
      });

      await request(app.getHttpServer() as App)
        .delete(`/reservations/requests/${req.id}`)
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(403);
    });
  });

  describe('POST /reservations/blocks', () => {
    it('should allow host to create manual block', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/reservations/blocks')
        .set(TEST_HOST_TOKEN_HEADERS)
        .send({
          accommodationId: ACC_ID,
          startDate: '2026-12-24',
          endDate: '2026-12-26',
        })
        .expect(201);

      const body = res.body as ReservationResponseDto;
      expect(body.type).toBe('MANUAL');

      const block = await dataSource
        .getRepository(Reservation)
        .findOneBy({ id: body.id });
      expect(block).toBeDefined();
    });

    it('should return 400 when host blocks over an existing reservation', async () => {
      await dataSource.getRepository(Reservation).save({
        accommodationId: ACC_ID,
        guestId: 'guest-1',
        startDate: new Date('2026-12-20'),
        endDate: new Date('2026-12-25'),
        numberOfGuests: 1,
        price: 100,
      });

      await request(app.getHttpServer() as App)
        .post('/reservations/blocks')
        .set(TEST_HOST_TOKEN_HEADERS)
        .send({
          accommodationId: ACC_ID,
          startDate: '2026-12-24',
          endDate: '2026-12-26',
        })
        .expect(400);
    });
  });

  describe('GET /reservations', () => {
    it('should return only reservations belonging to the requesting guest', async () => {
      const guestId = 'test-guest-789';
      await dataSource.getRepository(Reservation).save([
        {
          accommodationId: ACC_ID,
          guestId,
          startDate: new Date(),
          endDate: new Date(),
          numberOfGuests: 1,
          price: 100,
        },
        {
          accommodationId: ACC_ID,
          guestId: 'someone-else',
          startDate: new Date(),
          endDate: new Date(),
          numberOfGuests: 1,
          price: 100,
        },
      ]);

      const res = await request(app.getHttpServer() as App)
        .get('/reservations')
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(200);

      const body = res.body as ReservationResponseDto[];
      expect(body.length).toBe(1);
      expect(body[0].guestId).toBe(guestId);
    });
  });
});
