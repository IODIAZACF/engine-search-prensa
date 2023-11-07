import { Module } from '@nestjs/common';
import { GenerateFountsService } from './generate-founts.service';
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';
import { DownloadServiceService } from '../services/download-service/download-service.service';

import { GenerateFountsController } from './generate-founts.controller';
import { HttpModule } from '@nestjs/axios'

@Module({
  controllers: [GenerateFountsController],
  providers: [GenerateFountsService, ConvertToExcelService, DownloadServiceService],
  imports: [HttpModule],
})
export class GenerateFountsModule {}
