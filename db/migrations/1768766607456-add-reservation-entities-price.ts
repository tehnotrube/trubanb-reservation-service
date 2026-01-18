import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReservationEntitiesPrice1768766607456 implements MigrationInterface {
    name = 'AddReservationEntitiesPrice1768766607456'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservation_requests" ADD "price" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD "price" numeric(10,2) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "price"`);
        await queryRunner.query(`ALTER TABLE "reservation_requests" DROP COLUMN "price"`);
    }

}
