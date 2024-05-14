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
    Logger, 
    Injectable, 
    StreamableFile, 
    Res
} from '@nestjs/common';
import express, { Express, Request, Response } from "express";
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';
import { Observable, firstValueFrom, catchError } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Controller('scraping-founds')
export class ScrapingFoundsController {

    private readonly logger = new Logger(ScrapingFoundsController.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly convertToExcelService: ConvertToExcelService,
    ) {

    }



    /**
     * sirve para crear contenido web a las pagina wweb 
     * @param res 
     * @param createGenerateFountDto 
     * @param file 
     */
    @UseInterceptors(FileInterceptor('file'))
    @Post()
    async addContentHtml(
        @Res({ passthrough: true }) res: Response,
        @Body() createGenerateFountDto: CreateGenerateFountDto,
        @UploadedFile() file: Express.Multer.File,
    ) /* : Promise<any> */ {

        
        function groupChildren(obj) {
            for (const prop in obj) { // consider filtering for own properties (vs from prototype: for(prop of Object.keys(obj)) {
                if (typeof obj[prop] === 'object') {
                    groupChildren(obj[prop]);
                } else {
                    obj['$'] = obj['$'] || {};
                    obj['$'][prop] = obj[prop];
                    delete obj[prop];
                }
            }

            return obj;
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

        let dataPaginated = json;
        let contentsAux = [];

        for (let index2 = 0; index2 < dataPaginated.length; index2++) {


            const page = dataPaginated[index2];

            for (let j = 0; j < page.searchs.length; j++) {
                console.log("pregress scraping", (dataPaginated.length > 0 ? index2 / dataPaginated.length : 1) * 100)

                const element = page.searchs[j];

                //validar si esta contenido ya fue cosultado
                let indexContentsAux = contentsAux.findIndex(el => el.link == element.link);

                if (indexContentsAux !== -1) {
                    let contentCurrent = contentsAux[indexContentsAux];

                    dataPaginated[index2].searchs[j].content = contentCurrent.content;

                } else {

                    const responseContent: any = await this.getContentWeb(element.link, element.snippet, null);

                    let data = responseContent?.data;

                    let content: string | any = "";

                    if (typeof data == "string") {
                        content = await this.getTextFromHtml(data);
                        //mejorar el string quitando muchos espacio al princiapio y al final
                        content = content.trim();
                        //reducir el conetenido no todo sino una parte para que no falle
                        content = content.substr(0, 1000);

                    } else {
                        content = "FALLO AL OBTENER CONTENIDO";
                    }

                    dataPaginated[index2].searchs[j].content = content;
                    contentsAux.push({ content, link: element.link })

                }

            }

        }

        if (!dataPaginated?.length || dataPaginated.length == 0) {
            return "fallo el proceso de scraping";
        }
        //crear el axcel
        var xl = require('excel4node');

        const wb = new xl.Workbook();
        const ws = wb.addWorksheet('Matriz');
        var xml2js = require('xml2js');

        const headingColumnNames: any = Object.keys(dataPaginated[0])

        let headingColumnIndex = 1;
        headingColumnNames.forEach(heading => {
            ws.cell(1, headingColumnIndex++)
                .string(heading)
        });

        let rowIndex = 2;
        dataPaginated.forEach(record => {
            let columnIndex = 1;

            for (let index = 0; index < headingColumnNames.length; index++) {
                const columnName = headingColumnNames[index];
                //columnIndex = columnIndex + index;

                //Object.keys(record).forEach(columnName => {

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

                        let columnArrayValues = Object.values(record[columnName]);
                        let columnArrayKeys = Object.keys(record[columnName]);

                        if (columnArrayValues.length === 0) {
                                
                            var builder = new xml2js.Builder();

                            var lengthObject = JSON.stringify(record[columnName]);

                            var xml = builder.buildObject(groupChildren(record[columnName]));
                            if(lengthObject.length <= 1000){
                                ws.cell(rowIndex, columnIndex++)
                                .addToXMLele(xml)//JSON.stringify(record[columnName])
                            }
                            break;
                        }

                        //debo agregar una columna para poner lo que voy a imprimir y
                        // que vendria siendo las localizaciones en el headingColumnNames
                        // llamado "localizaciones"

                        //hacer en al misma fila con una columna nueva y fila nueva los datos
                        // que siguen del form que estoy recorriendo

                        /* for (let index = 0; index < columnArrayValues.length; index++) {
                            const element = columnArrayValues[index];

                            ws.cell(rowIndex, columnIndex++)
                                .string(JSON.stringify(record[columnName]))
                        } */

                        break;

                    default:
                        ws.cell(rowIndex, columnIndex++)
                            .string(JSON.stringify(record[columnName]))
                        break;
                }

                //});
            }

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
            'Content-Disposition': 'attachment; filename="Matriz de Prensa Scrapined.xlsx"',
        });

        return new StreamableFile(buffer);

    }


    getContentWeb(link, snippet, config) {
        return new Promise(async (resolve, reject) => {
            try {

                let data = await firstValueFrom(
                    this.httpService.get<any>(link, config)
                        .pipe(
                            catchError((error: any) => {
                                //console.log("link fallido ", error.response.data)
                                if (error.response?.data)
                                    this.logger.error("link fallido ", link);
                                return snippet;
                            }),
                        ));
                resolve(data)
            } catch (error) {
                /* console.log("error")
                console.log(error); */
                this.logger.error("link fallido ", link);
                resolve(snippet)
            }
        });
    }

    getTextFromHtml(htmlString) {

        //elimino todos los css
        //console.log("htmlString", typeof htmlString)

        htmlString = htmlString.substr(0, htmlString.indexOf("<body"));

        return new Promise(async (resolve, reject) => {

            try {

                /* const { htmlToText } = require('html-to-text');
        
                let content = await htmlToText(htmlString, {
                  wordwrap: 130
                }); */
                let textContent = "";
                const jsdom = require("jsdom");
                const { JSDOM } = jsdom;
                const virtualConsole = new jsdom.VirtualConsole();
                virtualConsole.on("error", () => {
                    // No-op to skip console errors.
                });
                const dom = new JSDOM(htmlString, { virtualConsole });

                textContent = dom.window.document.querySelector("body").textContent;

                resolve(textContent);
                /* let outerHTML = htmlparser2.DomUtils.getOuterHTML(htmlparser2.parseDOM(htmlString));
                resolve(outerHTML) */
            } catch (error) {
                //console.log("error al convertir html to text ", error)
                console.error("error al convertir html to text ")
                resolve(htmlString)
            }
        })

    }
}
