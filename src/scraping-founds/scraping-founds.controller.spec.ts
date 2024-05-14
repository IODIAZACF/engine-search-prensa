import { Test, TestingModule } from '@nestjs/testing';
import { ScrapingFoundsController } from './scraping-founds.controller';

describe('ScrapingFoundsController', () => {
  let controller: ScrapingFoundsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScrapingFoundsController],
    }).compile();

    controller = module.get<ScrapingFoundsController>(ScrapingFoundsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
