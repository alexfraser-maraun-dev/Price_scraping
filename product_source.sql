WITH RECURSIVE 
-- 1️⃣ GET DEDUPLICATED SALES (Past 3 Months)
latest_sale_headers AS (
  SELECT CAST(id AS INT64) AS sale_id, DATE(complete_time, 'America/Los_Angeles') AS sale_date
  FROM `bici-klaviyo-datasync.light_speed_retailne.sale_history`
  WHERE completed = true 
    AND voided = false     
    AND DATE(complete_time, 'America/Los_Angeles') >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL 3 MONTH)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
),
latest_sale_lines AS (
  SELECT 
    CAST(sale_id AS INT64) AS sale_id, 
    CAST(item_id AS INT64) AS item_id, 
    calc_subtotal AS line_revenue,
    
    -- Calculate the exact Margin PERCENTAGE for this specific transaction
    SAFE_DIVIDE(
      (calc_subtotal - (unit_quantity * COALESCE(fifo_cost, avg_cost, 0))), 
      calc_subtotal
    ) AS transaction_margin_pct
    
  FROM `bici-klaviyo-datasync.light_speed_retailne.sale_line_history`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
),
recent_sales AS (
  SELECT
    l.item_id,
    SUM(l.line_revenue) AS total_revenue,
    
    -- Take the Simple Average of all the transaction margins for this SKU
    AVG(l.transaction_margin_pct) AS avg_sku_margin_pct
    
  FROM latest_sale_headers h
  JOIN latest_sale_lines l ON h.sale_id = l.sale_id
  GROUP BY l.item_id
),

-- 2️⃣ CATEGORY HIERARCHY
clean_categories AS (
  SELECT CAST(id AS INT64) AS category_id, CAST(parent_id AS INT64) AS parent_id, name AS category_name
  FROM `bici-klaviyo-datasync.light_speed_retailne.category_history`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
),
category_paths AS (
  SELECT
    category_id AS target_id,
    category_id AS current_id,
    parent_id,
    category_name,
    1 AS depth_from_bottom
  FROM clean_categories
  
  UNION ALL
  
  SELECT
    cp.target_id,
    p.category_id,
    p.parent_id,
    p.category_name,
    cp.depth_from_bottom + 1
  FROM category_paths cp
  JOIN clean_categories p ON cp.parent_id = p.category_id
  WHERE cp.depth_from_bottom < 10
),
flat_categories AS (
  SELECT
    target_id AS category_id,
    ARRAY_AGG(category_name ORDER BY depth_from_bottom DESC) AS cat_array
  FROM category_paths
  GROUP BY target_id
),

-- 3️⃣ GET CURRENT ITEM DETAILS 
latest_item_info AS (
  SELECT
    id AS item_id,
    category_id,
    manufacturer_id,
    description,
    upc,
    system_sku,
    custom_sku
  FROM `bici-klaviyo-datasync.light_speed_retailne.item_history`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
),

-- 4️⃣ GET BRAND / MANUFACTURER NAME
latest_brands AS (
  SELECT
    CAST(id AS INT64) AS manufacturer_id,
    name AS brand_name
  FROM `bici-klaviyo-datasync.light_speed_retailne.manufacturer_history`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
),

-- 5️⃣ GET CURRENT DEFAULT PRICE
current_pricing AS (
  SELECT
    item_id,
    CAST(amount AS FLOAT64) AS current_default_price
  FROM `bici-klaviyo-datasync.light_speed_retailne.item_price_history`
  WHERE use_type = 'Default'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY item_updated_time DESC) = 1
)

-- 🏆 FINAL SELECT & RANKING
SELECT
  s.item_id, -- 🔑 NEW COLUMN: Added the primary item ID for API write-backs
  
  b.brand_name,
  i.description AS product_name,
  i.upc,
  i.system_sku,
  i.custom_sku,
  
  -- Categories
  fc.cat_array[SAFE_OFFSET(0)] AS category_main,
  fc.cat_array[SAFE_OFFSET(1)] AS subcategory_1,
  fc.cat_array[SAFE_OFFSET(2)] AS subcategory_2,
  
  p.current_default_price,
  s.total_revenue,
  
  -- Format the simple average as a clean percentage (e.g., 42.5)
  ROUND(s.avg_sku_margin_pct * 100, 1) AS avg_margin_pct
  
FROM recent_sales s
LEFT JOIN latest_item_info i ON s.item_id = i.item_id
LEFT JOIN latest_brands b ON i.manufacturer_id = b.manufacturer_id
LEFT JOIN current_pricing p ON s.item_id = p.item_id
LEFT JOIN flat_categories fc ON i.category_id = fc.category_id

WHERE s.item_id IS NOT NULL
  AND i.upc IS NOT NULL 
  AND TRIM(i.upc) != ''

ORDER BY s.total_revenue DESC
LIMIT 1000;
