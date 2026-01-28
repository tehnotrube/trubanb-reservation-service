import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { ReservationRequestStatus } from '../enums';
import { Reservation } from './reservation.entity';

@Entity('reservation_requests')
export class ReservationRequest {
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

  @Column({
    type: 'enum',
    enum: ReservationRequestStatus,
    default: ReservationRequestStatus.PENDING,
  })
  status: ReservationRequestStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Reservation, (reservation) => reservation.request)
  reservation?: Reservation;
}
