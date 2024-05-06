import { Module } from '@nestjs/common';
import { GenerateFountsLiteService } from './generate-founts-lite.service';
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';
import { DownloadServiceService } from '../services/download-service/download-service.service';
import { HelperService } from '../services/helper/helper.service';

import { GenerateFountsLiteController } from './generate-founts-lite.controller';
import { HttpModule } from '@nestjs/axios'

@Module({
  controllers: [GenerateFountsLiteController],
  providers: [GenerateFountsLiteService, ConvertToExcelService, DownloadServiceService, HelperService],
  imports: [HttpModule],
})
export class GenerateFountsLiteModule {}
