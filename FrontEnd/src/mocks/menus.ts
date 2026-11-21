export type Menu = { id:string; category:string; price:number; description:string; availability:'Disponible'|'Pocas porciones'|'Agotado'; options?: {id:string; name:string; description:string}[] };
export const menus: Menu[] = [
  {id:'eco',category:'Económico',price:10.6,description:'Olluquito de pollo con arroz',availability:'Disponible'},
  {id:'est',category:'Estudiantil',price:13.6,description:'Elige opción 1 o 2',availability:'Disponible',options:[
    {id:'est1',name:'Estudiantil 1',description:'Chicharrón de pescado con lentejas y arroz'},
    {id:'est2',name:'Estudiantil 2',description:'Pollo al horno con ensalada rusa y arroz'}
  ]},
  {id:'eje',category:'Ejecutivo',price:15.4,description:'Lomo saltado con papas',availability:'Disponible'},
  {id:'sal',category:'Saludable',price:17.1,description:'Pollo a la plancha con papa',availability:'Disponible'}
];
