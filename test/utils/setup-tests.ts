import { Test } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';

export let app: INestApplication;

export const mockAccommodationGrpcService = {
  getAccommodationInfo: jest.fn(),
  validateAndCalculatePrice: jest.fn(),
};

export const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockAccommodationGrpcService),
};

beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('ACCOMMODATION_PACKAGE')
    .useValue(mockGrpcClient)
    .compile();

  app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useLogger(new Logger('E2E-TEST', { timestamp: true }));

  await app.init();
}, 120000);

afterAll(async () => {
  if (app) {
    await app.close();
  }
});
