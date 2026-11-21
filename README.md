# Piatto UTEC 2026-2

Aplicación responsive para consulta, separación, reserva y recojo de menús de Piatto UTEC. Una sola plataforma con roles `guest`, `customer` y `staff`.

## Estructura
- `FrontEnd/`: React + TypeScript + Vite, listo para AWS Amplify Hosting.
- `BackEnd/`: handlers Lambda Node.js.
- `infra/`: AWS SAM para Cognito, API Gateway HTTP API, Lambda y DynamoDB.
- `amplify.yml`: build monorepo con `FrontEnd` como app root.

## Frontend local
```bash
cd FrontEnd
npm install
npm run dev
```

## Backend serverless
Requiere AWS CLI + AWS SAM CLI configurados.
```bash
cd infra
sam build -t template.yaml
sam deploy --guided
```

Al finalizar, copiar los outputs `ApiUrl`, `UserPoolId` y `UserPoolClientId` a variables de entorno del frontend/Amplify.

## Deploy del FrontEnd en Amplify
1. Conectar esta repo desde AWS Amplify Hosting.
2. Amplify detecta `amplify.yml` y usa `FrontEnd` como `appRoot`.
3. Configurar variables `VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`.
4. Desplegar `main`.

## Seguridad
- El registro público debe crear usuarios `customer`.
- `staff` se asigna administrativamente.
- Las rutas Staff deben validar JWT/grupo en backend; ocultarlas en React no es autorización suficiente.
- DynamoDB TTL solo limpia holds expirados; la lógica debe validar `expiresAt` en cada request.

## Próxima fase
Implementar los diseños Figma completos, Cognito real, hold atómico de 5 minutos, slots/histograma, QR opaco, pagos simulados y validación Staff.
