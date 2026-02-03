import request from 'supertest';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { app, mockAccommodationGrpcService } from '../utils/setup-tests';
import {
  TEST_GUEST_TOKEN_HEADERS,
  TEST_HOST_TOKEN_HEADERS,
  TEST_OTHER_HOST_TOKEN_HEADERS,
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

  // Host uses email; guest uses id per controller rules
  const HOST_ID = 'host@test.com';
  const GUEST_ID = 'test-guest-789';

  beforeAll(() => {
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    // Clean database before each test to ensure isolation
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
          hostId: HOST_ID,
          basePrice: 150,
          autoApprove: false,
          minGuests: 1,
          maxGuests: 5,
          isPerUnit: false,
        }),
      );

      const res = await request(app.getHttpServer() as App)
          .post('/api/reservations/requests')
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

      // Calculation: 150 (price) * 3 (nights) * 2 (guests) = 900
      expect(Number(saved?.price)).toBe(900);
      expect(saved?.hostId).toBe(HOST_ID);
    });
  });

  describe('PUT /reservations/requests/:id/approve', () => {
    it('should approve request and automatically reject overlapping pending ones', async () => {
      const target = await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID,
        guestId: GUEST_ID,
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
          hostId: HOST_ID,
          guestId: GUEST_ID,
          startDate: new Date('2026-08-03'),
          endDate: new Date('2026-08-07'),
          numberOfGuests: 1,
          price: 300,
          status: ReservationRequestStatus.PENDING,
        });

      const res = await request(app.getHttpServer() as App)
        .put(`/api/reservations/requests/${target.id}/approve`)
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

  describe('DELETE /reservations/:id (Cancel Reservation Policy)', () => {
    it('should allow guest to cancel if more than 24h before stay', async () => {
      // Create a reservation 5 days in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const resv = await dataSource.getRepository(Reservation).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID,
        guestId: GUEST_ID,
        startDate: futureDate,
        endDate: new Date(futureDate.getTime() + 86400000), // +1 day
        numberOfGuests: 2,
        price: 200,
      });

      await request(app.getHttpServer() as App)
        .delete(`/api/reservations/${resv.id}`)
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(200);

      const deleted = await dataSource
        .getRepository(Reservation)
        .findOneBy({ id: resv.id });
      expect(deleted).toBeNull();
    });

    it('should fail (400) if cancelling less than 24h before stay', async () => {
      // Create a reservation starting 5 hours from now
      const soonDate = new Date();
      soonDate.setHours(soonDate.getHours() + 5);

      const resv = await dataSource.getRepository(Reservation).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID,
        guestId: GUEST_ID,
        startDate: soonDate,
        endDate: new Date(soonDate.getTime() + 86400000),
        numberOfGuests: 2,
        price: 200,
      });

      const res = await request(app.getHttpServer() as App)
        .delete(`/api/reservations/${resv.id}`)
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(400);

      const body = res.body as { message: string };

      expect(body.message).toContain('24 hours');
    });
  });

  describe('POST /reservations/blocks', () => {
    it('should allow host to create manual block', async () => {
      const res = await request(app.getHttpServer() as App)
          .post('/api/reservations/blocks')
        .set(TEST_HOST_TOKEN_HEADERS)
        .send({
          accommodationId: ACC_ID,
          startDate: '2026-12-24',
          endDate: '2026-12-26',
        })
        .expect(201);

      const body = res.body as ReservationResponseDto;
      expect(body.type).toBe('MANUAL');
      expect(body.hostId).toBe(HOST_ID);

      const block = await dataSource
        .getRepository(Reservation)
        .findOneBy({ id: body.id });
      expect(block).toBeDefined();
    });
  });

  describe('GET /reservations', () => {
    it('should return only reservations belonging to the requesting guest', async () => {
      await dataSource.getRepository(Reservation).save([
        {
          accommodationId: ACC_ID,
          hostId: HOST_ID,
          guestId: GUEST_ID,
          startDate: new Date(),
          endDate: new Date(),
          numberOfGuests: 1,
          price: 100,
        },
        {
          accommodationId: ACC_ID,
          hostId: HOST_ID,
          guestId: 'someone-else',
          startDate: new Date(),
          endDate: new Date(),
          numberOfGuests: 1,
          price: 100,
        },
      ]);

      const res = await request(app.getHttpServer() as App)
          .get('/api/reservations')
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(200);

      const body = res.body as ReservationResponseDto[];
      expect(body.length).toBe(1);
      expect(body[0].guestId).toBe(GUEST_ID);
    });
  });
  describe('POST /reservations/blocks - Edge Cases', () => {
    it('should return 400 when host blocks over an existing guest reservation', async () => {
      // 1. Create an existing guest reservation
      await dataSource.getRepository(Reservation).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID,
        guestId: GUEST_ID,
        startDate: new Date('2026-12-20'),
        endDate: new Date('2026-12-25'),
        numberOfGuests: 2,
        price: 500,
      });

      // 2. Host tries to block 24th-26th (overlaps with the 24th/25th)
      await request(app.getHttpServer() as App)
          .post('/api/reservations/blocks')
        .set(TEST_HOST_TOKEN_HEADERS)
        .send({
          accommodationId: ACC_ID,
          startDate: '2026-12-24',
          endDate: '2026-12-26',
        })
        .expect(400); // Should fail because "Accommodation is already booked"
    });
  });

  describe('GET /reservations/requests/pending/:accommodationId', () => {
    it('should allow host to see pending requests with guest cancellation counts', async () => {
      // 1. Seed a pending request
      await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID,
        guestId: GUEST_ID,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-05'),
        numberOfGuests: 2,
        price: 300,
        status: ReservationRequestStatus.PENDING,
      });

      // 2. Seed some cancelled requests for the same guest to check the count
      await dataSource.getRepository(ReservationRequest).save([
        {
          accommodationId: 'another-acc',
          hostId: HOST_ID,
          guestId: GUEST_ID,
          status: ReservationRequestStatus.CANCELLED,
          startDate: new Date(),
          endDate: new Date(),
          numberOfGuests: 1,
          price: 100,
        },
      ]);

      const res = await request(app.getHttpServer() as App)
          .get(`/api/reservations/requests/pending/${ACC_ID}`)
        .set(TEST_HOST_TOKEN_HEADERS)
        .expect(200);

      const body = res.body as Array<
        RequestWithReservation & { guestCancellationCount: number }
      >;

      expect(body).toBeInstanceOf(Array);
      expect(body[0].guestCancellationCount).toBe(1);
    });

    it('should return 403 if a different host tries to view pending requests', async () => {
      await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID, // Owned by host@test.com
        guestId: GUEST_ID,
        startDate: new Date('2026-11-01'),
        endDate: new Date('2026-11-05'),
        status: ReservationRequestStatus.PENDING,
        numberOfGuests: 2,
        price: 300,
      });

      await request(app.getHttpServer() as App)
        .get(`/api/reservations/requests/pending/${ACC_ID}`)
        .set(TEST_OTHER_HOST_TOKEN_HEADERS)
        .expect(403);
    });
  });

  describe('GET /reservations/requests/:id', () => {
    it('should allow guest to see their own request details', async () => {
      const req = await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID,
        guestId: GUEST_ID,
        startDate: new Date(),
        endDate: new Date(),
        status: ReservationRequestStatus.PENDING,
        numberOfGuests: 2,
        price: 300,
      });

      const res = await request(app.getHttpServer() as App)
          .get(`/api/reservations/requests/${req.id}`)
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(200);

      const body = res.body as ReservationRequestResponseDto;

      expect(body.id).toBe(req.id);
    });

    it("should return 403 if a guest tries to see another guest's request", async () => {
      const req = await dataSource.getRepository(ReservationRequest).save({
        accommodationId: ACC_ID,
        hostId: HOST_ID,
        guestId: 'test-guest-456',
        startDate: new Date(),
        endDate: new Date(),
        status: ReservationRequestStatus.PENDING,
        numberOfGuests: 2,
        price: 300,
      });

      await request(app.getHttpServer() as App)
        .get(`/api/reservations/requests/${req.id}`)
        .set(TEST_GUEST_TOKEN_HEADERS)
        .expect(403);
    });
  });

  describe('DELETE /reservations/blocks/:id', () => {
    it('should allow host to remove their manual block', async () => {
      const block = await dataSource.getRepository(Reservation).save({
        accommodationId: ACC_ID,
        hostId: TEST_HOST_TOKEN_HEADERS['x-user-id'],
        guestId: TEST_HOST_TOKEN_HEADERS['x-user-id'],
        type: 'MANUAL',
        startDate: new Date(),
        endDate: new Date(),
        numberOfGuests: 0,
        price: 0,
      });

      await request(app.getHttpServer() as App)
        .delete(`/api/reservations/blocks/${block.id}`)
        .set(TEST_HOST_TOKEN_HEADERS)
        .expect(200);

      const found = await dataSource
        .getRepository(Reservation)
        .findOneBy({ id: block.id });
      expect(found).toBeNull();
    });
  });
});
