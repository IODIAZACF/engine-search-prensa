import { Test, TestingModule } from '@nestjs/testing';
import { GenerateFountsLiteController } from './generate-founts-lite.controller';

describe('GenerateFountsLiteController', () => {
  let controller: GenerateFountsLiteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GenerateFountsLiteController],
    }).compile();

    controller = module.get<GenerateFountsLiteController>(GenerateFountsLiteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
