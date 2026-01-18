import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceColumn1705600000000 implements MigrationInterface {
  name = 'AddPriceColumn1705600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reservation_requests"
      ADD COLUMN "price" DECIMAL(10, 2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "reservations"
      ADD COLUMN "price" DECIMAL(10, 2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reservations" DROP COLUMN "price"
    `);

    await queryRunner.query(`
      ALTER TABLE "reservation_requests" DROP COLUMN "price"
    `);
  }
}
