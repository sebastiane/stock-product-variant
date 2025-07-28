const axios = require("axios");

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;

// Ahora es un arreglo. Añade todos los IDs de las sucursales que quieras incluir.
const TARGET_LOCATION_IDS = ["72297939025", "68711448657", "62973509713"];

exports.handler = async (event) => {
  const variantId = event.queryStringParameters.variant_id;

  if (!variantId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Falta el variant_id" }),
    };
  }

  const variantApiUrl = `https://${SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2024-07/variants/${variantId}.json`;

  try {
    // Paso A: Obtener el inventory_item_id de la variante
    const variantResponse = await axios.get(variantApiUrl, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    const inventoryItemId = variantResponse.data.variant.inventory_item_id;

    if (!inventoryItemId) {
      throw new Error("No se encontró el inventory_item_id para la variante.");
    }

    // Paso B: Usar el inventory_item_id para obtener los niveles de stock
    const inventoryApiUrl = `https:////${SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2024-07/inventory_levels.json?inventory_item_ids=${inventoryItemId}`;

    const inventoryResponse = await axios.get(inventoryApiUrl, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    let totalSpecificStock = 0;
    if (inventoryResponse.data && inventoryResponse.data.inventory_levels) {
      // *** CAMBIO PRINCIPAL: Filtrar por el arreglo de sucursales y sumar el stock ***

      // 1. Filtramos para quedarnos solo con las sucursales que están en nuestro arreglo
      const targetLevels = inventoryResponse.data.inventory_levels.filter(
        (level) => TARGET_LOCATION_IDS.includes(level.location_id.toString())
      );

      // 2. Sumamos el stock de las sucursales filtradas
      if (targetLevels.length > 0) {
        totalSpecificStock = targetLevels.reduce(
          (sum, level) => sum + (level.available || 0),
          0
        );
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        variant: variantId,
        stock: totalSpecificStock, // Devolvemos el stock sumado de las sucursales específicas
      }),
    };
  } catch (error) {
    console.error("Error al llamar a la API de Shopify:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "No se pudo obtener el inventario.",
        details: error.message,
      }),
    };
  }
};
