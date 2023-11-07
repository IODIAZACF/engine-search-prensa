import { Injectable } from '@nestjs/common';

@Injectable()
export class ConvertToExcelService {

  convertCsvToJson(csv) {

    // split it in an array
    const array = csv.toString().split("\r");

    // will be added to result in an array
    let result = [];

    // in headers array
    let headers = array[0].split(", ")

    // need to traverse remaining n-1 rows.
    for (let i = 1; i < array.length - 1; i++) {
      let obj = {}

      // Create an empty object to later add
      // values of the current row to it
      // Declare string str as current array
      // value to change the delimiter and
      // store the generated string in a new
      // string s
      let str = array[i]
      let s = ''

      // By Default, we get the comma separated
      // values of a cell in quotes " " so we
      // use flag to keep track of quotes and
      // split the string accordingly
      // If we encounter opening quote (")
      // then we keep commas as it is otherwise
      // we replace them with pipe |
      // We keep adding the characters we
      // traverse to a String s
      let flag = 0
      for (let ch of str) {
        if (ch === '"' && flag === 0) {
          flag = 1
        }
        else if (ch === '"' && flag == 1) flag = 0
        if (ch === ', ' && flag === 0) ch = '|'
        if (ch !== '"') s += ch
      }

      // Split the string using pipe delimiter |
      // and store the values in a properties array
      let properties = s.split("|")

      // For each header, if the value contains
      // multiple comma separated data, then we
      // store it in the form of array otherwise
      // directly the value is stored
      for (let j in headers) {
        if (properties[j].includes(", ")) {
          obj[headers[j]] = properties[j]
            .split(", ").map(item => item.trim())
        }
        else obj[headers[j]] = properties[j]
      }

      // Add the generated object to our
      // result array
      result.push(obj)
    }

    // Convert the resultant array to json and
    // generate the JSON output file.
    let json = result;

    return json;

  }

  replaceAll(string, search, replace) {
    console.log("replaceAll string", string);
    return string ? string.split(search).join(replace) : '';
  }
}
