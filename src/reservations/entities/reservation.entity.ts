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

  @Column()
  hostId: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'int' })
  numberOfGuests: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'uuid', nullable: true })
  requestId?: string;

  @OneToOne(() => ReservationRequest, (request) => request.reservation)
  @JoinColumn({ name: 'requestId' })
  request: ReservationRequest;

  @Column({ default: 'RESERVATION' })
  type: 'RESERVATION' | 'MANUAL';

  @CreateDateColumn()
  createdAt: Date;
}
