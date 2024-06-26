import { Module } from '@nestjs/common';
import { ScrapingFoundsController } from '../scraping-founds/scraping-founds.controller';
import { ScrapingFoundsService } from '../scraping-founds/scraping-founds.service';
import { HttpModule } from '@nestjs/axios'
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';

@Module({
    controllers: [ScrapingFoundsController],
    providers: [ScrapingFoundsService, ConvertToExcelService],
    imports: [HttpModule],
})
export class ScrapingFoundsModule { }
