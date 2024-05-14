import { Module } from '@nestjs/common';
import { ScrapingFoundsController } from '../scraping-founds/scraping-founds.controller';
import { ScrapingFoundsService } from '../scraping-founds/scraping-founds.service';
import { HttpModule } from '@nestjs/axios'

@Module({
    controllers: [ScrapingFoundsController],
    providers: [ScrapingFoundsService],
    imports: [HttpModule],
})
export class ScrapingFoundsModule { }
