import { Test, TestingModule } from '@nestjs/testing';
import { GenerateFountsService } from './generate-founts.service';

describe('GenerateFountsService', () => {
  let service: GenerateFountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GenerateFountsService],
    }).compile();

    service = module.get<GenerateFountsService>(GenerateFountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
