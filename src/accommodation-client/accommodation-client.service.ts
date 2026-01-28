import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import * as microservices from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';

interface GetAccommodationInfoRequest {
  accommodationId: string;
}

export interface AccommodationInfo {
  exists: boolean;
  accommodationId: string;
  basePrice: number;
  autoApprove: boolean;
  hostId: string;
  minGuests: number;
  maxGuests: number;
  isPerUnit: boolean;
}

interface AccommodationServiceGrpc {
  getAccommodationInfo(
    data: GetAccommodationInfoRequest,
  ): Observable<AccommodationInfo>;
}

@Injectable()
export class AccommodationClientService implements OnModuleInit {
  private accommodationService: AccommodationServiceGrpc;

  constructor(
    @Inject('ACCOMMODATION_PACKAGE')
    private readonly client: microservices.ClientGrpc,
  ) {}

  onModuleInit() {
    this.accommodationService =
      this.client.getService<AccommodationServiceGrpc>('AccommodationService');
  }

  async getAccommodationInfo(
    accommodationId: string,
  ): Promise<AccommodationInfo> {
    return firstValueFrom(
      this.accommodationService.getAccommodationInfo({ accommodationId }),
    );
  }
}
