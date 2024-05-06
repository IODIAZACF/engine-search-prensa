import { Test, TestingModule } from '@nestjs/testing';
import { GenerateFountsLiteService } from './generate-founts-lite.service';

describe('GenerateFountsLiteService', () => {
  let service: GenerateFountsLiteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenerateFountsLiteService],
    }).compile();

    service = module.get<GenerateFountsLiteService>(GenerateFountsLiteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
