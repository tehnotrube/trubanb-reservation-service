import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ReservationRequest } from './reservation-request.entity';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  accommodationId: string;

  @Column()
  guestId: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'int' })
  numberOfGuests: number;

  @Column({ type: 'uuid' })
  requestId: string;

  @OneToOne(() => ReservationRequest, (request) => request.reservation)
  @JoinColumn({ name: 'requestId' })
  request: ReservationRequest;

  @CreateDateColumn()
  createdAt: Date;
}
