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
            let countMathes = this.buscarDosPalabras(data_content + "suficiente atencion", pairWords[0], pairWords[1]);

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

          location.municipio = location.municipio.toLowerCase();
          location.municipio = this.removeAccents(location.municipio);

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
    const palabras = texto.split(" ");
    let coincidencias = 0;

    for (let i = 0; i < palabras.length - 1; i++) {
      if (palabras[i] === palabra1 && palabras[i + 1] === palabra2) {
        coincidencias++;
      }

      if (palabras[i] === palabra1 && palabras[i + 2] === palabra2) {
        coincidencias++;
      }

      if (palabras[i] === palabra1 && palabras[i + 3] === palabra2) {
        coincidencias++;
      }

      if (palabras[i] === palabra1 && palabras[i + 4] === palabra2) {
        coincidencias++;
      }
    }

    return coincidencias;
  }
}
