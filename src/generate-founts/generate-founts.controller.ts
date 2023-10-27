import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GenerateFountsService } from './generate-founts.service';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse, AxiosError } from 'axios';
import { Observable, firstValueFrom, catchError} from 'rxjs';
import { api_key, search_engine_id } from '../config.service';
import { MyLogger } from '../LoggerService';
import { Logger, Injectable } from '@nestjs/common';

@Controller('generate-founts')
export class GenerateFountsController {
  
  private readonly logger = new Logger(GenerateFountsController.name);

  constructor(
    private readonly generateFountsService: GenerateFountsService,
    private readonly httpService: HttpService
  ) {}

  @Post()
  create(@Body() createGenerateFountDto: CreateGenerateFountDto) {
    return this.generateFountsService.create(createGenerateFountDto);
  }

  @Get()
  async findAll() : Promise<any> {

    let config = {
      params: {
        "q": "Fenomeno del niño",
        "key": api_key,
        "cx": search_engine_id
      }
    }

    const { data } = await firstValueFrom(
      this.httpService.get<any>('https://www.googleapis.com/customsearch/v1', config).pipe(
        catchError((error: AxiosError) => {
          this.logger.error(error.response.data);
          throw 'An error happened!';
        }),
      ),
    );
    return data;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.generateFountsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGenerateFountDto: UpdateGenerateFountDto) {
    return this.generateFountsService.update(+id, updateGenerateFountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.generateFountsService.remove(+id);
  }
}
