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

  async createElementsMath(dataPaginated: any, dictionaries: any) {
    let dataPaginatedCreated = [];

    for (let index = 0; index < dataPaginated.length; index++) {
      let data = dataPaginated[index];

      for (let j = 0; j < dictionaries.length; j++) {

        //init contadores
        if (j == 0) {
          data.array_word_mathed_value = 0;
          data.array_word_mathed_value_may = 0;
          data.array_word_mathed_words = [];
          data.array_word_mathed_key_category = "";
          data.array_word_mathed_key_subcategory = "";

        }
        const dictionary = dictionaries[j];

        let subcategorias = dictionary['Subcategorias'];
        let temas = dictionary['Temas'];
        let palabra_clave = dictionary['Palabra clave'];
        let diccionario_principal = dictionary['Diccionario Principal'];
        let diccionario_ligado = dictionary['Diccionario Ligado'];

        let mathed_categoria = dictionary['Categoría'];
        let mathed_subcategorias = dictionary['Subcategorias'];

        //optimizacion de palabras
        let data_content_minus = data.content.toLowerCase();
        let data_content = await this.removeAccents(data_content_minus);

        let array_subcategorias: string[] = [];
        let array_temas: string[] = [];
        let array_palabra_clave: string[] = [];
        let array_diccionario_principal: string[] = [];
        let array_diccionario_ligado: string[] = [];

        if (subcategorias) {
          subcategorias = subcategorias.toLowerCase()
          subcategorias = await this.removeAccents(subcategorias);
          //hacer esplit 
          array_subcategorias = subcategorias.split('/');
        }

        if (temas) {
          temas = temas.toLowerCase()
          temas = await this.removeAccents(temas);
          //hacer esplit 
          array_temas = temas.split('/');
        }

        if (palabra_clave) {
          palabra_clave = palabra_clave.toLowerCase()
          palabra_clave = await this.removeAccents(palabra_clave);
          //hacer esplit 
          array_palabra_clave = palabra_clave.split('/');
        }

        if (diccionario_principal) {
          diccionario_principal = diccionario_principal.toLowerCase()
          diccionario_principal = await this.removeAccents(diccionario_principal);
          //hacer esplit 
          array_diccionario_principal = diccionario_principal.split('/');
        }

        if (diccionario_ligado) {
          diccionario_ligado = diccionario_ligado.toLowerCase()
          diccionario_ligado = await this.removeAccents(diccionario_ligado);
          //hacer esplit 
          array_diccionario_ligado = diccionario_ligado.split('/');
        }

        let all_words: string[] = [];

        //y concatenar
        all_words = all_words.concat(array_subcategorias);
        all_words = all_words.concat(array_palabra_clave);
        all_words = all_words.concat(array_temas);
        all_words = all_words.concat(array_diccionario_principal);
        all_words = all_words.concat(array_diccionario_ligado);

        for (let k = 0; k < all_words.length; k++) {
          const dictionary_compare_word: string = all_words[k];

          if (dictionary_compare_word && dictionary_compare_word !== '' && data_content.includes(dictionary_compare_word)) {
            data.array_word_mathed_value++;
            data.array_word_mathed_words.push(dictionary_compare_word);

          }

        }

        /* console.log("data.array_word_mathed_value", data.array_word_mathed_value)
        console.log("mathed_categoria", mathed_categoria)
        console.log("mathed_subcategorias", mathed_subcategorias) */

        if (data.array_word_mathed_value > data.array_word_mathed_value_may) {
          data.array_word_mathed_value_may = data.array_word_mathed_value
          if (mathed_categoria !== '')
            data.array_word_mathed_key_category = mathed_categoria;
          if (mathed_subcategorias !== '')
            data.array_word_mathed_key_subcategory = mathed_subcategorias;

        }

      }

      dataPaginatedCreated.push(data);

    }

    return dataPaginatedCreated;
  }

  removeAccents(str: string) {
    return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str;
  }
}
