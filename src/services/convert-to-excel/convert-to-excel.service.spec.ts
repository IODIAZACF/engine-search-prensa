import { Test, TestingModule } from '@nestjs/testing';
import { ConvertToExcelService } from './convert-to-excel.service';

describe('ConvertToExcelService', () => {
  let service: ConvertToExcelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConvertToExcelService],
    }).compile();

    service = module.get<ConvertToExcelService>(ConvertToExcelService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
