import { Test, TestingModule } from '@nestjs/testing';
import { DownloadServiceService } from './download-service.service';

describe('DownloadServiceService', () => {
  let service: DownloadServiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DownloadServiceService],
    }).compile();

    service = module.get<DownloadServiceService>(DownloadServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
