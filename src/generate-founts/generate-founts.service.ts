import { Logger, Injectable } from '@nestjs/common';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { Observable, firstValueFrom, catchError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { url_provider_locationscolombia } from '../config.service';
import { LocationsCo } from '../interfaces/locations-co/locations-co.interface'
import { Console } from 'console';

@Injectable()
export class GenerateFountsService {

  private readonly logger = new Logger(GenerateFountsService.name);

  constructor(
    private readonly httpService: HttpService,

  ) { }

  create(createGenerateFountDto: CreateGenerateFountDto) {
    return 'This action adds a new generateFount';
  }

  findAll() {
    return `This action returns all generateFountss`;
  }

  findOne(id: number) {
    return `This action returns a #${id} generateFount`;
  }

  update(id: number, updateGenerateFountDto: UpdateGenerateFountDto) {
    return `This action updates a #${id} generateFount`;
  }

  remove(id: number) {
    return `This action removes a #${id} generateFount`;
  }

  /**
   * OJO LOS DICCINARIOS NO SON CORRESPONDIENTES CON LAS PALABRAS CLAVE
   * @param dataPaginated 
   * @returns 
   */
  async createElementsMath(elements: any, diccionarios_principal_object, diccionarios_ligado_object) {

    //ubicacion de las noticias
    /**
     * PALABRA CLAVE      UBICACION
     * fenomeno del niño  NORTE DE SANTANDER 
     * 
     * si la noticias hace math con este objeto 
     *  {"region": "Región Centro Oriente","c_digo_dane_del_departamento": "54","departamento": "Norte de Santander","c_digo_dane_del_municipio": "54.743","municipio": "Silos"}, 
     * se agrega a un arreglo con ese objeto 
     * y la cantidad de veces con las que vuelva a hacer math 
     * si no hace math se agrega otro a este arreglo (elements)
     * con la cantidad de 1
     */

    let elementsMathed = [];

    let locations: any = await this.getContentWeb(url_provider_locationscolombia, {}, null);

    let headerWorks: string[] = [];
    //hace la compraracion de los element con el contenido para que si hace math estos locaciones se defian
    //por noticia es decir cuantas noticias en esa localidad hablan de esa noticia es decir tema o palabra clave

    //inicializar contadores y contar
    //mathed
    for (let index = 0; index < elements.length; index++) {

      let element = elements[index];

      let diccionarios_principal: string[] = [];
      let diccionarios_ligado: string[] = [];
      //el elemento con su categoria define el diccionario de datos a usar

      let diccionarios_principal_values: any[] = Object.values(diccionarios_principal_object);
      let diccionarios_ligado_values: any[] = Object.values(diccionarios_ligado_object);

      let diccionarios_principal_keys: any[] = Object.keys(diccionarios_principal_object);
      let diccionarios_ligado_keys: any[] = Object.keys(diccionarios_ligado_object);

      let id_diccionario_ligado = element.id_diccionario_ligado;

      let index_dicc_principal = diccionarios_principal_keys.findIndex(el => el == id_diccionario_ligado);
      let index_dicc_ligado = diccionarios_ligado_keys.findIndex(el => el == id_diccionario_ligado);

      if (index_dicc_principal !== -1) {

        diccionarios_principal = diccionarios_principal_values[index_dicc_principal];

      }/*  else {
        continue;
      } */

      if (index_dicc_ligado !== -1) {

        diccionarios_ligado = diccionarios_ligado_values[index_dicc_ligado];

      } /* else {
        continue;
      } */

      let matrizPrincipalLigado: any[] = [];

      //REALIZANDO MATH CON EL DICCIONARIO PRINCIPAL
      for (const diccionario_principal_original of diccionarios_principal) {

        //optimizacion de palabras
        let diccionario_principal: string = diccionario_principal_original.toLowerCase()
        diccionario_principal = this.removeAccents(diccionario_principal/* this.removeSpaces() */);

        //realizo la combinatorio de los diccionarios
        for (const diccionario_ligado_original of diccionarios_ligado) {

          //optimizacion de palabras
          let diccionario_ligado: string = diccionario_ligado_original.toLowerCase()
          diccionario_ligado = this.removeAccents(diccionario_ligado/* this.removeSpaces() */);

          /* console.log("diccionario_ligado diccionario_ligado: ", diccionario_principal + ' - ' + diccionario_ligado);
          console.log("k m: ", k + ' - ' + m); */

          if (diccionario_principal !== undefined && diccionario_ligado !== undefined && diccionario_principal !== '' && diccionario_ligado !== '') {

            matrizPrincipalLigado.push([diccionario_principal, diccionario_ligado]);
            matrizPrincipalLigado.push([diccionario_ligado, diccionario_principal]);

          }

        }

      }

      let new_searchs = [];

      for (const search of element.searchs) {
        let contenido = search.content;

        //optimizacion de palabras
        let data_content_minus = contenido.toLowerCase();
        let data_content = this.removeAccents(data_content_minus);
        //poner aqui remover signos de puntuacion

        //BUSQUEDA EN MATRIZ DE COMBINACION DE DICCONARIO PRINCIPAL CON LIGADO 
        //BUSQUEDA EN MATRIZ INVERSA DE COMBINACION DE DICCONARIO LIGADO CON PRINCIPAL

        console.log("matrizPrincipalLigado Palabra clave", element['Palabra clave']);
        console.log("matrizPrincipalLigado tamaño", matrizPrincipalLigado.length);
        console.log("matrizPrincipalLigado 0", matrizPrincipalLigado[0]);

        if (index > 1 && elements.length > 1) {
          console.log("estado de proceso", (index / (elements.length - 1)) * 100);
        }


        for (const pairWords of matrizPrincipalLigado) {

          if (pairWords.length == 2) {
            //init contadores
            let countMathes = this.buscarDosPalabras(data_content, pairWords[0], pairWords[1]);

            if (countMathes > 0) {

              const pairwordsmath = pairWords[0] + '+' + pairWords[1];

              if (!element[pairwordsmath]) {
                element[pairwordsmath] = 0;
              }

              element[pairwordsmath]++;

              headerWorks.push(pairwordsmath);

            }

          }
        }

        //REALIZANDO MATH CON LOS PAISES
        for (const location of locations.data) {

          //optimizacion de palabras
          location.region = location.region.toLowerCase();
          location.region = this.removeAccents(location.region);

          location.departamento = location.departamento.toLowerCase();
          location.departamento = this.removeAccents(location.departamento);
          //error con bogota d.c
          location.departamento = location.departamento.replace(" d.c.", "")

          location.municipio = location.municipio.toLowerCase();
          location.municipio = this.removeAccents(location.municipio);
          //error con bogota d.c
          location.municipio = location.municipio.replace(" d.c.", "");
          /*    
            * se agrega a un arreglo con ese objeto 
            * y la cantidad de veces con las que vuelva a hacer math 
            * si no hace math se agrega otro a este arreglo (elements)
            * con la cantidad de 1
            * 
          */
          if (data_content.includes(location.region)) {
            console.log("SI ubo math de locacion")

            if (!element[location.region]) {
              element[location.region] = 0;
            }
            element[location.region]++;
          }

          if (data_content.includes(location.departamento)) {
            console.log("SI ubo math de locacion")

            if (!element[location.departamento]) {
              element[location.departamento] = 0;
            }

            element[location.departamento]++;

          }

          if (data_content.includes(location.municipio)) {
            console.log("SI ubo math de locacion")

            if (!element[location.municipio]) {
              element[location.municipio] = 0;
            }

            element[location.municipio]++;
          }

        }

        new_searchs.push({
          title: search.title,
          displayLink: search.displayLink,
          formattedUrl: search.formattedUrl
        });

      }

      element.searchs = new_searchs;
      element.matrizPrincipalLigado = matrizPrincipalLigado;

      elementsMathed.push(element);

    }

    //es mejor despuesde de para que se cuenten los registros correspondientes
    for (let n = 0; n < elementsMathed.length; n++) {
      let elementCustomWord = elementsMathed[n];
      let keys = Object.keys(elementCustomWord);

      for (const word of headerWorks) {

        let indexWord = keys.indexOf(word);

        if (indexWord == -1) {
          elementsMathed[word] = 0;
        }

      }

    }

    console.log("elementsMathed[0]", elementsMathed[0]);
    console.log("headerWorks[0]", headerWorks[0]);

    return elementsMathed;
  }

  removeAccents(str: string) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
  }

  removeSpaces(str: string) {
    return str ? str.replaceAll(' ', '') : str;
  }

  getContentWeb(link, snippet, config) {
    return new Promise(async (resolve, reject) => {
      try {

        let data = await firstValueFrom(
          this.httpService.get<any>(link, config)
            .pipe(
              catchError((error: any) => {
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
  buscarDosPalabras(texto, palabra1, palabra2) {
    texto = this.removeSpaces(texto);

    palabra1 = this.removeSpaces(palabra1);
    palabra2 = this.removeSpaces(palabra2);

    let index = texto.indexOf(palabra1);
    let coincidencias = 0;
    let cantMaxWordsMiddles = 4;

    if (index > 0) {
      if (palabra1 == "altera")
        console.log("PALABRA1", palabra1)

      //for (let indexMax = 0; indexMax < cantMaxWordsMiddles; indexMax++) {

      let subtexto = texto.substr(index, texto.length - 1);

      console.log("subtexto", subtexto)

      let index2 = subtexto.indexOf(palabra2);
      console.log("palabra2", palabra2)
      console.log("index2", index2)

      if (index2 == 0) {
        coincidencias++;
      }

      //}
    }

    return coincidencias;
  }

  buscarDosPalabras_(texto, palabra1, palabra2) {

    const palabras = texto.split(" ");
    let coincidencias = 0;

    let arrayPalabra1 = palabra1.split(" ");
    let arrayPalabra2 = palabra2.split(" ");

    //quitar espacios si la palabra es solo una
    if (arrayPalabra1.length == 2) {
      palabra1 = this.removeSpaces(palabra1);
    }

    //quitar espacios si la palabra es solo una
    if (arrayPalabra2.length == 2) {
      palabra2 = this.removeSpaces(palabra2);
    }

    console.log("existe el par", texto.includes(palabra1) && texto.includes(palabra2));

    for (let i = 0; i < palabras.length - 1; i++) {

      let currentWord = palabras[i];
      let nextOneWord = palabras[i + 1];
      let nextTwoWord = palabras[i + 2];
      let nextThreeWord = palabras[i + 3];
      let nextFourWord = palabras[i + 4];

      //eliminar puntos comas acentos a la palabra
      /* console.log("currentWord", currentWord)
      console.log("nextOneWord", nextOneWord) */

      if (palabra1.includes("altera") && palabra2.includes("exacerbadas")) {

        if (currentWord.includes(palabra1) || nextOneWord.includes(palabra2)) {

          console.log("palabra1 " + palabra1 + " palabra2 ", palabra2)
          console.log("PALABRAS CURRENT      :", currentWord)
          console.log("PALABRAS nextOneWord      :", nextOneWord)
          console.log("--------------------------------------------")
          console.log("currentWord.includes(palabra1)", currentWord.includes(palabra1))
          console.log("nextOneWord.includes(palabra2)", nextOneWord.includes(palabra2))
          console.log("--------------------------------------------")
        }

      }

      // sin son mas de una palabra que se va  ahacer math

      if (arrayPalabra1 > 2 || arrayPalabra2 > 2) {

        let contAcertWord1 = 0;
        //palabraa palabrab palabrac
        if (currentWord.includes(arrayPalabra1[0])) {
          contAcertWord1++

          for (let indexword = 1; indexword < arrayPalabra1.length; indexword++) {
            const word1 = arrayPalabra1[indexword];

            if (word1 == currentWord[i + indexword]) {
              contAcertWord1++
            }

          }

          if (arrayPalabra1.length == contAcertWord1) {

            coincidencias++;
          }
        }


        if (currentWord.includes(palabra1) && nextTwoWord.includes(palabra2)) {
          coincidencias++;
        }

        if (currentWord.includes(palabra1) && nextThreeWord.includes(palabra2)) {
          coincidencias++;
        }

        if (currentWord.includes(palabra1) && nextFourWord.includes(palabra2)) {
          coincidencias++;
        }

      } else {

        if (currentWord.includes(palabra1) && nextOneWord.includes(palabra2)) {
          coincidencias++;
        }

        if (currentWord.includes(palabra1) && nextTwoWord.includes(palabra2)) {
          coincidencias++;
        }

        if (currentWord.includes(palabra1) && nextThreeWord.includes(palabra2)) {
          coincidencias++;
        }

        if (currentWord.includes(palabra1) && nextFourWord.includes(palabra2)) {
          coincidencias++;
        }

      }
    }

    return coincidencias;
  }
}
