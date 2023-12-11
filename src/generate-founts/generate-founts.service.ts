import { Logger, Injectable } from '@nestjs/common';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';
import { Observable, firstValueFrom, catchError, concat } from 'rxjs';
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


    let headerWorks: string[] = [];
    let subHeaderLocations: any[] = [];

    //hace la compraracion de los element con el contenido para que si hace math estos locaciones se defian
    //por noticia es decir cuantas noticias en esa localidad hablan de esa noticia es decir tema o palabra clave

    //inicializar contadores y contar
    //mathed
    let index = 0;

    elements.map(element => {
      index++;
      console.log("progres math words", (elements.length > 0 ? index / elements.length : 1) * 100)

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


      console.log("diccionarios_principal", diccionarios_principal[0])
      console.log("diccionarios_ligado", diccionarios_ligado[0])
      console.log("diccionarios_principal", diccionarios_principal.length)
      console.log("diccionarios_ligado", diccionarios_ligado.length)


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
      element.matrizPrincipalLigado = { matrizPrincipalLigado };

      console.log("element.matrizPrincipalLigado ", element.matrizPrincipalLigado.length);

      let new_searchs = [];

      for (const search of element.searchs) {
        let contenido = search.title + " " + search.content;
        //identificador de busqueda
        let link = search.link;

        //console.log("contenido country bogota-> ", contenido.includes("bogota"));

        //optimizacion de palabras
        let data_content_minus = contenido.toLowerCase();
        let data_content = this.removeAccents(data_content_minus);
        let pairwordCounted = [];
        //poner aqui remover signos de puntuacion

        //BUSQUEDA EN MATRIZ DE COMBINACION DE DICCONARIO PRINCIPAL CON LIGADO 
        //BUSQUEDA EN MATRIZ INVERSA DE COMBINACION DE DICCONARIO LIGADO CON PRINCIPAL

        for (const pairWords of matrizPrincipalLigado) {

          if (pairWords.length == 2) {
            //init contadores
            let countMathes = this.buscarDosPalabras(data_content, pairWords[0], pairWords[1]);

            if (countMathes > 0) {
              let localationStr = this.getLocationNew(data_content);

              if (!pairwordCounted.includes(link + pairWords[0] + pairWords[1] + localationStr)) {

                pairwordCounted.push(link + pairWords[0] + pairWords[1] + localationStr);

                const pairwordsmath = pairWords[0] + '+' + pairWords[1];

                if (!element[pairwordsmath]) {
                  element[pairwordsmath] = {};
                }

                if (!element[pairwordsmath].localization) {
                  element[pairwordsmath].localization = {}
                }

                if (!element[pairwordsmath].localization[localationStr]) {
                  element[pairwordsmath].localization[localationStr] = 0;
                }

                element[pairwordsmath].localization[localationStr]++;

                if (!headerWorks.includes(pairwordsmath)) {
                  headerWorks.push(pairwordsmath);
                }


              }

            } else {


              //por aqui la busqueda solo si no encontro uno de las 2
              const word1 = this.removeChar(pairWords[0], " "),
                word2 = pairWords[1];

              let index2 = this.removeChar(data_content, " ").indexOf(word1);

              //word 1
              if (index2 !== -1) {
                let localationStr = this.getLocationNew(data_content);

                if (!pairwordCounted.includes(link + word1 + localationStr)) {
                  pairwordCounted.push(link + word1 + localationStr);
                  //console.log("index2", index2);

                  if (!element[word1]) {
                    element[word1] = {};
                  }

                  if (!element[word1].localization) {
                    element[word1].localization = {}
                  }

                  if (!element[word1].localization[localationStr]) {
                    element[word1].localization[localationStr] = 0;
                  }

                  element[word1].localization[localationStr]++;

                  if (!headerWorks.includes(word1)) {
                    headerWorks.push(word1);
                  }

                }

              }
            }

          }
        }

        new_searchs.push({
          title: search.title,
          link: search.link,
          formattedUrl: search.formattedUrl,
          snippet: search.snippet
        });

      }

      element.searchs = { searchs: new_searchs };

      elementsMathed.push(element);

    });

    console.log("headerWorks", headerWorks)
    console.log("subHeaderLocations", subHeaderLocations)

    //es mejor despuesde de para que se cuenten los registros correspondientes
    elementsMathed.map(elementCustomWord => {

      let keys = Object.keys(elementCustomWord);
      let values = Object.values(elementCustomWord);

      let locations = this.extractLocationsEstandar(values)

      for (const word of headerWorks) {

        let indexWord = keys.indexOf(word);

        if (indexWord == -1) {
          elementCustomWord[word] = 0;
          continue;
        }

        //para localizacion 
        for (let index = 0; index < locations.length; index++) {
          const location = locations[index];
          if (elementCustomWord[word]?.localization && !elementCustomWord[word]?.localization[location]) {
            elementCustomWord[word].localization[location] = 0;
          }

        }

      }


      return elementCustomWord;
    });

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
                console.log("error", error.response)
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

    //console.log("buscarDosPalabras", palabra1 + palabra2)

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

      if (firstWordAguja && element1 && (firstWordAguja.includes(element1))) {
        contMath = 1;

        for (let j = 1; j < arrayaguja.length; j++) {
          const element1Next1 = this.removeChar(arraypajar[i + j], " ");
          const element2Next1 = this.removeChar(arrayaguja[j], " ");
          if (element1Next1 && element2Next1 && element1Next1.includes(element2Next1)) {
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

  getLocationNew(data_content): string {

    let locationAprox = "";
    let headerLocations: string[] = [];
    let departamentosCiudadesArray = this.helper.getCities();
    let groupCitiesObj = this.helper.groupBy(departamentosCiudadesArray, 'ciudades');
    let groupCitiesArray = Object.keys(groupCitiesObj);

    let locations: any = this.helper.getMunicipios();
    let locationsMunicipio = this.helper.groupBy(locations, 'municipio');
    let arrayMunicipios = Object.keys(locationsMunicipio);
    let locationsDepartamento: any = this.helper.groupBy(locations, 'departamento');
    let arrayDepartamentos: any = Object.keys(locationsDepartamento);
    let locationsRegion = this.helper.groupBy(locations, 'region');
    let arrayRegiones: any = Object.keys(locationsRegion);


    //REALIZANDO MATH CON LOS PAISES este hace por municipio
    for (let municipioOrigininal of arrayMunicipios) {

      let municipio = municipioOrigininal.toLowerCase();
      municipio = this.removeAccents(municipio);
      //error con bogota d.c
      municipio = this.removeChar(municipio, "d.c.");
      let countMathesMunicipio = this.buscarDosPalabras(data_content, "municipio", municipio);

      if (countMathesMunicipio > 0) {

        let location = locationsMunicipio[municipioOrigininal];
        /* {
          "region": "Región Eje Cafetero - Antioquia",
          "c_digo_dane_del_departamento": "5",
          "departamento": "Antioquia",
          "c_digo_dane_del_municipio": "5.002",
          "municipio": "Abejorral"
        } */

        let head3 = "municipio:" + municipioOrigininal +
          " departamento:" + location?.departamento;

        if (!headerLocations.includes(head3)) {
          headerLocations.push(head3);
        }

        locationAprox = head3;

      }
    }

    if (locationAprox !== "") {
      return locationAprox;
    }

    //math de ciudades
    for (let departamento of departamentosCiudadesArray) {
      for (let ciudad of departamento.ciudades) {

        let ciudadFormated = this.removeAccents(ciudad);
        ciudadFormated = ciudadFormated.toLowerCase();
        ciudadFormated = this.removeChar(ciudadFormated, "d.c.");

        let mathesCiudad = data_content.includes(ciudadFormated);

        if (mathesCiudad) {

          let head2 = "ciudad:" + ciudadFormated +
            " departamento:" + departamento?.departamento;

          if (!headerLocations.includes(head2)) {
            headerLocations.push(head2);
          }

          locationAprox = head2;
        }
      }

    }

    if (locationAprox !== "") {
      return locationAprox;
    }

    //math de departamentos
    for (let departamento of arrayDepartamentos) {

      departamento = departamento.toLowerCase();
      departamento = this.removeAccents(departamento);
      //error con bogota d.c
      departamento = this.removeChar(departamento, "d.c.");

      let countMathesDepartamento = this.buscarDosPalabras(data_content, "departamento", departamento);
      if (countMathesDepartamento > 0) {

        let head2 = "departamento:" + departamento +
          " region:" + departamento.region;

        if (!headerLocations.includes(head2)) {
          headerLocations.push(head2);
        }

        locationAprox = head2;

      }

    }

    if (locationAprox !== "") {
      return locationAprox;
    }

    for (let region of arrayRegiones) {

      //optimizacion de palabras
      region = region.toLowerCase();
      region = this.removeAccents(region);

      let countMathesRegion = data_content.includes(region);

      if (countMathesRegion) {

        let head1 = "region:" + region;

        if (!headerLocations.includes(head1)) {
          headerLocations.push(head1);
        }

        locationAprox = head1;
      }

    }

    if (locationAprox !== "") {
      return locationAprox;
    }

    let allLocations = arrayDepartamentos.concat(groupCitiesArray);

    for (let location of allLocations) {

      location = location.toLowerCase();
      location = this.removeAccents(location);
      //error con bogota d.c
      location = this.removeChar(location, "d.c.");

      let mathesLocation = data_content.includes(location);
      if (mathesLocation) {

        if (!headerLocations.includes(location)) {
          headerLocations.push(location);
        }

        locationAprox = location;
      }

    }


    if (locationAprox == "") {
      return "INDEFINIDO";
    }

    return locationAprox;
  }

  /**
   * funcion para extraer los subhedaer localizaciones del elemento o fila
   *  
   */
  extractLocationsEstandar(fila) {

    let values: any[] = Object.values(fila);
    let locations = [];

    for (let index = 0; index < values.length; index++) {
      const element = values[index];

      if (element?.localization) {
        let locationsRepited = Object.keys(element?.localization);

        for (let index = 0; index < locationsRepited.length; index++) {
          const locationRepited = locationsRepited[index];

          if (!locations.includes(locationRepited)) {
            locations.push(locationRepited)
          }
        }
      }

    }

    return locations;

  }
}
