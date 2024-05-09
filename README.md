## Description

[api rest fuentes] search engine de google . buscar noticias y hacer un analisis de datos para procesar
y exportar un excel con el contenido

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

Help.

## Stay in touch

- Author - [Ivan Diaz](https://ivancho2802.github.io/ings.ivandiaz/?trk=public_profile_project-button)
- github - [ivancho2802]

## License

Nest is [MIT licensed](LICENSE).

# para descargar templates para la carga del diccionario de datos
http://localhost:3000/generate-founts/templates/diccionario_de_datos.csv

## documentacion de la api console search

https://developers.google.com/custom-search/v1/overview?hl=es-419#:~:text=Get%20a%20Key-,Pricing,to%2010k%20queries%20per%20day.

## documentacion de console custom search

https://programmablesearchengine.google.com/about/

https://console.cloud.google.com/apis/library/customsearch.googleapis.com?hl=ES&project=ach-dev-3

 
## Nota 

# duracion de la solictud de prensa mas de una hroa con diccionario de datos_


## Metas

# Do
    * EN DONDE SALE para el start de la api v1 de google hay que solicitar la 
        siguiente pagina y ponerla a los res

    * crear la opcion de uso masico de las consultas de la api de google
    * y que tambien si hace math con solo una palabra del diccionrio principal o ligado.
    * que cuando la fecha de las busquedas exceda la fecha de consulta no las tome tomando en cuenta que se tomaran 20 noticias es decir 1o noticias mas.
    * 
    

Vamos a organizar las hojas de excel por SUBCATEGORIAS, Ej: 
agua, energía, seguridad alimentaria, salud

en cada hoja vamos a organizar por filas los municipios y por columnas
 las palabras clave asociadas a solo 1 diccionarios (la combinación de
  el diccionario ligado y el principal)

  

# Doing


# Does


buscar precios

hacaer la busqueda de nuevo con que sean por pais colombia

para que haga math con el diccionario de datos

arreglar el math de localidades


## cuenta usada en datos.gov

datos.gov.co

https://datos.gov.co/verify_email?unverified_email=iodiazbard@gmail.com

correo: iodiazbard@gmail.com

contraseña: v24250144


## for deploy production

npm run build

node dist/main.js &

http://ach.dyndns.info:7777/

## and config 

cd /etc/apache2/sites-available

sudo nano 000-default.conf

