import { Module } from '@nestjs/common';
import { GenerateFountsService } from './generate-founts.service';
import { GenerateFountsController } from './generate-founts.controller';
import { HttpModule } from '@nestjs/axios'

@Module({
  controllers: [GenerateFountsController],
  providers: [GenerateFountsService],
  imports: [HttpModule],
})
export class GenerateFountsModule {}
