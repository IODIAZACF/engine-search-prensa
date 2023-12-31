import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GenerateFountsModule } from './generate-founts/generate-founts.module';
import { ContentExtractService } from './services/content-extract/content-extract.service';
import { ConvertToExcelService } from './services/convert-to-excel/convert-to-excel.service';
import { DownloadServiceService } from './services/download-service/download-service.service';

@Module({
  imports: [GenerateFountsModule],
  controllers: [AppController],
  providers: [AppService, ContentExtractService, ConvertToExcelService, DownloadServiceService]
})
export class AppModule {}
