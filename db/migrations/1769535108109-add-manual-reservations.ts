import { MigrationInterface, QueryRunner } from "typeorm";

export class AddManualReservations1769535108109 implements MigrationInterface {
    name = 'AddManualReservations1769535108109'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" ADD "reason" character varying NOT NULL DEFAULT 'RESERVATION'`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_88c101b4a1ed8a8f48c26793122"`);
        await queryRunner.query(`ALTER TABLE "reservations" ALTER COLUMN "requestId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_88c101b4a1ed8a8f48c26793122" FOREIGN KEY ("requestId") REFERENCES "reservation_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_88c101b4a1ed8a8f48c26793122"`);
        await queryRunner.query(`ALTER TABLE "reservations" ALTER COLUMN "requestId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_88c101b4a1ed8a8f48c26793122" FOREIGN KEY ("requestId") REFERENCES "reservation_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "reason"`);
    }

}
