import { Test, TestingModule } from '@nestjs/testing';
import { ContentExtractService } from './content-extract.service';

describe('ContentExtractService', () => {
  let service: ContentExtractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentExtractService],
    }).compile();

    service = module.get<ContentExtractService>(ContentExtractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
