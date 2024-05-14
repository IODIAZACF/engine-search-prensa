import { Test, TestingModule } from '@nestjs/testing';
import { ScrapingFoundsService } from './scraping-founds.service';

describe('ScrapingFoundsService', () => {
  let service: ScrapingFoundsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScrapingFoundsService],
    }).compile();

    service = module.get<ScrapingFoundsService>(ScrapingFoundsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
