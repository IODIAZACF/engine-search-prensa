import { Module } from '@nestjs/common';
import { GenerateFountsService } from './generate-founts.service';
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';
import { DownloadServiceService } from '../services/download-service/download-service.service';
import { HelperService } from '../services/helper/helper.service';

import { GenerateFountsController } from './generate-founts.controller';
import { HttpModule } from '@nestjs/axios'

@Module({
  controllers: [GenerateFountsController],
  providers: [GenerateFountsService, ConvertToExcelService, DownloadServiceService, HelperService],
  imports: [HttpModule],
})
export class GenerateFountsModule {}
