import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReservationEntities1768673579019 implements MigrationInterface {
    name = 'AddReservationEntities1768673579019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."reservation_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "reservation_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "accommodationId" character varying NOT NULL, "guestId" character varying NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "numberOfGuests" integer NOT NULL, "status" "public"."reservation_requests_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8ebf9e6ba0f5a55c175b4520789" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "reservations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "accommodationId" character varying NOT NULL, "guestId" character varying NOT NULL, "startDate" date NOT NULL, "endDate" date NOT NULL, "numberOfGuests" integer NOT NULL, "requestId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_88c101b4a1ed8a8f48c2679312" UNIQUE ("requestId"), CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_88c101b4a1ed8a8f48c26793122" FOREIGN KEY ("requestId") REFERENCES "reservation_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_88c101b4a1ed8a8f48c26793122"`);
        await queryRunner.query(`DROP TABLE "reservations"`);
        await queryRunner.query(`DROP TABLE "reservation_requests"`);
        await queryRunner.query(`DROP TYPE "public"."reservation_requests_status_enum"`);
    }

}
