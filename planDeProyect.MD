1. Objetivo General del Proyecto
Construir un sistema serverless que:

Procese imágenes de remitos escaneados, interpretándolos con Amazon Textract.
Utilice Amazon Bedrock para enriquecer la interpretación:

normalización de textos,
inferencia de campos complejos,
identificación de remitente/destinatario,
sugerencia de tipo de carga.


Permita a operadores validar/corregir información mediante una UI web.
Agrupe remitos en lotes automáticos según reglas reales.
Permita marcar remitos urgentes y procesarlos fuera de horario.
Se integre con Acmasoft:

API para consultar clientes,
API para generar nuevas guías.


Exponga métricas operativas en Power BI en tiempo casi real.
Use autenticación SSO Azure (Entra ID).
Tenga backend serverless en Node.js + TypeScript (Lambda).
Tenga frontend en React (SPA en S3 + CloudFront).


2. Arquitectura Tecnológica
Backend

AWS Lambda (Node.js + TypeScript)
API Gateway (REST)
AWS SDK para integrar:

Textract (OCR)
Bedrock (IA)
DynamoDB (DB)
S3 (storage)


Lógica de negocio en TypeScript organizada en:

/functions para Lambdas
/services para integraciones externas (Textract, Bedrock, Acmasoft, Azure Verify)
/models para tipos DynamoDB y DTOs



Frontend

React + TypeScript
MSAL.js para SSO con Azure AD / Entra ID
Consumo de APIs vía API Gateway
Deploy 100% estático en S3 + CloudFront

ERP

API Acmasoft:

GET clientes → matching de remitente / cliente pagador
POST guías → generar guía desde lote validado



Métricas

DynamoDB (tabla de eventos)
Sync/Export → S3
Power BI conectado a S3 o Athena


3. Modelo de Datos DynamoDB
Tabla: Operadores
operador_id (PK)
azure_object_id
nombre
email
rol (OPERADOR | SUPERVISOR)
creado_en
ultima_actividad

Tabla: Remitos
remito_id (PK)
imagen_url
estado
lote_id
datos_extraidos (JSON Textract)
datos_ia (JSON Bedrock)
datos_validados (JSON final)
remitente_normalizado
destinatario_normalizado
cliente_pagador_id
operador_id_validacion
timestamps:
  escaneado_en
  entra_validacion_en
  validado_en
  enviado_acmasoft_en
es_urgente (bool)
fuera_de_horario (bool)

Tabla: Lotes
lote_id (PK)
tipo (normal | urgente)
estado
remitos_ids (array)
abierto_en
cerrado_en
ventana_temporal

Tabla: Eventos
evento_id (PK)
tipo_evento
remito_id
lote_id
operador_id
timestamp
metadata (JSON)

Eventos necesarios:

remito_asignado
remito_validado
campo_corregido
remito_urgente
remito_fuera_horario
lote_abierto
lote_cerrado
guia_generada


4. Procesamiento de Remitos
4.1 Ingesta

Operador sube imagen (PDF/JPG).
Lambda:

guarda en S3
ejecuta Textract (OCR)
guarda remito en DynamoDB con estado pendiente_validación.



4.2 Interpretación con Bedrock

Recibe texto Textract → interpreta contexto:

remitente
destinatario
tipo de carga
unidades/bultos/kg/m³


Usa API Acmasoft para enriquecer matching de clientes.

Resultado → guardado en datos_ia.

5. Validación de Remitos (UI)

Imagen a la izquierda.
Formulario editable a la derecha.
Correcciones → registran campo_corregido en eventos.
Confirmar → remito_validado.


6. Lotes Automáticos
Reglas:

Lote se abre al recibir remitos nuevos.
Corte automático por:

cantidad flexible,
tiempo sin nuevos remitos,
horario operativo (ej. 17:30).


Lote puede tener remitos de distintos remitentes.
Al cerrarse → va a cola de validación.

Eventos: lote_abierto, lote_cerrado.

7. Remitos Urgentes

Operador busca remito (número/remitente).
Selecciona uno o varios del mismo lote.
Extrae sin advertencias.
Crea lote urgente automáticamente.
Procesado antes que cualquier lote normal.
Puede procesarse fuera del horario operativo.

Eventos:

remito_urgente
remito_fuera_horario


8. Integración con Acmasoft
API Clientes

Para normalizar remitente/destinatario/cliente pagador.
El sistema consulta antes de validación.

API Generar Guía

Lote validado → consolidación.
Payload JSON → POST guías en Acmasoft.
Guardar resultado (id_guia_acmasoft).
Evento: guia_generada.


9. Métricas y Power BI
KPIs:

Remitos procesados por operador
Campos corregidos por operador
Tiempo de validación → ERP
% Remitos sin corrección
Urgentes
Fuera de horario
Ranking remitentes con errores
Latencia: escaneo → validación
Tiempos por lote

Flujo:

Eventos DynamoDB → export a S3 → Power BI DirectQuery/Athena.


10. Roles
OPERADOR

Validación
Correcciones
Marcar urgentes
Procesar urgentes

SUPERVISOR

Ve todos los lotes
Ajusta ventana temporal / horario de corte
Ve todas las métricas en Power BI
Supervisa urgentes
No valida remitos (opcional)


11. Plan de Implementación por Fases
Fase 1 — Autenticación + Modelo de Datos

SSO Azure AD (MSAL.js + backend validator)
Tablas DynamoDB
Middleware de roles

Fase 2 — Ingesta + Textract

Upload
OCR
Guardado básico

Fase 3 — Bedrock IA

Interpretación semántica
Normalización
Matching con Acmasoft

Fase 4 — UI Validación

Imagen + formulario
Correcciones + eventos
Confirmación

Fase 5 — Lotes automáticos

Algoritmo tiempo + cantidad + corte horario
Cola de lotes
Eventos

Fase 6 — Urgentes

Búsqueda
Selección múltiple
Lote urgente
Procesar antes de todo
Eventos

Fase 7 — Integración Acmasoft

API clientes
API guías
Envío de datos

Fase 8 — Power BI

Export eventos a S3
Dashboard supervisor

Fase 9 — Funciones Supervisor

Ver lotes
Parámetros del sistema
Ver urgentes
Acceso a métricas