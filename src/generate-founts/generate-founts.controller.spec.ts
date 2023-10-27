import { Test, TestingModule } from '@nestjs/testing';
import { GenerateFountsController } from './generate-founts.controller';
import { GenerateFountsService } from './generate-founts.service';

describe('GenerateFountsController', () => {
  let controller: GenerateFountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GenerateFountsController],
      providers: [GenerateFountsService],
    }).compile();

    controller = module.get<GenerateFountsController>(GenerateFountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
