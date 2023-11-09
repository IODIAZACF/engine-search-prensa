import { Injectable } from '@nestjs/common';
import { CreateGenerateFountDto } from './dto/create-generate-fount.dto';
import { UpdateGenerateFountDto } from './dto/update-generate-fount.dto';

@Injectable()
export class GenerateFountsService {
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

    let elementsMathed = [];

    for (let index = 0; index < elements.length; index++) {

      var element = elements[index];

      let diccionarios_principal:string[] = [];
      let diccionarios_ligado:string[] = [];
      //el elemento con su categoria define el diccionario de datos a usar

      let diccionarios_principal_values: any[] = Object.values(diccionarios_principal_object);
      let diccionarios_ligado_values: any[] = Object.values(diccionarios_ligado_object);

      let diccionarios_principal_keys: any[] = Object.keys(diccionarios_principal_object);
      let diccionarios_ligado_keys: any[] = Object.keys(diccionarios_ligado_object);

      let id_diccionario_ligado = element.id_diccionario_ligado;

      let index_dicc_principal = diccionarios_principal_keys.findIndex(el=>el == id_diccionario_ligado);
      let index_dicc_ligado = diccionarios_ligado_keys.findIndex(el=>el == id_diccionario_ligado);

      if(index_dicc_principal!==-1){

        diccionarios_principal = diccionarios_principal_values[index_dicc_principal];

      } else {
        continue;
      }
      
      if(index_dicc_ligado!==-1){

        diccionarios_ligado = diccionarios_ligado_values[index_dicc_ligado];

      } else {
        continue;
      }

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

        for (let k = 0; k < diccionarios_principal.length; k++) {
          let diccionario_principal: string = diccionarios_principal[k];

          //optimizacion de palabras
          diccionario_principal = diccionario_principal.toLowerCase()
          diccionario_principal = await this.removeAccents(diccionario_principal);

          if (diccionario_principal && diccionario_principal !== '' && data_content.includes(diccionario_principal)) {
            element.diccionario_principal_mathed_value++;
            element.diccionario_principal_mathed_words.push(diccionario_principal);

          }

        }

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

        /* console.log("data.array_word_mathed_value", data.array_word_mathed_value)
        console.log("mathed_categoria", mathed_categoria)
        console.log("mathed_subcategorias", mathed_subcategorias) */

      }

      elementsMathed.push(element);

    }

    return elementsMathed;
  }

  removeAccents(str: string) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
  }
}
