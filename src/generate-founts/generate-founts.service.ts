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

    let locations: any = this.getContentWeb(url_provider_locationscolombia, {}, null);

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

      for (let j = 0; j < element.searchs.length; j++) {

        let contenido = element.searchs[j].content;

        //optimizacion de palabras
        let data_content_minus = contenido.toLowerCase();
        let data_content = await this.removeAccents(data_content_minus);

        let matrizPrincipalLigado: any[] = [];

        //REALIZANDO MATH CON EL DICCIONARIO PRINCIPAL
        for (let k = 0; k < diccionarios_principal.length; k++) {
          let diccionario_principal: string = diccionarios_principal[k];

          //optimizacion de palabras
          diccionario_principal = diccionario_principal.toLowerCase()
          diccionario_principal = await this.removeAccents(diccionario_principal/* this.removeSpaces() */);

          //realizo la combinatorio de los diccionarios
          for (let m = 0; m < diccionarios_ligado.length; m++) {

            let diccionario_ligado: string = diccionarios_ligado[m];

            //optimizacion de palabras
            diccionario_ligado = diccionario_ligado.toLowerCase()
            diccionario_ligado = await this.removeAccents(diccionario_ligado/* this.removeSpaces() */);

            /* console.log("diccionario_ligado diccionario_ligado: ", diccionario_principal + ' - ' + diccionario_ligado);
            console.log("k m: ", k + ' - ' + m); */

            if (diccionario_principal !== undefined && diccionario_ligado !== undefined && diccionario_principal !== '' && diccionario_ligado !== '') {

              matrizPrincipalLigado.push([diccionario_principal, diccionario_ligado]);
              matrizPrincipalLigado.push([diccionario_ligado, diccionario_principal]);

            }

          }

        }

        //BUSQUEDA EN MATRIZ DE COMBINACION DE DICCONARIO PRINCIPAL CON LIGADO 
        //BUSQUEDA EN MATRIZ INVERSA DE COMBINACION DE DICCONARIO LIGADO CON PRINCIPAL

        console.log("matrizPrincipalLigado Palabra clave", element['Palabra clave']);
        console.log("matrizPrincipalLigado tamaño", matrizPrincipalLigado.length);
        console.log("matrizPrincipalLigado 0", matrizPrincipalLigado[0]);

        if (index > 1 && elements.length > 1) {
          console.log("estado de proceso", (index / (elements.length - 1)) * 100);
        }


        for (let p = 0; p < matrizPrincipalLigado.length; p++) {
          const pairWords = matrizPrincipalLigado[p];

          if (pairWords.length == 2) {
            //init contadores
            let countMathes = this.buscarDosPalabras(data_content + "suficiente atencion", pairWords[0], pairWords[1]);

            if (countMathes > 0) {

              if(!element[pairWords[0] + '+' + pairWords[1]]){
                element[pairWords[0] + '+' + pairWords[1]] = 0;

              }

              element[pairWords[0] + '+' + pairWords[1]] += countMathes;

              headerWorks.push(pairWords[0] + '+' + pairWords[1]);

            }

          }
        }

        //REALIZANDO MATH CON LOS PAISES
        for (let n = 0; n < locations.length; n++) {
          let location: LocationsCo = locations[n];

          //optimizacion de palabras
          location.region = location.region.toLowerCase();
          location.region = await this.removeAccents(location.region);

          location.departamento = location.departamento.toLowerCase();
          location.departamento = await this.removeAccents(location.departamento);

          location.municipio = location.municipio.toLowerCase();
          location.municipio = await this.removeAccents(location.municipio);

          /*    
            * se agrega a un arreglo con ese objeto 
            * y la cantidad de veces con las que vuelva a hacer math 
            * si no hace math se agrega otro a este arreglo (elements)
            * con la cantidad de 1
            * 
          */
          if (data_content.includes(location.region)) {
            console.log("SI ubo math de locacion")
            if (element[location.region]) {
              element[location.region].cant++;
            } else {
              element[location.region].cant = 1;
            }
          }

          if (data_content.includes(location.departamento)) {
            console.log("SI ubo math de locacion")
            if (element[location.departamento]) {
              element[location.departamento].cant++;
            } else {
              element[location.departamento].cant = 1;
            }
          }

          if (data_content.includes(location.municipio)) {
            console.log("SI ubo math de locacion")
            if (element[location.municipio]) {
              element[location.municipio].cant++;
            } else {
              element[location.municipio].cant = 1;
            }
          }

        }

      }

      elementsMathed.push(element);

    }

    console.log("elementsMathed[0]", elementsMathed[0]);
    console.log("headerWorks[0]", headerWorks[0]);

    //eliminar los searches
    for (let x = 0; x < elementsMathed.length; x++) {
      const element = elementsMathed[x];

      //llenar con cero los elementos donde la oalabra no cubrs
      //la idea es llenar de cero lo demas valores pero por objeto no hay vlor por header o 
      //en llso objetos hay mas datos
      let keys = Object.keys(element);

      for (let a = 0; a < headerWorks.length; a++) {

        const work: string = headerWorks[a];
        let indexWord = keys.indexOf(work);

        if (indexWord == -1) {
          element[work] = 0;
        }

      }

      let old_searchs = element.searchs;
      let new_searchs = [];

      delete element.searchs;

      for (let y = 0; y < old_searchs.length; y++) {
        const search = old_searchs[y];

        new_searchs.push({
          title: search.title,
          displayLink: search.displayLink,
          formattedUrl: search.formattedUrl
        });
      }

      element.searchs = new_searchs;



    }

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
