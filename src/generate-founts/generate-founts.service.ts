import { Logger, Injectable } from '@nestjs/common';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { Observable, firstValueFrom, catchError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { url_provider_locationscolombia } from '../config.service';
import { HelperService } from '../services/helper/helper.service';
import { LocationsCo } from '../interfaces/locations-co/locations-co.interface'

@Injectable()
export class GenerateFountsService {

  private readonly logger = new Logger(GenerateFountsService.name);

  constructor(
    private readonly httpService: HttpService,
    public helper: HelperService

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
    let headerLocations: string[] = [];

    let locationsRegion = this.helper.groupBy(locations.data, 'region');
    let locationsDepartamento = this.helper.groupBy(locations.data, 'departamento');

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

      }

      if (index_dicc_ligado !== -1) {

        diccionarios_ligado = diccionarios_ligado_values[index_dicc_ligado];

      }

      let matrizPrincipalLigado: any[] = [];

      //REALIZANDO MATH CON EL DICCIONARIO PRINCIPAL
      for (const diccionario_principal_original of diccionarios_principal) {

        //optimizacion de palabras
        let diccionario_principal: string = diccionario_principal_original.toLowerCase()
        diccionario_principal = this.removeAccents(diccionario_principal/* this.removeChar() */);

        //realizo la combinatorio de los diccionarios
        for (const diccionario_ligado_original of diccionarios_ligado) {

          //optimizacion de palabras
          let diccionario_ligado: string = diccionario_ligado_original.toLowerCase()
          diccionario_ligado = this.removeAccents(diccionario_ligado/* this.removeChar() */);

          if (diccionario_principal !== undefined && diccionario_ligado !== undefined && diccionario_principal !== '' && diccionario_ligado !== '') {

            matrizPrincipalLigado.push([diccionario_principal, diccionario_ligado]);
            matrizPrincipalLigado.push([diccionario_ligado, diccionario_principal]);

          }

        }

      }

      //set matriz ligado
      element.matrizPrincipalLigado = matrizPrincipalLigado;

      let new_searchs = [];

      for (const search of element.searchs) {
        let contenido = search.content;

        console.log("contenido", contenido?.length)

        //optimizacion de palabras
        let data_content_minus = contenido.toLowerCase();
        let data_content = this.removeAccents(data_content_minus);
        //poner aqui remover signos de puntuacion

        //BUSQUEDA EN MATRIZ DE COMBINACION DE DICCONARIO PRINCIPAL CON LIGADO 
        //BUSQUEDA EN MATRIZ INVERSA DE COMBINACION DE DICCONARIO LIGADO CON PRINCIPAL

        for (const pairWords of matrizPrincipalLigado) {
          console.log("progres math words", (elements.length > 0 ? index / elements.length : 1) * 100)

          if (pairWords.length == 2) {
            //init contadores
            let countMathes = this.buscarDosPalabras(data_content, pairWords[0], pairWords[1]);

            if (countMathes > 0) {

              const pairwordsmath = pairWords[0] + '+' + pairWords[1];

              if (!element[pairwordsmath]) {
                element[pairwordsmath] = 0;
              }

              element[pairwordsmath]++;

              if (!headerWorks.includes(pairwordsmath)) {
                headerWorks.push(pairwordsmath);

              }

            }

          }
        }


        /*    
          * se agrega a un arreglo con ese objeto 
          * y la cantidad de veces con las que vuelva a hacer math 
          * si no hace math se agrega otro a este arreglo (elements)
          * con la cantidad de 1
          * 
        */

        //REALIZANDO MATH CON LOS PAISES este hace por municipio
        for (const location of locations.data) {

          let municipio = location.municipio.toLowerCase();
          municipio = this.removeAccents(municipio);
          //error con bogota d.c
          municipio = municipio.replace(" d.c.", "");

          if (data_content.includes(municipio)) {

            let head3 = "municipio:" + municipio;

            if (!element[head3]) {
              element[head3] = 0;
            }

            element[head3]++;

            if (!headerLocations.includes(head3)) {
              headerLocations.push(head3);
            }
          }
        }

        for (let region of Object.keys(locationsRegion)) {

          //optimizacion de palabras
          region = region.toLowerCase();
          region = this.removeAccents(region);
          if (data_content.includes(region)) {

            let head1 = "region:" + region;

            if (!element[head1]) {
              element[head1] = 0;
            }
            element[head1]++;

            if (!headerLocations.includes(head1)) {
              headerLocations.push(head1);
            }
          }

        }

        for (let departamento of Object.keys(locationsDepartamento)) {

          departamento = departamento.toLowerCase();
          departamento = this.removeAccents(departamento);
          //error con bogota d.c
          departamento = departamento.replace(" d.c.", "")
  
          if (data_content.includes(departamento)) {
  
            let head2 = "departamento:" + departamento;
  
            if (!element[head2]) {
              element[head2] = 0;
            }
  
            element[head2]++;
  
            if (!headerLocations.includes(head2)) {
              headerLocations.push(head2);
            }
  
          }
          
        }

        new_searchs.push({
          title: search.title,
          displayLink: search.displayLink,
          formattedUrl: search.formattedUrl
        });

      }

      element.searchs = new_searchs;

      elementsMathed.push(element);

    }
    console.log("headerLocations", headerLocations)
    console.log("headerWorks", headerWorks)

    //es mejor despuesde de para que se cuenten los registros correspondientes
    for (let n = 0; n < elementsMathed.length; n++) {
      let elementCustomWord = elementsMathed[n];
      let keys = Object.keys(elementCustomWord);

      for (const word of headerWorks) {

        let indexWord = keys.indexOf(word);

        if (indexWord == -1) {
          elementCustomWord[word] = 0;
        }

      }

      for (const location of headerLocations) {

        let indexWordLocations = keys.indexOf(location);

        console.log("indexWordLocations", indexWordLocations);

        if (indexWordLocations == -1) {
          elementCustomWord[location] = 0;
        }

      }


    }

    return elementsMathed;
  }

  removeAccents(str: string) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
  }

  removeChar(str: string, char) {
    return str ? str.replaceAll(char, '') : str;
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

    console.log("buscarDosPalabras", palabra1 + palabra2)

    let wordsTexto = texto.split(" ");
    let wordsPalabra1 = palabra1.split(" ");
    let wordsPalabra2 = palabra2.split(" ");

    texto = this.removeChar(texto, " ");
    palabra1 = this.removeChar(palabra1, " ");
    palabra2 = this.removeChar(palabra2, " ");

    let index = texto.indexOf(palabra1);
    let coincidencias = 0;

    if (index >= 0) {

      let subtexto = texto.substr(index, texto.length - 1);

      let index2 = subtexto.indexOf(palabra2);

      //calculo de maximo tolerancia de busqueads de palabras 4 maximo
      //con un arreglo en parte del tamaño de la frase a comprar
      //pasada a string sin comas

      //la idea es tener el indice de la frase de la palabra 1 
      //mas 4 palabras 
      //mas la frase de la palabra2 para con ello
      //buscar el indice maximo a buscar 
      //todo esto aprtir de la palabra subtexto
      let palabra1mas4seguientespalabras = this.prepareToCompare(wordsTexto, wordsPalabra1);

      //buscar el index string de 
      //defino el indice con el numero de 4 palabras siguientes

      //con la cuarta palara despues de la palabra1 mas la paralbra2 puedo tener el maximo indice de palabras
      let indexLastWordMax = subtexto.indexOf(palabra1mas4seguientespalabras) + palabra1mas4seguientespalabras.length + palabra2.length;

      if (index2 >= 0 && index2 <= indexLastWordMax) {
        coincidencias++;
      }

    }

    return coincidencias;
  }

  /**
   * funcion para uir os grupos de un arreglo paa poder comparar
   */
  prepareToCompare(arraypajar, arrayaguja) {

    let indexWord1 = 0;
    let contMath = 0;
    let indexLastWord = 0;
    let wordsForFindedIndex = "";
    //preparo para buscar
    for (var i = 0; i < arraypajar.length; i++) {
      const element1 = this.removeChar(arraypajar[i], " ");
      const firstWordAguja = this.removeChar(arrayaguja[0], " ");

      if (firstWordAguja && element1 && (firstWordAguja.includes(element1) || element1.includes(firstWordAguja))) {
        contMath = 1;

        for (let j = 1; j < arrayaguja.length; j++) {
          const element1Next1 = this.removeChar(arraypajar[i + j], " ");
          const element2Next1 = this.removeChar(arrayaguja[j], " ");

          if (element1Next1.includes(element2Next1) || element2Next1.includes(element1Next1)) {
            contMath++;
            indexLastWord = i + j;
            if (contMath == arrayaguja.length) {
              break;
            }
          }

        }

      }

    }

    if (contMath == arrayaguja.length && contMath !== 0 && indexLastWord !== 0) {
      indexWord1 = indexLastWord;

      let word1String = this.removeChar(arrayaguja.toString(), ",")
      word1String = this.removeChar(word1String, " ")

      wordsForFindedIndex = word1String +
        arraypajar[indexWord1 + 1] +
        arraypajar[indexWord1 + 2] +
        arraypajar[indexWord1 + 3] +
        arraypajar[indexWord1 + 4];
    }

    //ecuentro las cuatro siguientes palabras
    //le sumo al string de la palabra1 la sumatoria de las 4 siguientes palabras
    return wordsForFindedIndex;
  }
}
