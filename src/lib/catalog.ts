// Catálogo local argentino enriquecido con sinónimos y categorías
// Más de 600 productos de consumo masivo para funcionamiento offline
import { Category, Unit } from '../types';

export interface CatalogProduct {
  nombre: string;
  sinonimos: string[];
  categoria: Category;
  unidad_por_defecto: Unit;
}

export const CATALOG_VERSION = '1.1.0';

export const ARGENTINE_CATALOG: CatalogProduct[] = [
  {
    "nombre": "papa",
    "sinonimos": [
      "papas",
      "patata",
      "patatas",
      "papa negra",
      "papa blanca",
      "papa cepillada",
      "papaa"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "cebolla",
    "sinonimos": [
      "cebollas",
      "cebolla blanca",
      "cebolla comun"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cebolla morada",
    "sinonimos": [
      "cebollas moradas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cebolla de verdeo",
    "sinonimos": [
      "verdeo",
      "cebollita de verdeo",
      "cebollitas de verdeo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "tomate",
    "sinonimos": [
      "tomates",
      "tomte",
      "tomate redondo",
      "tomates redondos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "tomate perita",
    "sinonimos": [
      "tomates perita",
      "perita"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "tomate cherry",
    "sinonimos": [
      "tomates cherry",
      "cherrys",
      "cherry"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "zanahoria",
    "sinonimos": [
      "zanahorias",
      "zanahoriaa"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "zapallito",
    "sinonimos": [
      "zapallitos",
      "zapallito verde",
      "zapallitos verdes"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "zucchini",
    "sinonimos": [
      "zuquini",
      "zucchinie",
      "zapallito largo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "zapallo anco",
    "sinonimos": [
      "calabaza",
      "anco",
      "calabacin",
      "zapallo calabaza",
      "calabazas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "zapallo cabutia",
    "sinonimos": [
      "cabutia",
      "zapallo japones"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "zapallo criollo",
    "sinonimos": [
      "zapallo plomo",
      "zapallo gris"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "lechuga",
    "sinonimos": [
      "lechugas",
      "lechuga criolla",
      "lechuga comun"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "lechuga mantecosa",
    "sinonimos": [
      "mantecosa"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "lechuga capuchina",
    "sinonimos": [
      "capuchina",
      "lechuga iceberg"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "lechuga morada",
    "sinonimos": [
      "morada"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "rucula",
    "sinonimos": [
      "ruculas",
      "rucola"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "radicheta",
    "sinonimos": [
      "radichetas",
      "radicchio",
      "achicoria"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "espinaca",
    "sinonimos": [
      "espinacas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "acelga",
    "sinonimos": [
      "acelgas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "morron rojo",
    "sinonimos": [
      "morron",
      "morrones",
      "pimiento",
      "pimientos",
      "pimiento rojo",
      "morron colorado"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "morron verde",
    "sinonimos": [
      "pimiento verde",
      "morrones verdes"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "morron amarillo",
    "sinonimos": [
      "pimiento amarillo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "ajo",
    "sinonimos": [
      "ajos",
      "cabeza de ajo",
      "diente de ajo",
      "dientes de ajo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "perejil",
    "sinonimos": [
      "perejil fresco",
      "perejiles"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "albahaca",
    "sinonimos": [
      "albahaca fresca"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "cilantro",
    "sinonimos": [
      "coriandro"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "romero",
    "sinonimos": [
      "romero fresco"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "tomillo",
    "sinonimos": [
      "tomillo fresco"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "oregano fresco",
    "sinonimos": [
      "oregano rama"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "menta",
    "sinonimos": [
      "menta fresca",
      "hierbabuena"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "apio",
    "sinonimos": [
      "apio criollo",
      "apioc"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "puerro",
    "sinonimos": [
      "puerros"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "remolacha",
    "sinonimos": [
      "remolachas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "batata",
    "sinonimos": [
      "batatas",
      "camote"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "choclo",
    "sinonimos": [
      "choclos",
      "maiz",
      "elote",
      "espiga de choclo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "berenjena",
    "sinonimos": [
      "berenjenas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pepino",
    "sinonimos": [
      "pepinos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "palta",
    "sinonimos": [
      "paltas",
      "aguacate",
      "palta hass"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "repollo blanco",
    "sinonimos": [
      "repollo",
      "col"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "repollo morado",
    "sinonimos": [
      "repollo colorado"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "coliflor",
    "sinonimos": [
      "coliflores"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "brocoli",
    "sinonimos": [
      "brocolis"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "chauchas",
    "sinonimos": [
      "chaucha",
      "chauchas planas",
      "chaucha roliza"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "champinon",
    "sinonimos": [
      "champinones",
      "portobello",
      "champis"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "hongo de pino",
    "sinonimos": [
      "hongos de pino",
      "hongos secos patagonicos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "hongo portobello",
    "sinonimos": [
      "portobello"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "hongo gírgola",
    "sinonimos": [
      "girgola",
      "girgolas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "limon",
    "sinonimos": [
      "limones",
      "limon amarillo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "naranja",
    "sinonimos": [
      "naranjas",
      "naranja de ombligo",
      "naranja para jugo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "mandarina",
    "sinonimos": [
      "mandarinas",
      "mandarina criolla"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pomelo",
    "sinonimos": [
      "pomelos",
      "pomelo rosado",
      "pomelo amarillo"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "manzana",
    "sinonimos": [
      "manzanas",
      "manzana roja",
      "manzana deliciosa"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "manzana verde",
    "sinonimos": [
      "manzana granny",
      "manzanas verdes"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "banana",
    "sinonimos": [
      "bananas",
      "platano"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pera",
    "sinonimos": [
      "peras",
      "pera packham",
      "pera williams"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "durazno",
    "sinonimos": [
      "duraznos",
      "melocoton"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "damasco",
    "sinonimos": [
      "damascos",
      "albaricoque"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "ciruela",
    "sinonimos": [
      "ciruelas",
      "ciruela roja",
      "ciruela negra"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "frutilla",
    "sinonimos": [
      "frutillas",
      "fresa",
      "fresas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "frambuesa",
    "sinonimos": [
      "frambuesas",
      "frambuesa patagonica"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "mora",
    "sinonimos": [
      "moras"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "arandano",
    "sinonimos": [
      "arandanos",
      "blueberries"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cereza",
    "sinonimos": [
      "cerezas",
      "cereza del sur"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "uva",
    "sinonimos": [
      "uvas",
      "uva blanca",
      "uva negra",
      "uva red globe"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "sandia",
    "sinonimos": [
      "sandias"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "melon",
    "sinonimos": [
      "melones",
      "melon rocio de miel"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "anana",
    "sinonimos": [
      "pina",
      "ananas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "kiwi",
    "sinonimos": [
      "kiwis"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mango",
    "sinonimos": [
      "mangos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "jengibre",
    "sinonimos": [
      "raiz de jengibre"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "nabo",
    "sinonimos": [
      "nabos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "hinojo",
    "sinonimos": [
      "hinojos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "alcaucil",
    "sinonimos": [
      "alcauciles",
      "alcachofa"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "esparrago",
    "sinonimos": [
      "esparragos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "mandioca",
    "sinonimos": [
      "yuca"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "higo",
    "sinonimos": [
      "higos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pelon",
    "sinonimos": [
      "pelones",
      "nectarina"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "membrillo",
    "sinonimos": [
      "membrillos"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "granada",
    "sinonimos": [
      "granadas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "papaya",
    "sinonimos": [
      "mamon"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "lima",
    "sinonimos": [
      "limas"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "maracuya",
    "sinonimos": [
      "fruta de la pasion"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "sauco",
    "sinonimos": [
      "fruto de sauco"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "rosa mosqueta fresca",
    "sinonimos": [
      "mosqueta"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "pinon de araucaria",
    "sinonimos": [
      "pinon patagonico",
      "pinones"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "kale",
    "sinonimos": [
      "col rizada"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "acelga roja",
    "sinonimos": [
      "acelga morada"
    ],
    "categoria": "verduleria",
    "unidad_por_defecto": "atado"
  },
  {
    "nombre": "carne picada",
    "sinonimos": [
      "picada",
      "carne molida",
      "picada comun",
      "picada especial"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "nalga",
    "sinonimos": [
      "nalga para milanesa",
      "nalga feteada"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "peceto",
    "sinonimos": [
      "peseto",
      "peceto feteado"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "cuadril",
    "sinonimos": [
      "colita de cuadril",
      "cuadril para bife"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "bola de lomo",
    "sinonimos": [
      "bola lomo",
      "bife de bola de lomo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "cuadrada",
    "sinonimos": [
      "cuadrada para milanesa"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "lomo",
    "sinonimos": [
      "lomo vacuno",
      "bife de lomo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "bife de chorizo",
    "sinonimos": [
      "bife chorizo",
      "ojo de bife"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "bife angosto",
    "sinonimos": [
      "bife con hueso"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "bife ancho",
    "sinonimos": [
      "bife de costilla ancho"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "tira de asado",
    "sinonimos": [
      "asado",
      "costillar",
      "asado de tira"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "vacio",
    "sinonimos": [
      "vacio vacuno"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "matambre vacuno",
    "sinonimos": [
      "matambre",
      "matambre de vaca"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "entrana",
    "sinonimos": [
      "entrana vacuna",
      "entranas"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "tapa de asado",
    "sinonimos": [
      "tapa asado"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "tapa de nalga",
    "sinonimos": [
      "tapa nalga"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "falda",
    "sinonimos": [
      "falda parrillera"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "roast beef",
    "sinonimos": [
      "rosbif",
      "ros bif",
      "carne para guiso"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "paleta",
    "sinonimos": [
      "paleta vacuna"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "ossobuco",
    "sinonimos": [
      "osobuco"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "tortuguita",
    "sinonimos": [
      "tortuguita vacuna"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "aguja",
    "sinonimos": [
      "aguja vacuna"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "marucha",
    "sinonimos": [
      "marucha vacuna"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "azotillo",
    "sinonimos": [
      "azotillo vacuno"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "espinazo",
    "sinonimos": [
      "hueso con carne"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "rabo",
    "sinonimos": [
      "rabo de toro",
      "cola de vaca"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "lengua vacuna",
    "sinonimos": [
      "lengua a la vinagreta"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "higado vacuno",
    "sinonimos": [
      "higado con cebolla",
      "higado bife"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "seso vacuno",
    "sinonimos": [
      "seso"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "corazon vacuno",
    "sinonimos": [
      "corazon"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "mondongo",
    "sinonimos": [
      "mondongo para locro",
      "callos"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pollo entero",
    "sinonimos": [
      "pollo",
      "pollo fresco"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pechuga de pollo",
    "sinonimos": [
      "pechuga",
      "suprema",
      "supremas",
      "suprema de pollo",
      "filet de pechuga"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pata muslo",
    "sinonimos": [
      "pata y muslo",
      "cuarto trasero de pollo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "alitas de pollo",
    "sinonimos": [
      "alitas"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "menudos de pollo",
    "sinonimos": [
      "menudos"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "higado de pollo",
    "sinonimos": [
      "higaditos"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "carcasa de pollo",
    "sinonimos": [
      "huesos de pollo para sopa"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "milanesa de pollo",
    "sinonimos": [
      "milanesas de pollo",
      "milanesas de suprema"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "milanesa de carne",
    "sinonimos": [
      "milanesas de carne",
      "milanesas preparadas"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "bondiola",
    "sinonimos": [
      "bondiola de cerdo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pechito de cerdo",
    "sinonimos": [
      "pechito"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "costillita de cerdo",
    "sinonimos": [
      "chuleta de cerdo",
      "costillas de cerdo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "matambre de cerdo",
    "sinonimos": [
      "matambrito",
      "matambrito de cerdo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "carre de cerdo",
    "sinonimos": [
      "carre",
      "lomo de cerdo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "solomillo de cerdo",
    "sinonimos": [
      "solomillo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "jamon de cerdo fresco",
    "sinonimos": [
      "pernil de cerdo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "paleta de cerdo",
    "sinonimos": [
      "paletilla cerdo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "panceta de cerdo fresca",
    "sinonimos": [
      "tocino fresco"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "chorizo",
    "sinonimos": [
      "chorizos",
      "chorizo puro cerdo",
      "chorizo mezcla"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "morcilla",
    "sinonimos": [
      "morcillas",
      "morcilla bombon"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "morcilla vasca",
    "sinonimos": [
      "morcilla dulce"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "salchicha parrillera",
    "sinonimos": [
      "parrillera"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "chinchulin",
    "sinonimos": [
      "chinchulines"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "molleja",
    "sinonimos": [
      "mollejas"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "rinon",
    "sinonimos": [
      "rinones"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "tripa gorda",
    "sinonimos": [
      "tripa gorda parrillera"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "choto",
    "sinonimos": [
      "choto parrillero"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "cordero patagonico",
    "sinonimos": [
      "cordero",
      "cuarto de cordero",
      "costillar de cordero"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "chivito",
    "sinonimos": [
      "chivo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "ciervo",
    "sinonimos": [
      "carne de ciervo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "jabali",
    "sinonimos": [
      "carne de jabali"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "conejo",
    "sinonimos": [
      "carne de conejo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "grasa vacuna",
    "sinonimos": [
      "grasa de pella",
      "grasa para freir"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "filet de merluza",
    "sinonimos": [
      "merluza",
      "merluza fresca"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "trucha",
    "sinonimos": [
      "filet de trucha",
      "trucha arcoiris",
      "trucha patagonica"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "salmon rosado",
    "sinonimos": [
      "salmon",
      "filet de salmon"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pejerrey",
    "sinonimos": [
      "pejerreyes"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "brotola",
    "sinonimos": [
      "filet de brotola"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "abadejo",
    "sinonimos": [
      "filet de abadejo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "corvina",
    "sinonimos": [
      "corvina rubia",
      "corvina negra"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "lenguado",
    "sinonimos": [
      "filet de lenguado"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pescadilla",
    "sinonimos": [
      "filet de pescadilla"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "atun fresco",
    "sinonimos": [
      "lomo de atun"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "calamar",
    "sinonimos": [
      "tubo de calamar",
      "rabas"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "tentaculos de calamar",
    "sinonimos": [
      "tentaculos"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "langostino",
    "sinonimos": [
      "langostinos",
      "colas de langostino"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "camaron",
    "sinonimos": [
      "camarones pelados"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "mejillon",
    "sinonimos": [
      "mejillones",
      "mejillones pelados"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "berberechos",
    "sinonimos": [
      "berberecho"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pulpo",
    "sinonimos": [
      "pulpo espanol"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "almejas",
    "sinonimos": [
      "almeja"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "centolla",
    "sinonimos": [
      "carne de centolla fueguina"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "cangrejo",
    "sinonimos": [
      "patas de cangrejo"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "surimi",
    "sinonimos": [
      "kanikama"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "anchoa fresca",
    "sinonimos": [
      "anchoitas"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "sardina fresca",
    "sinonimos": [
      "sardinas"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "caviar",
    "sinonimos": [
      "huevas de pescado"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "carne picada de pollo",
    "sinonimos": [
      "pollo molido"
    ],
    "categoria": "carniceria",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "leche",
    "sinonimos": [
      "leche entera",
      "leche sachet",
      "leche fluida",
      "leche caja"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "leche descremada",
    "sinonimos": [
      "leche parcialmente descremada",
      "leche 0%"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "leche deslactosada",
    "sinonimos": [
      "leche sin lactosa"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "leche en polvo",
    "sinonimos": [
      "leche polvo"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "leche chocolatada",
    "sinonimos": [
      "chocolatada",
      "cindor"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "leche condensada",
    "sinonimos": [
      "lata de leche condensada"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "leche evaporada",
    "sinonimos": [
      "leche ideal"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "crema de leche",
    "sinonimos": [
      "crema leche",
      "crema para batir",
      "crema cocina"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "crema doble",
    "sinonimos": [
      "crema espesa"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "chantilly",
    "sinonimos": [
      "crema chantilly en aerosol"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "manteca",
    "sinonimos": [
      "manteca 200g",
      "pan de manteca"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "margarina",
    "sinonimos": [
      "dánica",
      "margarina vegetal"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "yogur natural",
    "sinonimos": [
      "yogurt natural"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "yogur con frutilla",
    "sinonimos": [
      "yogur frutilla",
      "yogurt frutilla"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "yogur con vainilla",
    "sinonimos": [
      "yogur vainilla",
      "yogurt vainilla"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "yogur bebible",
    "sinonimos": [
      "yogur sachet",
      "yogurt bebible"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "yogur griego",
    "sinonimos": [
      "yogurt griego"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "yogur con cereales",
    "sinonimos": [
      "yogur con granola"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "queso cremoso",
    "sinonimos": [
      "cremoso",
      "cuartirolo",
      "queso cuartirolo",
      "cremosito"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "muzzarella",
    "sinonimos": [
      "mozzarella",
      "queso muzzarella",
      "queso muzza",
      "muzza"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso rallado",
    "sinonimos": [
      "quesito rallado",
      "reggianito rallado",
      "parmesano rallado"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso reggianito",
    "sinonimos": [
      "reggianito",
      "queso duro"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso sardo",
    "sinonimos": [
      "sardo"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso pategras",
    "sinonimos": [
      "pategras",
      "queso mar del plata",
      "mar del plata"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso gouda",
    "sinonimos": [
      "gouda"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso tybo",
    "sinonimos": [
      "tybo",
      "queso de maquina",
      "queso en barra"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso dambo",
    "sinonimos": [
      "dambo"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso fontina",
    "sinonimos": [
      "fontina"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso gruyere",
    "sinonimos": [
      "gruyere"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso roquefort",
    "sinonimos": [
      "roquefort",
      "queso azul"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso provolone",
    "sinonimos": [
      "provolone",
      "provoleta"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso untable",
    "sinonimos": [
      "queso blanco",
      "casancrem",
      "finlandia",
      "philadelphia"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "queso untable descremado",
    "sinonimos": [
      "queso blanco light"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "queso cheddar",
    "sinonimos": [
      "cheddar feteado",
      "salsa cheddar"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso brie",
    "sinonimos": [
      "brie"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso camembert",
    "sinonimos": [
      "camembert"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso mascarpone",
    "sinonimos": [
      "mascarpone"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso de cabra",
    "sinonimos": [
      "chivo queso"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "ricota",
    "sinonimos": [
      "ricotta",
      "ricota magra"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "levadura fresca",
    "sinonimos": [
      "levadura",
      "cubito de levadura"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "tapa de empanada",
    "sinonimos": [
      "tapas de empanada",
      "tapas para horno",
      "tapas para freir",
      "tapas hojaldre"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "tapa de tarta",
    "sinonimos": [
      "tapas de tarta",
      "pascualina",
      "tapa pascualina"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "tapa de empanada criolla",
    "sinonimos": [
      "criollas empanada"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "tapa de empanada hojaldre",
    "sinonimos": [
      "hojaldradas empanada"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "tapa de tarta integral",
    "sinonimos": [
      "pascualina integral"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "dulce de batata",
    "sinonimos": [
      "batata pan",
      "dulce batata"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "dulce de membrillo",
    "sinonimos": [
      "membrillo pan",
      "dulce membrillo"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "postre de leche",
    "sinonimos": [
      "postrecito serenito",
      "danette"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "flan con caramelo pote",
    "sinonimos": [
      "flan comprado"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "leche de almendras",
    "sinonimos": [
      "bebida de almendras"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "leche de soja",
    "sinonimos": [
      "bebida de soja"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "leche de coco",
    "sinonimos": [
      "lata de leche de coco"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "leche de avena",
    "sinonimos": [
      "bebida de avena"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "tofu",
    "sinonimos": [
      "queso de soja"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "ricota magra",
    "sinonimos": [
      "ricota descremada"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso magro sin sal",
    "sinonimos": [
      "queso sin sal"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "manteca clarificada",
    "sinonimos": [
      "ghee"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "queso parmesano",
    "sinonimos": [
      "parmesano horma"
    ],
    "categoria": "lacteos",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "jamon cocido",
    "sinonimos": [
      "jamoncito",
      "fiambrin",
      "jamon cocido natural"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "jamon crudo",
    "sinonimos": [
      "crudo feteado",
      "jamon serrano"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "paleta fiambrera",
    "sinonimos": [
      "paleta cocida",
      "paleta sandwich"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "salame",
    "sinonimos": [
      "salame picado fino",
      "salame picado grueso",
      "salamin"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "salame milan",
    "sinonimos": [
      "milan feteado"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "salame de colonia",
    "sinonimos": [
      "salame caroya"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mortadela",
    "sinonimos": [
      "mortadela con pistacho"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "salchichon primavera",
    "sinonimos": [
      "primavera"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "panceta ahumada",
    "sinonimos": [
      "panceta",
      "bacon",
      "tocino"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "panceta salada",
    "sinonimos": [
      "panceta para tuco"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "chorizo colorado",
    "sinonimos": [
      "chorizo espanol",
      "cantimpalo"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "bondiola feteada",
    "sinonimos": [
      "bondiola estacionada"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "lomito ahumado",
    "sinonimos": [
      "lomito feteado",
      "lomito"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "leberwurst",
    "sinonimos": [
      "pasta de higado"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pate de foie",
    "sinonimos": [
      "pate en lata",
      "paté"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "queso de chancho",
    "sinonimos": [
      "morcon"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "pastron",
    "sinonimos": [
      "pastrami"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "matambre arrollado",
    "sinonimos": [
      "matambre casero feteado"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "arrollado de pollo",
    "sinonimos": [
      "pollo arrollado feteado"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "salchichas",
    "sinonimos": [
      "salchicha",
      "vienisima",
      "salchichas de viena"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "salchichas con queso",
    "sinonimos": [
      "vienisimas con queso"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "salchichas alemanas",
    "sinonimos": [
      "bratwurst"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "salchichas de pollo",
    "sinonimos": [
      "salchichas de ave"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "chorizo seco",
    "sinonimos": [
      "chorizo criollo seco"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "sopresatta",
    "sinonimos": [
      "sopresata"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "bresaola",
    "sinonimos": [
      "carne curada"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "lomo embuchado",
    "sinonimos": [
      "lomo curado"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "jamon glaseado",
    "sinonimos": [
      "jamon dulce"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "picada de fiambres",
    "sinonimos": [
      "tabla de fiambres"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mortadela bocha",
    "sinonimos": [
      "bochita mortadela"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "panceta en tiras",
    "sinonimos": [
      "tiras de panceta"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "chorizo parrillero seco",
    "sinonimos": [
      "choricito"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "salchichon con jamon",
    "sinonimos": [
      "salchichon"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "chicharron",
    "sinonimos": [
      "chicharrones"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "butifarra",
    "sinonimos": [
      "botifarra"
    ],
    "categoria": "fiambreria",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "yerba mate",
    "sinonimos": [
      "yerba",
      "yerba playadito",
      "yerba taragui",
      "yerba con palo",
      "yerba suave"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "yerba mate sin palo",
    "sinonimos": [
      "yerba despalada"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "yerba mate compuesta",
    "sinonimos": [
      "yerba con hierbas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "huevo",
    "sinonimos": [
      "huevos",
      "huevo blanco",
      "huevo colorado",
      "huevos de campo",
      "maple de huevos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "huevo de codorniz",
    "sinonimos": [
      "huevos de codorniz"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cafe",
    "sinonimos": [
      "cafe molido",
      "cafe torrado",
      "cafe instantaneo",
      "cafe en saquitos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "cafe en grano",
    "sinonimos": [
      "granos de cafe"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "cafe descafeinado",
    "sinonimos": [
      "cafe sin cafeina"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "capsulas de cafe",
    "sinonimos": [
      "nespresso",
      "dolce gusto"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "te",
    "sinonimos": [
      "te negro",
      "saquitos de te",
      "te en saquitos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "te verde",
    "sinonimos": [
      "saquitos de te verde"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "te de manzanilla",
    "sinonimos": [
      "manzanilla"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "te de tilo",
    "sinonimos": [
      "tilo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "te de menta",
    "sinonimos": [
      "menta peperina"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "te earl grey",
    "sinonimos": [
      "earl grey"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "mate cocido",
    "sinonimos": [
      "saquitos de mate cocido"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "azucar",
    "sinonimos": [
      "azucar blanco",
      "azucar comun",
      "azucar ledesma"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "azucar impalpable",
    "sinonimos": [
      "azucar flor",
      "azucar glas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "azucar negra",
    "sinonimos": [
      "azucar rubia",
      "azucar mascabo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "edulcorante",
    "sinonimos": [
      "stevia",
      "sucralosa",
      "edulcorante liquido",
      "hileret"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "edulcorante en sobres",
    "sinonimos": [
      "sobres de edulcorante"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "arroz",
    "sinonimos": [
      "arroz largo fino",
      "arroz blanco",
      "arroz parboil",
      "arroz no se pasa"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "arroz carnaroli",
    "sinonimos": [
      "arroz para risotto",
      "arroz arborio"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "arroz integral",
    "sinonimos": [
      "arroz yamani",
      "yamani"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "arroz basmati",
    "sinonimos": [
      "basmati"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "arroz jazmin",
    "sinonimos": [
      "jazmin"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "arroz sushi",
    "sinonimos": [
      "arroz grano corto"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "arroz doble carolina",
    "sinonimos": [
      "doble carolina"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "fideos",
    "sinonimos": [
      "fideos secos",
      "tallarines",
      "spaghetti",
      "mostacholes",
      "tirabuzon",
      "guiseros",
      "sopita",
      "fideitos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos tallarines",
    "sinonimos": [
      "tallarines secos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos spaghetti",
    "sinonimos": [
      "espaguetis"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos moñitos",
    "sinonimos": [
      "farfalle",
      "monitos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos tirabuzon",
    "sinonimos": [
      "fusilli",
      "tirabuzones"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos mostacholes",
    "sinonimos": [
      "penne rigate",
      "mostachol"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos para sopa",
    "sinonimos": [
      "cabello de angel",
      "municion",
      "estrellita"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos cinta",
    "sinonimos": [
      "pappardelle",
      "fettuccine"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos codito",
    "sinonimos": [
      "coditos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fideos nido",
    "sinonimos": [
      "nidos de fideos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "harina 000",
    "sinonimos": [
      "harina triple cero",
      "harina comun",
      "harina panadera"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "harina 0000",
    "sinonimos": [
      "harina cuatro ceros",
      "harina repostera"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "harina leudante",
    "sinonimos": [
      "harina con polvo de hornear",
      "blancaflor"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "harina integral",
    "sinonimos": [
      "harina pura integral"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "harina de centeno",
    "sinonimos": [
      "centeno"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "harina de maiz",
    "sinonimos": [
      "polenta",
      "polenta presto pronta"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "harina de arroz",
    "sinonimos": [
      "harina sin gluten"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "harina de garbanzo",
    "sinonimos": [
      "faina",
      "harina para faina"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "almidon de maiz",
    "sinonimos": [
      "maicena",
      "fecula de maiz"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "fecula de mandioca",
    "sinonimos": [
      "almidon de mandioca",
      "almidon para chipa"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pan rallado",
    "sinonimos": [
      "rebozador",
      "pan rallado preferido",
      "rallado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "panko",
    "sinonimos": [
      "pan rallado japones"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "aceite de girasol",
    "sinonimos": [
      "aceite girasol",
      "aceite natura",
      "aceite comun"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "aceite de oliva",
    "sinonimos": [
      "oliva",
      "aceite oliva extra virgen"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "aceite de maiz",
    "sinonimos": [
      "aceite maiz"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "aceite de canola",
    "sinonimos": [
      "canola"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "aceite de coco",
    "sinonimos": [
      "aceite coco virgen"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "aceite en aerosol",
    "sinonimos": [
      "fritolim",
      "rocio vegetal"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vinagre de alcohol",
    "sinonimos": [
      "vinagre blanco",
      "vinagre alcohol"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "vinagre de manzana",
    "sinonimos": [
      "vinagre manzana",
      "vinagre sidra"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "vinagre de vino",
    "sinonimos": [
      "vinagre vino tinto"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "aceto balsamico",
    "sinonimos": [
      "aceto"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "reduccion de aceto",
    "sinonimos": [
      "glaseado balsamico"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "sal fina",
    "sinonimos": [
      "sal de mesa",
      "sal celusal fina"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "sal gruesa",
    "sinonimos": [
      "sal parrillera",
      "sal gruesa asado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "sal entrefina",
    "sinonimos": [
      "sal marina"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "sal rosa del himalaya",
    "sinonimos": [
      "sal rosada"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "sal dietetica",
    "sinonimos": [
      "sal sin sodio",
      "sal light"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "salsa de tomate",
    "sinonimos": [
      "pure de tomate",
      "tomate triturado",
      "pulpa de tomate",
      "extracto de tomate"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "tomate en lata",
    "sinonimos": [
      "tomates perita pelados",
      "lata de tomate"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "salsa pomarola",
    "sinonimos": [
      "pomarola lista"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "salsa portuguesa",
    "sinonimos": [
      "tuco portugues"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "salsa bolognesa",
    "sinonimos": [
      "salsa con carne"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "mayonesa",
    "sinonimos": [
      "mayo",
      "hellmanns",
      "natura"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mayonesa light",
    "sinonimos": [
      "mayo baja calorias"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mostaza",
    "sinonimos": [
      "savora",
      "mostaza dijon"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "ketchup",
    "sinonimos": [
      "kechu",
      "salsa ketchup"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "salsa golf",
    "sinonimos": [
      "golf"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "salsa barbacoa",
    "sinonimos": [
      "bbq"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "salsa de soja",
    "sinonimos": [
      "salsa soja"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "salsa inglesa",
    "sinonimos": [
      "worcestershire"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "chimichurri",
    "sinonimos": [
      "chimichurri preparado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "salsa criolla",
    "sinonimos": [
      "criolla frasco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "atun en lata",
    "sinonimos": [
      "atun al natural",
      "atun en aceite",
      "lata de atun"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "caballa en lata",
    "sinonimos": [
      "caballa",
      "lata de caballa"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "sardinas en lata",
    "sinonimos": [
      "sardinas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "anchoas en aceite",
    "sinonimos": [
      "anchoitas en frasco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "palmitos en lata",
    "sinonimos": [
      "lata de palmitos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "arvejas en lata",
    "sinonimos": [
      "arvejas",
      "lata de arvejas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "choclo en lata",
    "sinonimos": [
      "choclo cremoso",
      "choclo grano amarillo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "lentejas en lata",
    "sinonimos": [
      "lentejas remojadas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "garbanzos en lata",
    "sinonimos": [
      "garbanzo remojado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "porotos en lata",
    "sinonimos": [
      "porotos alubia remojados"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "lentejas secas",
    "sinonimos": [
      "lentejas",
      "paquete de lentejas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "lentejones",
    "sinonimos": [
      "lentejas grandes"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "porotos alubia",
    "sinonimos": [
      "porotos blancos",
      "alubia"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "porotos negros",
    "sinonimos": [
      "porotos feijoada"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "porotos colorados",
    "sinonimos": [
      "porotos rojos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "porotos pallares",
    "sinonimos": [
      "pallares mantecosos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "garbanzos secos",
    "sinonimos": [
      "garbanzos crudos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "arvejas secas partidas",
    "sinonimos": [
      "arvejas verdes secas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "maiz blanco partido",
    "sinonimos": [
      "maiz locro",
      "maiz blanco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "maiz pisingallo",
    "sinonimos": [
      "pochoclo",
      "maiz para pochoclo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "aceitunas verdes",
    "sinonimos": [
      "aceitunas",
      "aceitunas con carozo",
      "aceitunas descarozadas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "aceitunas negras",
    "sinonimos": [
      "aceitunas griegas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "aceitunas rellenas",
    "sinonimos": [
      "aceitunas con morron"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "picles",
    "sinonimos": [
      "encurtidos",
      "pepinillos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "berenjenas en escabeche",
    "sinonimos": [
      "escabeche de berenjena"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "oregano seco",
    "sinonimos": [
      "oregano"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "aji molido",
    "sinonimos": [
      "aji picante",
      "chile molido"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pimenton",
    "sinonimos": [
      "pimenton dulce",
      "pimenton ahumado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pimenton picante",
    "sinonimos": [
      "pimenton extra picante"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "comino",
    "sinonimos": [
      "comino molido"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "nuez moscada",
    "sinonimos": [
      "nuez moscada molida",
      "nuez moscada entera"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pimienta negra",
    "sinonimos": [
      "pimienta molida",
      "pimienta en grano"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pimienta blanca",
    "sinonimos": [
      "pimienta blanca molida"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pimienta verde",
    "sinonimos": [
      "granos de pimienta verde"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "laurel",
    "sinonimos": [
      "hojas de laurel"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "curry",
    "sinonimos": [
      "curry en polvo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "curcuma",
    "sinonimos": [
      "curcuma molida"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "canela en rama",
    "sinonimos": [
      "rama de canela"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "canela en polvo",
    "sinonimos": [
      "canela molida"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "clavo de olor",
    "sinonimos": [
      "clavos de olor"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "estragón",
    "sinonimos": [
      "estragon"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "eneldo",
    "sinonimos": [
      "eneldo seco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "provenzal seco",
    "sinonimos": [
      "ajo y perejil deshidratado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "ajo en polvo",
    "sinonimos": [
      "ajo granulado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "cebolla en polvo",
    "sinonimos": [
      "cebolla deshidratada"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "caldo de verduras",
    "sinonimos": [
      "cubito de caldo",
      "caldo knorr verdura"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "caldo de gallina",
    "sinonimos": [
      "caldo pollo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "caldo de carne",
    "sinonimos": [
      "caldo vacuno"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "sopa crema de arvejas",
    "sinonimos": [
      "sopa knorr"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "sopa crema de esparragos",
    "sinonimos": [
      "sopa sobre"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "sopa crema de zapallo",
    "sinonimos": [
      "sopa instantanea"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "galletitas de agua",
    "sinonimos": [
      "galletitas agua",
      "criollitas",
      "express",
      "medallones"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "galletitas de salvado",
    "sinonimos": [
      "galletitas integrales"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "galletitas dulces",
    "sinonimos": [
      "galletitas surtidas",
      "chocolinas",
      "oreos",
      "vocacion",
      "sonrisas",
      "melba"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "galletitas chocolinas",
    "sinonimos": [
      "chocolinas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "galletitas oreo",
    "sinonimos": [
      "oreos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "galletitas pepas",
    "sinonimos": [
      "pepas de membrillo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "vainillas",
    "sinonimos": [
      "bizcochos vainilla"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "bizcochitos de grasa",
    "sinonimos": [
      "bizcochitos",
      "don satur",
      "bizcochos de grasa"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "mermelada de durazno",
    "sinonimos": [
      "mermelada durazno"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mermelada de frutilla",
    "sinonimos": [
      "mermelada frutilla"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mermelada de ciruela",
    "sinonimos": [
      "dulce de ciruela"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mermelada de damasco",
    "sinonimos": [
      "dulce de damasco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mermelada de naranja",
    "sinonimos": [
      "mermelada de citricos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mermelada de rosa mosqueta",
    "sinonimos": [
      "rosa mosqueta",
      "mosqueta"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mermelada de frambuesa",
    "sinonimos": [
      "dulce de frambuesa"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "mermelada de sauco",
    "sinonimos": [
      "dulce de sauco patagonico"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "miel",
    "sinonimos": [
      "miel pura",
      "miel de abeja"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "dulce de leche",
    "sinonimos": [
      "dulce leche",
      "ddl",
      "dulce de leche colonial",
      "dulce de leche repostero"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "cacao en polvo",
    "sinonimos": [
      "nesquik",
      "chocolatada polvo",
      "cacao amargo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "chocolate para taza",
    "sinonimos": [
      "chocolate aguila",
      "barra de chocolate"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "chips de chocolate",
    "sinonimos": [
      "gotas de chocolate"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "polvo para hornear",
    "sinonimos": [
      "royal",
      "levadura quimica"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "bicarbonato de sodio",
    "sinonimos": [
      "bicarbonato"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "levadura seca",
    "sinonimos": [
      "levadura en polvo",
      "levadurina"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "esencia de vainilla",
    "sinonimos": [
      "vainilla liquida"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "colorante de repostería",
    "sinonimos": [
      "colorante vegetal"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "gelatina de frutilla",
    "sinonimos": [
      "gelatina frutilla"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "gelatina de cereza",
    "sinonimos": [
      "gelatina cereza"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "gelatina sin sabor",
    "sinonimos": [
      "gelatina neutra"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "flan en polvo",
    "sinonimos": [
      "caja de flan",
      "flan con caramelo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "postre de chocolate en polvo",
    "sinonimos": [
      "postre royal"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "coco rallado",
    "sinonimos": [
      "coco seco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "papas fritas",
    "sinonimos": [
      "papas de paquete",
      "papas lays",
      "lays",
      "papas copetin",
      "chips"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "papas fritas pay",
    "sinonimos": [
      "papas pay"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "chizitos",
    "sinonimos": [
      "palitos de queso",
      "chicitos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "palitos salados",
    "sinonimos": [
      "palitos"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "mani salado",
    "sinonimos": [
      "mani",
      "cacahuate"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "mani sin sal",
    "sinonimos": [
      "mani tostado pelado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "nueces",
    "sinonimos": [
      "nuez",
      "mariposa"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "almendras",
    "sinonimos": [
      "almendra pelada"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "castanas de caju",
    "sinonimos": [
      "caju"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "avellanas",
    "sinonimos": [
      "avellana"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "pasas de uva",
    "sinonimos": [
      "pasas de uva rubias",
      "pasas negras"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "ciruelas pasas",
    "sinonimos": [
      "ciruela deshidratada"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "damascos turcos",
    "sinonimos": [
      "orejones de damasco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "avena",
    "sinonimos": [
      "avena arrollada",
      "quaker",
      "avena instantanea"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "copos de maiz",
    "sinonimos": [
      "cereales",
      "zucaritas",
      "corn flakes"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "granola",
    "sinonimos": [
      "mix de cereales"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "semillas de girasol",
    "sinonimos": [
      "girasol pelado"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "semillas de chia",
    "sinonimos": [
      "chia"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "semillas de sesamo",
    "sinonimos": [
      "sesamo integral",
      "sesamo blanco"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "semillas de lino",
    "sinonimos": [
      "lino"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "semillas de amapola",
    "sinonimos": [
      "amapola"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "semillas de zapallo",
    "sinonimos": [
      "pepas de zapallo"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "carbon",
    "sinonimos": [
      "bolsa de carbon",
      "carbon vegetal"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "lena",
    "sinonimos": [
      "bolsa de lena",
      "quebracho"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "fosforos",
    "sinonimos": [
      "caja de fosforos",
      "cerillas"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "encendedor",
    "sinonimos": [
      "bic",
      "fuego"
    ],
    "categoria": "almacen",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pan",
    "sinonimos": [
      "pan frances",
      "miñon",
      "pan flauta",
      "flautita",
      "pancitos"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pan mignon",
    "sinonimos": [
      "mignon"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pan flauta",
    "sinonimos": [
      "barra de pan"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "figaza de manteca",
    "sinonimos": [
      "figacitas"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pan lactal",
    "sinonimos": [
      "pan de molde",
      "pan lacteado",
      "pan blanco feteado"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pan integral",
    "sinonimos": [
      "pan lactal integral",
      "pan negro"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pan con salvado",
    "sinonimos": [
      "pan salvado"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pan multicereal",
    "sinonimos": [
      "pan 7 cereales"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pan de hamburguesa",
    "sinonimos": [
      "panes de hamburguesa"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pan de pancho",
    "sinonimos": [
      "pan para hot dog",
      "panes de pancho"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pan arabe",
    "sinonimos": [
      "pan pita"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pan de campo",
    "sinonimos": [
      "pan casero"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "medialunas",
    "sinonimos": [
      "medialuna",
      "medialunas de manteca",
      "medialunas de grasa"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "facturas",
    "sinonimos": [
      "docena de facturas",
      "facturitas"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vigilantes",
    "sinonimos": [
      "facturas vigilante"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "canoncitros de dulce de leche",
    "sinonimos": [
      "canoncitos"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "bolas de fraile",
    "sinonimos": [
      "berlinesas"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "churros",
    "sinonimos": [
      "churros rellenos con dulce de leche"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "tortas fritas",
    "sinonimos": [
      "torta frita"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cremona",
    "sinonimos": [
      "cremona con grasa"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cuernitos de grasa",
    "sinonimos": [
      "cuernitos"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "chipa",
    "sinonimos": [
      "chipas",
      "pan de queso"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "tostadas",
    "sinonimos": [
      "pan tostado",
      "tostaditas"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "grisines",
    "sinonimos": [
      "palitos de pan"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "talitas",
    "sinonimos": [
      "talitas con queso",
      "talitas saborizadas"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "prepizza",
    "sinonimos": [
      "masa de pizza",
      "pizetas",
      "pizzetas"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "prepizza con cebolla",
    "sinonimos": [
      "fugazza masa"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pan dulce",
    "sinonimos": [
      "panettone"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "budin de vainilla",
    "sinonimos": [
      "budin comun"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "budin con chips de chocolate",
    "sinonimos": [
      "budin marmolado"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pionono",
    "sinonimos": [
      "masa de pionono"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "bizcochuelo",
    "sinonimos": [
      "torta bizcochuelo"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "alfajor de maicena",
    "sinonimos": [
      "alfajorcitos de maicena"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "alfajor de chocolate",
    "sinonimos": [
      "alfajor havanna",
      "alfajor jorgito"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pasta frola de membrillo",
    "sinonimos": [
      "pastafrola"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pasta frola de batata",
    "sinonimos": [
      "pastafrola batata"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "tarta tofi",
    "sinonimos": [
      "tarta dulce de leche y chocolate"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "lemon pie",
    "sinonimos": [
      "tarta de limon"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pan de masa madre",
    "sinonimos": [
      "hogaza masa madre"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "baguette",
    "sinonimos": [
      "pan baguette"
    ],
    "categoria": "panaderia",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "agua mineral",
    "sinonimos": [
      "agua",
      "agua sin gas",
      "botella de agua",
      "bidon de agua"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "agua con gas",
    "sinonimos": [
      "soda",
      "sifon de soda"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "coca cola",
    "sinonimos": [
      "gaseosa cola",
      "coca",
      "pepsi"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "coca cola zero",
    "sinonimos": [
      "coca sin azucar",
      "pepsi black"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "gaseosa lima limon",
    "sinonimos": [
      "sprite",
      "7up",
      "seven up"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "gaseosa naranja",
    "sinonimos": [
      "fanta",
      "mirinda"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "gaseosa pomelo",
    "sinonimos": [
      "paso de los toros",
      "schweppes"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "agua tonica",
    "sinonimos": [
      "tonica paso de los toros"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "agua saborizada levite",
    "sinonimos": [
      "levite naranja",
      "levite pomelo"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "agua saborizada aquarius",
    "sinonimos": [
      "aquarius pera",
      "aquarius manzana"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "agua saborizada h2oh",
    "sinonimos": [
      "h2oh limonetto"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "jugo de naranja",
    "sinonimos": [
      "jugo naranja",
      "baggio naranja",
      "cepidan"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "jugo de manzana",
    "sinonimos": [
      "baggio manzana"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "jugo de durazno",
    "sinonimos": [
      "baggio durazno"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "jugo multifruta",
    "sinonimos": [
      "baggio multifruta"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "jugo ades de soja",
    "sinonimos": [
      "ades manzana",
      "ades naranja"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "jugo en polvo tang",
    "sinonimos": [
      "tang naranja"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "jugo en polvo clight",
    "sinonimos": [
      "clight pomelo"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "cerveza",
    "sinonimos": [
      "cervezas",
      "quilmes",
      "brahma",
      "heineken",
      "stella artois",
      "birra",
      "lata de cerveza"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "cerveza rubia",
    "sinonimos": [
      "rubia especial"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "cerveza negra",
    "sinonimos": [
      "bock",
      "porter"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "cerveza roja",
    "sinonimos": [
      "red ale",
      "amber ale"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "cerveza ipa",
    "sinonimos": [
      "cerveza artesanal ipa"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "cerveza patagonia",
    "sinonimos": [
      "patagonia 24.7",
      "patagonia bohemian"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cerveza corona",
    "sinonimos": [
      "coronita"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cerveza sin alcohol",
    "sinonimos": [
      "quilmes 0.0"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "lata"
  },
  {
    "nombre": "vino tinto",
    "sinonimos": [
      "malbec",
      "cabernet",
      "tinto"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino malbec",
    "sinonimos": [
      "malbec reserva"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino cabernet sauvignon",
    "sinonimos": [
      "cabernet"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino bonarda",
    "sinonimos": [
      "bonarda"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino merlot",
    "sinonimos": [
      "merlot patagonico"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino pinot noir",
    "sinonimos": [
      "pinot noir patagonico"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino blanco",
    "sinonimos": [
      "torrontes",
      "chardonnay",
      "blanco"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino chardonnay",
    "sinonimos": [
      "chardonnay blanco"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino torrontes",
    "sinonimos": [
      "torrontes riojano"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino rosado",
    "sinonimos": [
      "rose"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vino espumante",
    "sinonimos": [
      "champagne",
      "chandon",
      "prosecco"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "sidra",
    "sinonimos": [
      "sidra real",
      "sidra del valle",
      "sidra patagonica"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "fernet",
    "sinonimos": [
      "branca",
      "fernet branca"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "campari",
    "sinonimos": [
      "aperitivo campari"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "gancia",
    "sinonimos": [
      "aperitivo americano"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vermouth",
    "sinonimos": [
      "cinzano",
      "martini rosso"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cynar",
    "sinonimos": [
      "alcachofa licor"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "aperol",
    "sinonimos": [
      "aperol spritz"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "vodka",
    "sinonimos": [
      "smirnoff",
      "absolut"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "gin",
    "sinonimos": [
      "beefeater",
      "gin heraclito"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "whisky",
    "sinonimos": [
      "johnnie walker",
      "blended"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "ron",
    "sinonimos": [
      "havana club",
      "bacardi"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "licor de dulce de leche",
    "sinonimos": [
      "baileys",
      "licor artesanal"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "amaretto",
    "sinonimos": [
      "licor de almendras"
    ],
    "categoria": "bebidas",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "hamburguesas",
    "sinonimos": [
      "paty",
      "hamburguesas de carne",
      "hamburguesa congelada"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "hamburguesas vegetarianas",
    "sinonimos": [
      "hamburguesas de soja",
      "not burger",
      "veggie burger"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "hamburguesas de pollo",
    "sinonimos": [
      "paty de pollo"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "nuggets de pollo",
    "sinonimos": [
      "patitas de pollo",
      "patitas"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "papas congeladas",
    "sinonimos": [
      "papas baston",
      "mccain"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "papas noisette",
    "sinonimos": [
      "noisette congeladas"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "papas rusticas congeladas",
    "sinonimos": [
      "cuñas de papa"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "verduras congeladas",
    "sinonimos": [
      "mix de verduras",
      "primavera congelada"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "espinaca congelada",
    "sinonimos": [
      "espinaca congelada en cubos"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "choclo congelado",
    "sinonimos": [
      "choclo desgranado"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "arvejas congeladas",
    "sinonimos": [
      "arvejas congeladas"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "brocoli congelado",
    "sinonimos": [
      "arbolitos de brocoli"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "medallones de merluza",
    "sinonimos": [
      "filet congelado rebozado"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "medallones de verdura",
    "sinonimos": [
      "medallones de calabaza y queso"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "croquetas de papa congeladas",
    "sinonimos": [
      "croquetitas"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "empanadas congeladas",
    "sinonimos": [
      "docena de empanadas para hornear"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pizzas congeladas",
    "sinonimos": [
      "pizza sibarita"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "helado",
    "sinonimos": [
      "pote de helado",
      "kilo de helado",
      "grido",
      "freddo"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "bombones helados",
    "sinonimos": [
      "bombón escocés",
      "bombón suizo"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "palitos de helado",
    "sinonimos": [
      "palito de agua"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "hielo",
    "sinonimos": [
      "bolsa de hielo",
      "cubitos de hielo"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "masa filo congelada",
    "sinonimos": [
      "masa baklava"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "frutos rojos congelados",
    "sinonimos": [
      "mix frutos del bosque"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "frutillas congeladas",
    "sinonimos": [
      "frutillas para licuado"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "arandanos congelados",
    "sinonimos": [
      "arandanos frizados"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "g"
  },
  {
    "nombre": "mariscos congelados",
    "sinonimos": [
      "cazuela de mariscos"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "rabas congeladas",
    "sinonimos": [
      "anillos de calamar rebozados"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "bocaditos de queso congelados",
    "sinonimos": [
      "tequeños congelados"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "tartas congeladas",
    "sinonimos": [
      "tarta individual para microondas"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "ravioles congelados",
    "sinonimos": [
      "ravioles de verdura"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "sorrentinos congelados",
    "sinonimos": [
      "sorrentinos de jamon y queso"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "ñoquis congelados",
    "sinonimos": [
      "ñoquis de papa listos"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "canelones congelados",
    "sinonimos": [
      "canelones con salsa"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "lasagna congelada",
    "sinonimos": [
      "lasaña lista"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "tortillas mexicanas congeladas",
    "sinonimos": [
      "fajitas"
    ],
    "categoria": "congelados",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "papel higienico",
    "sinonimos": [
      "higienico",
      "rollo higienico",
      "papel de bano",
      "scott",
      "elite"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "papel higienico doble hoja",
    "sinonimos": [
      "higienico premiun"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "rollo de cocina",
    "sinonimos": [
      "rollos de cocina",
      "papel de cocina",
      "servilletas de papel"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "servilletas de papel",
    "sinonimos": [
      "servilletas descartables"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "jabon en polvo",
    "sinonimos": [
      "jabon para lavarropas",
      "ala",
      "skip",
      "ariel",
      "jabon ropa"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "jabon liquido para ropa",
    "sinonimos": [
      "jabon liquido lavarropas",
      "jabon liquido ropa"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "suavizante para ropa",
    "sinonimos": [
      "suavizante",
      "vivere",
      "comfort"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "jabon blanco en pan",
    "sinonimos": [
      "pan de jabon blanco",
      "jabon federal"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "quitamanchas",
    "sinonimos": [
      "vanish",
      "oxigeno activo"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "detergente para vajilla",
    "sinonimos": [
      "detergente",
      "magistral",
      "ala platos",
      "cif vajilla"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "detergente concentrado",
    "sinonimos": [
      "magistral limon"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pastillas para lavavajillas",
    "sinonimos": [
      "finish"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "sal para lavavajillas",
    "sinonimos": [
      "sal regeneradora"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "lavandina",
    "sinonimos": [
      "lavandina comun",
      "ayudin",
      "cloro"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "lavandina en gel",
    "sinonimos": [
      "lavandina gel"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "lavandina para ropa",
    "sinonimos": [
      "lavandina blanca"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "desinfectante de pisos",
    "sinonimos": [
      "poett",
      "desodorante de piso",
      "limpiador de pisos",
      "procenen"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "limpiador cremoso",
    "sinonimos": [
      "cif",
      "cif crema"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "limpiavidrios",
    "sinonimos": [
      "limpiador de vidrios",
      "cristal"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "antigrasa",
    "sinonimos": [
      "desengrasante",
      "mr musculo"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "esponja de cocina",
    "sinonimos": [
      "esponjita",
      "mortimer",
      "esponja verde y amarilla"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "esponja de acero",
    "sinonimos": [
      "virulana",
      "lana de acero"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "esponja que no raya",
    "sinonimos": [
      "esponja azul"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "rejilla",
    "sinonimos": [
      "trapo rejilla",
      "pano rejilla"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "trapo de piso",
    "sinonimos": [
      "trapo piso",
      "trapo de piso blanco"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pano de microfibra",
    "sinonimos": [
      "microfibra"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "bolsas de residuos",
    "sinonimos": [
      "bolsas de basura",
      "bolsas consorcio",
      "bolsas negras"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "bolsas de residuos 45x55",
    "sinonimos": [
      "bolsas chicas basura"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "bolsas de consorcio 60x90",
    "sinonimos": [
      "bolsas grandes consorcio"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "guantes de limpieza",
    "sinonimos": [
      "guantes de goma",
      "guantes latex"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pastilla de inodoro",
    "sinonimos": [
      "canastita inodoro",
      "bloque inodoro"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "liquido limpiador de inodoro",
    "sinonimos": [
      "pato purific",
      "harpic"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "destapacañerias",
    "sinonimos": [
      "destapa cañerias en gel"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "desodorante de ambiente",
    "sinonimos": [
      "aerosol ambiente",
      "glade"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "difusor de aromas",
    "sinonimos": [
      "varitas aromaticas"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "insecticida",
    "sinonimos": [
      "raid",
      "fuyi",
      "mata moscas"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "espirales",
    "sinonimos": [
      "espiral para mosquitos",
      "repelente mosquitos"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "tabletas para mosquitos",
    "sinonimos": [
      "fuyi tabletas"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "repelente",
    "sinonimos": [
      "off",
      "aerosol repelente"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "repelente en crema",
    "sinonimos": [
      "off crema"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "lustramuebles",
    "sinonimos": [
      "blem",
      "aerosol muebles"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cera para pisos",
    "sinonimos": [
      "cera roja",
      "cera incolora"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "lampazo",
    "sinonimos": [
      "mopa"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "escoba",
    "sinonimos": [
      "escobillon"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pala de basura",
    "sinonimos": [
      "palita junta basura"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "broches para ropa",
    "sinonimos": [
      "broches de plastico",
      "broches de madera"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "film transparente",
    "sinonimos": [
      "papel film cocina",
      "rollo de film"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "papel de aluminio",
    "sinonimos": [
      "papel aluminio"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "bolsas ziploc",
    "sinonimos": [
      "bolsas hermeticas para freezer"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "papel manteca",
    "sinonimos": [
      "papel para horno"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "palillos escarbadientes",
    "sinonimos": [
      "escarbadientes"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "vasos descartables",
    "sinonimos": [
      "vasitos plasticos"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "platos descartables",
    "sinonimos": [
      "platos de carton"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "cubiertos descartables",
    "sinonimos": [
      "tenedores plasticos"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "filtro de cafe",
    "sinonimos": [
      "filtros de papel para cafe"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "sal para ablandador de agua",
    "sinonimos": [
      "sal gruesa boya"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "pastillas de cloro para pileta",
    "sinonimos": [
      "cloro pastillas"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "alguicida para pileta",
    "sinonimos": [
      "alguicida"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "clarificador para pileta",
    "sinonimos": [
      "decantador"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "l"
  },
  {
    "nombre": "limpiador desinfectante lisoform",
    "sinonimos": [
      "lisoform aerosol"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "jabon de tocador",
    "sinonimos": [
      "jabon de manos",
      "jabon barra",
      "dove",
      "lux"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "jabon liquido para manos",
    "sinonimos": [
      "jabon manos",
      "repuesto jabon manos"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "jabon blanco hipoalergenico",
    "sinonimos": [
      "jabon glicerina"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "shampoo",
    "sinonimos": [
      "champu",
      "shampoo pelo",
      "sedal",
      "pantene"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "shampoo anticaspa",
    "sinonimos": [
      "head and shoulders",
      "clear"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "acondicionador",
    "sinonimos": [
      "crema de enjuague",
      "enjuague pelo"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "banio de crema capilar",
    "sinonimos": [
      "mascarilla pelo"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "crema dental",
    "sinonimos": [
      "pasta de dientes",
      "dentifrico",
      "colgate"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cepillo de dientes",
    "sinonimos": [
      "cepillo dental"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "enjuague bucal",
    "sinonimos": [
      "listerine",
      "plax"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "hilo dental",
    "sinonimos": [
      "seda dental"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "desodorante corporal",
    "sinonimos": [
      "desodorante",
      "antitranspirante",
      "rexona",
      "axe"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "desodorante a bolilla",
    "sinonimos": [
      "roll on"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "algodon",
    "sinonimos": [
      "paquete de algodon",
      "algodon en discos"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "protectores diarios",
    "sinonimos": [
      "protectores carefree"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "toallitas femeninas",
    "sinonimos": [
      "toallas femeninas",
      "always",
      "kotex"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "toallitas nocturnas",
    "sinonimos": [
      "toallas largas"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "tampones",
    "sinonimos": [
      "ob",
      "tampones con aplicador"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "panales",
    "sinonimos": [
      "pampers",
      "huggies",
      "panales bebe"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "toallitas humedas",
    "sinonimos": [
      "toallitas bebe"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "oleo calcareo",
    "sinonimos": [
      "oleo para bebe"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "ml"
  },
  {
    "nombre": "maquinita de afeitar",
    "sinonimos": [
      "afeitadora descartable",
      "gillette"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "repuestos de afeitadora",
    "sinonimos": [
      "hojas mach 3"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "espuma de afeitar",
    "sinonimos": [
      "crema de afeitar"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "locion para despues de afeitar",
    "sinonimos": [
      "after shave"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "alcohol etilico",
    "sinonimos": [
      "alcohol 70",
      "alcohol fino"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "alcohol en gel",
    "sinonimos": [
      "gel desinfectante"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "agua oxigenada",
    "sinonimos": [
      "peroxido 10 volumenes"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "curitas",
    "sinonimos": [
      "apositos",
      "adhesivos"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "gasa esteril",
    "sinonimos": [
      "gasas"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "cinta adhesiva medica",
    "sinonimos": [
      "hipoalergenica leucoplast"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "crema hidratante corporal",
    "sinonimos": [
      "dermaglos",
      "nivea"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "crema para manos",
    "sinonimos": [
      "crema manos seca"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "protector solar",
    "sinonimos": [
      "bloqueador solar",
      "filtro solar hawaiian"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "post solar",
    "sinonimos": [
      "gel con aloe vera"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "talco corporal",
    "sinonimos": [
      "talco efiderme"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "hisopos",
    "sinonimos": [
      "bastoncillos"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "quitaesmalte",
    "sinonimos": [
      "acetona"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "esmalte de uñas",
    "sinonimos": [
      "pintauñas"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "lima de uñas",
    "sinonimos": [
      "limita"
    ],
    "categoria": "limpieza",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "comida para perro",
    "sinonimos": [
      "alimento balanceado perro",
      "pedigree",
      "dog chow"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "comida para cachorro",
    "sinonimos": [
      "alimento balanceado cachorro"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "comida para gato",
    "sinonimos": [
      "alimento balanceado gato",
      "whiskas",
      "cat chow"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "comida humeda para perro",
    "sinonimos": [
      "sobre pedigree",
      "lata de comida perro"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "comida humeda para gato",
    "sinonimos": [
      "sobre whiskas",
      "lata de pate gato"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "piedras sanitarias",
    "sinonimos": [
      "piedritas para gato",
      "piedras gato"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "huesos para perro",
    "sinonimos": [
      "snack masticable"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "shampoo para perros",
    "sinonimos": [
      "champu canino"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pipeta pulguicida",
    "sinonimos": [
      "frontline",
      "bravecto"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pilas",
    "sinonimos": [
      "pilas aa",
      "pilas aaa",
      "baterias"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pilas aa",
    "sinonimos": [
      "pilas doble a"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "pilas aaa",
    "sinonimos": [
      "pilas triple a"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "foco de luz",
    "sinonimos": [
      "lamparita",
      "foco led"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cinta de embalar",
    "sinonimos": [
      "cinta scotch gruesa"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "cinta aisladora",
    "sinonimos": [
      "cinta electrica"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pegamento universal",
    "sinonimos": [
      "gotita",
      "uhucol"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "maceta de plastico",
    "sinonimos": [
      "macetita"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "tierra fertilizada",
    "sinonimos": [
      "tierra para plantas"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "kg"
  },
  {
    "nombre": "semillas para huerta",
    "sinonimos": [
      "sobre de semillas"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "velas blancas",
    "sinonimos": [
      "paquete de velas"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "paquete"
  },
  {
    "nombre": "paraguas",
    "sinonimos": [
      "paraguas plegable"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "abrelatas",
    "sinonimos": [
      "abrelatas de mano"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "sacacorchos",
    "sinonimos": [
      "tirabuzon vino"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "pelador de papas",
    "sinonimos": [
      "pelapapas"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  },
  {
    "nombre": "termotanque boya",
    "sinonimos": [
      "repuesto"
    ],
    "categoria": "otros",
    "unidad_por_defecto": "unidad"
  }
];

export const CATALOG_EXACT_MAP = new Map<string, CatalogProduct>();

for (const prod of ARGENTINE_CATALOG) {
  CATALOG_EXACT_MAP.set(prod.nombre.toLowerCase(), prod);
  for (const sin of prod.sinonimos) {
    CATALOG_EXACT_MAP.set(sin.toLowerCase(), prod);
  }
}
