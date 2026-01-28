import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeReasonToType1769549773461 implements MigrationInterface {
    name = 'ChangeReasonToType1769549773461'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" RENAME COLUMN "reason" TO "type"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" RENAME COLUMN "type" TO "reason"`);
    }

}
