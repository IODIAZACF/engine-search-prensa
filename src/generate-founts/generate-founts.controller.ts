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
import { api_key, search_engine_id, dummy, jsonDictionary, url_provider_locationscolombia} from '../config.service';
import { MyLogger } from '../LoggerService';
import { Logger, Injectable, StreamableFile, Res } from '@nestjs/common';
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';
import { json2csv } from 'json-2-csv';
import { createReadStream } from 'fs';
import { join } from 'path';
import { DownloadServiceService } from '../services/download-service/download-service.service'
import express, { Request, Response } from "express";
import * as htmlparser2 from "htmlparser2";

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
  )/* : Promise<StreamableFile> */  {

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

    let query_params = query;

    let config: any = {
      params: {
        //start: 1,
        num,
        dateRestrict,//2021-01-01:2021-12-31
        cr,
        "q": "",
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
    let diccionarios_principal: any={};
    let diccionarios_ligado: any={};
    let subcategoria;

    /* for (let index = 0; index < json.length; index++) {
      var element = json[index];

      subcategoria = element["Subcategorias"] ? element["Subcategorias"] : subcategoria;

      if (element["Subcategorias"]) {
        //inicializacion del arreglo de diccionario principal
        if (typeof diccionarios_principal[element["Subcategorias"]] == 'undefined') {
          diccionarios_principal[element["Subcategorias"]] = [];
        }
      }

      if (element["Subcategorias"]) {
        //inicializacion del arreglo de diccionario ligado
        if (typeof diccionarios_ligado[element["Subcategorias"]] == 'undefined') {
          diccionarios_ligado[element["Subcategorias"]] = [];
        }
      }

      //DEFINO LOS DICCIONARIOS DE DATOS PRINCIPAL
      element.id_diccionario_principal = subcategoria;

      if (element['Diccionario Principal']) {
        let dictionary_principal_words = element['Diccionario Principal'].split('/');

        for (let m = 0; m < dictionary_principal_words.length; m++) {
          const word = dictionary_principal_words[m];
          diccionarios_principal[subcategoria].push(word);
        }

      }

      //DEFINO LOS DICCIONARIOS DE DATOS LIGADO 
      element.id_diccionario_ligado = subcategoria;

      if (element['Diccionario Ligado']) {
        let dictionary_ligado_words = element['Diccionario Ligado'].split('/');
        console.log("dictionary_ligado_words", dictionary_ligado_words[0]);

        for (let n = 0; n < dictionary_ligado_words.length; n++) {
          const word2 = dictionary_ligado_words[n];
          diccionarios_ligado[subcategoria].push(word2);
        }

      }

      if (element["Palabra clave"] && element["Palabra clave"] !== "") {
        config.params.q = element["Palabra clave"] + query_params;

        //DEFINO LAS BUSQUEDAS
        //validar si esta palabra clave ya fue buscada
        let indexItemCurrent = dataPaginated.findIndex(el => el && el['Palabra clave'] == element["Palabra clave"]);

        console.log("dataPaginated[0]", dataPaginated[index - 1] ? dataPaginated[index - 1]['Palabra clave'] : 'NO');
        console.log("element[Palabra clave]", element["Palabra clave"]);
        console.log("indexItemCurrent", indexItemCurrent);

        let itemCurrent = null;

        if (indexItemCurrent !== -1) {
          itemCurrent = dataPaginated[indexItemCurrent];

          if (itemCurrent.searchs && itemCurrent.searchs?.length > 0) {

            element.searchs = itemCurrent.searchs;

            dataPaginated.push(element);

            console.log("itemCurrent.searchs.length", itemCurrent?.searchs ? itemCurrent.searchs.length : itemCurrent);
            console.log("element.searchs.length", element.searchs.length);

          } else {

            //while (true) {
            //z += 10;

            //config.params.start = z

            const { data }: any = await this.getContentWeb('https://www.googleapis.com/customsearch/v1', '', config)

            if (data?.items && data.items?.length) {

              element.searchs = data.items;
              dataPaginated.push(element);
              console.log("itemCurrent.searchs.length", itemCurrent?.searchs ? itemCurrent.searchs.length : itemCurrent);
              console.log("element.searchs.length", element.searchs.length);
            } else {

              console.log(" config.params.q", config.params.q);
              console.log("itemCurrent.searchs.length", itemCurrent?.searchs ? itemCurrent.searchs.length : itemCurrent);
              console.log("element.searchs.length", element.searchs?.length);
            }
          }
        } else {

          //while (true) {
          //z += 10;

          //config.params.start = z

          const { data }: any = await this.getContentWeb('https://www.googleapis.com/customsearch/v1', '', config)

          if (data?.items && data.items?.length) {

            element.searchs = data.items;
            dataPaginated.push(element);
            console.log("itemCurrent.searchs.length", itemCurrent?.searchs ? itemCurrent.searchs.length : itemCurrent);
            console.log("element.searchs.length", element.searchs.length);
          } else {

            console.log(" config.params.q", config.params.q);
            console.log("itemCurrent.searchs.length", itemCurrent?.searchs ? itemCurrent.searchs.length : itemCurrent);
            console.log("element.searchs.length", element.searchs?.length);
          }

        }
      }
    } */

    let contentsAux = [];

    //poner aqui data dummy
    //remover
    dataPaginated = dummy.dataPaginated;
    diccionarios_principal = dummy.diccionarios_principal_light;
    diccionarios_ligado = dummy.diccionarios_ligado_light;
    //remover

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

          const responseContent: any = await this.getContentWeb(element.link, element.snippet, null);

          let data = responseContent.data;

          let content: string | any = "";

          content = await this.getTextFromHtml(data);

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
    let dataPaginatedCreated:any = await this.generateFountsService.createElementsMath(
      dataPaginated,
      diccionarios_principal,
      diccionarios_ligado
    );

    if (!dataPaginatedCreated?.length || dataPaginatedCreated.length == 0) {
      return null;
    }

    //crear el axcel
    var xl = require('excel4node');

    const wb = new xl.Workbook();
    const ws = wb.addWorksheet('Matriz');

    const headingColumnNames:any = Object.keys(dataPaginatedCreated[0])

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
  ) /* : Promise<any> */ {

    let htmlString = ` `;

    //let outerHTML = await this.getTextFromHtml(htmlString);

    //return outerHTML;

    /* let locations: any = await this.getContentWeb(url_provider_locationscolombia, {}, null);

    console.log("locations", locations.data.length);

    return locations; */

    let dataPaginated = [
      {
          "Categoría": "Vulnerabilidad",
          "Subcategorias": "Caracterización fenómeno",
          "Temas": "1. Fenomeno general",
          "Palabra clave": "fenómeno del niño",
          "Diccionario Principal": "Record de temperatura",
          "Diccionario Ligado": "Intenso /fortalecimiento",
          "field7": "",
          "id_diccionario_principal": "Caracterización fenómeno",
          "id_diccionario_ligado": "Caracterización fenómeno",
          "searchs": [
              {
                  "kind": "customsearch#result",
                  "title": "Frio, granizada y, ahora, el fenómeno del Niño: estos son los ...",
                  "htmlTitle": "Frio, granizada y, ahora, el <b>fenómeno del Niño</b>: estos son los ...",
                  "link": "https://www.infobae.com/colombia/2023/09/23/frio-granizada-y-ahora-el-fenomeno-del-nino-estos-son-los-cambios-climaticos-que-ha-sufrido-bogota-en-esta-semana/",
                  "displayLink": "www.infobae.com",
                  "content": "Record de temperatura emergencia Sep 23, 2023 ... Ahora puede seguirnos en nuestro WhatsApp Channel y en Google News. ... Este clima atípico en Bogotá se produce en un contexto más amplio en ...",
                  "htmlSnippet": "Sep 23, 2023 <b>...</b> Ahora puede seguirnos en nuestro WhatsApp Channel y en Google <b>News</b>. ... Este clima atípico en <b>Bogotá</b> se produce en un contexto más amplio en&nbsp;...",
                  "cacheId": "bxotvT74lXIJ",
                  "formattedUrl": "https://www.infobae.com/.../frio-granizada-y-ahora-el-fenomeno-del-nino-...",
                  "htmlFormattedUrl": "https://www.infobae.com/.../frio-granizada-y-ahora-el-fenomeno-<b>del</b>-nino-...",
              },
              {
                  "kind": "customsearch#result",
                  "title": "Navidad a media luz en Colombia por temor a apagones | AP News",
                  "htmlTitle": "Navidad a media luz en <b>Colombia</b> por temor a apagones | AP <b>News</b>",
                  "link": "https://apnews.com/article/3d685b8c26384a79bf3493fbf664794c",
                  "displayLink": "apnews.com",
                  "content": "altera Exacerbadas Dec 24, 2015 ... BOGOTA, Colombia (AP) — Una brutal sequía provocada por el fenómeno de El Niño cobró una inesperada víctima en esta época festiva de fin de ...",
                  "htmlSnippet": "Dec 24, 2015 <b>...</b> <b>BOGOTA</b>, <b>Colombia</b> (AP) — Una brutal sequía provocada por el <b>fenómeno</b> de El <b>Niño</b> cobró una inesperada víctima en esta época festiva de fin de&nbsp;...",
                  "cacheId": "tn0ACcD_4YMJ",
                  "formattedUrl": "https://apnews.com/article/3d685b8c26384a79bf3493fbf664794c",
                  "htmlFormattedUrl": "https://ap<b>news</b>.com/article/3d685b8c26384a79bf3493fbf664794c",
              }
          ]
      }
    ];

    let diccionarios_principal = dummy.diccionarios_principal_light;
    let diccionarios_ligado = dummy.diccionarios_ligado_light;

    let dataPaginatedCreated:any = await this.generateFountsService.createElementsMath(
      dataPaginated,
      diccionarios_principal,
      diccionarios_ligado
    );
    console.log("dataPaginatedCreated", dataPaginatedCreated);


    return dataPaginatedCreated;
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

  getContentWeb(link, snippet, config) {
    return new Promise(async (resolve, reject) => {
      try {

        let data = await firstValueFrom(
          this.httpService.get<any>(link, config)
            .pipe(
              catchError((error: any) => {
                console.log("link fallido ", link)
                if (error.response?.data)
                  this.logger.error(error.response.data);
                //throw 'An error happened!';
                return snippet;
              }),
            ));
        resolve(data)
      } catch (error) {
        console.log("error")
        console.log(error);
        resolve(snippet)
      }
    });
  }

  getTextFromHtml(htmlString) {

    return new Promise(async (resolve, reject) => {

      try {

        /* const { htmlToText } = require('html-to-text');

        let content = await htmlToText(htmlString, {
          wordwrap: 130
        }); */
        let textContent = "";
        const jsdom = require("jsdom");
        const dom = new jsdom.JSDOM(htmlString);

        textContent = dom.window.document.querySelector("body").textContent;

        resolve(textContent);
        /* let outerHTML = htmlparser2.DomUtils.getOuterHTML(htmlparser2.parseDOM(htmlString));
        resolve(outerHTML) */
      } catch (error) {
        console.log("error al convertir html to text ", error)
        resolve(htmlString)
      }
    })

  }
}
