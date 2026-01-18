import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AccommodationClientService } from './accommodation-client.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'ACCOMMODATION_PACKAGE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'accommodation',
            protoPath: join(__dirname, '../proto/accommodation.proto'),
            url: configService.get<string>(
              'ACCOMMODATION_GRPC_URL',
              'localhost:50051',
            ),
          },
        }),
      },
    ]),
  ],
  providers: [AccommodationClientService],
  exports: [AccommodationClientService],
})
export class AccommodationClientModule {}
