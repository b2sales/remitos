export type OperadorRol = 'OPERADOR' | 'SUPERVISOR';

export interface Operador {
  operador_id: string;
  azure_object_id: string;
  nombre: string;
  email: string;
  rol: OperadorRol;
  creado_en: string;
  ultima_actividad: string;
}
