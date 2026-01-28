import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHostIdToReservationAndRequest1769621459994 implements MigrationInterface {
    name = 'AddHostIdToReservationAndRequest1769621459994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" ADD "hostId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservation_requests" ADD "hostId" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservation_requests" DROP COLUMN "hostId"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "hostId"`);
    }

}
