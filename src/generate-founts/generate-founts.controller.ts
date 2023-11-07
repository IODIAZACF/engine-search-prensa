import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,

} from '@nestjs/common';
import { Express } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { GenerateFountsService } from './generate-founts.service';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse, AxiosError } from 'axios';
import { Observable, firstValueFrom, catchError } from 'rxjs';
import { api_key, search_engine_id, dummy, jsonDictionary } from '../config.service';
import { MyLogger } from '../LoggerService';
import { Logger, Injectable, StreamableFile, Res } from '@nestjs/common';
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';
import { json2csv } from 'json-2-csv';
import { createReadStream } from 'fs';
import { join } from 'path';
import { DownloadServiceService } from '../services/download-service/download-service.service'

import express, { Request, Response } from "express";

@Controller('generate-founts')
export class GenerateFountsController {

  private readonly logger = new Logger(GenerateFountsController.name);

  constructor(
    private readonly generateFountsService: GenerateFountsService,
    private readonly httpService: HttpService,
    private readonly convertToExcelService: ConvertToExcelService,
    private readonly downloadService: DownloadServiceService,

  ) { }

  @UseInterceptors(FileInterceptor('file'))
  @Post()
  async create(
    @Body() createGenerateFountDto: CreateGenerateFountDto,
    @UploadedFile() file: Express.Multer.File
  ) :Promise<StreamableFile> {

    let query = createGenerateFountDto['contexto'],
      cr = createGenerateFountDto['cr'],
      dateRestrict = createGenerateFountDto['dateRestrict'],
      highRange = createGenerateFountDto['highRange'],
      num = createGenerateFountDto['num'],
      lowRange = createGenerateFountDto['lowRange'],
      start = createGenerateFountDto['start'];


    if (createGenerateFountDto['noticia'])
      query += " + " + " news ";
    else
      query += " + " + " investigation ";

    if (createGenerateFountDto['city'])
      query += " + " + createGenerateFountDto['city'];

    let config = {
      params: {
        start,
        num,
        lowRange,
        highRange,
        dateRestrict,//2021-01-01:2021-12-31
        cr,
        "q": query,
        "key": api_key,
        "cx": search_engine_id
      }
    }
    //hacer una consulta para obtener la buisqueda solicitada

    let dataPaginated = []

    //obtener los 100 datos de 10 en 10 pero los 100
    /* let z = 1;
    while (true) {
      z += 10;

      config.params.start = z
      
      const { data } = await firstValueFrom(
        this.httpService.get<any>('https://www.googleapis.com/customsearch/v1', config).pipe(
          catchError((error: AxiosError) => {
            this.logger.error(error.response.data);
            throw 'An error happened!';
          }),
        ),
      );

      dataPaginated = dataPaginated.concat(data.items);

      if (z > 90) {
        break;
      }
    } */

    //remover
    dataPaginated = dummy

    //procesar los datos para que podamos mostrar mas contenido extrayendo todo el texto de la web
    // Web Scraping
    for (let index = 0; index < dataPaginated.length; index++) {
      const element = dataPaginated[index];

      const { data }: any = //await firstValueFrom(
        await this.httpService.get<any>(element.link).toPromise()//,
      //);
      let content = "";
      const { htmlToText } = require('html-to-text');

      content = await htmlToText(data, {
        wordwrap: 130
      });

      //mejorar el string quitando muchos espacio al princiapio y al final
      content = content.trim();

      //mejorando el string quitando espacio muy repetido

      dataPaginated[index].content = content;

    }

    let json = [];
    //convert or create excel con la informacion de resultado y formato en las demas hojas de calculo
    //usar un excel con las claves o procesar la tabla para extraer
    if (file && file.buffer) {

      //validar que el excel cumpla el formato
      let csv = file.buffer;
      let csvstring: string = csv.toString();

      if ((csvstring.match(/;/g) || []).length > 10) {
        csvstring = await this.convertToExcelService.replaceAll(csvstring, ';', ',');

      }

      //poner aqui el servicios para convertitr el excel en un json y poder hacer un analisis con 
      //json = await this.convertToExcelService.convertCsvToJson(csv);

      const csvtojson = require("csvtojson");

      const jsonArray = await csvtojson().fromString(csvstring)
        .subscribe((json) => {
          console.log("jsonss", json)
          return new Promise((resolve, reject) => {
            resolve(json)
          })
        })

      /* const { Readable } = require('stream');
      const stream = Readable.from(csv);
      const jsonArray = csvtojson().fromStream(stream)
        .subscribe((json) => {
          console.log("jsonss", json)
          return new Promise((resolve, reject) => {
            resolve(json)
          })
        }) 
      */

      json = jsonArray;

    } else {

      json = jsonDictionary;

    }

    //luego validar el content contenga el json y definir las categorias
    let dataPaginatedCreated = await this.generateFountsService.createElementsMath(dataPaginated, json);

    //crear el axcel  estas celdas

    /* let converter = require('json-2-csv');
    let options = "-o output.csv"
    const csv = await converter.json2csv(dataPaginatedCreated, options); */

    const CsvParser = require("json2csv").Parser;

    const csvFields = Object.keys(json[0]); //["Id", "Title", "Description", "Published"];

    const csvParser = new CsvParser({ csvFields });

    const csvData = csvParser.parse(dataPaginatedCreated);

    console.log("csv string", dataPaginatedCreated)
    
    var fs = require('fs');

    /* 

    fs.writeFile('form-tracking/formList.csv', csv, 'utf8', function (err) {
      if (err) {
        console.log('Some error occured - file either not saved or corrupted file saved.');
      } else {
        console.log('It\'s saved!');
      }
    }); */

    const fileName = 'Matriz de consistencia Prensa_ Fenomeno del Niño 20231009.csv';
    const readStream = fs.createWriteStream("/tmp/test", fileName);

    fs.writeFileSync("/tmp/test", csv);

    readStream.on('data', (chunk) => console.log(chunk)); //<--- the data log gets printed
    readStream.on('finish', () => console.log('done'));
    return new StreamableFile(readStream);

    //return dataPaginatedCreated;
  }

  @Get()
  async findAll(): Promise<any> {

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

  @Get('/templates/diccionario_de_datos.csv')
  getFile(): StreamableFile {
    const file = createReadStream(join(process.cwd(), './src/assets/diccionario_de_datos.csv'));
    return new StreamableFile(file);
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
