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
import { GenerateFountsLiteService } from './generate-founts-lite.service';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse, AxiosError } from 'axios';
import { Observable, firstValueFrom, catchError } from 'rxjs';
import { api_key, search_engine_id, dummy, jsonDictionary, url_provider_locationscolombia } from '../config.service';
import { MyLogger } from '../LoggerService';
import { Logger, Injectable, StreamableFile, Res } from '@nestjs/common';
import { ConvertToExcelService } from '../services/convert-to-excel/convert-to-excel.service';
import { json2csv } from 'json-2-csv';
import { createReadStream } from 'fs';
import { join } from 'path';
import { DownloadServiceService } from '../services/download-service/download-service.service'
import express, { Request, Response } from "express";
import * as htmlparser2 from "htmlparser2";
import { HelperService } from '../services/helper/helper.service';


@Controller('generate-founts-lite')
export class GenerateFountsLiteController {

    private readonly logger = new Logger(GenerateFountsLiteController.name);

    constructor(
        private readonly generateFountsService: GenerateFountsLiteService,
        private readonly httpService: HttpService,
        private readonly convertToExcelService: ConvertToExcelService,
        private readonly downloadService: DownloadServiceService,
        private readonly helperService: HelperService,

    ) { }

    @UseInterceptors(FileInterceptor('file'))
    @Post()
    async create(
        @Body() createGenerateFountDto: CreateGenerateFountDto,
        @UploadedFile() file: Express.Multer.File,
        @Res({ passthrough: true }) res: Response
    ): Promise<StreamableFile | string> {

        console.log("createGenerateFountDto", createGenerateFountDto, createGenerateFountDto['scraping']);

        return

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


        let query = "",
            cr = createGenerateFountDto['cr'],
            dateRestrict = createGenerateFountDto['dateRestrictType'] + createGenerateFountDto['dateRestrictNum'],
            highRange = createGenerateFountDto['highRange'] ? createGenerateFountDto['highRange'] : null,
            num = createGenerateFountDto['num'] ? JSON.parse(createGenerateFountDto['num']) : 10,
            lowRange = createGenerateFountDto['lowRange'] ? createGenerateFountDto['lowRange'] : null;
        //start = createGenerateFountDto['start'];

        if (createGenerateFountDto['noticia'])
            query += " news ";
        else
            query += " investigation ";

        if (createGenerateFountDto['city'])
            query += " " + createGenerateFountDto['city'];

        let query_params = query;

        let config: any = {
            params: {
                //start: 1,
                //num,
                dateRestrict,//2021-01-01:2021-12-31 dateRestrict
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
        let diccionarios_principal: any = {};
        let diccionarios_ligado: any = {};
        let subcategoria;

        for (let index = 0; index < json.length; index++) {
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
                config.params.q = query_params + " " + element["Palabra clave"];

                //DEFINO LAS BUSQUEDAS
                //validar si esta palabra clave ya fue buscada
                let indexItemCurrent = dataPaginated.findIndex(el => el && el['Palabra clave'] == element["Palabra clave"]);

                console.log("dataPaginated[0]", dataPaginated[index] ? dataPaginated[index]['Palabra clave'] : 'NO');
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
        }

        let contentsAux = [];

        //poner aqui data dummy
        //remover
        /* dataPaginated = dummy.dataPaginated;
        diccionarios_principal = dummy.diccionarios_principal;
        diccionarios_ligado = dummy.diccionarios_ligado; */
        //remover

        //procesar los datos para que podamos mostrar mas contenido extrayendo todo el texto de la web
        // Web Scraping
        //deshabilito el scraping
        if (createGenerateFountDto['scraping'] == true)
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

        //luego validar el content contenga el json y definir
        /* let dataPaginatedCreated: any = await this.generateFountsService.createElementsMath(
            dataPaginated,
            diccionarios_principal,
            diccionarios_ligado
        );
        */
        let dataPaginatedCreated = [];
        console.log("dataPaginated", dataPaginated, dataPaginatedCreated);

        //reaprar recorriendo los searchs
        dataPaginated.forEach(element => {

            var wordkey = element['Palabra clave'];
            var searchs = element['searchs'];

            searchs.forEach(element2 => {

                var row = {
                    wordkey, 
                    searchs: null
                };
                
                let columnArrayValues = Object.values(element2);
                let columnArrayKeys = Object.keys(element2);
                
                row.searchs = element2;

                for (let zzz = 0; zzz < columnArrayKeys.length; zzz++) {
                    var keyItem = columnArrayKeys[zzz];
                    var valueItem = element2[keyItem];

                    console.log("valueItem", valueItem)
                    
                    row["searchs." + keyItem] = valueItem;
                }

                dataPaginatedCreated.push(row);
                
            });

        });

        if (!dataPaginatedCreated?.length || dataPaginatedCreated.length == 0) {
            return "Tal vez se acabaron los creditos";
        }
        //crear el axcel
        var xl = require('excel4node');

        const wb = new xl.Workbook();
        const ws = wb.addWorksheet('Matriz');
        var xml2js = require('xml2js');

        const headingColumnNames: any = Object.keys(dataPaginatedCreated[0])

        let headingColumnIndex = 1;
        headingColumnNames.forEach(heading => {
            ws.cell(1, headingColumnIndex++)
                .string(heading)
        });

        let rowIndex = 2;
        dataPaginatedCreated.forEach(record => {
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
            'Content-Disposition': 'attachment; filename="Matriz de Prensa.xlsx"',
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
        @Res({ passthrough: true }) res: Response,
        @Body() createGenerateFountDto: CreateGenerateFountDto,
        @UploadedFile() file: Express.Multer.File,
    ) /* : Promise<any> */ {

        let dataPaginated: any = [
            {
                "Categoría": "Ctaegoria",
                "Subcategorias": "Fenomeno del niño",
                "Temas": "2. Fenomeno para Colombia",
                "Palabra clave": "Oscilación del sur",
                "Diccionario Principal": "alteración / altera",
                "Diccionario Ligado": "preocupación",
                "field7": "",
                "id_diccionario_principal": "Caracterización fenómeno",
                "id_diccionario_ligado": "Caracterización fenómeno",
                "searchs": [
                    {
                        "kind": "customsearch#result",
                        "title": "Precipitación y Temperatura - IDIGER",
                        "htmlTitle": "Precipitación y Temperatura - IDIGER",
                        "link": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "displayLink": "www.idiger.gov.co",
                        "content": "... oscilacion-del-sur/. 2. Fenómeno de El Niño y La Niña y variabilidad ... Bogotá, disponible en la página web del Sistema de Alerta de Bogotá. Asimismo, en la ...",
                        "htmlSnippet": "... <b>oscilacion-del-sur</b>/. 2. Fenómeno de El Niño y La Niña y variabilidad ... <b>Bogotá</b>, disponible en la página web del Sistema de Alerta de <b>Bogotá</b>. Asimismo, en la&nbsp;...",
                        "formattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "htmlFormattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRPKtxSxmgikPVyiCEGD-o03WYetRTpPl5nAxSez70926LNucnL-duvlIDq",
                                    "width": "315",
                                    "height": "160"
                                }
                            ],
                            "metatags": [
                                {
                                    "twitter:title": "IDIGER",
                                    "twitter:card": "summary_large_image",
                                    "viewport": "initial-scale=1.0, width=device-width",
                                    "twitter:image": "https://www.idiger.gov.co/documents/20182/25478/idiger.jpg"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.idiger.gov.co/documents/20182/1312633/Zona_Convergencia_Intertropical.png/c21db85e-32d3-4581-9619-0ada8fa1424d?t=1647537192625"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Conoce los Trabajos Programados que Enel-Codensa realizará en ...",
                        "htmlTitle": "Conoce los Trabajos Programados que Enel-Codensa realizará en ...",
                        "link": "https://www.enel.com.co/es/prensa/news/d202106-trabajos-programados-bogota-del-6-al-9-de-junio-del-2021.html",
                        "displayLink": "www.enel.com.co",
                        "content": "Jun 4, 2021 ... ... Bogotá, para reducir fallas en el suministro y responder de manera ... Calle 2 sur a Calle 5 sur entre Carrera 17 a Carrera 20. 6:30 a. m ...",
                        "htmlSnippet": "Jun 4, 2021 <b>...</b> ... <b>Bogotá</b>, para reducir fallas en el suministro y responder de manera ... Calle 2 <b>sur</b> a Calle 5 <b>sur</b> entre Carrera 17 a Carrera 20. 6:30 a. m&nbsp;...",
                        "cacheId": "gQV0dX38U08J",
                        "formattedUrl": "https://www.enel.com.co/.../news/d202106-trabajos-programados-bogota-d...",
                        "htmlFormattedUrl": "https://www.enel.com.co/.../<b>news</b>/d202106-trabajos-programados-bogota-<b>d</b>...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRYvytBjYF9ie-yhLMrmgnMrcr47oWHyJuonsbjKkjvUCPM4QaN6fXwiGo",
                                    "width": "341",
                                    "height": "148"
                                }
                            ],
                            "organization": [
                                {
                                    "logo": "https://www.enel.com.co/content/dam/enel-co/im%C3%A1genes-home/Enel_Logo_Secondary_white_RGB.png",
                                    "url": "https://www.enel.com.co/es.html"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://www.enel.com.co/content/dam/enel-co/español/medios/distribución/2018/mayo/imagenes/mantenimientos-bogota-mayo.jpg",
                                    "og:type": "article",
                                    "twitter:card": "summary_large_image",
                                    "twitter:title": "Conoce los Trabajos Programados que Enel-Codensa realizará en Bogotá",
                                    "viewport": "width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1",
                                    "twitter:description": "Enel-Codensa, pensando en la calidad de su servicio, estará realizando trabajos programados.",
                                    "og:title": "Conoce los Trabajos Programados que Enel-Codensa realizará en Bogotá",
                                    "og:locale": "es",
                                    "og:url": "https://enel.com.co/content/enel-co/es/megamenu/prensa/news/2021/06/trabajos-programados-bogota-del-6-al-9-de-junio-del-2021.html",
                                    "og:description": "Enel-Codensa, pensando en la calidad de su servicio, estará realizando trabajos programados.",
                                    "facebook-domain-verification": "ew5qy5dlu4u7rnujedr9snqrrwvud1"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.enel.com.co/content/enel-co/es/megamenu/prensa/news/2021/06/trabajos-programados-bogota-del-6-al-9-de-junio-del-2021/_jcr_content/carousel/items/image.img.jpg/1622841331568.jpg"
                                }
                            ],
                            "listitem": [
                                {
                                    "item": "Home",
                                    "name": "Home",
                                    "position": "1"
                                },
                                {
                                    "item": "Oficina de prensa Enel Colombia",
                                    "name": "Oficina de prensa Enel Colombia",
                                    "position": "2"
                                },
                                {
                                    "item": "news",
                                    "name": "news",
                                    "position": "3"
                                },
                                {
                                    "item": "Enel-Codensa trabaja para mejorar la calidad del servicio en Bogotá - Trabajos del 6 al 9 de junio de 2021",
                                    "name": "Enel-Codensa trabaja para mejorar la calidad del servicio en Bogotá - Trabajos del 6 al 9 de junio de 2021",
                                    "position": "4"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Guatemala - Rapports | ReliefWeb Response",
                        "htmlTitle": "Guatemala - Rapports | ReliefWeb Response",
                        "link": "https://response.reliefweb.int/fr/guatemala/reports?filters%5Bdisaster.name%5D%5B13%5D=hurricane%20eta%20-%20nov%202020&filters%5Bdisaster.name%5D%5B22%5D=Colombia%3A%20Floods%20and%20Landslides%20-%20Nov%202020&filters%5Btheme.name%5D%5B0%5D=Health&filters%5Btheme.name%5D%5B1%5D=Logistics%20and%20Telecommunications&filters%5Bdisaster_type%5D=Flood&filters%5Bdate.changed%5D=2020-12-01%3A2020-12-31&page=757",
                        "displayLink": "response.reliefweb.int",
                        "content": "El fenómeno de El Niño Oscilación Sur es un sistema de interacciones entre ... Bogotá, 20 nov… Format: News and Press Release; Source: Govt. Colombia; Posted ...",
                        "htmlSnippet": "El fenómeno de El Niño <b>Oscilación Sur</b> es un sistema de interacciones entre ... <b>Bogotá</b>, 20 nov… Format: <b>News</b> and Press Release; Source: Govt. <b>Colombia</b>; Posted&nbsp;...",
                        "cacheId": "iwtL9KpRvBgJ",
                        "formattedUrl": "https://response.reliefweb.int/fr/.../reports?...12...",
                        "htmlFormattedUrl": "https://response.reliefweb.int/fr/.../reports?...12...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcTtaZ2_QrGcxs93XJbZx6SsbAMbEOx1y5_uSmArHnLw3o22_59PBTs_oy3d",
                                    "width": "355",
                                    "height": "142"
                                }
                            ],
                            "metatags": [
                                {
                                    "handheldfriendly": "true",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "mobileoptimized": "width"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://response.reliefweb.int/themes/custom/common_design_subtheme/img/logos/response-logo.svg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño ...",
                        "htmlTitle": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño ...",
                        "link": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                        "displayLink": "www.researchgate.net",
                        "content": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia ... News · Careers.",
                        "htmlSnippet": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-<b>Oscilación del Sur</b> y su efecto en el patrón pluviométrico de <b>Colombia</b> ... <b>News</b> &middot; Careers.",
                        "formattedUrl": "https://www.researchgate.net/.../281605886_La_variabilidad_climatica_inte...",
                        "htmlFormattedUrl": "https://www.researchgate.net/.../281605886_La_variabilidad_climatica_inte...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRgj1e4g8u4CIXrmgMqfc6HqqbhonOr9WXa0jAXHgIN0n4BuU_y9ToKcNst",
                                    "width": "197",
                                    "height": "255"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://i1.rgstatic.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/largepreview.png",
                                    "citation_publication_date": "2000/01/01",
                                    "twitter:card": "summary",
                                    "citation_title": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia",
                                    "og:site_name": "ResearchGate",
                                    "twitter:url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "twitter:creator": "@ResearchGate",
                                    "og:description": "PDF | On Jan 1, 2000, J.E. Montealegre and others published La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia | Find, read and cite all the research you need on ResearchGate",
                                    "twitter:site": "@ResearchGate",
                                    "og:site": "ResearchGate",
                                    "citation_fulltext_html_url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "citation_pdf_url": "https://www.researchgate.net/profile/Jose-Daniel-Pabon-Caicedo/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/La-variabilidad-climatica-interanual-asociada-al-ciclo-El-Nino-La-Nina-Oscilacion-del-Sur-y-su-efecto-en-el-patron-pluviometrico-de-Colombia.pdf",
                                    "citation_lastpage": "21",
                                    "application-name": "ResearchGate",
                                    "og:type": "website",
                                    "rg-request-token": "aad-F2OtW0j5GClI3c///3I0R79zuF/rP1nONA8Z4d8YAjnFdhKGfCTodyeKdNTtVJSozZT/YwW+ueMduNkIT+H0aW5Bc5OYNjxhqbpKpiLH7b/hjD9oKiZkjaKTf+Ddu/wdRRizEAIApThidTNX5lRF2r1FB/V3rQq/Jl0FMD1H7M5as2yoFMbn9u1/DJ18YcxGkDRAP+yrQ7P8u/hiCrHjlGZK1k50w06/ntgpWQKyt/mEN3X9J/idgHX8uG4B52Vq3FC5guHu0iSiBknHcto=",
                                    "og:title": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia",
                                    "citation_author": "J.E. Montealegre",
                                    "citation_abstract_html_url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "referrer": "origin",
                                    "citation_firstpage": "7",
                                    "viewport": "width=device-width,initial-scale=1",
                                    "rg:id": "PB:281605886",
                                    "dc.identifier": "http://dx.doi.org/",
                                    "citation_volume": "2",
                                    "og:url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "gs_meta_revision": "1.1"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://i1.rgstatic.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/largepreview.png"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "GICA - Tesis (Thesis)",
                        "htmlTitle": "GICA - Tesis (Thesis)",
                        "link": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                        "displayLink": "sites.google.com",
                        "content": "Sensibilidad de la contaminación fotoquímica en Bogotá a la oscilación del sur El Niño (ENSO). GABRIEL DE JESUS SALDARRIAGA OROZCO, gsaldarriaga64@gmail.com.",
                        "htmlSnippet": "Sensibilidad de la contaminación fotoquímica en <b>Bogotá</b> a la <b>oscilación del sur</b> El Niño (ENSO). GABRIEL DE JESUS SALDARRIAGA OROZCO, gsaldarriaga64@gmail.com.",
                        "cacheId": "aa9jmiUNgcEJ",
                        "formattedUrl": "https://sites.google.com/unal.edu.co/gica/página-principal/tesis-thesis",
                        "htmlFormattedUrl": "https://sites.google.com/unal.edu.co/gica/página-principal/tesis-thesis",
                        "pagemap": {
                            "metatags": [
                                {
                                    "referrer": "strict-origin-when-cross-origin",
                                    "og:image": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "og:type": "website",
                                    "viewport": "width=device-width, initial-scale=1",
                                    "og:title": "GICA - Tesis (Thesis)",
                                    "og:url": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                                    "og:description": "Tesis de doctorado (Ph.D. Thesis)"
                                }
                            ],
                            "webpage": [
                                {
                                    "image": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "imageurl": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "name": "GICA - Tesis (Thesis)",
                                    "description": "Tesis de doctorado (Ph.D. Thesis)",
                                    "url": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                                    "thumbnailurl": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "La Niña está de regreso: qué es y qué significa para el clima en ...",
                        "htmlTitle": "La Niña está de regreso: qué es y qué significa para el clima en ...",
                        "link": "https://www.bbc.com/mundo/noticias-58904461",
                        "displayLink": "www.bbc.com",
                        "content": "Oct 18, 2021 ... ... Oscilación del Sur. El Niño es un patrón climático que causa un ... Ahora puedes recibir notificaciones de BBC News Mundo. Descarga la nueva ...",
                        "htmlSnippet": "Oct 18, 2021 <b>...</b> ... <b>Oscilación del Sur</b>. El Niño es un patrón climático que causa un ... Ahora puedes recibir notificaciones de BBC <b>News</b> Mundo. Descarga la nueva&nbsp;...",
                        "cacheId": "d53OxV2XvZkJ",
                        "formattedUrl": "https://www.bbc.com/mundo/noticias-58904461",
                        "htmlFormattedUrl": "https://www.bbc.com/mundo/noticias-58904461",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSedVbg-6a-rnfKqjQRownAjdkrkGr29E6l4CTwDy-DLkae1lxtQiIB3O7f",
                                    "width": "300",
                                    "height": "168"
                                }
                            ],
                            "metatags": [
                                {
                                    "apple-itunes-app": "app-id=515255747, app-argument=https://www.bbc.com/mundo/noticias-58904461?utm_medium=banner&utm_content=apple-itunes-app",
                                    "og:image": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg",
                                    "theme-color": "#B80000",
                                    "twitter:card": "summary_large_image",
                                    "article:published_time": "2021-10-18T10:45:53.000Z",
                                    "og:site_name": "BBC News Mundo",
                                    "apple-mobile-web-app-title": "BBC News Mundo",
                                    "msapplication-tileimage": "https://static.files.bbci.co.uk/ws/simorgh-assets/public/mundo/images/icons/icon-144x144.png",
                                    "og:description": "El fenómeno climático responsable de crudos inviernos y grandes sequías en todo el mundo ha llegado nuevamente y sus efectos se sentirán por varios meses.",
                                    "twitter:creator": "@bbcmundo",
                                    "twitter:image:alt": "la niña",
                                    "twitter:site": "@bbcmundo",
                                    "article:modified_time": "2021-10-18T10:45:53.000Z",
                                    "application-name": "BBC News Mundo",
                                    "msapplication-tilecolor": "#B80000",
                                    "og:image:alt": "la niña",
                                    "og:type": "article",
                                    "twitter:title": "La Niña está de regreso: qué es y qué significa para el clima en América Latina - BBC News Mundo",
                                    "og:title": "La Niña está de regreso: qué es y qué significa para el clima en América Latina - BBC News Mundo",
                                    "article:author": "https://www.facebook.com/bbcnews",
                                    "twitter:image:src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg",
                                    "article:tag": "Ciencia",
                                    "fb:app_id": "1609039196070050",
                                    "viewport": "width=device-width, initial-scale=1, minimum-scale=1",
                                    "twitter:description": "El fenómeno climático responsable de crudos inviernos y grandes sequías en todo el mundo ha llegado nuevamente y sus efectos se sentirán por varios meses.",
                                    "mobile-web-app-capable": "yes",
                                    "og:locale": "es-005",
                                    "og:url": "https://www.bbc.com/mundo/noticias-58904461"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD ...",
                        "htmlTitle": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD ...",
                        "link": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "displayLink": "www.researchgate.net",
                        "content": "... Bogotá, Colombia. This paper reports the final analysis of data. There were ... Oscilación del Sur. Conference Paper. Nov 2006.",
                        "htmlSnippet": "... <b>Bogotá</b>, <b>Colombia</b>. This paper reports the final analysis of data. There were ... <b>Oscilación del Sur</b>. Conference Paper. Nov 2006.",
                        "formattedUrl": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "htmlFormattedUrl": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "pagemap": {
                            "hcard": [
                                {
                                    "fn": "Daniel Hernandez-Deckers",
                                    "title": "PhD"
                                }
                            ],
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQr4JNJBhfA1_yrtJ-fivjydjHOu3sloZjDz99HqVXGHHGxF41MsB8JFe83",
                                    "width": "225",
                                    "height": "225"
                                }
                            ],
                            "person": [
                                {
                                    "role": "PhD",
                                    "org": "National University of Colombia"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Maxime Colin"
                                },
                                {
                                    "name": "Frank Robinson"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Rani M. Wiggins"
                                },
                                {
                                    "name": "Ben Lintner"
                                },
                                {
                                    "name": "Yolande Serra"
                                },
                                {
                                    "name": "Giuseppe Torri"
                                },
                                {
                                    "name": "Alejandro Casallas García"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Hector Mora-Paez"
                                },
                                {
                                    "name": "Jose A Perez"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Andres Ochoa"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Maria Clara Zuluaga"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Toshihisa Matsui"
                                },
                                {
                                    "name": "Ann M. Fridlind"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Toshihisa Matsui"
                                },
                                {
                                    "name": "Ann M. Fridlind"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Andres Ochoa"
                                },
                                {
                                    "name": "Cristian Garzon"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "S. Sherwood"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Steven C. Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "S. C. Sherwood"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "David Fuchs"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Carsten Eden"
                                },
                                {
                                    "name": "Irina Fast"
                                },
                                {
                                    "name": "Detlef Stammer"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Maxime Colin"
                                },
                                {
                                    "name": "Frank Robinson"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Héctor A Múnera"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "George Arenas"
                                },
                                {
                                    "name": "Iván López"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Igor Málikov"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Eric Alfaro"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Arnoldo Bezanilla"
                                },
                                {
                                    "name": "Héctor A Múnera"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "George Arenas"
                                },
                                {
                                    "name": "Edgar Alfonso"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                }
                            ],
                            "metatags": [
                                {
                                    "application-name": "ResearchGate",
                                    "og:image": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg",
                                    "twitter:card": "summary",
                                    "twitter:title": "Daniel Hernandez-Deckers",
                                    "og:type": "profile",
                                    "og:site_name": "ResearchGate",
                                    "rg-request-token": "aad-MQVQF4pjx5JXvtHeA0UkX5gdNFiDhCSB7CbdBgHGN4Ssfs34XHnbNeaqVBfRE39AR2gkFGFOg6Utgj59W0pkXfXU/ikhTqirnYMTl0UKYhlvAGVDbP73cavjBKRKaxAtx8v9Vj+/16SE2U5GognvGYphVMqIB5Y+kvYjA90+/hLDcuvIlW7Ck3jfyPiZunuIfPXP87/8ivww8/l0K1csChq2Zeh56kJ2LQ+ZNTYEm5eZohopaOW1q9yL4YNdoEL375DFIvAHwXCr+oETuCw=",
                                    "twitter:url": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                                    "profile:username": "Daniel-Hernandez-Deckers",
                                    "og:title": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD | National University of Colombia, Bogotá | UNAL | Research profile",
                                    "twitter:creator": "@ResearchGate",
                                    "og:description": "Atmospheric Science",
                                    "twitter:image": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg",
                                    "referrer": "origin",
                                    "profile:last_name": "Hernandez-Deckers",
                                    "twitter:site": "@ResearchGate",
                                    "viewport": "width=device-width,initial-scale=1",
                                    "rg:id": "AC:4787022",
                                    "og:site": "ResearchGate",
                                    "profile:gender": "unknown",
                                    "profile:first_name": "Daniel",
                                    "og:url": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg"
                                }
                            ],
                            "scholarlyarticle": [
                                {
                                    "headline": "Energetics Responses to Increases in Greenhouse Gas Concentration"
                                },
                                {
                                    "headline": "The energetics response to a warmer climate: Relative contributions from the transient and stationary eddies"
                                },
                                {
                                    "headline": "Impact of the Warming Pattern on Global Energetics"
                                },
                                {
                                    "headline": "Slippery Thermals and the Cumulus Entrainment Paradox*"
                                },
                                {
                                    "headline": "On the Role of Entrainment in the Fate of Cumulus Thermals"
                                },
                                {
                                    "headline": "Tropical Easterly Waves Over Costa Rica and Their Relationship to the Diurnal Cycle of Rainfall"
                                },
                                {
                                    "headline": "Understanding convective storms in a tropical, high-altitude location with in-situ meteorological observations and GPS-derived water vapor"
                                },
                                {
                                    "headline": "IMPLEMENTACIÓN DE UN MODELO CLIMÁTICO PARA INTERPRETAR POSIBLES CAMBIOS ESTACIONALES EN LA TATACOA, COLOMBIA, DURANTE EL MIOCENO MEDIO"
                                },
                                {
                                    "headline": "Efecto cantidad en la composición del agua meteórica en Barranquilla, Bogotá, El Tesoro y Tulenapa (Colombia)"
                                },
                                {
                                    "headline": "Updraft dynamics and microphysics: on the added value of the cumulus thermal reference frame in simulations of aerosol–deep convection interactions"
                                },
                                {
                                    "headline": "Features of atmospheric deep convection in Northwestern South America obtained from infrared satellite data"
                                },
                                {
                                    "headline": "Updraft dynamics and microphysics: on the added value of the cumulus thermal reference frame in simulations of aerosol-deep convection interactions"
                                },
                                {
                                    "headline": "Composición del agua meteórica de los paleosuelos del desierto de La Tatacoa: implicaciones en el ciclo hidrológico durante el serravaliense"
                                },
                                {
                                    "headline": "The mixing role of cumulus thermals"
                                },
                                {
                                    "headline": "A Numerical Investigation of Cumulus Thermals"
                                },
                                {
                                    "headline": "Cumulus thermals throughout different convective regimes: sticky or slippery?"
                                },
                                {
                                    "headline": "An Exploration of Multivariate Fluctuation Dissipation Operators and Their Response to Sea Surface Temperature Perturbations"
                                },
                                {
                                    "headline": "An estimate of the Lorenz energy cycle for the World Ocean based on the 1/10°STORM/NCEP simulation"
                                },
                                {
                                    "headline": "Do growing cumulus experience friction?"
                                },
                                {
                                    "headline": "The energetics response to a warmer climate: relative contributions from the transient and stationary eddies"
                                },
                                {
                                    "headline": "Warming up the atmosphere’s heat engine: atmospheric energetics with higher greenhouse gas concentrations"
                                },
                                {
                                    "headline": "Energetics responses to different atmospheric warming patterns"
                                },
                                {
                                    "headline": "Energetics of a warmer climate: eddy kinetic energy responses to different warming patterns"
                                },
                                {
                                    "headline": "Energetics responses to higher greenhouse gas concentrations, and the role of the warming pattern"
                                },
                                {
                                    "headline": "Observation of a Non-conventional Influence of Earth's Motion on the Velocity of Photons, and Calculation of the Velocity of Our Galaxy"
                                },
                                {
                                    "headline": "Presencia del fenómeno El Niño en algunas variables hidrometeorológicas del Pacífico Colombiano"
                                },
                                {
                                    "headline": "Uso de un modelo de aguas someras para analizar la influencia del Atlántico Tropical Norte y del Pacífico Ecuatorial del Este sobre la circulación atmosférica en los mares Intra-Americanos"
                                },
                                {
                                    "headline": "Observation of a significant influence of earth's motion on the velocity of photons in our terrestrial laboratory - art. no. 66640K"
                                },
                                {
                                    "headline": "Predictores de la variabilidad de las anomalías de la temperatura superficial del mar de la Cuenca del Pacífico Colombiano"
                                },
                                {
                                    "headline": "Respuestas de la temperatura superficial del mar y la temperatura del aire de la Cuenca del Pacífico Colombiano ante El Niño Oscilación del Sur"
                                },
                                {
                                    "headline": "Relaciones espacio-temporales entre la temperatura superficial del mar de la Cuenca del Pacífico Colombiano y el ciclo El Niño Oscilación del Sur"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                        "htmlTitle": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                        "link": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "displayLink": "issuu.com",
                        "content": "... Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia. Universidad Nacional: Revista Meteorología Colombiana 2: pag 7-21 Bogotá. Montealegre ...",
                        "htmlSnippet": "... <b>Oscilación del Sur</b> y su efecto en el patrón pluviométrico de <b>Colombia</b>. Universidad Nacional: Revista Meteorología Colombiana 2: pag 7-21 <b>Bogotá</b>. Montealegre&nbsp;...",
                        "cacheId": "RQ9bxrlGWXkJ",
                        "formattedUrl": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "htmlFormattedUrl": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcS1L9bOtXiJ3Hn6iT4-QjsJ3vo-S5Lz-91kdGf9uP7FNLL8l9SYMBO_Ud6C",
                                    "width": "351",
                                    "height": "144"
                                }
                            ],
                            "imageobject": [
                                {
                                    "width": "160px",
                                    "url": "https://photo.isu.pub/unigis_latina/photo_large.jpg",
                                    "height": "160px"
                                }
                            ],
                            "organization": [
                                {
                                    "name": "UNIGIS América Latina"
                                }
                            ],
                            "metatags": [
                                {
                                    "application-name": "issuu",
                                    "msapplication-tilecolor": "#f26f61",
                                    "og:image": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "twitter:card": "summary",
                                    "twitter:title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                                    "og:type": "article",
                                    "msapplication-square70x70logo": "//issuu.com/microsoft-70x70.png",
                                    "og:site_name": "issuu",
                                    "og:title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                                    "og:image:type": "image/jpeg",
                                    "og:description": "Alfaro E, y Soley F. (2008) Descripción de dos métodos de rellenado de datos ausentes en series de tiempo meteorológicas. Revista de Matemática: Teoría y Aplicaciones. p 72",
                                    "msapplication-square150x150logo": "//issuu.com/microsoft-150x150.png",
                                    "twitter:image": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "og:image:secure_url": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "twitter:site": "@issuu",
                                    "viewport": "width=device-width",
                                    "twitter:description": "Alfaro E, y Soley F. (2008) Descripción de dos métodos de rellenado de datos ausentes en series de tiempo meteorológicas. Revista de Matemática: Teoría y Aplicaciones. p 72",
                                    "og:url": "https://issuu.com/unigis_latina/docs/102639/s/14459283"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://static.isu.pub/fe/default-story-images/news.jpg"
                                }
                            ],
                            "article": [
                                {
                                    "image": "5 minute read7. REFERENCIAS BIBLIOGRÁFICAS",
                                    "author": "from 102639by UNIGIS América Latina",
                                    "headline": "7. REFERENCIAS BIBLIOGRÁFICAS",
                                    "datepublished": "2022-01-04T20:16:27.000Z",
                                    "mainentityofpage": "http://schema.org/Article"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Índices Locales del Ciclo El Niño Oscilación del Sur para las ...",
                        "htmlTitle": "Índices Locales del Ciclo El Niño <b>Oscilación del Sur</b> para las ...",
                        "link": "https://repositorio.unal.edu.co/bitstream/handle/unal/79362/1018421469.2021.pdf?sequence=1&isAllowed=y",
                        "displayLink": "repositorio.unal.edu.co",
                        "content": "Se definieron índices locales del ciclo de El Niño Oscilación del Sur (ENOS) en las regiones naturales de Colombia. Se utilizaron datos de temperatura del ...",
                        "htmlSnippet": "Se definieron índices locales del ciclo de El Niño <b>Oscilación del Sur</b> (ENOS) en las regiones naturales de <b>Colombia</b>. Se utilizaron datos de temperatura del&nbsp;...",
                        "formattedUrl": "https://repositorio.unal.edu.co/bitstream/.../1018421469.2021.pdf?...1...y",
                        "htmlFormattedUrl": "https://repositorio.unal.edu.co/bitstream/.../1018421469.2021.pdf?...1...y",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0xN7v9guNv-dOsS3WIN4ugaL8BDspNslsgkYLgzbXsSeJOSd2UZVBG0I",
                                    "width": "212",
                                    "height": "238"
                                }
                            ],
                            "metatags": [
                                {
                                    "moddate": "D:20210315154923-05'00'",
                                    "creator": "Microsoft® Word para Microsoft 365",
                                    "creationdate": "D:20210315154923-05'00'",
                                    "author": "Universidad Nacional de Colombia",
                                    "producer": "Microsoft® Word para Microsoft 365"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "x-raw-image:///b63d3e01a863f69877636a0ec0556cc7b08ee708e1b1047ae9ccf7aec02acd04"
                                }
                            ]
                        },
                        "mime": "application/pdf",
                        "fileFormat": "PDF/Adobe Acrobat"
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "El Niño is here! What is it, and what can we do? | Alliance Bioversity ...",
                        "htmlTitle": "El Niño is here! What is it, and what can we do? | Alliance Bioversity ...",
                        "link": "https://alliancebioversityciat.org/stories/el-nino-here-what-it-and-what-can-we-do",
                        "displayLink": "alliancebioversityciat.org",
                        "content": "Aug 4, 2023 ... There has long been expectation of the arrival of El Niño, occupying news ... Available at: https://ciifen.org/el-nino-oscilacion-del-sur/ ( ...",
                        "htmlSnippet": "Aug 4, 2023 <b>...</b> There has long been expectation of the arrival of El Niño, occupying <b>news</b> ... Available at: https://ciifen.org/el-nino-<b>oscilacion-del-sur</b>/ (&nbsp;...",
                        "cacheId": "GZ6vPqsCpaMJ",
                        "formattedUrl": "https://alliancebioversityciat.org/.../el-nino-here-what-it-and-what-can-we-d...",
                        "htmlFormattedUrl": "https://alliancebioversityciat.org/.../el-nino-here-what-it-and-what-can-we-d...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRVlp3-S4cuGKWLqTKLy-oO8LQRK5XAcFPMvPi5M6iR4P_XOmdh_CwTcqT6",
                                    "width": "275",
                                    "height": "183"
                                }
                            ],
                            "Article": [
                                {
                                    "name": " El Niño is here! What is it, and what can we do?"
                                }
                            ],
                            "metatags": [
                                {
                                    "msapplication-tilecolor": "#ffffff",
                                    "og:image": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd",
                                    "twitter:card": "summary_large_image",
                                    "twitter:title": "El Niño is here! What is it, and what can we do?",
                                    "theme-color": "#ffffff",
                                    "og:site_name": "Alliance Bioversity International - CIAT",
                                    "handheldfriendly": "true",
                                    "og:title": "El Niño is here! What is it, and what can we do?",
                                    "og:description": "On July 4th 2023, the World Meteorological Organization - WMO, a technical agency of the United Nations - announced that conditions are in place for the El Niño phenomenon [1]. There has long been expectation of the arrival of El Niño, occupying news headlines and generating a sense of uncertainty due to images of its potentially devastating effects.",
                                    "twitter:image": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd",
                                    "twitter:site": "@BiovIntCIAT_eng",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "twitter:description": "On July 4th 2023, the World Meteorological Organization - WMO, a technical agency of the United Nations - announced that conditions are in place for the El Niño phenomenon [1]. There has long been expectation of the arrival of El Niño, occupying news headlines and generating a sense of uncertainty due to images of its potentially devastating effects.",
                                    "mobileoptimized": "width",
                                    "og:url": "https://alliancebioversityciat.org/stories/el-nino-here-what-it-and-what-can-we-do"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd"
                                }
                            ]
                        }
                    }
                ]
            },
            {
                "Categoría": "",
                "Subcategorias": "",
                "Temas": "2. Fenomeno para Colombia",
                "Palabra clave": "Oscilación del sur",
                "Diccionario Principal": "alteración / altera",
                "Diccionario Ligado": "preocupación",
                "field7": "",
                "id_diccionario_principal": "Caracterización fenómeno",
                "id_diccionario_ligado": "Caracterización fenómeno",
                "searchs": [
                    {
                        "kind": "customsearch#result",
                        "title": "Precipitación y Temperatura - IDIGER",
                        "htmlTitle": "Precipitación y Temperatura - IDIGER",
                        "link": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "displayLink": "www.idiger.gov.co",
                        "content": "... oscilacion-del-sur/. 2. Fenómeno de El Niño y La Niña y variabilidad ... Bogotá, disponible en la página web del Sistema de Alerta de Bogotá. Asimismo, en la ...",
                        "htmlSnippet": "... <b>oscilacion-del-sur</b>/. 2. Fenómeno de El Niño y La Niña y variabilidad ... <b>Bogotá</b>, disponible en la página web del Sistema de Alerta de <b>Bogotá</b>. Asimismo, en la&nbsp;...",
                        "formattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "htmlFormattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRPKtxSxmgikPVyiCEGD-o03WYetRTpPl5nAxSez70926LNucnL-duvlIDq",
                                    "width": "315",
                                    "height": "160"
                                }
                            ],
                            "metatags": [
                                {
                                    "twitter:title": "IDIGER",
                                    "twitter:card": "summary_large_image",
                                    "viewport": "initial-scale=1.0, width=device-width",
                                    "twitter:image": "https://www.idiger.gov.co/documents/20182/25478/idiger.jpg"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.idiger.gov.co/documents/20182/1312633/Zona_Convergencia_Intertropical.png/c21db85e-32d3-4581-9619-0ada8fa1424d?t=1647537192625"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Conoce los Trabajos Programados que Enel-Codensa realizará en ...",
                        "htmlTitle": "Conoce los Trabajos Programados que Enel-Codensa realizará en ...",
                        "link": "https://www.enel.com.co/es/prensa/news/d202106-trabajos-programados-bogota-del-6-al-9-de-junio-del-2021.html",
                        "displayLink": "www.enel.com.co",
                        "content": "Jun 4, 2021 ... ... Bogotá, para reducir fallas en el suministro y responder de manera ... Calle 2 sur a Calle 5 sur entre Carrera 17 a Carrera 20. 6:30 a. m ...",
                        "htmlSnippet": "Jun 4, 2021 <b>...</b> ... <b>Bogotá</b>, para reducir fallas en el suministro y responder de manera ... Calle 2 <b>sur</b> a Calle 5 <b>sur</b> entre Carrera 17 a Carrera 20. 6:30 a. m&nbsp;...",
                        "cacheId": "gQV0dX38U08J",
                        "formattedUrl": "https://www.enel.com.co/.../news/d202106-trabajos-programados-bogota-d...",
                        "htmlFormattedUrl": "https://www.enel.com.co/.../<b>news</b>/d202106-trabajos-programados-bogota-<b>d</b>...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRYvytBjYF9ie-yhLMrmgnMrcr47oWHyJuonsbjKkjvUCPM4QaN6fXwiGo",
                                    "width": "341",
                                    "height": "148"
                                }
                            ],
                            "organization": [
                                {
                                    "logo": "https://www.enel.com.co/content/dam/enel-co/im%C3%A1genes-home/Enel_Logo_Secondary_white_RGB.png",
                                    "url": "https://www.enel.com.co/es.html"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://www.enel.com.co/content/dam/enel-co/español/medios/distribución/2018/mayo/imagenes/mantenimientos-bogota-mayo.jpg",
                                    "og:type": "article",
                                    "twitter:card": "summary_large_image",
                                    "twitter:title": "Conoce los Trabajos Programados que Enel-Codensa realizará en Bogotá",
                                    "viewport": "width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1",
                                    "twitter:description": "Enel-Codensa, pensando en la calidad de su servicio, estará realizando trabajos programados.",
                                    "og:title": "Conoce los Trabajos Programados que Enel-Codensa realizará en Bogotá",
                                    "og:locale": "es",
                                    "og:url": "https://enel.com.co/content/enel-co/es/megamenu/prensa/news/2021/06/trabajos-programados-bogota-del-6-al-9-de-junio-del-2021.html",
                                    "og:description": "Enel-Codensa, pensando en la calidad de su servicio, estará realizando trabajos programados.",
                                    "facebook-domain-verification": "ew5qy5dlu4u7rnujedr9snqrrwvud1"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.enel.com.co/content/enel-co/es/megamenu/prensa/news/2021/06/trabajos-programados-bogota-del-6-al-9-de-junio-del-2021/_jcr_content/carousel/items/image.img.jpg/1622841331568.jpg"
                                }
                            ],
                            "listitem": [
                                {
                                    "item": "Home",
                                    "name": "Home",
                                    "position": "1"
                                },
                                {
                                    "item": "Oficina de prensa Enel Colombia",
                                    "name": "Oficina de prensa Enel Colombia",
                                    "position": "2"
                                },
                                {
                                    "item": "news",
                                    "name": "news",
                                    "position": "3"
                                },
                                {
                                    "item": "Enel-Codensa trabaja para mejorar la calidad del servicio en Bogotá - Trabajos del 6 al 9 de junio de 2021",
                                    "name": "Enel-Codensa trabaja para mejorar la calidad del servicio en Bogotá - Trabajos del 6 al 9 de junio de 2021",
                                    "position": "4"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Guatemala - Rapports | ReliefWeb Response",
                        "htmlTitle": "Guatemala - Rapports | ReliefWeb Response",
                        "link": "https://response.reliefweb.int/fr/guatemala/reports?filters%5Bdisaster.name%5D%5B13%5D=hurricane%20eta%20-%20nov%202020&filters%5Bdisaster.name%5D%5B22%5D=Colombia%3A%20Floods%20and%20Landslides%20-%20Nov%202020&filters%5Btheme.name%5D%5B0%5D=Health&filters%5Btheme.name%5D%5B1%5D=Logistics%20and%20Telecommunications&filters%5Bdisaster_type%5D=Flood&filters%5Bdate.changed%5D=2020-12-01%3A2020-12-31&page=757",
                        "displayLink": "response.reliefweb.int",
                        "content": "El fenómeno de El Niño Oscilación Sur es un sistema de interacciones entre ... Bogotá, 20 nov… Format: News and Press Release; Source: Govt. Colombia; Posted ...",
                        "htmlSnippet": "El fenómeno de El Niño <b>Oscilación Sur</b> es un sistema de interacciones entre ... <b>Bogotá</b>, 20 nov… Format: <b>News</b> and Press Release; Source: Govt. <b>Colombia</b>; Posted&nbsp;...",
                        "cacheId": "iwtL9KpRvBgJ",
                        "formattedUrl": "https://response.reliefweb.int/fr/.../reports?...12...",
                        "htmlFormattedUrl": "https://response.reliefweb.int/fr/.../reports?...12...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcTtaZ2_QrGcxs93XJbZx6SsbAMbEOx1y5_uSmArHnLw3o22_59PBTs_oy3d",
                                    "width": "355",
                                    "height": "142"
                                }
                            ],
                            "metatags": [
                                {
                                    "handheldfriendly": "true",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "mobileoptimized": "width"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://response.reliefweb.int/themes/custom/common_design_subtheme/img/logos/response-logo.svg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño ...",
                        "htmlTitle": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño ...",
                        "link": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                        "displayLink": "www.researchgate.net",
                        "content": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia ... News · Careers.",
                        "htmlSnippet": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-<b>Oscilación del Sur</b> y su efecto en el patrón pluviométrico de <b>Colombia</b> ... <b>News</b> &middot; Careers.",
                        "formattedUrl": "https://www.researchgate.net/.../281605886_La_variabilidad_climatica_inte...",
                        "htmlFormattedUrl": "https://www.researchgate.net/.../281605886_La_variabilidad_climatica_inte...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRgj1e4g8u4CIXrmgMqfc6HqqbhonOr9WXa0jAXHgIN0n4BuU_y9ToKcNst",
                                    "width": "197",
                                    "height": "255"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://i1.rgstatic.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/largepreview.png",
                                    "citation_publication_date": "2000/01/01",
                                    "twitter:card": "summary",
                                    "citation_title": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia",
                                    "og:site_name": "ResearchGate",
                                    "twitter:url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "twitter:creator": "@ResearchGate",
                                    "og:description": "PDF | On Jan 1, 2000, J.E. Montealegre and others published La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia | Find, read and cite all the research you need on ResearchGate",
                                    "twitter:site": "@ResearchGate",
                                    "og:site": "ResearchGate",
                                    "citation_fulltext_html_url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "citation_pdf_url": "https://www.researchgate.net/profile/Jose-Daniel-Pabon-Caicedo/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/La-variabilidad-climatica-interanual-asociada-al-ciclo-El-Nino-La-Nina-Oscilacion-del-Sur-y-su-efecto-en-el-patron-pluviometrico-de-Colombia.pdf",
                                    "citation_lastpage": "21",
                                    "application-name": "ResearchGate",
                                    "og:type": "website",
                                    "rg-request-token": "aad-F2OtW0j5GClI3c///3I0R79zuF/rP1nONA8Z4d8YAjnFdhKGfCTodyeKdNTtVJSozZT/YwW+ueMduNkIT+H0aW5Bc5OYNjxhqbpKpiLH7b/hjD9oKiZkjaKTf+Ddu/wdRRizEAIApThidTNX5lRF2r1FB/V3rQq/Jl0FMD1H7M5as2yoFMbn9u1/DJ18YcxGkDRAP+yrQ7P8u/hiCrHjlGZK1k50w06/ntgpWQKyt/mEN3X9J/idgHX8uG4B52Vq3FC5guHu0iSiBknHcto=",
                                    "og:title": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia",
                                    "citation_author": "J.E. Montealegre",
                                    "citation_abstract_html_url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "referrer": "origin",
                                    "citation_firstpage": "7",
                                    "viewport": "width=device-width,initial-scale=1",
                                    "rg:id": "PB:281605886",
                                    "dc.identifier": "http://dx.doi.org/",
                                    "citation_volume": "2",
                                    "og:url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "gs_meta_revision": "1.1"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://i1.rgstatic.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/largepreview.png"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "GICA - Tesis (Thesis)",
                        "htmlTitle": "GICA - Tesis (Thesis)",
                        "link": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                        "displayLink": "sites.google.com",
                        "content": "Sensibilidad de la contaminación fotoquímica en Bogotá a la oscilación del sur El Niño (ENSO). GABRIEL DE JESUS SALDARRIAGA OROZCO, gsaldarriaga64@gmail.com.",
                        "htmlSnippet": "Sensibilidad de la contaminación fotoquímica en <b>Bogotá</b> a la <b>oscilación del sur</b> El Niño (ENSO). GABRIEL DE JESUS SALDARRIAGA OROZCO, gsaldarriaga64@gmail.com.",
                        "cacheId": "aa9jmiUNgcEJ",
                        "formattedUrl": "https://sites.google.com/unal.edu.co/gica/página-principal/tesis-thesis",
                        "htmlFormattedUrl": "https://sites.google.com/unal.edu.co/gica/página-principal/tesis-thesis",
                        "pagemap": {
                            "metatags": [
                                {
                                    "referrer": "strict-origin-when-cross-origin",
                                    "og:image": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "og:type": "website",
                                    "viewport": "width=device-width, initial-scale=1",
                                    "og:title": "GICA - Tesis (Thesis)",
                                    "og:url": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                                    "og:description": "Tesis de doctorado (Ph.D. Thesis)"
                                }
                            ],
                            "webpage": [
                                {
                                    "image": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "imageurl": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "name": "GICA - Tesis (Thesis)",
                                    "description": "Tesis de doctorado (Ph.D. Thesis)",
                                    "url": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                                    "thumbnailurl": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "La Niña está de regreso: qué es y qué significa para el clima en ...",
                        "htmlTitle": "La Niña está de regreso: qué es y qué significa para el clima en ...",
                        "link": "https://www.bbc.com/mundo/noticias-58904461",
                        "displayLink": "www.bbc.com",
                        "content": "Oct 18, 2021 ... ... Oscilación del Sur. El Niño es un patrón climático que causa un ... Ahora puedes recibir notificaciones de BBC News Mundo. Descarga la nueva ...",
                        "htmlSnippet": "Oct 18, 2021 <b>...</b> ... <b>Oscilación del Sur</b>. El Niño es un patrón climático que causa un ... Ahora puedes recibir notificaciones de BBC <b>News</b> Mundo. Descarga la nueva&nbsp;...",
                        "cacheId": "d53OxV2XvZkJ",
                        "formattedUrl": "https://www.bbc.com/mundo/noticias-58904461",
                        "htmlFormattedUrl": "https://www.bbc.com/mundo/noticias-58904461",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSedVbg-6a-rnfKqjQRownAjdkrkGr29E6l4CTwDy-DLkae1lxtQiIB3O7f",
                                    "width": "300",
                                    "height": "168"
                                }
                            ],
                            "metatags": [
                                {
                                    "apple-itunes-app": "app-id=515255747, app-argument=https://www.bbc.com/mundo/noticias-58904461?utm_medium=banner&utm_content=apple-itunes-app",
                                    "og:image": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg",
                                    "theme-color": "#B80000",
                                    "twitter:card": "summary_large_image",
                                    "article:published_time": "2021-10-18T10:45:53.000Z",
                                    "og:site_name": "BBC News Mundo",
                                    "apple-mobile-web-app-title": "BBC News Mundo",
                                    "msapplication-tileimage": "https://static.files.bbci.co.uk/ws/simorgh-assets/public/mundo/images/icons/icon-144x144.png",
                                    "og:description": "El fenómeno climático responsable de crudos inviernos y grandes sequías en todo el mundo ha llegado nuevamente y sus efectos se sentirán por varios meses.",
                                    "twitter:creator": "@bbcmundo",
                                    "twitter:image:alt": "la niña",
                                    "twitter:site": "@bbcmundo",
                                    "article:modified_time": "2021-10-18T10:45:53.000Z",
                                    "application-name": "BBC News Mundo",
                                    "msapplication-tilecolor": "#B80000",
                                    "og:image:alt": "la niña",
                                    "og:type": "article",
                                    "twitter:title": "La Niña está de regreso: qué es y qué significa para el clima en América Latina - BBC News Mundo",
                                    "og:title": "La Niña está de regreso: qué es y qué significa para el clima en América Latina - BBC News Mundo",
                                    "article:author": "https://www.facebook.com/bbcnews",
                                    "twitter:image:src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg",
                                    "article:tag": "Ciencia",
                                    "fb:app_id": "1609039196070050",
                                    "viewport": "width=device-width, initial-scale=1, minimum-scale=1",
                                    "twitter:description": "El fenómeno climático responsable de crudos inviernos y grandes sequías en todo el mundo ha llegado nuevamente y sus efectos se sentirán por varios meses.",
                                    "mobile-web-app-capable": "yes",
                                    "og:locale": "es-005",
                                    "og:url": "https://www.bbc.com/mundo/noticias-58904461"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD ...",
                        "htmlTitle": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD ...",
                        "link": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "displayLink": "www.researchgate.net",
                        "content": "... Bogotá, Colombia. This paper reports the final analysis of data. There were ... Oscilación del Sur. Conference Paper. Nov 2006.",
                        "htmlSnippet": "... <b>Bogotá</b>, <b>Colombia</b>. This paper reports the final analysis of data. There were ... <b>Oscilación del Sur</b>. Conference Paper. Nov 2006.",
                        "formattedUrl": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "htmlFormattedUrl": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "pagemap": {
                            "hcard": [
                                {
                                    "fn": "Daniel Hernandez-Deckers",
                                    "title": "PhD"
                                }
                            ],
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQr4JNJBhfA1_yrtJ-fivjydjHOu3sloZjDz99HqVXGHHGxF41MsB8JFe83",
                                    "width": "225",
                                    "height": "225"
                                }
                            ],
                            "person": [
                                {
                                    "role": "PhD",
                                    "org": "National University of Colombia"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Maxime Colin"
                                },
                                {
                                    "name": "Frank Robinson"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Rani M. Wiggins"
                                },
                                {
                                    "name": "Ben Lintner"
                                },
                                {
                                    "name": "Yolande Serra"
                                },
                                {
                                    "name": "Giuseppe Torri"
                                },
                                {
                                    "name": "Alejandro Casallas García"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Hector Mora-Paez"
                                },
                                {
                                    "name": "Jose A Perez"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Andres Ochoa"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Maria Clara Zuluaga"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Toshihisa Matsui"
                                },
                                {
                                    "name": "Ann M. Fridlind"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Toshihisa Matsui"
                                },
                                {
                                    "name": "Ann M. Fridlind"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Andres Ochoa"
                                },
                                {
                                    "name": "Cristian Garzon"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "S. Sherwood"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Steven C. Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "S. C. Sherwood"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "David Fuchs"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Carsten Eden"
                                },
                                {
                                    "name": "Irina Fast"
                                },
                                {
                                    "name": "Detlef Stammer"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Maxime Colin"
                                },
                                {
                                    "name": "Frank Robinson"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Héctor A Múnera"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "George Arenas"
                                },
                                {
                                    "name": "Iván López"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Igor Málikov"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Eric Alfaro"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Arnoldo Bezanilla"
                                },
                                {
                                    "name": "Héctor A Múnera"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "George Arenas"
                                },
                                {
                                    "name": "Edgar Alfonso"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                }
                            ],
                            "metatags": [
                                {
                                    "application-name": "ResearchGate",
                                    "og:image": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg",
                                    "twitter:card": "summary",
                                    "twitter:title": "Daniel Hernandez-Deckers",
                                    "og:type": "profile",
                                    "og:site_name": "ResearchGate",
                                    "rg-request-token": "aad-MQVQF4pjx5JXvtHeA0UkX5gdNFiDhCSB7CbdBgHGN4Ssfs34XHnbNeaqVBfRE39AR2gkFGFOg6Utgj59W0pkXfXU/ikhTqirnYMTl0UKYhlvAGVDbP73cavjBKRKaxAtx8v9Vj+/16SE2U5GognvGYphVMqIB5Y+kvYjA90+/hLDcuvIlW7Ck3jfyPiZunuIfPXP87/8ivww8/l0K1csChq2Zeh56kJ2LQ+ZNTYEm5eZohopaOW1q9yL4YNdoEL375DFIvAHwXCr+oETuCw=",
                                    "twitter:url": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                                    "profile:username": "Daniel-Hernandez-Deckers",
                                    "og:title": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD | National University of Colombia, Bogotá | UNAL | Research profile",
                                    "twitter:creator": "@ResearchGate",
                                    "og:description": "Atmospheric Science",
                                    "twitter:image": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg",
                                    "referrer": "origin",
                                    "profile:last_name": "Hernandez-Deckers",
                                    "twitter:site": "@ResearchGate",
                                    "viewport": "width=device-width,initial-scale=1",
                                    "rg:id": "AC:4787022",
                                    "og:site": "ResearchGate",
                                    "profile:gender": "unknown",
                                    "profile:first_name": "Daniel",
                                    "og:url": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg"
                                }
                            ],
                            "scholarlyarticle": [
                                {
                                    "headline": "Energetics Responses to Increases in Greenhouse Gas Concentration"
                                },
                                {
                                    "headline": "The energetics response to a warmer climate: Relative contributions from the transient and stationary eddies"
                                },
                                {
                                    "headline": "Impact of the Warming Pattern on Global Energetics"
                                },
                                {
                                    "headline": "Slippery Thermals and the Cumulus Entrainment Paradox*"
                                },
                                {
                                    "headline": "On the Role of Entrainment in the Fate of Cumulus Thermals"
                                },
                                {
                                    "headline": "Tropical Easterly Waves Over Costa Rica and Their Relationship to the Diurnal Cycle of Rainfall"
                                },
                                {
                                    "headline": "Understanding convective storms in a tropical, high-altitude location with in-situ meteorological observations and GPS-derived water vapor"
                                },
                                {
                                    "headline": "IMPLEMENTACIÓN DE UN MODELO CLIMÁTICO PARA INTERPRETAR POSIBLES CAMBIOS ESTACIONALES EN LA TATACOA, COLOMBIA, DURANTE EL MIOCENO MEDIO"
                                },
                                {
                                    "headline": "Efecto cantidad en la composición del agua meteórica en Barranquilla, Bogotá, El Tesoro y Tulenapa (Colombia)"
                                },
                                {
                                    "headline": "Updraft dynamics and microphysics: on the added value of the cumulus thermal reference frame in simulations of aerosol–deep convection interactions"
                                },
                                {
                                    "headline": "Features of atmospheric deep convection in Northwestern South America obtained from infrared satellite data"
                                },
                                {
                                    "headline": "Updraft dynamics and microphysics: on the added value of the cumulus thermal reference frame in simulations of aerosol-deep convection interactions"
                                },
                                {
                                    "headline": "Composición del agua meteórica de los paleosuelos del desierto de La Tatacoa: implicaciones en el ciclo hidrológico durante el serravaliense"
                                },
                                {
                                    "headline": "The mixing role of cumulus thermals"
                                },
                                {
                                    "headline": "A Numerical Investigation of Cumulus Thermals"
                                },
                                {
                                    "headline": "Cumulus thermals throughout different convective regimes: sticky or slippery?"
                                },
                                {
                                    "headline": "An Exploration of Multivariate Fluctuation Dissipation Operators and Their Response to Sea Surface Temperature Perturbations"
                                },
                                {
                                    "headline": "An estimate of the Lorenz energy cycle for the World Ocean based on the 1/10°STORM/NCEP simulation"
                                },
                                {
                                    "headline": "Do growing cumulus experience friction?"
                                },
                                {
                                    "headline": "The energetics response to a warmer climate: relative contributions from the transient and stationary eddies"
                                },
                                {
                                    "headline": "Warming up the atmosphere’s heat engine: atmospheric energetics with higher greenhouse gas concentrations"
                                },
                                {
                                    "headline": "Energetics responses to different atmospheric warming patterns"
                                },
                                {
                                    "headline": "Energetics of a warmer climate: eddy kinetic energy responses to different warming patterns"
                                },
                                {
                                    "headline": "Energetics responses to higher greenhouse gas concentrations, and the role of the warming pattern"
                                },
                                {
                                    "headline": "Observation of a Non-conventional Influence of Earth's Motion on the Velocity of Photons, and Calculation of the Velocity of Our Galaxy"
                                },
                                {
                                    "headline": "Presencia del fenómeno El Niño en algunas variables hidrometeorológicas del Pacífico Colombiano"
                                },
                                {
                                    "headline": "Uso de un modelo de aguas someras para analizar la influencia del Atlántico Tropical Norte y del Pacífico Ecuatorial del Este sobre la circulación atmosférica en los mares Intra-Americanos"
                                },
                                {
                                    "headline": "Observation of a significant influence of earth's motion on the velocity of photons in our terrestrial laboratory - art. no. 66640K"
                                },
                                {
                                    "headline": "Predictores de la variabilidad de las anomalías de la temperatura superficial del mar de la Cuenca del Pacífico Colombiano"
                                },
                                {
                                    "headline": "Respuestas de la temperatura superficial del mar y la temperatura del aire de la Cuenca del Pacífico Colombiano ante El Niño Oscilación del Sur"
                                },
                                {
                                    "headline": "Relaciones espacio-temporales entre la temperatura superficial del mar de la Cuenca del Pacífico Colombiano y el ciclo El Niño Oscilación del Sur"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                        "htmlTitle": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                        "link": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "displayLink": "issuu.com",
                        "content": "... Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia. Universidad Nacional: Revista Meteorología Colombiana 2: pag 7-21 Bogotá. Montealegre ...",
                        "htmlSnippet": "... <b>Oscilación del Sur</b> y su efecto en el patrón pluviométrico de <b>Colombia</b>. Universidad Nacional: Revista Meteorología Colombiana 2: pag 7-21 <b>Bogotá</b>. Montealegre&nbsp;...",
                        "cacheId": "RQ9bxrlGWXkJ",
                        "formattedUrl": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "htmlFormattedUrl": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcS1L9bOtXiJ3Hn6iT4-QjsJ3vo-S5Lz-91kdGf9uP7FNLL8l9SYMBO_Ud6C",
                                    "width": "351",
                                    "height": "144"
                                }
                            ],
                            "imageobject": [
                                {
                                    "width": "160px",
                                    "url": "https://photo.isu.pub/unigis_latina/photo_large.jpg",
                                    "height": "160px"
                                }
                            ],
                            "organization": [
                                {
                                    "name": "UNIGIS América Latina"
                                }
                            ],
                            "metatags": [
                                {
                                    "application-name": "issuu",
                                    "msapplication-tilecolor": "#f26f61",
                                    "og:image": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "twitter:card": "summary",
                                    "twitter:title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                                    "og:type": "article",
                                    "msapplication-square70x70logo": "//issuu.com/microsoft-70x70.png",
                                    "og:site_name": "issuu",
                                    "og:title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                                    "og:image:type": "image/jpeg",
                                    "og:description": "Alfaro E, y Soley F. (2008) Descripción de dos métodos de rellenado de datos ausentes en series de tiempo meteorológicas. Revista de Matemática: Teoría y Aplicaciones. p 72",
                                    "msapplication-square150x150logo": "//issuu.com/microsoft-150x150.png",
                                    "twitter:image": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "og:image:secure_url": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "twitter:site": "@issuu",
                                    "viewport": "width=device-width",
                                    "twitter:description": "Alfaro E, y Soley F. (2008) Descripción de dos métodos de rellenado de datos ausentes en series de tiempo meteorológicas. Revista de Matemática: Teoría y Aplicaciones. p 72",
                                    "og:url": "https://issuu.com/unigis_latina/docs/102639/s/14459283"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://static.isu.pub/fe/default-story-images/news.jpg"
                                }
                            ],
                            "article": [
                                {
                                    "image": "5 minute read7. REFERENCIAS BIBLIOGRÁFICAS",
                                    "author": "from 102639by UNIGIS América Latina",
                                    "headline": "7. REFERENCIAS BIBLIOGRÁFICAS",
                                    "datepublished": "2022-01-04T20:16:27.000Z",
                                    "mainentityofpage": "http://schema.org/Article"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Índices Locales del Ciclo El Niño Oscilación del Sur para las ...",
                        "htmlTitle": "Índices Locales del Ciclo El Niño <b>Oscilación del Sur</b> para las ...",
                        "link": "https://repositorio.unal.edu.co/bitstream/handle/unal/79362/1018421469.2021.pdf?sequence=1&isAllowed=y",
                        "displayLink": "repositorio.unal.edu.co",
                        "content": "Se definieron índices locales del ciclo de El Niño Oscilación del Sur (ENOS) en las regiones naturales de Colombia. Se utilizaron datos de temperatura del ...",
                        "htmlSnippet": "Se definieron índices locales del ciclo de El Niño <b>Oscilación del Sur</b> (ENOS) en las regiones naturales de <b>Colombia</b>. Se utilizaron datos de temperatura del&nbsp;...",
                        "formattedUrl": "https://repositorio.unal.edu.co/bitstream/.../1018421469.2021.pdf?...1...y",
                        "htmlFormattedUrl": "https://repositorio.unal.edu.co/bitstream/.../1018421469.2021.pdf?...1...y",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0xN7v9guNv-dOsS3WIN4ugaL8BDspNslsgkYLgzbXsSeJOSd2UZVBG0I",
                                    "width": "212",
                                    "height": "238"
                                }
                            ],
                            "metatags": [
                                {
                                    "moddate": "D:20210315154923-05'00'",
                                    "creator": "Microsoft® Word para Microsoft 365",
                                    "creationdate": "D:20210315154923-05'00'",
                                    "author": "Universidad Nacional de Colombia",
                                    "producer": "Microsoft® Word para Microsoft 365"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "x-raw-image:///b63d3e01a863f69877636a0ec0556cc7b08ee708e1b1047ae9ccf7aec02acd04"
                                }
                            ]
                        },
                        "mime": "application/pdf",
                        "fileFormat": "PDF/Adobe Acrobat"
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "El Niño is here! What is it, and what can we do? | Alliance Bioversity ...",
                        "htmlTitle": "El Niño is here! What is it, and what can we do? | Alliance Bioversity ...",
                        "link": "https://alliancebioversityciat.org/stories/el-nino-here-what-it-and-what-can-we-do",
                        "displayLink": "alliancebioversityciat.org",
                        "content": "Aug 4, 2023 ... There has long been expectation of the arrival of El Niño, occupying news ... Available at: https://ciifen.org/el-nino-oscilacion-del-sur/ ( ...",
                        "htmlSnippet": "Aug 4, 2023 <b>...</b> There has long been expectation of the arrival of El Niño, occupying <b>news</b> ... Available at: https://ciifen.org/el-nino-<b>oscilacion-del-sur</b>/ (&nbsp;...",
                        "cacheId": "GZ6vPqsCpaMJ",
                        "formattedUrl": "https://alliancebioversityciat.org/.../el-nino-here-what-it-and-what-can-we-d...",
                        "htmlFormattedUrl": "https://alliancebioversityciat.org/.../el-nino-here-what-it-and-what-can-we-d...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRVlp3-S4cuGKWLqTKLy-oO8LQRK5XAcFPMvPi5M6iR4P_XOmdh_CwTcqT6",
                                    "width": "275",
                                    "height": "183"
                                }
                            ],
                            "Article": [
                                {
                                    "name": " El Niño is here! What is it, and what can we do?"
                                }
                            ],
                            "metatags": [
                                {
                                    "msapplication-tilecolor": "#ffffff",
                                    "og:image": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd",
                                    "twitter:card": "summary_large_image",
                                    "twitter:title": "El Niño is here! What is it, and what can we do?",
                                    "theme-color": "#ffffff",
                                    "og:site_name": "Alliance Bioversity International - CIAT",
                                    "handheldfriendly": "true",
                                    "og:title": "El Niño is here! What is it, and what can we do?",
                                    "og:description": "On July 4th 2023, the World Meteorological Organization - WMO, a technical agency of the United Nations - announced that conditions are in place for the El Niño phenomenon [1]. There has long been expectation of the arrival of El Niño, occupying news headlines and generating a sense of uncertainty due to images of its potentially devastating effects.",
                                    "twitter:image": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd",
                                    "twitter:site": "@BiovIntCIAT_eng",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "twitter:description": "On July 4th 2023, the World Meteorological Organization - WMO, a technical agency of the United Nations - announced that conditions are in place for the El Niño phenomenon [1]. There has long been expectation of the arrival of El Niño, occupying news headlines and generating a sense of uncertainty due to images of its potentially devastating effects.",
                                    "mobileoptimized": "width",
                                    "og:url": "https://alliancebioversityciat.org/stories/el-nino-here-what-it-and-what-can-we-do"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd"
                                }
                            ]
                        }
                    }
                ]
            },
            {
                "Categoría": "",
                "Subcategorias": "",
                "Temas": "2. Fenomeno para Colombia",
                "Palabra clave": "Oscilación del sur",
                "Diccionario Principal": "alteración / altera",
                "Diccionario Ligado": "preocupación",
                "field7": "",
                "id_diccionario_principal": "Caracterización fenómeno",
                "id_diccionario_ligado": "Caracterización fenómeno",
                "searchs": [
                    {
                        "kind": "customsearch#result",
                        "title": "Precipitación y Temperatura - IDIGER",
                        "htmlTitle": "Precipitación y Temperatura - IDIGER",
                        "link": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "displayLink": "www.idiger.gov.co",
                        "content": "... oscilacion-del-sur/. 2. Fenómeno de El Niño y La Niña y variabilidad ... Bogotá, disponible en la página web del Sistema de Alerta de Bogotá. Asimismo, en la ...",
                        "htmlSnippet": "... <b>oscilacion-del-sur</b>/. 2. Fenómeno de El Niño y La Niña y variabilidad ... <b>Bogotá</b>, disponible en la página web del Sistema de Alerta de <b>Bogotá</b>. Asimismo, en la&nbsp;...",
                        "formattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "htmlFormattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRPKtxSxmgikPVyiCEGD-o03WYetRTpPl5nAxSez70926LNucnL-duvlIDq",
                                    "width": "315",
                                    "height": "160"
                                }
                            ],
                            "metatags": [
                                {
                                    "twitter:title": "IDIGER",
                                    "twitter:card": "summary_large_image",
                                    "viewport": "initial-scale=1.0, width=device-width",
                                    "twitter:image": "https://www.idiger.gov.co/documents/20182/25478/idiger.jpg"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.idiger.gov.co/documents/20182/1312633/Zona_Convergencia_Intertropical.png/c21db85e-32d3-4581-9619-0ada8fa1424d?t=1647537192625"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Conoce los Trabajos Programados que Enel-Codensa realizará en ...",
                        "htmlTitle": "Conoce los Trabajos Programados que Enel-Codensa realizará en ...",
                        "link": "https://www.enel.com.co/es/prensa/news/d202106-trabajos-programados-bogota-del-6-al-9-de-junio-del-2021.html",
                        "displayLink": "www.enel.com.co",
                        "content": "Jun 4, 2021 ... ... Bogotá, para reducir fallas en el suministro y responder de manera ... Calle 2 sur a Calle 5 sur entre Carrera 17 a Carrera 20. 6:30 a. m ...",
                        "htmlSnippet": "Jun 4, 2021 <b>...</b> ... <b>Bogotá</b>, para reducir fallas en el suministro y responder de manera ... Calle 2 <b>sur</b> a Calle 5 <b>sur</b> entre Carrera 17 a Carrera 20. 6:30 a. m&nbsp;...",
                        "cacheId": "gQV0dX38U08J",
                        "formattedUrl": "https://www.enel.com.co/.../news/d202106-trabajos-programados-bogota-d...",
                        "htmlFormattedUrl": "https://www.enel.com.co/.../<b>news</b>/d202106-trabajos-programados-bogota-<b>d</b>...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRYvytBjYF9ie-yhLMrmgnMrcr47oWHyJuonsbjKkjvUCPM4QaN6fXwiGo",
                                    "width": "341",
                                    "height": "148"
                                }
                            ],
                            "organization": [
                                {
                                    "logo": "https://www.enel.com.co/content/dam/enel-co/im%C3%A1genes-home/Enel_Logo_Secondary_white_RGB.png",
                                    "url": "https://www.enel.com.co/es.html"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://www.enel.com.co/content/dam/enel-co/español/medios/distribución/2018/mayo/imagenes/mantenimientos-bogota-mayo.jpg",
                                    "og:type": "article",
                                    "twitter:card": "summary_large_image",
                                    "twitter:title": "Conoce los Trabajos Programados que Enel-Codensa realizará en Bogotá",
                                    "viewport": "width=device-width, user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1",
                                    "twitter:description": "Enel-Codensa, pensando en la calidad de su servicio, estará realizando trabajos programados.",
                                    "og:title": "Conoce los Trabajos Programados que Enel-Codensa realizará en Bogotá",
                                    "og:locale": "es",
                                    "og:url": "https://enel.com.co/content/enel-co/es/megamenu/prensa/news/2021/06/trabajos-programados-bogota-del-6-al-9-de-junio-del-2021.html",
                                    "og:description": "Enel-Codensa, pensando en la calidad de su servicio, estará realizando trabajos programados.",
                                    "facebook-domain-verification": "ew5qy5dlu4u7rnujedr9snqrrwvud1"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.enel.com.co/content/enel-co/es/megamenu/prensa/news/2021/06/trabajos-programados-bogota-del-6-al-9-de-junio-del-2021/_jcr_content/carousel/items/image.img.jpg/1622841331568.jpg"
                                }
                            ],
                            "listitem": [
                                {
                                    "item": "Home",
                                    "name": "Home",
                                    "position": "1"
                                },
                                {
                                    "item": "Oficina de prensa Enel Colombia",
                                    "name": "Oficina de prensa Enel Colombia",
                                    "position": "2"
                                },
                                {
                                    "item": "news",
                                    "name": "news",
                                    "position": "3"
                                },
                                {
                                    "item": "Enel-Codensa trabaja para mejorar la calidad del servicio en Bogotá - Trabajos del 6 al 9 de junio de 2021",
                                    "name": "Enel-Codensa trabaja para mejorar la calidad del servicio en Bogotá - Trabajos del 6 al 9 de junio de 2021",
                                    "position": "4"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Guatemala - Rapports | ReliefWeb Response",
                        "htmlTitle": "Guatemala - Rapports | ReliefWeb Response",
                        "link": "https://response.reliefweb.int/fr/guatemala/reports?filters%5Bdisaster.name%5D%5B13%5D=hurricane%20eta%20-%20nov%202020&filters%5Bdisaster.name%5D%5B22%5D=Colombia%3A%20Floods%20and%20Landslides%20-%20Nov%202020&filters%5Btheme.name%5D%5B0%5D=Health&filters%5Btheme.name%5D%5B1%5D=Logistics%20and%20Telecommunications&filters%5Bdisaster_type%5D=Flood&filters%5Bdate.changed%5D=2020-12-01%3A2020-12-31&page=757",
                        "displayLink": "response.reliefweb.int",
                        "content": "El fenómeno de El Niño Oscilación Sur es un sistema de interacciones entre ... Bogotá, 20 nov… Format: News and Press Release; Source: Govt. Colombia; Posted ...",
                        "htmlSnippet": "El fenómeno de El Niño <b>Oscilación Sur</b> es un sistema de interacciones entre ... <b>Bogotá</b>, 20 nov… Format: <b>News</b> and Press Release; Source: Govt. <b>Colombia</b>; Posted&nbsp;...",
                        "cacheId": "iwtL9KpRvBgJ",
                        "formattedUrl": "https://response.reliefweb.int/fr/.../reports?...12...",
                        "htmlFormattedUrl": "https://response.reliefweb.int/fr/.../reports?...12...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcTtaZ2_QrGcxs93XJbZx6SsbAMbEOx1y5_uSmArHnLw3o22_59PBTs_oy3d",
                                    "width": "355",
                                    "height": "142"
                                }
                            ],
                            "metatags": [
                                {
                                    "handheldfriendly": "true",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "mobileoptimized": "width"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://response.reliefweb.int/themes/custom/common_design_subtheme/img/logos/response-logo.svg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño ...",
                        "htmlTitle": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño ...",
                        "link": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                        "displayLink": "www.researchgate.net",
                        "content": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia ... News · Careers.",
                        "htmlSnippet": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-<b>Oscilación del Sur</b> y su efecto en el patrón pluviométrico de <b>Colombia</b> ... <b>News</b> &middot; Careers.",
                        "formattedUrl": "https://www.researchgate.net/.../281605886_La_variabilidad_climatica_inte...",
                        "htmlFormattedUrl": "https://www.researchgate.net/.../281605886_La_variabilidad_climatica_inte...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRgj1e4g8u4CIXrmgMqfc6HqqbhonOr9WXa0jAXHgIN0n4BuU_y9ToKcNst",
                                    "width": "197",
                                    "height": "255"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://i1.rgstatic.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/largepreview.png",
                                    "citation_publication_date": "2000/01/01",
                                    "twitter:card": "summary",
                                    "citation_title": "La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia",
                                    "og:site_name": "ResearchGate",
                                    "twitter:url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "twitter:creator": "@ResearchGate",
                                    "og:description": "PDF | On Jan 1, 2000, J.E. Montealegre and others published La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia | Find, read and cite all the research you need on ResearchGate",
                                    "twitter:site": "@ResearchGate",
                                    "og:site": "ResearchGate",
                                    "citation_fulltext_html_url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "citation_pdf_url": "https://www.researchgate.net/profile/Jose-Daniel-Pabon-Caicedo/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/La-variabilidad-climatica-interanual-asociada-al-ciclo-El-Nino-La-Nina-Oscilacion-del-Sur-y-su-efecto-en-el-patron-pluviometrico-de-Colombia.pdf",
                                    "citation_lastpage": "21",
                                    "application-name": "ResearchGate",
                                    "og:type": "website",
                                    "rg-request-token": "aad-F2OtW0j5GClI3c///3I0R79zuF/rP1nONA8Z4d8YAjnFdhKGfCTodyeKdNTtVJSozZT/YwW+ueMduNkIT+H0aW5Bc5OYNjxhqbpKpiLH7b/hjD9oKiZkjaKTf+Ddu/wdRRizEAIApThidTNX5lRF2r1FB/V3rQq/Jl0FMD1H7M5as2yoFMbn9u1/DJ18YcxGkDRAP+yrQ7P8u/hiCrHjlGZK1k50w06/ntgpWQKyt/mEN3X9J/idgHX8uG4B52Vq3FC5guHu0iSiBknHcto=",
                                    "og:title": "(PDF) La variabilidad climática interanual asociada al ciclo El Niño-La Niña-Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia",
                                    "citation_author": "J.E. Montealegre",
                                    "citation_abstract_html_url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "referrer": "origin",
                                    "citation_firstpage": "7",
                                    "viewport": "width=device-width,initial-scale=1",
                                    "rg:id": "PB:281605886",
                                    "dc.identifier": "http://dx.doi.org/",
                                    "citation_volume": "2",
                                    "og:url": "https://www.researchgate.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia",
                                    "gs_meta_revision": "1.1"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://i1.rgstatic.net/publication/281605886_La_variabilidad_climatica_interanual_asociada_al_ciclo_El_Nino-La_Nina-Oscilacion_del_Sur_y_su_efecto_en_el_patron_pluviometrico_de_Colombia/links/597259a60f7e9b4016943e8e/largepreview.png"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "GICA - Tesis (Thesis)",
                        "htmlTitle": "GICA - Tesis (Thesis)",
                        "link": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                        "displayLink": "sites.google.com",
                        "content": "Sensibilidad de la contaminación fotoquímica en Bogotá a la oscilación del sur El Niño (ENSO). GABRIEL DE JESUS SALDARRIAGA OROZCO, gsaldarriaga64@gmail.com.",
                        "htmlSnippet": "Sensibilidad de la contaminación fotoquímica en <b>Bogotá</b> a la <b>oscilación del sur</b> El Niño (ENSO). GABRIEL DE JESUS SALDARRIAGA OROZCO, gsaldarriaga64@gmail.com.",
                        "cacheId": "aa9jmiUNgcEJ",
                        "formattedUrl": "https://sites.google.com/unal.edu.co/gica/página-principal/tesis-thesis",
                        "htmlFormattedUrl": "https://sites.google.com/unal.edu.co/gica/página-principal/tesis-thesis",
                        "pagemap": {
                            "metatags": [
                                {
                                    "referrer": "strict-origin-when-cross-origin",
                                    "og:image": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "og:type": "website",
                                    "viewport": "width=device-width, initial-scale=1",
                                    "og:title": "GICA - Tesis (Thesis)",
                                    "og:url": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                                    "og:description": "Tesis de doctorado (Ph.D. Thesis)"
                                }
                            ],
                            "webpage": [
                                {
                                    "image": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "imageurl": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383",
                                    "name": "GICA - Tesis (Thesis)",
                                    "description": "Tesis de doctorado (Ph.D. Thesis)",
                                    "url": "https://sites.google.com/unal.edu.co/gica/p%C3%A1gina-principal/tesis-thesis",
                                    "thumbnailurl": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://lh3.googleusercontent.com/7QdZOVo7sIT9v8gapvfQsR7FWSOlKxbLWwrkYJIIGqIT4UCGFSt3FPKahvarEHuqjIq_kA=w16383"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "La Niña está de regreso: qué es y qué significa para el clima en ...",
                        "htmlTitle": "La Niña está de regreso: qué es y qué significa para el clima en ...",
                        "link": "https://www.bbc.com/mundo/noticias-58904461",
                        "displayLink": "www.bbc.com",
                        "content": "Oct 18, 2021 ... ... Oscilación del Sur. El Niño es un patrón climático que causa un ... Ahora puedes recibir notificaciones de BBC News Mundo. Descarga la nueva ...",
                        "htmlSnippet": "Oct 18, 2021 <b>...</b> ... <b>Oscilación del Sur</b>. El Niño es un patrón climático que causa un ... Ahora puedes recibir notificaciones de BBC <b>News</b> Mundo. Descarga la nueva&nbsp;...",
                        "cacheId": "d53OxV2XvZkJ",
                        "formattedUrl": "https://www.bbc.com/mundo/noticias-58904461",
                        "htmlFormattedUrl": "https://www.bbc.com/mundo/noticias-58904461",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSedVbg-6a-rnfKqjQRownAjdkrkGr29E6l4CTwDy-DLkae1lxtQiIB3O7f",
                                    "width": "300",
                                    "height": "168"
                                }
                            ],
                            "metatags": [
                                {
                                    "apple-itunes-app": "app-id=515255747, app-argument=https://www.bbc.com/mundo/noticias-58904461?utm_medium=banner&utm_content=apple-itunes-app",
                                    "og:image": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg",
                                    "theme-color": "#B80000",
                                    "twitter:card": "summary_large_image",
                                    "article:published_time": "2021-10-18T10:45:53.000Z",
                                    "og:site_name": "BBC News Mundo",
                                    "apple-mobile-web-app-title": "BBC News Mundo",
                                    "msapplication-tileimage": "https://static.files.bbci.co.uk/ws/simorgh-assets/public/mundo/images/icons/icon-144x144.png",
                                    "og:description": "El fenómeno climático responsable de crudos inviernos y grandes sequías en todo el mundo ha llegado nuevamente y sus efectos se sentirán por varios meses.",
                                    "twitter:creator": "@bbcmundo",
                                    "twitter:image:alt": "la niña",
                                    "twitter:site": "@bbcmundo",
                                    "article:modified_time": "2021-10-18T10:45:53.000Z",
                                    "application-name": "BBC News Mundo",
                                    "msapplication-tilecolor": "#B80000",
                                    "og:image:alt": "la niña",
                                    "og:type": "article",
                                    "twitter:title": "La Niña está de regreso: qué es y qué significa para el clima en América Latina - BBC News Mundo",
                                    "og:title": "La Niña está de regreso: qué es y qué significa para el clima en América Latina - BBC News Mundo",
                                    "article:author": "https://www.facebook.com/bbcnews",
                                    "twitter:image:src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg",
                                    "article:tag": "Ciencia",
                                    "fb:app_id": "1609039196070050",
                                    "viewport": "width=device-width, initial-scale=1, minimum-scale=1",
                                    "twitter:description": "El fenómeno climático responsable de crudos inviernos y grandes sequías en todo el mundo ha llegado nuevamente y sus efectos se sentirán por varios meses.",
                                    "mobile-web-app-capable": "yes",
                                    "og:locale": "es-005",
                                    "og:url": "https://www.bbc.com/mundo/noticias-58904461"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/12B56/production/_121103667_lanina.jpg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD ...",
                        "htmlTitle": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD ...",
                        "link": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "displayLink": "www.researchgate.net",
                        "content": "... Bogotá, Colombia. This paper reports the final analysis of data. There were ... Oscilación del Sur. Conference Paper. Nov 2006.",
                        "htmlSnippet": "... <b>Bogotá</b>, <b>Colombia</b>. This paper reports the final analysis of data. There were ... <b>Oscilación del Sur</b>. Conference Paper. Nov 2006.",
                        "formattedUrl": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "htmlFormattedUrl": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                        "pagemap": {
                            "hcard": [
                                {
                                    "fn": "Daniel Hernandez-Deckers",
                                    "title": "PhD"
                                }
                            ],
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcQr4JNJBhfA1_yrtJ-fivjydjHOu3sloZjDz99HqVXGHHGxF41MsB8JFe83",
                                    "width": "225",
                                    "height": "225"
                                }
                            ],
                            "person": [
                                {
                                    "role": "PhD",
                                    "org": "National University of Colombia"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Maxime Colin"
                                },
                                {
                                    "name": "Frank Robinson"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Rani M. Wiggins"
                                },
                                {
                                    "name": "Ben Lintner"
                                },
                                {
                                    "name": "Yolande Serra"
                                },
                                {
                                    "name": "Giuseppe Torri"
                                },
                                {
                                    "name": "Alejandro Casallas García"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Hector Mora-Paez"
                                },
                                {
                                    "name": "Jose A Perez"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Andres Ochoa"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Maria Clara Zuluaga"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Toshihisa Matsui"
                                },
                                {
                                    "name": "Ann M. Fridlind"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Toshihisa Matsui"
                                },
                                {
                                    "name": "Ann M. Fridlind"
                                },
                                {
                                    "name": "Susana Salazar"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Andres Ochoa"
                                },
                                {
                                    "name": "Cristian Garzon"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "S. Sherwood"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Steven C. Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "S. C. Sherwood"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "David Fuchs"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Carsten Eden"
                                },
                                {
                                    "name": "Irina Fast"
                                },
                                {
                                    "name": "Detlef Stammer"
                                },
                                {
                                    "name": "Steven C Sherwood"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Maxime Colin"
                                },
                                {
                                    "name": "Frank Robinson"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Jin-Song von Storch"
                                },
                                {
                                    "name": "Héctor A Múnera"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "George Arenas"
                                },
                                {
                                    "name": "Iván López"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Igor Málikov"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Eric Alfaro"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Arnoldo Bezanilla"
                                },
                                {
                                    "name": "Héctor A Múnera"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "George Arenas"
                                },
                                {
                                    "name": "Edgar Alfonso"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                },
                                {
                                    "name": "Nancy Liliana Villegas Bolaños"
                                },
                                {
                                    "name": "Daniel Hernandez-Deckers"
                                }
                            ],
                            "metatags": [
                                {
                                    "application-name": "ResearchGate",
                                    "og:image": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg",
                                    "twitter:card": "summary",
                                    "twitter:title": "Daniel Hernandez-Deckers",
                                    "og:type": "profile",
                                    "og:site_name": "ResearchGate",
                                    "rg-request-token": "aad-MQVQF4pjx5JXvtHeA0UkX5gdNFiDhCSB7CbdBgHGN4Ssfs34XHnbNeaqVBfRE39AR2gkFGFOg6Utgj59W0pkXfXU/ikhTqirnYMTl0UKYhlvAGVDbP73cavjBKRKaxAtx8v9Vj+/16SE2U5GognvGYphVMqIB5Y+kvYjA90+/hLDcuvIlW7Ck3jfyPiZunuIfPXP87/8ivww8/l0K1csChq2Zeh56kJ2LQ+ZNTYEm5eZohopaOW1q9yL4YNdoEL375DFIvAHwXCr+oETuCw=",
                                    "twitter:url": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers",
                                    "profile:username": "Daniel-Hernandez-Deckers",
                                    "og:title": "Daniel HERNANDEZ-DECKERS | Profesor Asistente | PhD | National University of Colombia, Bogotá | UNAL | Research profile",
                                    "twitter:creator": "@ResearchGate",
                                    "og:description": "Atmospheric Science",
                                    "twitter:image": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg",
                                    "referrer": "origin",
                                    "profile:last_name": "Hernandez-Deckers",
                                    "twitter:site": "@ResearchGate",
                                    "viewport": "width=device-width,initial-scale=1",
                                    "rg:id": "AC:4787022",
                                    "og:site": "ResearchGate",
                                    "profile:gender": "unknown",
                                    "profile:first_name": "Daniel",
                                    "og:url": "https://www.researchgate.net/profile/Daniel-Hernandez-Deckers"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://i1.rgstatic.net/ii/profile.image/938562937692163-1600782250338_Q512/Daniel-Hernandez-Deckers.jpg"
                                }
                            ],
                            "scholarlyarticle": [
                                {
                                    "headline": "Energetics Responses to Increases in Greenhouse Gas Concentration"
                                },
                                {
                                    "headline": "The energetics response to a warmer climate: Relative contributions from the transient and stationary eddies"
                                },
                                {
                                    "headline": "Impact of the Warming Pattern on Global Energetics"
                                },
                                {
                                    "headline": "Slippery Thermals and the Cumulus Entrainment Paradox*"
                                },
                                {
                                    "headline": "On the Role of Entrainment in the Fate of Cumulus Thermals"
                                },
                                {
                                    "headline": "Tropical Easterly Waves Over Costa Rica and Their Relationship to the Diurnal Cycle of Rainfall"
                                },
                                {
                                    "headline": "Understanding convective storms in a tropical, high-altitude location with in-situ meteorological observations and GPS-derived water vapor"
                                },
                                {
                                    "headline": "IMPLEMENTACIÓN DE UN MODELO CLIMÁTICO PARA INTERPRETAR POSIBLES CAMBIOS ESTACIONALES EN LA TATACOA, COLOMBIA, DURANTE EL MIOCENO MEDIO"
                                },
                                {
                                    "headline": "Efecto cantidad en la composición del agua meteórica en Barranquilla, Bogotá, El Tesoro y Tulenapa (Colombia)"
                                },
                                {
                                    "headline": "Updraft dynamics and microphysics: on the added value of the cumulus thermal reference frame in simulations of aerosol–deep convection interactions"
                                },
                                {
                                    "headline": "Features of atmospheric deep convection in Northwestern South America obtained from infrared satellite data"
                                },
                                {
                                    "headline": "Updraft dynamics and microphysics: on the added value of the cumulus thermal reference frame in simulations of aerosol-deep convection interactions"
                                },
                                {
                                    "headline": "Composición del agua meteórica de los paleosuelos del desierto de La Tatacoa: implicaciones en el ciclo hidrológico durante el serravaliense"
                                },
                                {
                                    "headline": "The mixing role of cumulus thermals"
                                },
                                {
                                    "headline": "A Numerical Investigation of Cumulus Thermals"
                                },
                                {
                                    "headline": "Cumulus thermals throughout different convective regimes: sticky or slippery?"
                                },
                                {
                                    "headline": "An Exploration of Multivariate Fluctuation Dissipation Operators and Their Response to Sea Surface Temperature Perturbations"
                                },
                                {
                                    "headline": "An estimate of the Lorenz energy cycle for the World Ocean based on the 1/10°STORM/NCEP simulation"
                                },
                                {
                                    "headline": "Do growing cumulus experience friction?"
                                },
                                {
                                    "headline": "The energetics response to a warmer climate: relative contributions from the transient and stationary eddies"
                                },
                                {
                                    "headline": "Warming up the atmosphere’s heat engine: atmospheric energetics with higher greenhouse gas concentrations"
                                },
                                {
                                    "headline": "Energetics responses to different atmospheric warming patterns"
                                },
                                {
                                    "headline": "Energetics of a warmer climate: eddy kinetic energy responses to different warming patterns"
                                },
                                {
                                    "headline": "Energetics responses to higher greenhouse gas concentrations, and the role of the warming pattern"
                                },
                                {
                                    "headline": "Observation of a Non-conventional Influence of Earth's Motion on the Velocity of Photons, and Calculation of the Velocity of Our Galaxy"
                                },
                                {
                                    "headline": "Presencia del fenómeno El Niño en algunas variables hidrometeorológicas del Pacífico Colombiano"
                                },
                                {
                                    "headline": "Uso de un modelo de aguas someras para analizar la influencia del Atlántico Tropical Norte y del Pacífico Ecuatorial del Este sobre la circulación atmosférica en los mares Intra-Americanos"
                                },
                                {
                                    "headline": "Observation of a significant influence of earth's motion on the velocity of photons in our terrestrial laboratory - art. no. 66640K"
                                },
                                {
                                    "headline": "Predictores de la variabilidad de las anomalías de la temperatura superficial del mar de la Cuenca del Pacífico Colombiano"
                                },
                                {
                                    "headline": "Respuestas de la temperatura superficial del mar y la temperatura del aire de la Cuenca del Pacífico Colombiano ante El Niño Oscilación del Sur"
                                },
                                {
                                    "headline": "Relaciones espacio-temporales entre la temperatura superficial del mar de la Cuenca del Pacífico Colombiano y el ciclo El Niño Oscilación del Sur"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                        "htmlTitle": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                        "link": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "displayLink": "issuu.com",
                        "content": "... Oscilación del Sur y su efecto en el patrón pluviométrico de Colombia. Universidad Nacional: Revista Meteorología Colombiana 2: pag 7-21 Bogotá. Montealegre ...",
                        "htmlSnippet": "... <b>Oscilación del Sur</b> y su efecto en el patrón pluviométrico de <b>Colombia</b>. Universidad Nacional: Revista Meteorología Colombiana 2: pag 7-21 <b>Bogotá</b>. Montealegre&nbsp;...",
                        "cacheId": "RQ9bxrlGWXkJ",
                        "formattedUrl": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "htmlFormattedUrl": "https://issuu.com/unigis_latina/docs/102639/s/14459283",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcS1L9bOtXiJ3Hn6iT4-QjsJ3vo-S5Lz-91kdGf9uP7FNLL8l9SYMBO_Ud6C",
                                    "width": "351",
                                    "height": "144"
                                }
                            ],
                            "imageobject": [
                                {
                                    "width": "160px",
                                    "url": "https://photo.isu.pub/unigis_latina/photo_large.jpg",
                                    "height": "160px"
                                }
                            ],
                            "organization": [
                                {
                                    "name": "UNIGIS América Latina"
                                }
                            ],
                            "metatags": [
                                {
                                    "application-name": "issuu",
                                    "msapplication-tilecolor": "#f26f61",
                                    "og:image": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "twitter:card": "summary",
                                    "twitter:title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                                    "og:type": "article",
                                    "msapplication-square70x70logo": "//issuu.com/microsoft-70x70.png",
                                    "og:site_name": "issuu",
                                    "og:title": "7. REFERENCIAS BIBLIOGRÁFICAS - Issuu",
                                    "og:image:type": "image/jpeg",
                                    "og:description": "Alfaro E, y Soley F. (2008) Descripción de dos métodos de rellenado de datos ausentes en series de tiempo meteorológicas. Revista de Matemática: Teoría y Aplicaciones. p 72",
                                    "msapplication-square150x150logo": "//issuu.com/microsoft-150x150.png",
                                    "twitter:image": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "og:image:secure_url": "https://static.isu.pub/fe/default-story-images/news.jpg",
                                    "twitter:site": "@issuu",
                                    "viewport": "width=device-width",
                                    "twitter:description": "Alfaro E, y Soley F. (2008) Descripción de dos métodos de rellenado de datos ausentes en series de tiempo meteorológicas. Revista de Matemática: Teoría y Aplicaciones. p 72",
                                    "og:url": "https://issuu.com/unigis_latina/docs/102639/s/14459283"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://static.isu.pub/fe/default-story-images/news.jpg"
                                }
                            ],
                            "article": [
                                {
                                    "image": "5 minute read7. REFERENCIAS BIBLIOGRÁFICAS",
                                    "author": "from 102639by UNIGIS América Latina",
                                    "headline": "7. REFERENCIAS BIBLIOGRÁFICAS",
                                    "datepublished": "2022-01-04T20:16:27.000Z",
                                    "mainentityofpage": "http://schema.org/Article"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Índices Locales del Ciclo El Niño Oscilación del Sur para las ...",
                        "htmlTitle": "Índices Locales del Ciclo El Niño <b>Oscilación del Sur</b> para las ...",
                        "link": "https://repositorio.unal.edu.co/bitstream/handle/unal/79362/1018421469.2021.pdf?sequence=1&isAllowed=y",
                        "displayLink": "repositorio.unal.edu.co",
                        "content": "Se definieron índices locales del ciclo de El Niño Oscilación del Sur (ENOS) en las regiones naturales de Colombia. Se utilizaron datos de temperatura del ...",
                        "htmlSnippet": "Se definieron índices locales del ciclo de El Niño <b>Oscilación del Sur</b> (ENOS) en las regiones naturales de <b>Colombia</b>. Se utilizaron datos de temperatura del&nbsp;...",
                        "formattedUrl": "https://repositorio.unal.edu.co/bitstream/.../1018421469.2021.pdf?...1...y",
                        "htmlFormattedUrl": "https://repositorio.unal.edu.co/bitstream/.../1018421469.2021.pdf?...1...y",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ0xN7v9guNv-dOsS3WIN4ugaL8BDspNslsgkYLgzbXsSeJOSd2UZVBG0I",
                                    "width": "212",
                                    "height": "238"
                                }
                            ],
                            "metatags": [
                                {
                                    "moddate": "D:20210315154923-05'00'",
                                    "creator": "Microsoft® Word para Microsoft 365",
                                    "creationdate": "D:20210315154923-05'00'",
                                    "author": "Universidad Nacional de Colombia",
                                    "producer": "Microsoft® Word para Microsoft 365"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "x-raw-image:///b63d3e01a863f69877636a0ec0556cc7b08ee708e1b1047ae9ccf7aec02acd04"
                                }
                            ]
                        },
                        "mime": "application/pdf",
                        "fileFormat": "PDF/Adobe Acrobat"
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "El Niño is here! What is it, and what can we do? | Alliance Bioversity ...",
                        "htmlTitle": "El Niño is here! What is it, and what can we do? | Alliance Bioversity ...",
                        "link": "https://alliancebioversityciat.org/stories/el-nino-here-what-it-and-what-can-we-do",
                        "displayLink": "alliancebioversityciat.org",
                        "content": "Aug 4, 2023 ... There has long been expectation of the arrival of El Niño, occupying news ... Available at: https://ciifen.org/el-nino-oscilacion-del-sur/ ( ...",
                        "htmlSnippet": "Aug 4, 2023 <b>...</b> There has long been expectation of the arrival of El Niño, occupying <b>news</b> ... Available at: https://ciifen.org/el-nino-<b>oscilacion-del-sur</b>/ (&nbsp;...",
                        "cacheId": "GZ6vPqsCpaMJ",
                        "formattedUrl": "https://alliancebioversityciat.org/.../el-nino-here-what-it-and-what-can-we-d...",
                        "htmlFormattedUrl": "https://alliancebioversityciat.org/.../el-nino-here-what-it-and-what-can-we-d...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRVlp3-S4cuGKWLqTKLy-oO8LQRK5XAcFPMvPi5M6iR4P_XOmdh_CwTcqT6",
                                    "width": "275",
                                    "height": "183"
                                }
                            ],
                            "Article": [
                                {
                                    "name": " El Niño is here! What is it, and what can we do?"
                                }
                            ],
                            "metatags": [
                                {
                                    "msapplication-tilecolor": "#ffffff",
                                    "og:image": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd",
                                    "twitter:card": "summary_large_image",
                                    "twitter:title": "El Niño is here! What is it, and what can we do?",
                                    "theme-color": "#ffffff",
                                    "og:site_name": "Alliance Bioversity International - CIAT",
                                    "handheldfriendly": "true",
                                    "og:title": "El Niño is here! What is it, and what can we do?",
                                    "og:description": "On July 4th 2023, the World Meteorological Organization - WMO, a technical agency of the United Nations - announced that conditions are in place for the El Niño phenomenon [1]. There has long been expectation of the arrival of El Niño, occupying news headlines and generating a sense of uncertainty due to images of its potentially devastating effects.",
                                    "twitter:image": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd",
                                    "twitter:site": "@BiovIntCIAT_eng",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "twitter:description": "On July 4th 2023, the World Meteorological Organization - WMO, a technical agency of the United Nations - announced that conditions are in place for the El Niño phenomenon [1]. There has long been expectation of the arrival of El Niño, occupying news headlines and generating a sense of uncertainty due to images of its potentially devastating effects.",
                                    "mobileoptimized": "width",
                                    "og:url": "https://alliancebioversityciat.org/stories/el-nino-here-what-it-and-what-can-we-do"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://alliancebioversityciat.org/sites/default/files/styles/header_image_teaser/public/images/banner-post-danielaarce.png?itok=Q_cT_yXd"
                                }
                            ]
                        }
                    }
                ]
            },
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
                        "content": "departamento norte de santander Sep 23, 2023 ... Ahora puede seguirnos en nuestro WhatsApp Channel y en Google News. ... Este clima atípico en Bogotá se produce en un contexto más amplio en ...",
                        "htmlSnippet": "Sep 23, 2023 <b>...</b> Ahora puede seguirnos en nuestro WhatsApp Channel y en Google <b>News</b>. ... Este clima atípico en <b>Bogotá</b> se produce en un contexto más amplio en&nbsp;...",
                        "cacheId": "bxotvT74lXIJ",
                        "formattedUrl": "https://www.infobae.com/.../frio-granizada-y-ahora-el-fenomeno-del-nino-...",
                        "htmlFormattedUrl": "https://www.infobae.com/.../frio-granizada-y-ahora-el-fenomeno-<b>del</b>-nino-...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcTcQInKuFK5R7Nqogh3c4h6tPjQ2GzEWy8Wip8qSt96xn55Z1cptggKrYE",
                                    "width": "310",
                                    "height": "163"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://www.infobae.com/new-resizer/KQMOcLhntBaZgvkcgKc8glHz1V8=/1200x630/filters:format(webp):quality(85)/cloudfront-us-east-1.images.arcpublishing.com/infobae/EOMV64CYHI57G6GD4KXG2EHXYE.jpg",
                                    "twitter:card": "summary_large_image",
                                    "og:image:width": "1200",
                                    "article:published_time": "2023-09-23T16:02:56.977Z",
                                    "og:site_name": "infobae",
                                    "rating": "general",
                                    "language": "es_ES",
                                    "distribution": "global",
                                    "twitter:creator": "@infobae",
                                    "og:description": "En la última semana, las redes sociales se han llenado de comentarios, fotos y videos sobre los cambios climáticos que ha sufrido Bogotá",
                                    "twitter:image": "https://www.infobae.com/new-resizer/6BYcdTPf0bvFJjesE4sC1cpZhos=/1024x512/filters:format(webp):quality(85)/cloudfront-us-east-1.images.arcpublishing.com/infobae/EOMV64CYHI57G6GD4KXG2EHXYE.jpg",
                                    "article:publisher": "https://www.facebook.com/infobae",
                                    "twitter:site": "@infobae",
                                    "news_keywords": "Clima Bogotano,Bogotá,Fenómeno del Niño,Granizo,Colombia-noticias",
                                    "article:section": "Colombia",
                                    "twitter:title": "Frio, granizada y, ahora, el fenómeno del Niño: estos son los cambios climáticos que ha sufrido Bogotá en esta semana",
                                    "og:type": "article",
                                    "dfppagetype": "nota",
                                    "og:title": "Frio, granizada y, ahora, el fenómeno del Niño: estos son los cambios climáticos que ha sufrido Bogotá en esta semana",
                                    "og:image:height": "630",
                                    "dfp_path": "america",
                                    "fb:pages": "34839376970",
                                    "viewport": "width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=0.5, maximum-scale=2.0",
                                    "twitter:description": "En la última semana, las redes sociales se han llenado de comentarios, fotos y videos sobre los cambios climáticos que ha sufrido Bogotá",
                                    "og:locale": "es_LA",
                                    "isdfp": "true",
                                    "og:url": "https://www.infobae.com/colombia/2023/09/23/frio-granizada-y-ahora-el-fenomeno-del-nino-estos-son-los-cambios-climaticos-que-ha-sufrido-bogota-en-esta-semana/"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.infobae.com/new-resizer/KQMOcLhntBaZgvkcgKc8glHz1V8=/1200x630/filters:format(webp):quality(85)/cloudfront-us-east-1.images.arcpublishing.com/infobae/EOMV64CYHI57G6GD4KXG2EHXYE.jpg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Navidad a media luz en Colombia por temor a apagones | AP News",
                        "htmlTitle": "Navidad a media luz en <b>Colombia</b> por temor a apagones | AP <b>News</b>",
                        "link": "https://apnews.com/article/3d685b8c26384a79bf3493fbf664794c",
                        "displayLink": "apnews.com",
                        "content": "Record de temperatura intenso Dec 24, 2015 ... BOGOTA, Colombia (AP) — Una brutal sequía provocada por el fenómeno de El Niño cobró una inesperada víctima en esta época festiva de fin de ...",
                        "htmlSnippet": "Dec 24, 2015 <b>...</b> <b>BOGOTA</b>, <b>Colombia</b> (AP) — Una brutal sequía provocada por el <b>fenómeno</b> de El <b>Niño</b> cobró una inesperada víctima en esta época festiva de fin de&nbsp;...",
                        "cacheId": "tn0ACcD_4YMJ",
                        "formattedUrl": "https://apnews.com/article/3d685b8c26384a79bf3493fbf664794c",
                        "htmlFormattedUrl": "https://ap<b>news</b>.com/article/3d685b8c26384a79bf3493fbf664794c",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR7UiKa0xBVzBOoT79Rx4yYAX3SUXP_aprqH_DF_qqXBCnj7bIjI70iX0UG",
                                    "width": "300",
                                    "height": "168"
                                }
                            ],
                            "thumbnail": [
                                {
                                    "src": "https://dims.apnews.com/dims4/default/9b7c821/2147483647/strip/true/crop/3000x1688+0+159/resize/1440x810!/quality/90/?url=https%3A%2F%2Fstorage.googleapis.com%2Fafs-prod%2Fmedia%2Fe2ec959fdf8944dc86c4a6e955d49d73%2F3000.jpeg"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://dims.apnews.com/dims4/default/9b7c821/2147483647/strip/true/crop/3000x1688+0+159/resize/1440x810!/quality/90/?url=https%3A%2F%2Fstorage.googleapis.com%2Fafs-prod%2Fmedia%2Fe2ec959fdf8944dc86c4a6e955d49d73%2F3000.jpeg",
                                    "og:image:width": "1440",
                                    "article:published_time": "2015-12-24T12:10:20",
                                    "twitter:card": "summary_large_image",
                                    "og:site_name": "AP News",
                                    "og:image:type": "image/jpeg",
                                    "og:description": "BOGOTA, Colombia (AP) — Una brutal sequía provocada por el fenómeno de El Niño cobró una inesperada víctima en esta época festiva de fin de año: los alumbrados navideños.",
                                    "twitter:image": "https://dims.apnews.com/dims4/default/9b7c821/2147483647/strip/true/crop/3000x1688+0+159/resize/1440x810!/quality/90/?url=https%3A%2F%2Fstorage.googleapis.com%2Fafs-prod%2Fmedia%2Fe2ec959fdf8944dc86c4a6e955d49d73%2F3000.jpeg",
                                    "twitter:image:alt": "En esta imagen del 8 de diciembre de 2015, un artista callejero en la plaza Usaquen, iluminada con el despliegue navideño, en Bogotá, Colombia. (AP Foto/Fernando Vergara)",
                                    "twitter:site": "@AP",
                                    "article:modified_time": "2021-10-27T04:44:59",
                                    "brightspot.contentid": "00000188-92b2-db7b-a7c8-d7f796120028",
                                    "thumbnail": "https://dims.apnews.com/dims4/default/9b7c821/2147483647/strip/true/crop/3000x1688+0+159/resize/1440x810!/quality/90/?url=https%3A%2F%2Fstorage.googleapis.com%2Fafs-prod%2Fmedia%2Fe2ec959fdf8944dc86c4a6e955d49d73%2F3000.jpeg",
                                    "og:image:alt": "En esta imagen del 8 de diciembre de 2015, un artista callejero en la plaza Usaquen, iluminada con el despliegue navideño, en Bogotá, Colombia. (AP Foto/Fernando Vergara)",
                                    "og:type": "article",
                                    "twitter:title": "Navidad a media luz en Colombia por temor a apagones",
                                    "og:image:url": "https://dims.apnews.com/dims4/default/9b7c821/2147483647/strip/true/crop/3000x1688+0+159/resize/1440x810!/quality/90/?url=https%3A%2F%2Fstorage.googleapis.com%2Fafs-prod%2Fmedia%2Fe2ec959fdf8944dc86c4a6e955d49d73%2F3000.jpeg",
                                    "ga-datalayer": "{\n  \"dimension1\" : \"3d685b8c26384a79bf3493fbf664794c\",\n  \"dimension15\" : \"Archive\",\n  \"Publication_Date\" : \"2015-12-24 07:10:20\",\n  \"Author\" : \"Cesar Garcia\"\n}",
                                    "og:title": "Navidad a media luz en Colombia por temor a apagones",
                                    "og:image:height": "810",
                                    "article:tag": "Archive",
                                    "fb:app_id": "2220391788200892",
                                    "viewport": "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5",
                                    "twitter:description": "BOGOTA, Colombia (AP) — Una brutal sequía provocada por el fenómeno de El Niño cobró una inesperada víctima en esta época festiva de fin de año: los alumbrados navideños.",
                                    "og:url": "https://apnews.com/article/3d685b8c26384a79bf3493fbf664794c",
                                    "gtm-datalayer": "{\n  \"event\" : \"Article Visited\",\n  \"Item_Id\" : \"3d685b8c26384a79bf3493fbf664794c\",\n  \"TagArray\" : \"Archive\",\n  \"item_ID\" : \"3d685b8c26384a79bf3493fbf664794c\",\n  \"tag_array\" : \"Archive\",\n  \"headline\" : \"Navidad a media luz en Colombia por temor a apagones\",\n  \"publication_date\" : \"2015-12-24 07:10:20\",\n  \"author\" : \"Cesar Garcia\",\n  \"linked_video\" : \"NO\",\n  \"pr_content\" : \"NO\",\n  \"featured\" : \"NO\",\n  \"lead_media\" : \"Photo\"\n}"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://dims.apnews.com/dims4/default/9b7c821/2147483647/strip/true/crop/3000x1688+0+159/resize/1440x810!/quality/90/?url=https%3A%2F%2Fstorage.googleapis.com%2Fafs-prod%2Fmedia%2Fe2ec959fdf8944dc86c4a6e955d49d73%2F3000.jpeg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A ...",
                        "htmlTitle": "Presidente De Ecuador Viaja A <b>Bogotá</b> Para Buscar Ayuda Frente A ...",
                        "link": "https://www.barrons.com/news/spanish/presidente-de-ecuador-viaja-a-bogota-para-buscar-ayuda-frente-a-crisis-energetica-f43956eb",
                        "displayLink": "www.barrons.com",
                        "content": "Oct 27, 2023 ... ... Bogotá con su par colombiano Gustavo Petro en busca ... Fenómeno El Niño, han afectado al sector eléctrico ecuatoriano. pld/ag. The Barron's news ...",
                        "htmlSnippet": "Oct 27, 2023 <b>...</b> ... <b>Bogotá</b> con su par colombiano Gustavo Petro en busca ... <b>Fenómeno</b> El <b>Niño</b>, han afectado al sector eléctrico ecuatoriano. pld/ag. The Barron&#39;s <b>news</b>&nbsp;...",
                        "formattedUrl": "https://www.barrons.com/news/.../presidente-de-ecuador-viaja-a-bogota-par...",
                        "htmlFormattedUrl": "https://www.barrons.com/<b>news</b>/.../presidente-de-ecuador-viaja-a-bogota-par...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcREXIh8aMXQWqHko98G4-6bOv16c-6Y4MN2goabQLgSXxPt0fcprK6dQwM",
                                    "width": "300",
                                    "height": "168"
                                }
                            ],
                            "metatags": [
                                {
                                    "article.origheadline": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A Crisis Energética",
                                    "og:image": "https://asset.barrons.com/barrons/images/afp-metadata-default.jpg",
                                    "twitter:card": "summary_large_image",
                                    "og:image:width": "1280",
                                    "dj.asn": "i-03f5",
                                    "chosenadtarget": "section:AFP Spanish;type:AFP News;id:AFP7531182178724780667203760989330542906224",
                                    "page.site.product": "BOL",
                                    "language": "es-ES",
                                    "datelastpubbed": "2023-10-28T00:55:00.000Z",
                                    "article.access": "paid",
                                    "og:description": "El presidente de Ecuador, Guillermo Lasso, informó que se reunirá el sábado en Bogotá con su par colombiano Gustavo Petro en busca de ayuda para enfrentar la crisis energética del país, donde este jueves inició un programa de racionamiento de electricidad de hasta cuatro horas.",
                                    "twitter:image:alt": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A Crisis Energética",
                                    "article.template": "full",
                                    "article.section": "AFP Spanish",
                                    "page.content.format": "responsive",
                                    "cxenseparse:wsj-display": "AFP News",
                                    "article:word_count": "359",
                                    "article.created": "2023-10-28T00:52:00.000Z",
                                    "author": "AFP - Agence France Presse",
                                    "og:locale": "en_US",
                                    "page.site": "Barrons Online",
                                    "cxenseparse:wsj-ad-page": "AFP News",
                                    "page.content.type": "Article",
                                    "article_availability_flag": "METER",
                                    "article.id": "AFP7531182178724780667203760989330542906224",
                                    "article.page": "News",
                                    "twitter:image": "https://asset.barrons.com/barrons/images/afp-metadata-default.jpg",
                                    "article.updated": "2023-10-28T00:52:00.000Z",
                                    "news_keywords": "ecuador,colombia,energía,sequía,meteorología,Ecuador,Colombia,SYND",
                                    "article.type.display": "AFP Spanish",
                                    "page.region": "na,us",
                                    "article.summary": "El presidente de Ecuador, Guillermo Lasso, informó que se reunirá el sábado en Bogotá con su par colombiano Gustavo Petro en busca de ayuda para enfrentar la crisis energética del país, donde este jueves inició un programa de racionamiento de electricidad de hasta cuatro horas.",
                                    "twitter:title": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A Crisis Energética",
                                    "og:type": "article",
                                    "servo-context": "servo:prod:oregon:article:barrons",
                                    "og:title": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A Crisis Energética",
                                    "og:image:height": "640",
                                    "page.content.source": "Barrons Online",
                                    "parsely-title": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A Crisis Energética",
                                    "page_editorial_keywords": "Ecuador,Colombia,energía,sequía,meteorología",
                                    "fb:app_id": "64579042740",
                                    "article.published": "2023-10-28T00:52:00.000Z",
                                    "viewport": "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no",
                                    "user.exp": "google_bot",
                                    "twitter:description": "El presidente de Ecuador, Guillermo Lasso, informó que se reunirá el sábado en Bogotá con su par colombiano Gustavo Petro en busca de ayuda para enfrentar la crisis energética del país, donde este jueves inició un programa de racionamiento de electricidad de hasta cuatro horas.",
                                    "user.type": "nonsubscriber",
                                    "article.headline": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A Crisis Energética",
                                    "og:url": "https://www.barrons.com/news/spanish/presidente-de-ecuador-viaja-a-bogota-para-buscar-ayuda-frente-a-crisis-energetica-f43956eb",
                                    "article.type": "AFP Spanish",
                                    "article:opinion": "false"
                                }
                            ],
                            "webpage": [
                                {
                                    "image": "https://asset.barrons.com/barrons/images/afp-metadata-default.jpg",
                                    "articlebody": "Text size El presidente de Ecuador, Guillermo Lasso, informó que se reunirá el sábado en Bogotá con su par colombiano Gustavo Petro en busca de ayuda para enfrentar la crisis energética...",
                                    "datemodified": "2023-10-28T00:52:00.000Z",
                                    "inlanguage": "es-ES",
                                    "description": "El presidente de Ecuador, Guillermo Lasso, informó que se reunirá el sábado en Bogotá con su par colombiano Gustavo Petro en busca de ayuda para enfrentar la crisis energética del país,...",
                                    "datecreated": "2023-10-28T00:52:00.000Z",
                                    "headline": "Presidente De Ecuador Viaja A Bogotá Para Buscar Ayuda Frente A Crisis Energética",
                                    "datepublished": "2023-10-28T00:52:00.000Z"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://asset.barrons.com/barrons/images/afp-metadata-default.jpg"
                                }
                            ],
                            "listitem": [
                                {
                                    "item": "FROM AFP NEWS",
                                    "name": "FROM AFP NEWS",
                                    "position": "1"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Colombia kicks-off new disaster risk reduction effort as El Niño takes ...",
                        "htmlTitle": "<b>Colombia</b> kicks-off new disaster risk reduction effort as El <b>Niño</b> takes ...",
                        "link": "https://reliefweb.int/report/colombia/colombia-kicks-new-disaster-risk-reduction-effort-el-nino-takes-hold",
                        "displayLink": "reliefweb.int",
                        "content": "Sep 8, 2023 ... News and Press Release in English on Colombia about Disaster Management, Drought and Flood; published on 7 Sep 2023 by PDC.",
                        "htmlSnippet": "Sep 8, 2023 <b>...</b> <b>News</b> and Press Release in English on <b>Colombia</b> about Disaster Management, Drought and Flood; published on 7 Sep 2023 by PDC.",
                        "cacheId": "59E0Er8dmdsJ",
                        "formattedUrl": "https://reliefweb.int/.../colombia-kicks-new-disaster-risk-reduction-effort-el-...",
                        "htmlFormattedUrl": "https://reliefweb.int/.../colombia-kicks-new-disaster-risk-reduction-effort-el-...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSX98RfnvyEpztuhAbf4vSu_UNrM4NRKfuH0PK1vcJGIpa8Nle8jj7mbDY",
                                    "width": "225",
                                    "height": "225"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://reliefweb.int/modules/custom/reliefweb_meta/images/disaster-type/DR.png",
                                    "og:type": "article",
                                    "twitter:card": "summary",
                                    "og:site_name": "ReliefWeb",
                                    "handheldfriendly": "true",
                                    "og:title": "Colombia kicks-off new disaster risk reduction effort as El Niño takes hold - Colombia",
                                    "og:description": "News and Press Release in English on Colombia about Disaster Management, Drought and Flood; published on 7 Sep 2023 by PDC",
                                    "fb:app_id": "1916193535375038",
                                    "twitter:site": "@reliefweb",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "mobileoptimized": "width",
                                    "original-source": "https://www.pdc.org/colombia-ndpba-kick-off-2023/",
                                    "og:url": "https://reliefweb.int/report/colombia/colombia-kicks-new-disaster-risk-reduction-effort-el-nino-takes-hold"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://reliefweb.int/modules/custom/reliefweb_meta/images/disaster-type/DR.png"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Neither el Niño nor la Niña expected in Colombia for first half of 2014",
                        "htmlTitle": "Neither el <b>Niño</b> nor la <b>Niña</b> expected in <b>Colombia</b> for first half of 2014",
                        "link": "https://colombiareports.com/neither-el-nino-la-nina-colombia-first-half-2014/",
                        "displayLink": "colombiareports.com",
                        "content": "Nov 15, 2013 ... Omar Franco told a national news outlet that while Colombia will likely be spared the worst of these seasonal abnormalities, the public should ...",
                        "htmlSnippet": "Nov 15, 2013 <b>...</b> Omar Franco told a national <b>news</b> outlet that while <b>Colombia</b> will likely be spared the worst of these seasonal abnormalities, the public should&nbsp;...",
                        "cacheId": "c-2ngnrpfB8J",
                        "formattedUrl": "https://colombiareports.com/neither-el-nino-la-nina-colombia-first-half-2014/",
                        "htmlFormattedUrl": "https://colombiareports.com/neither-el-nino-la-nina-colombia-first-half-2014/",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcSLACgGq-8nYj6nVVCnxzflahL03UuV0XEZQrR9-s0a9C3YDIvejsOZBhk",
                                    "width": "332",
                                    "height": "152"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://colombiareports.com/wp-content/uploads/2013/11/weather_f_elespectador.jpg",
                                    "og:type": "article",
                                    "article:published_time": "2013-11-15T12:06:48+00:00",
                                    "og:image:width": "770",
                                    "twitter:card": "summary_large_image",
                                    "og:site_name": "Colombia News | Colombia Reports",
                                    "author": "Taran Volckhausen",
                                    "og:title": "Neither el Niño nor la Niña expected in Colombia for first half of 2014",
                                    "og:image:height": "353",
                                    "twitter:label1": "Written by",
                                    "twitter:label2": "Est. reading time",
                                    "og:image:type": "image/jpeg",
                                    "msapplication-tileimage": "https://colombiareports.com/wp-content/uploads/2018/02/fav_cr.jpg",
                                    "og:description": "Colombia is not expected to feel the effects of the weather phenomena known as “El Niño” or “La Niña” this year, according to the Director of the country’s Institute of Hydrology, Meteorology,…",
                                    "twitter:creator": "@colombiareports",
                                    "article:publisher": "https://www.facebook.com/colombiareports",
                                    "twitter:data1": "Taran Volckhausen",
                                    "twitter:data2": "1 minute",
                                    "twitter:site": "@colombiareports",
                                    "article:modified_time": "2015-02-27T03:51:07+00:00",
                                    "viewport": "width=device-width, initial-scale=1",
                                    "og:locale": "en_US",
                                    "og:url": "https://colombiareports.com/neither-el-nino-la-nina-colombia-first-half-2014/"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://colombiareports.com/wp-content/uploads/2013/11/weather_f_elespectador.jpg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Precipitación y Temperatura - IDIGER",
                        "htmlTitle": "Precipitación y Temperatura - IDIGER",
                        "link": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "displayLink": "www.idiger.gov.co",
                        "content": "Lluvias y temperatura en Bogotá D.C. Contenido. Zona de Convergencia Intertropical - ZCIT; Fenómeno de El Niño y La Niña y variabilidad climática; Estaciones ...",
                        "htmlSnippet": "Lluvias y temperatura en <b>Bogotá</b> D.C. Contenido. Zona de Convergencia Intertropical - ZCIT; <b>Fenómeno</b> de El <b>Niño</b> y La <b>Niña</b> y variabilidad climática; Estaciones&nbsp;...",
                        "formattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "htmlFormattedUrl": "https://www.idiger.gov.co/en/precipitacion-y-temperatura",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRPKtxSxmgikPVyiCEGD-o03WYetRTpPl5nAxSez70926LNucnL-duvlIDq",
                                    "width": "315",
                                    "height": "160"
                                }
                            ],
                            "metatags": [
                                {
                                    "twitter:title": "IDIGER",
                                    "twitter:card": "summary_large_image",
                                    "viewport": "initial-scale=1.0, width=device-width",
                                    "twitter:image": "https://www.idiger.gov.co/documents/20182/25478/idiger.jpg"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.idiger.gov.co/documents/20182/1312633/Zona_Convergencia_Intertropical.png/c21db85e-32d3-4581-9619-0ada8fa1424d?t=1647537192625"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "PAHO/WHO Emergencies News - El fenómeno de La Niña hizo ...",
                        "htmlTitle": "PAHO/WHO Emergencies <b>News</b> - El <b>fenómeno</b> de La <b>Niña</b> hizo ...",
                        "link": "https://www3.paho.org/disasters/newsletter/458-el-fenomeno-de-la-nina-hizo-estragos-en-colombia-215-286-es.html",
                        "displayLink": "www3.paho.org",
                        "content": "Entre los grupos más afectados están los niños, adolescentes, mujeres embarazadas, ancianos y las personas con discapacidad quienes requieren protección ...",
                        "htmlSnippet": "Entre los grupos más afectados están los <b>niños</b>, adolescentes, mujeres embarazadas, ancianos y las personas con discapacidad quienes requieren protección&nbsp;...",
                        "cacheId": "cl9Nrrel9u0J",
                        "formattedUrl": "https://www3.paho.org/.../newsletter/458-el-fenomeno-de-la-nina-hizo-estra...",
                        "htmlFormattedUrl": "https://www3.paho.org/.../<b>news</b>letter/458-el-fenomeno-de-la-nina-hizo-estra...",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRJlUI2PB1f4ByF5oOqnjGhedbA0AFQ01idBWFGPwC8FdqC4jy9fI1vIak",
                                    "width": "276",
                                    "height": "183"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "/disasters/newsletter/images/stories/memberCountries/wpThumbnails/LaNina_Colombia.jpg",
                                    "og:type": "article",
                                    "twitter:card": "summary",
                                    "twitter:title": "El fenómeno de La Niña hizo estragos en Colombia",
                                    "og:site_name": "PAHO/WHO Emergencies News",
                                    "twitter:url": "/disasters/newsletter/458-el-fenomeno-de-la-nina-hizo-estragos-en-colombia-215-286-es.html",
                                    "author": "Victor Ariscain",
                                    "og:title": "El fenómeno de La Niña hizo estragos en Colombia",
                                    "og:updated_time": "2011-04-27 16:36:13",
                                    "og:description": "Según la Presidencia de la República y la Dirección de Gestión del Riesgo del Ministerio del Interior y de Justicia, la temporada invernal que soportó el país el año pasado cubrió cerca del 60% del territorio colombiano y dejó más de 2,4 millones de personas damnificadas, 323 fallecidos, 312 heridos, 66 desaparecidos, 7,450 viviendas destruidas, 298 acueductos y 16 alcantarillados afectados en 28 departamentos y 710 municipios, incluido el distrito Capital.",
                                    "twitter:image": "/disasters/newsletter/images/stories/memberCountries/wpThumbnails/LaNina_Colombia.jpg",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "twitter:description": "Según la Presidencia de la República y la Dirección de Gestión del Riesgo del Ministerio del Interior y de Justicia, la temporada invernal que soportó el país el año pasado cubrió cerca del 60% del territorio colombiano y dejó más de 2,4 millones de personas damnificadas, 323 fallecidos, 312 heridos, 66 desaparecidos, 7,450 viviendas destruidas, 298 acueductos y 16 alcantarillados afectados en 28 departamentos y 710 municipios, incluido el distrito Capital.",
                                    "og:published_time": "2011-04-20 13:26:39",
                                    "og:section": "Issue 115 - April 2011 Member Countries",
                                    "og:locale": "he_il",
                                    "og:url": "/disasters/newsletter/458-el-fenomeno-de-la-nina-hizo-estragos-en-colombia-215-286-es.html"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www3.paho.org/disasters/newsletter/images/stories/memberCountries/LaNina_Colombia.jpg"
                                }
                            ],
                            "article": [
                                {
                                    "articlebody": "Inundaciones en el departmento del Chocó Según la Presidencia de la República y la Dirección de Gestión del Riesgo del Ministerio del Interior y de Justicia, la temporada invernal que...",
                                    "inlanguage": "es-ES",
                                    "genre": "Issue 115 - April 2011 Member Countries",
                                    "headline": "El fenómeno de La Niña hizo estragos en Colombia"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Quetame: las imágenes de los efectos de la avalancha en Colombia ...",
                        "htmlTitle": "Quetame: las imágenes de los efectos de la avalancha en <b>Colombia</b> ...",
                        "link": "https://www.bbc.com/mundo/articles/cx7y6plg669o",
                        "displayLink": "www.bbc.com",
                        "content": "Jul 18, 2023 ... Y mientras las lluvias siguen generando tragedias como la de Quetame, los colombianos deben empezarse a preparar para el fenómeno ... Niño y La ...",
                        "htmlSnippet": "Jul 18, 2023 <b>...</b> Y mientras las lluvias siguen generando tragedias como la de Quetame, los colombianos deben empezarse a preparar para el <b>fenómeno</b> ... <b>Niño</b> y La&nbsp;...",
                        "cacheId": "tQOz_OKUn5IJ",
                        "formattedUrl": "https://www.bbc.com/mundo/articles/cx7y6plg669o",
                        "htmlFormattedUrl": "https://www.bbc.com/mundo/articles/cx7y6plg669o",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcSDKvgfLLM9hAYE_2hDVp9AFhJQOZEGhJqUBNQNfTxBeIOtcB8pUtXBKd0",
                                    "width": "300",
                                    "height": "168"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://ichef.bbci.co.uk/news/1024/branded_mundo/5291/live/eb670ef0-25a7-11ee-88ec-818f6a9d0486.jpg",
                                    "theme-color": "#B80000",
                                    "twitter:card": "summary_large_image",
                                    "article:published_time": "2023-07-18T21:21:58.284Z",
                                    "og:site_name": "BBC News Mundo",
                                    "apple-mobile-web-app-title": "BBC News Mundo",
                                    "msapplication-tileimage": "https://static.files.bbci.co.uk/ws/simorgh-assets/public/mundo/images/icons/icon-144x144.png",
                                    "og:description": "La vía al Llano, una importante carretera de 80 km que conecta Bogotá con Villavicencio, permanece cerrada.",
                                    "twitter:creator": "@bbcmundo",
                                    "twitter:image:alt": "Un rescatista con un perro entre los escombros",
                                    "twitter:site": "@bbcmundo",
                                    "article:modified_time": "2023-07-19T11:14:59.261Z",
                                    "application-name": "BBC News Mundo",
                                    "msapplication-tilecolor": "#B80000",
                                    "og:image:alt": "Un rescatista con un perro entre los escombros",
                                    "og:type": "article",
                                    "twitter:title": "Quetame: las imágenes de los efectos de la avalancha en Colombia que dejó al menos 15 muertos y múltiples desaparecidos - BBC News Mundo",
                                    "og:title": "Quetame: las imágenes de los efectos de la avalancha en Colombia que dejó al menos 15 muertos y múltiples desaparecidos - BBC News Mundo",
                                    "article:author": "https://www.facebook.com/bbcnews",
                                    "twitter:image:src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/5291/live/eb670ef0-25a7-11ee-88ec-818f6a9d0486.jpg",
                                    "article:tag": "Colombia",
                                    "fb:app_id": "1609039196070050",
                                    "viewport": "width=device-width, initial-scale=1, minimum-scale=1",
                                    "twitter:description": "La vía al Llano, una importante carretera de 80 km que conecta Bogotá con Villavicencio, permanece cerrada.",
                                    "mobile-web-app-capable": "yes",
                                    "og:locale": "es-005",
                                    "og:url": "https://www.bbc.com/mundo/articles/cx7y6plg669o"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://ichef.bbci.co.uk/news/1024/branded_mundo/5291/live/eb670ef0-25a7-11ee-88ec-818f6a9d0486.jpg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Latin America and the Caribbean | OCHA",
                        "htmlTitle": "Latin America and the Caribbean | OCHA",
                        "link": "https://www.unocha.org/latin-america-and-caribbean",
                        "displayLink": "www.unocha.org",
                        "content": "Colombia. Appeal. Colombia: Plan de Acciones Anticipatorias, Preparación y Respuesta - EHP - Fenómeno de El Niño (Noviembre 2023). El fenómeno de El Niño es un ...",
                        "htmlSnippet": "<b>Colombia</b>. Appeal. <b>Colombia</b>: Plan de Acciones Anticipatorias, Preparación y Respuesta - EHP - <b>Fenómeno</b> de El <b>Niño</b> (Noviembre 2023). El <b>fenómeno</b> de El <b>Niño</b> es un&nbsp;...",
                        "cacheId": "kydbhmAN7hAJ",
                        "formattedUrl": "https://www.unocha.org/latin-america-and-caribbean",
                        "htmlFormattedUrl": "https://www.unocha.org/latin-america-and-caribbean",
                        "pagemap": {
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn1.gstatic.com/images?q=tbn:ANd9GcRKA1Y3E-PKxSx0AmtSVWaq-5tmE5ndmMtTyvAuJiHiVWR5zacosBA1Ault",
                                    "width": "310",
                                    "height": "163"
                                }
                            ],
                            "metatags": [
                                {
                                    "og:image": "https://www.unocha.org/sites/default/files/styles/social_facebook_og/public/2023-06/130_Guatemala2022_Tremeau_1R6A0091.jpg",
                                    "og:image:width": "1200",
                                    "og:image:alt": "Picture of the rolling and firested hills of Camotán in Guatemala",
                                    "twitter:card": "summary_large_image",
                                    "twitter:title": "Latin America and the Caribbean",
                                    "handheldfriendly": "true",
                                    "og:title": "Latin America and the Caribbean",
                                    "og:image:height": "630",
                                    "twitter:image": "https://www.unocha.org/sites/default/files/styles/social_twitter_card/public/2023-06/130_Guatemala2022_Tremeau_1R6A0091.jpg",
                                    "twitter:image:alt": "Picture of the rolling and firested hills of Camotán in Guatemala",
                                    "twitter:site": "@UNOCHA",
                                    "viewport": "width=device-width, initial-scale=1.0",
                                    "mobileoptimized": "width"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.unocha.org/sites/default/files/styles/social_facebook_og/public/2023-06/130_Guatemala2022_Tremeau_1R6A0091.jpg"
                                }
                            ]
                        }
                    },
                    {
                        "kind": "customsearch#result",
                        "title": "Los efectos del fenómeno de El Niño en Bogotá / Opinión de Ómar ...",
                        "htmlTitle": "Los efectos del <b>fenómeno</b> de El <b>Niño</b> en <b>Bogotá</b> / Opinión de Ómar ...",
                        "link": "https://www.eltiempo.com/bogota/los-efectos-del-fenomeno-de-el-nino-en-bogota-opinion-de-omar-orostegui-778995",
                        "displayLink": "www.eltiempo.com",
                        "content": "Jun 20, 2023 ... ... Bogotá. ÓMAR ORÓSTEGUI Director del laboratorio de gobierno de la Universidad de La Sabana. Reciba noticias de EL TIEMPO desde GoogleNews. SB.",
                        "htmlSnippet": "Jun 20, 2023 <b>...</b> ... <b>Bogotá</b>. ÓMAR ORÓSTEGUI Director del laboratorio de gobierno de la Universidad de La Sabana. Reciba noticias de EL TIEMPO desde Google<b>News</b>. SB.",
                        "cacheId": "PYq9-0RH258J",
                        "formattedUrl": "https://www.eltiempo.com/.../los-efectos-del-fenomeno-de-el-nino-en-bogo...",
                        "htmlFormattedUrl": "https://www.eltiempo.com/.../los-efectos-<b>del</b>-fenomeno-de-el-nino-en-bogo...",
                        "pagemap": {
                            "hcard": [
                                {
                                    "fn": "Ómar Oróstegui"
                                },
                                {
                                    "fn": "Ómar Oróstegui"
                                }
                            ],
                            "cse_thumbnail": [
                                {
                                    "src": "https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcRLsvDa0WYmdPBRm-zBEX5Gw4pP_sr9Yma4PV2AcwmSidgn1XJD4S1WBy0",
                                    "width": "300",
                                    "height": "168"
                                }
                            ],
                            "imageobject": [
                                {
                                    "width": "950",
                                    "url": "https://www.eltiempo.com/files/image_950_534/uploads/2023/02/26/63fb44cd683f8.jpeg",
                                    "height": "534"
                                },
                                {
                                    "width": "652",
                                    "url": "https://www.eltiempo.com/files/article_content_new/uploads/2023/01/27/63d3f325128e0.jpeg",
                                    "height": "366"
                                }
                            ],
                            "person": [
                                {
                                    "name": "Ómar Oróstegui"
                                },
                                {
                                    "name": "Ómar Oróstegui"
                                }
                            ],
                            "metatags": [
                                {
                                    "date": "2023-06-19T22:45:00-05:00",
                                    "og:image": "https://www.eltiempo.com/files/image_950_534/uploads/2023/02/26/63fb44cd683f8.jpeg",
                                    "twitter:card": "summary_large_image",
                                    "og:image:width": "200",
                                    "article:published_time": "2023-06-19T22:45:00-05:00",
                                    "og:site_name": "El Tiempo",
                                    "bingbot": "index, follow",
                                    "language": "spanish",
                                    "og:image:type": "image/jpeg",
                                    "geo.position": "4.570868;-74.297333",
                                    "twitter:creator": "@ELTIEMPO",
                                    "og:description": "Es urgente que gobiernos locales mejoren sus instrumentos de respuesta ante diferentes escenarios.",
                                    "twitter:image": "https://www.eltiempo.com/files/image_1200_680/uploads/2023/02/26/63fb44cd683f8.jpeg",
                                    "mrf:tags": "CategoriaContenido:Estándar;TipoContenido:Articulo;RedactorContenido:Ómar Oróstegui;SeccionContenido:Bogota",
                                    "twitter:site": "@ELTIEMPO",
                                    "icbm": "4.570868, -74.297333",
                                    "article:modified_time": "2023-06-20T15:22:08-05:00",
                                    "news_keywords": "los, efectos, del, fenomeno, de, el, nino, en, bogota, opinion",
                                    "genre": "News",
                                    "fb:admins": "100002279652972",
                                    "og:video:type": "youtube_v3",
                                    "og:video:height": "300",
                                    "twitter:title": "Los efectos del fenómeno de El Niño en Bogotá / Opinión",
                                    "og:type": "article",
                                    "geo.region": "CO",
                                    "og:image:url": "https://www.eltiempo.com/files/image_950_534/uploads/2023/02/26/63fb44cd683f8.jpeg",
                                    "author": "Casa Editorial El Tiempo",
                                    "og:title": "Los efectos del fenómeno de El Niño en Bogotá / Opinión",
                                    "og:image:height": "200",
                                    "google": "notranslate",
                                    "og:video:width": "400",
                                    "dc.date.issued": "2023-06-19T22:45:00-05:00",
                                    "article:author": "Ómar Oróstegui",
                                    "article:tag": "Bogotá",
                                    "fb:app_id": "865245646889167",
                                    "og:locale:alternate": "es_CO",
                                    "og:video": "https://www.youtube.com/watch?v=sEaPb_CZOZk",
                                    "viewport": "width=device-width",
                                    "twitter:description": "Es urgente que gobiernos locales mejoren sus instrumentos de respuesta ante diferentes escenarios.",
                                    "og:locale": "es_CO",
                                    "og:url": "https://www.eltiempo.com/bogota/los-efectos-del-fenomeno-de-el-nino-en-bogota-opinion-de-omar-orostegui-778995",
                                    "geo.placename": "Colombia",
                                    "format-detection": "telephone=no"
                                }
                            ],
                            "videoobject": [
                                {
                                    "embedurl": "https://www.youtube.com/embed/sEaPb_CZOZk",
                                    "uploaddate": "2023-06-20",
                                    "name": "Bogotá: ¿vientos de agosto desde junio?",
                                    "description": "Mañanas con tiempo seco, bajas temperaturas y viento frío es lo que por estos días se ha registrado en Bogotá. Según expertos, la condición de disminución de las temperaturas es muy...",
                                    "thumbnailurl": "https://www.eltiempo.com/files/image_950_534/uploads/2023/02/26/63fb44cd683f8.jpeg"
                                }
                            ],
                            "cse_image": [
                                {
                                    "src": "https://www.eltiempo.com/files/image_950_534/uploads/2023/02/26/63fb44cd683f8.jpeg"
                                }
                            ],
                            "sitenavigationelement": [
                                {
                                    "name": "Opinión",
                                    "url": "Opinión"
                                }
                            ]
                        }
                    }
                ]
            }
        ];

        dataPaginated = dummy.dataPaginated;
        let diccionarios_principal = dummy.diccionarios_principal;
        let diccionarios_ligado = dummy.diccionarios_ligado;

        let dataPaginatedCreated: any = await this.generateFountsService.createElementsMath(
            dataPaginated,
            diccionarios_principal,
            diccionarios_ligado
        );

        dataPaginatedCreated = this.showLocations(dataPaginatedCreated);


        //crear el axcel
        var xl = require('excel4node');

        const wb = new xl.Workbook();
        const ws = wb.addWorksheet('Matriz');

        const headingColumnNames: any = Object.keys(dataPaginatedCreated[0]);

        let headingColumnIndex = 1;

        const bgStyleHeader1 = wb.createStyle({
            fill: {
                type: 'pattern',
                patternType: 'solid',
                bgColor: '#002060',
                fgColor: '#FFFFFF',
            },
            border: {
                left: {
                    style: "medium",
                    //§18.18.3 ST_BorderStyle (Border Line Styles) 
                    //['none', 'thin', 'medium', 'dashed', 'dotted', 'thick', 'double', 'hair', 
                    //'mediumDashed', 'dashDot', 'mediumDashDot', 'dashDotDot', 'mediumDashDotDot', 'slantDashDot']
                    color: "#000000" // HTML style hex value
                },
                right: {
                    style: "medium",
                    color: "#000000"
                },
                top: {
                    style: "medium",
                    color: "#000000"
                },
                bottom: {
                    style: "medium",
                    color: "#000000"
                }
            },
        });

        const bgStyleHeader2 = wb.createStyle({
            fill: {
                type: 'pattern',
                patternType: 'solid',
                bgColor: '#375623',
                fgColor: '#FFFFFF',
            }
        });

        ws.cell(1, headingColumnIndex)
            .style(bgStyleHeader1);
        ws.cell(1, headingColumnIndex)
            .string("Matriz Fuentes Secundarias");

        //falta revisar para que pueda fijar las header
        /* 
        ws.column(2).freeze(4); // Freezes the first two columns and scrolls the right view to column D
        ws.row(4).freeze(); // Freezes the top four rows 
        */

        headingColumnNames.forEach(heading => {

            ws.cell(2, headingColumnIndex++)
                .string(heading)
            ws.cell(2, headingColumnIndex++)
                .style(bgStyleHeader2);


        });

        let rowIndex = 3;

        dataPaginatedCreated.forEach(record => {
            let columnIndex = 1;

            for (let index = 0; index < headingColumnNames.length; index++) {
                const columnName = headingColumnNames[index];
                let columnNameBefore = "";
                if (index - 1 >= 0)
                    columnNameBefore = headingColumnNames[index - 1];
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
                        let columnArrayKeys: any = Object.keys(record[columnName]);

                        //if (columnArrayKeys[0] == 'searchs' || columnArrayKeys[0] == 'matrizPrincipalLigado') {
                        ws.cell(rowIndex, columnIndex++)
                            .string(JSON.stringify(record[columnName]))
                        break;
                    //}

                    //debo agregar una columna para poner lo que voy a imprimir y
                    // que vendria siendo las localizaciones en el headingColumnNames
                    // llamado "localizaciones"

                    //1
                    /*
                    [
                      {
                        'ciudad:colombia departamento:Huila': 1,
                        'ciudad:bogota departamento:Cundinamarca': 0
                      } 
                    ]
                    */

                    /* {localization: {
                      'ciudad:colombia departamento:Huila': 1,
                      'ciudad:bogota departamento:Cundinamarca': 0
                    }} 
          
          
                    break;*/

                    default:
                        ws.cell(rowIndex, columnIndex++)
                            .string(JSON.stringify(record[columnName]))
                        break;
                }

                //});
            }

            rowIndex++;
        });

        //falta terminar ojo importante para set area de impresion
        //ws.setPrintArea(startRow, startCol, endRow, endCol)

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

        //return { dataPaginatedCreated, diccionarios_principal, diccionarios_ligado };
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

    orderOject(unordered) {

        const ordered = Object.keys(unordered).sort().reduce(
            (obj, key) => {
                obj[key] = unordered[key];
                return obj;
            },
            {}
        );

        return ordered;
    }

    showLocations(dataPaginatedCreated) {

        let dataPaginatedCreatedLocations: any = [];
        let dataPaginatedCreatedEnd: any = [];

        for (let index = 0; index < dataPaginatedCreated.length; index++) {
            let element = dataPaginatedCreated[index];
            let elementKeyArray = Object.keys(element);
            let elementValueArray = Object.values(element);
            let indexLimit = elementKeyArray.indexOf("matrizPrincipalLigado");

            let elementFormaed: any = {};

            for (let j = 0; j < elementKeyArray.length; j++) {

                const elementKey = elementKeyArray[j];
                let elementValue: any = elementValueArray[j];
                let indexCurrent = elementKeyArray.map(function (e) { return e; }).indexOf(elementKey);

                //no mover o no saldra los demas valores del elemento del objeo general
                elementFormaed[elementKey] = elementValue;

                if (indexCurrent == indexLimit) {

                    if (!elementFormaed?.Localizacion)
                        elementFormaed.Localizacion = [];
                    if (!elementFormaed?.wordlocation)
                        elementFormaed.wordlocation = [];
                }

                if (indexCurrent > indexLimit) {

                    if (!elementValue?.localization) {
                        //elementValue.localization
                        elementFormaed.Localizacion.push('INDEFINIDO');
                        elementFormaed.wordlocation.push({ elementKey: elementKey, value: 0, key: 'INDEFINIDO' });
                        continue;
                    }

                    elementValue.localization = this.orderOject(elementValue.localization);
                    //{location: 1}, {location: 1}, {location: 1}

                    let localizationsKeyArray = Object.keys(elementValue.localization);
                    let localizationsValueArray = Object.values(elementValue.localization);

                    for (let k = 0; k < localizationsValueArray.length; k++) {

                        const localizationValue = localizationsValueArray[k];
                        const localizationKey = localizationsKeyArray[k];

                        elementFormaed.Localizacion.push(localizationKey);
                        elementFormaed.wordlocation.push({ elementKey: elementKey, value: localizationValue, key: localizationKey });
                    }
                }

            }

            dataPaginatedCreatedLocations.push(elementFormaed);

        }

        //imprimir aqui

        for (let p = 0; p < dataPaginatedCreatedLocations.length; p++) {
            let elementP = dataPaginatedCreatedLocations[p];
            let elementModified: any = {};

            let groupBylocation = this.helperService.groupBy(elementP.wordlocation, 'key');
            console.log("groupBylocation", groupBylocation);

            let groupBylocationValue: any = Object.values(groupBylocation);
            let groupBylocationKey: any = Object.keys(groupBylocation);

            delete elementP.wordlocation

            for (let m = 0; m < groupBylocationKey.length; m++) {
                elementModified = { ...elementP };

                const groupLocationKey: any = groupBylocationKey[m];
                //const groupLocationValue: any = groupBylocation[groupLocationKey];
                const groupLocationValue: any = groupBylocationValue[m];

                for (let n = 0; n < groupLocationValue.length; n++) {
                    const group = groupLocationValue[n];
                    console.log("group", group);
                    elementModified[group.elementKey] = group.value ? group.value : 0;
                    elementModified.Localizacion = group.key;
                }
                //elementModified.Localizacion = groupLocationKey;

                dataPaginatedCreatedEnd.push(elementModified);

            }

        }

        return dataPaginatedCreatedEnd;

    }
}
