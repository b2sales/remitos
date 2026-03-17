import {
  IAcmasoftService,
  AcmasoftCliente,
  AcmasoftGuia,
  AcmasoftGuiaPayload,
} from './acmasoft';

const MOCK_CLIENTES: AcmasoftCliente[] = [
  {
    cliente_id: 'CLI-001',
    razon_social: 'Transportes del Sur S.A.',
    cuit: '30-71234567-0',
    direccion: 'Av. Rivadavia 1234',
    localidad: 'Buenos Aires',
    provincia: 'Buenos Aires',
    telefono: '011-4567-8901',
  },
  {
    cliente_id: 'CLI-002',
    razon_social: 'Distribuidora Norte SRL',
    cuit: '30-70987654-3',
    direccion: 'Ruta 9 km 320',
    localidad: 'Rosario',
    provincia: 'Santa Fe',
  },
  {
    cliente_id: 'CLI-003',
    razon_social: 'Logística Federal S.A.',
    cuit: '30-71456789-1',
    direccion: 'Calle San Martín 567',
    localidad: 'Córdoba',
    provincia: 'Córdoba',
    telefono: '0351-456-7890',
  },
];

let guiaCounter = 1;

export class AcmasoftMockService implements IAcmasoftService {
  async buscarClientes(query: string): Promise<AcmasoftCliente[]> {
    const q = query.toLowerCase();
    return MOCK_CLIENTES.filter(
      (c) =>
        c.razon_social.toLowerCase().includes(q) ||
        c.cuit.includes(q) ||
        c.localidad.toLowerCase().includes(q),
    );
  }

  async obtenerCliente(clienteId: string): Promise<AcmasoftCliente | null> {
    return MOCK_CLIENTES.find((c) => c.cliente_id === clienteId) ?? null;
  }

  async generarGuia(payload: AcmasoftGuiaPayload): Promise<AcmasoftGuia> {
    const numero = guiaCounter++;
    return {
      guia_id: `GUIA-MOCK-${numero.toString().padStart(6, '0')}`,
      numero_guia: `GM-${numero.toString().padStart(6, '0')}`,
      fecha_emision: new Date().toISOString(),
      estado: 'emitida',
    };
  }
}
