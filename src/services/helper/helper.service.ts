import { Injectable } from '@nestjs/common';
import cities from '../../assets/data/cities.json';
import municipios from '../../assets/data/municipios.json';

@Injectable()
export class HelperService {

  groupBy(xs, key) {
    return xs.reduce(function (rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  };

  getCities(){
    let regionesCiudades = cities;
    return regionesCiudades;
  };

  getMunicipios(){
    let regionesMunicipios = municipios;
    return regionesMunicipios;
  };
}
