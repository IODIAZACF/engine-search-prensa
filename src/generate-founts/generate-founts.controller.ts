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
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response
  )/* : Promise<StreamableFile> */ {

    /* const data:any = await this.getContentWeb("https://kf.acf-e.org/");
    console.log("data", data.data)
    return data.data; */

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
      //console.log("csvstring", csvstring)

      //poner aqui el servicios para convertitr el excel en un json y poder hacer un analisis con 
      //json = await this.convertToExcelService.convertCsvToJson(csv);

      const csvtojson = require("csvtojson");

      const jsonArray = await csvtojson().fromString(csvstring)
        .subscribe((json) => {
          return new Promise((resolve, reject) => {
            resolve(json)
          })
        })

      json = jsonArray;

    } else {

      json = [];

    }

    let query = "",
      cr = createGenerateFountDto['cr'],
      dateRestrict = createGenerateFountDto['dateRestrictType'] + "[" + createGenerateFountDto['dateRestrictNum'] + "]",
      highRange = createGenerateFountDto['highRange'] ? createGenerateFountDto['highRange'] : null,
      num = createGenerateFountDto['num'] ? JSON.parse(createGenerateFountDto['num']) : 10,
      lowRange = createGenerateFountDto['lowRange'] ? createGenerateFountDto['lowRange'] : null;
    //start = createGenerateFountDto['start'];

    if (createGenerateFountDto['noticia'])
      query += " + " + " news ";
    else
      query += " + " + " investigation ";

    if (createGenerateFountDto['city'])
      query += " + " + createGenerateFountDto['city'];

    let config: any = {
      params: {
        //start: 1,
        safe: "active",
        num,
        dateRestrict,//2021-01-01:2021-12-31
        cr,
        "q": query,
        "key": api_key,
        "cx": search_engine_id
      }
    }

    if (highRange) {
      config.params.highRange = highRange
    }
    if (lowRange) {
      config.params.lowRange = lowRange
    }

    //hacer una consulta para obtener la buisqueda solicitada

    //defino el item del archivo excel a json con sus diccionarios de datos asociados
    let dataPaginated = [];
    let diccionarios_principal: any[] = [];
    let diccionarios_ligado: any[] = [];
    let subcategoria;

    for (let index = 0; index < json.length; index++) {
      var element = json[index];

      subcategoria = element["Subcategorias"] ? element["Subcategorias"] : subcategoria;

      //DEFINO LOS DICCIONARIOS DE DATOS PRINCIPAL
      element.id_diccionario_principal = subcategoria;

      if (element['Diccionario Principal']) {
        let dictionary_principal_words = element['Diccionario Principal'].split('/');

        for (let m = 0; m < dictionary_principal_words.length; m++) {
          //inicializacion del arreglo de diccionario principal
          if (typeof diccionarios_principal[subcategoria] == 'undefined') {
            diccionarios_principal[subcategoria] = [];
          }
          const word = dictionary_principal_words[m];
          diccionarios_principal[subcategoria].push(word);
        }

      }

      //DEFINO LOS DICCIONARIOS DE DATOS LIGADO 
      element.id_diccionario_ligado = subcategoria;

      if (element['Diccionario Ligado']) {
        let dictionary_ligado_words = element['Diccionario Ligado'].split('/');

        //inicializacion del arreglo de diccionario ligado
        if (typeof diccionarios_ligado[subcategoria] == 'undefined') {
          diccionarios_ligado[subcategoria] = [];
        }

        for (let n = 0; n < dictionary_ligado_words.length; n++) {
          const word2 = dictionary_ligado_words[n];
          diccionarios_ligado[subcategoria].push(word2);
        }

      }

      if (element["Palabra clave"] && element["Palabra clave"] !== "") {
        config.params.q = element["Palabra clave"] + config.params.q;

        //DEFINO LAS BUSQUEDAS
        //validar si esta palabra clave ya fue buscada
        let indexItemCurrent = dataPaginated.findIndex(el => el && el['Palabra clave'] == element["Palabra clave"]);

        console.log("dataPaginated[0]", dataPaginated[index] ? dataPaginated[index]['Palabra clave'] : 'NO');
        console.log("element[Palabra clave]", element["Palabra clave"]);
        console.log("indexItemCurrent", indexItemCurrent)

        if (indexItemCurrent !== -1) {
          let itemCurrent = dataPaginated[indexItemCurrent];

          if (itemCurrent.searchs && itemCurrent.searchs?.length > 0) {

            element.searchs = itemCurrent.searchs;

            dataPaginated.push(element);

          } else {

            //while (true) {
            //z += 10;

            //config.params.start = z

            const { data } = await firstValueFrom(
              this.httpService.get<any>('https://www.googleapis.com/customsearch/v1', config).pipe(
                catchError((error: AxiosError) => {
                  this.logger.error(error.response.data);
                  throw 'An error happened!';
                }),
              ),
            );

            element.searchs = data.items;

            //remover
            //element.searchs = dummy;
            //remover

            dataPaginated.push(element);

          }
        } else {

          //while (true) {
          //z += 10;

          //config.params.start = z

          const { data } = await firstValueFrom(
            this.httpService.get<any>('https://www.googleapis.com/customsearch/v1', config).pipe(
              catchError((error: AxiosError) => {
                this.logger.error(error.response.data);
                throw 'An error happened!';
              }),
            ),
          );

          element.searchs = data.items;

          //remover
          //element.searchs = dummy;
          //remover

          dataPaginated.push(element);

        }

      }
    }

    let contentsAux = [];

    //procesar los datos para que podamos mostrar mas contenido extrayendo todo el texto de la web
    // Web Scraping
    for (let index2 = 0; index2 < dataPaginated.length; index2++) {
      const page = dataPaginated[index2];

      for (let j = 0; j < page.searchs.length; j++) {

        const element = page.searchs[j];

        //validar si esta contenido ya fue cosultado
        let indexContentsAux = contentsAux.findIndex(el => el.link == element.link);

        if (indexContentsAux !== -1) {
          let contentCurrent = contentsAux[indexContentsAux];

          dataPaginated[index2].searchs[j].content = contentCurrent.content;

        } else {


          const responseContent: any = await this.getContentWeb("https://kf.acf-e.org/");

          let data = responseContent.data;

          let content = "";
          const { htmlToText } = require('html-to-text');

          content = await htmlToText(data, {
            wordwrap: 130
          });

          //mejorar el string quitando muchos espacio al princiapio y al final
          content = content.trim();

          //mejorando el string quitando espacio muy repetido

          dataPaginated[index2].searchs[j].content = content;
          contentsAux.push({ content, link: element.link })

        }

      }

    }
    console.log("dataPaginated", dataPaginated.length);

    //luego validar el content contenga el json y definir
    let dataPaginatedCreated = await this.generateFountsService.createElementsMath(dataPaginated, diccionarios_principal, diccionarios_ligado);
    console.log("dataPaginatedCreated", dataPaginatedCreated.length);
    //crear el axcel
    var xl = require('excel4node');

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet('Matriz');

    const headingColumnNames = Object.keys(dataPaginatedCreated[0])

    let headingColumnIndex = 1;
    headingColumnNames.forEach(heading => {
      ws.cell(1, headingColumnIndex++)
        .string(heading)
    });

    let rowIndex = 2;
    dataPaginatedCreated.forEach(record => {
      let columnIndex = 1;
      Object.keys(record).forEach(columnName => {

        switch (typeof record[columnName]) {

          case 'string':
            ws.cell(rowIndex, columnIndex++)
              .string(record[columnName])
            break;

          case 'number':
            ws.cell(rowIndex, columnIndex++)
              .number(record[columnName])
            break;

          case 'object':
            ws.cell(rowIndex, columnIndex++)
              .string(JSON.stringify(record[columnName]))
            break;

          default:
            ws.cell(rowIndex, columnIndex++)
              .string(JSON.stringify(record[columnName]))
            break;
        }
      });
      rowIndex++;
    });

    wb.write('ExcelFile.xlsx', function (err, stats) {
      if (err) {
        console.error(err);
      } else {
        console.log(stats); // Prints out an instance of a node.js fs.Stats object

        return stats;
      }
    });

    let buffer = await wb.writeToBuffer('ExcelFile.xlsx');

    res.set({
      'Content-Type': 'application/excel',
      'Content-Disposition': 'attachment; filename="Matriz de consistencia Prensa Fenomeno del Niño.xlsx"',
    });

    return new StreamableFile(buffer);

    /* const CsvParser = require("json2csv").Parser;

    const csvFields = Object.keys(json[0]); //["Id", "Title", "Description", "Published"];

    const csvParser = new CsvParser({ csvFields });

    const csvData = csvParser.parse(dataPaginatedCreated);

    console.log("csv string", dataPaginatedCreated)
    
    var fs = require('fs'); */

    /* 

    fs.writeFile('form-tracking/formList.csv', csv, 'utf8', function (err) {
      if (err) {
        console.log('Some error occured - file either not saved or corrupted file saved.');
      } else {
        console.log('It\'s saved!');
      }
    }); */

    /* const fileName = 'Matriz de consistencia Prensa_ Fenomeno del Niño 20231009.csv';
    const readStream = fs.createWriteStream("/tmp/test", fileName);

    fs.writeFileSync("/tmp/test", csv);

    readStream.on('data', (chunk) => console.log(chunk)); //<--- the data log gets printed
    readStream.on('finish', () => console.log('done'));
    return new StreamableFile(readStream); */

    //return dataPaginatedCreated;
  }

  @Get()
  async findAll(
    @Body() createGenerateFountDto: CreateGenerateFountDto,
    @UploadedFile() file: Express.Multer.File,
  ) {/* : Promise<any> */

    let query = "",
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
          //console.log("jsonss", json)
          return new Promise((resolve, reject) => {
            resolve(json)
          })
        })

      json = jsonArray;

    } else {

      json = jsonDictionary;

    }

    //luego validar el content contenga el json y definir las categorias
    let dataPaginatedCreated = await this.generateFountsService.createElementsMath(dataPaginated, [], []);

    return dataPaginatedCreated;
    /* let config = {
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
    return data; */
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

  getContentWeb(link) {
    return new Promise(async (resolve, reject) => {
      await this.httpService.get<any>(link)
        .subscribe((response) => {
          resolve(response)
        });
    });
  }
}
