import { Logger, Injectable } from '@nestjs/common';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { Observable, firstValueFrom, catchError } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { url_provider_locationscolombia } from '../config.service';
import { LocationsCo } from '../interfaces/locations-co/locations-co.interface'

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

        //init contadores
        if (j == 0) {
          element.diccionario_principal_mathed_value = 0;
          element.diccionario_principal_mathed_words = [];

          element.diccionario_ligado_mathed_value = 0;
          element.diccionario_ligado_mathed_words = [];

        }

        //optimizacion de palabras
        let data_content_minus = contenido.toLowerCase();
        let data_content = await this.removeAccents(data_content_minus);

        //REALIZANDO MATH CON EL DICCIONARIO PRINCIPAL
        for (let k = 0; k < diccionarios_principal.length; k++) {
          let diccionario_principal: string = diccionarios_principal[k];

          //optimizacion de palabras
          diccionario_principal = diccionario_principal.toLowerCase()
          diccionario_principal = await this.removeAccents(diccionario_principal);

          this.buscarDosPalabras(data_content, diccionario_principal, "palabra2 diccionario ligado")

          //luego poner el diccionario ligado como palabra 2 e invertir lo mejor
          // es crear una matriz en el orden que salga con el diccionario ligado
          // y despues invertir y volver a buscar
          //cuando halla coincidencias poner element[palabra1+palabra2] = 10


          if (diccionario_principal && diccionario_principal !== '' && data_content.includes(diccionario_principal)) {
            element.diccionario_principal_mathed_value++;
            element.diccionario_principal_mathed_words.push(diccionario_principal);

          }

        }

        //REALIZANDO MATH CON EL DICCIONARIO LIGADO
        for (let m = 0; m < diccionarios_ligado.length; m++) {
          let diccionario_ligado: string = diccionarios_ligado[m];

          //optimizacion de palabras
          diccionario_ligado = diccionario_ligado.toLowerCase()
          diccionario_ligado = await this.removeAccents(diccionario_ligado);

          if (diccionario_ligado && diccionario_ligado !== '' && data_content.includes(diccionario_ligado)) {
            element.diccionario_ligado_mathed_value++;
            element.diccionario_ligado_mathed_words.push(diccionario_ligado);

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
            if(element[location.region]){
              element[location.region].cant++;
            } else {
              element[location.region].cant = 1;
            }
          }

          if (data_content.includes(location.departamento)) {
            console.log("SI ubo math de locacion")
            if(element[location.departamento]){
              element[location.departamento].cant++;
            } else {
              element[location.departamento].cant = 1;
            }
          }
          
          if (data_content.includes(location.municipio)) {
            console.log("SI ubo math de locacion")
            if(element[location.municipio]){
              element[location.municipio].cant++;
            } else {
              element[location.municipio].cant = 1;
            }
          }

        }

      }

      elementsMathed.push(element);

    }

    //eliminar los searches
    for (let x = 0; x < elementsMathed.length; x++) {
      const element = elementsMathed[x];

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

      element.searchs = new_searchs
    }

    return elementsMathed;
  }

  removeAccents(str: string) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
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
