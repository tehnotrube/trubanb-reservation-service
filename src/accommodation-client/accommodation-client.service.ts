import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import * as microservices from '@nestjs/microservices';
import { Observable, firstValueFrom } from 'rxjs';

interface GetAccommodationInfoRequest {
  accommodationId: string;
}

export interface AccommodationInfo {
  exists: boolean;
  accommodationId: string;
  name?: string;
  basePrice: number;
  autoApprove: boolean;
  hostId: string;
  minGuests: number;
  maxGuests: number;
  isPerUnit: boolean;
}

export interface ValidateAndCalculatePriceRequest {
  accommodationId: string;
  checkIn: string;
  checkOut: string;
  guestCount: number;
}

export interface ValidateAndCalculatePriceResponse {
  success: boolean;
  message: string;
  accommodationExists: boolean;
  datesValid: boolean;
  guestsValid: boolean;
  nights: number;
  totalPrice: number;
  pricePerNight: number;
  rulesApplied: number;
  hostId: string;
  autoApprove: boolean;
  isPerUnit: boolean;
}

interface AccommodationServiceGrpc {
  getAccommodationInfo(
    data: GetAccommodationInfoRequest,
  ): Observable<AccommodationInfo>;
  validateAndCalculatePrice(
    data: ValidateAndCalculatePriceRequest,
  ): Observable<ValidateAndCalculatePriceResponse>;
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

  async validateAndCalculatePrice(
    accommodationId: string,
    checkIn: string,
    checkOut: string,
    guestCount: number,
  ): Promise<ValidateAndCalculatePriceResponse> {
    return firstValueFrom(
      this.accommodationService.validateAndCalculatePrice({
        accommodationId,
        checkIn,
        checkOut,
        guestCount,
      }),
    );
  }
}
