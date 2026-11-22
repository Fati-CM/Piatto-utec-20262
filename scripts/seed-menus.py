import json
import subprocess

DATE = "2026-11-23"
TABLE = "piatto-dev-menus"

menus = [
    {
        "menuId": "eco",
        "category": "Económico",
        "priceMinor": 1060,
        "options": [
            {
                "id": "eco-1",
                "dishId": "olluquito-pollo",
                "name": "Olluquito de pollo con arroz",
                "stock": 20
            }
        ]
    },
    {
        "menuId": "est",
        "category": "Estudiantil",
        "priceMinor": 1360,
        "options": [
            {
                "id": "est-1",
                "dishId": "chicharron-pescado",
                "name": "Chicharrón de pescado con lentejas y arroz",
                "stock": 20
            },
            {
                "id": "est-2",
                "dishId": "pollo-horno",
                "name": "Pollo al horno con ensalada rusa y arroz",
                "stock": 20
            }
        ]
    },
    {
        "menuId": "eje",
        "category": "Ejecutivo",
        "priceMinor": 1540,
        "options": [
            {
                "id": "eje-1",
                "dishId": "lomo-saltado",
                "name": "Lomo saltado con papas fritas y arroz",
                "stock": 20
            }
        ]
    },
    {
        "menuId": "sal",
        "category": "Saludable",
        "priceMinor": 1710,
        "options": [
            {
                "id": "sal-1",
                "dishId": "pollo-plancha",
                "name": "Pollo a la plancha con papa y ensalada",
                "stock": 20
            }
        ]
    }
]

def dynamo(value):
    if isinstance(value, str):
        return {"S": value}
    if isinstance(value, int):
        return {"N": str(value)}
    if isinstance(value, list):
        return {"L": [dynamo(item) for item in value]}
    if isinstance(value, dict):
        return {"M": {key: dynamo(item) for key, item in value.items()}}
    raise TypeError(type(value))

for menu in menus:
    menu.update({
        "serviceDate": DATE,
        "status": "PUBLISHED",
        "currency": "PEN",
        "dataSource": "DEMO",
        "description": " / ".join(
            option["name"] for option in menu["options"]
        )
    })

    subprocess.run([
        "aws", "dynamodb", "put-item",
        "--table-name", TABLE,
        "--item", json.dumps({
            key: dynamo(value) for key, value in menu.items()
        }),
        "--condition-expression", "attribute_not_exists(menuId)",
        "--region", "us-east-1",
        "--no-cli-pager"
    ], check=True)

    print(f'Guardado: {menu["category"]}')

print("Carga completada.")
