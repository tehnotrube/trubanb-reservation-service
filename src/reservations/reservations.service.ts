import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservationRequest, Reservation } from './entities';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationRequest)
    private readonly requestRepository: Repository<ReservationRequest>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  // Phase 2: Add business logic methods here
}
