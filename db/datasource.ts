// TypeORM CLI DataSource configuration file
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { getTypeOrmConfig } from '../src/db/typeorm.config';

config();

export default new DataSource(
  getTypeOrmConfig({
    isTest: false,
  }),
);
