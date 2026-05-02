import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TableServiceController } from './table-service.controller';
import { TableServiceService } from './table-service.service';

@Module({
  imports: [PrismaModule],
  controllers: [TableServiceController],
  providers: [TableServiceService],
})
export class TableServiceModule {}
