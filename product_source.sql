WITH RECURSIVE

-- ============================================================
-- SHARED LOOKUPS
-- ============================================================

latest_item_info AS (
  SELECT
    CAST(id AS INT64)         AS item_id,
    CAST(system_sku AS INT64) AS system_sku,
    custom_sku,
    description,
    upc,
    category_id,
    manufacturer_id,
    CAST(avg_cost AS FLOAT64) AS current_cost
  FROM `bici-klaviyo-datasync.light_speed_retailne.item_history`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
),

-- Category hierarchy (recursive walk up the tree)
clean_categories AS (
  SELECT
    CAST(id        AS INT64) AS category_id,
    CAST(parent_id AS INT64) AS parent_id,
    name AS category_name
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

latest_brands AS (
  SELECT
    CAST(id AS INT64) AS manufacturer_id,
    name AS brand_name
  FROM `bici-klaviyo-datasync.light_speed_retailne.manufacturer_history`
  QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_time DESC) = 1
),

current_pricing AS (
  SELECT
    item_id,
    CAST(amount AS FLOAT64) AS current_default_price
  FROM `bici-klaviyo-datasync.light_speed_retailne.item_price_history`
  WHERE use_type = 'Default'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY item_updated_time DESC) = 1
),

-- ============================================================
-- SOURCE 1: sales_master_view  →  BUCKETS 1, 2, 5, 6  (weekly)
-- ============================================================

weekly_sales_raw AS (
  SELECT
    system_sku,
    SUM(units_sold)   AS weekly_units,
    SUM(revenue)      AS weekly_revenue,
    SUM(gross_profit) AS weekly_gross_profit
  FROM `bici-klaviyo-datasync.light_speed_retailne.sales_master_view`
  WHERE sale_date >= DATE_SUB(CURRENT_DATE('America/Los_Angeles'), INTERVAL 7 DAY)
  GROUP BY system_sku
),

-- Attach item metadata & UPC filter
weekly_sales AS (
  SELECT
    w.system_sku,
    w.weekly_units,
    w.weekly_revenue,
    w.weekly_gross_profit,
    -- Margin as a ratio (0–1)
    SAFE_DIVIDE(w.weekly_gross_profit, w.weekly_revenue) AS weekly_margin
  FROM weekly_sales_raw w
  JOIN latest_item_info i ON w.system_sku = i.system_sku
  WHERE i.upc IS NOT NULL
    AND TRIM(i.upc) != ''
),

-- Bucket 1: Top 200 by weekly volume
bucket_1 AS (
  SELECT system_sku, 'top_200_weekly_volume' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY weekly_units DESC) AS rnk
    FROM weekly_sales
  )
  WHERE rnk <= 200
),

-- Bucket 2: Top 200 by weekly revenue
bucket_2 AS (
  SELECT system_sku, 'top_200_weekly_revenue' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY weekly_revenue DESC) AS rnk
    FROM weekly_sales
  )
  WHERE rnk <= 200
),

-- Bucket 5: Top 200 highest-margin products (weekly)
bucket_5 AS (
  SELECT system_sku, 'top_200_highest_margin_weekly' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY weekly_margin DESC NULLS LAST) AS rnk
    FROM weekly_sales
    WHERE weekly_revenue > 0
  )
  WHERE rnk <= 200
),

-- Bucket 6: Top 200 lowest-margin products (weekly)
bucket_6 AS (
  SELECT system_sku, 'top_200_lowest_margin_weekly' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY weekly_margin ASC NULLS LAST) AS rnk
    FROM weekly_sales
    WHERE weekly_revenue > 0
  )
  WHERE rnk <= 200
),

-- ============================================================
-- SOURCE 2: abc grading snapshot  →  BUCKETS 3, 4, 7, 8
-- ============================================================

abc_base AS (
  SELECT
    a.lightspeed_item_number AS item_id,
    a.sku_current_margin,
    a.sku_cost_on_hand,
    a.sku_last_30d_sales_dollars,
    a.sku_last_30d_sales_units,
    a.sku_quantity_on_hand,

    -- 30d GMROI = (30d gross profit annualised) / inventory cost on hand
    -- Gross profit proxy: sales_dollars × current_margin
    -- Annualise by ×12 to get a standard yearly GMROI figure
    SAFE_DIVIDE(
      a.sku_last_30d_sales_dollars * a.sku_current_margin * 12,
      a.sku_cost_on_hand
    ) AS gmroi_30d,

    -- 30d Sellthrough = units sold / (units sold + units on hand)
    SAFE_DIVIDE(
      a.sku_last_30d_sales_units,
      a.sku_last_30d_sales_units + a.sku_quantity_on_hand
    ) AS sellthrough_30d,

    i.system_sku
  FROM `bici-klaviyo-datasync.light_speed_retailne.v_lightspeed_abc_combined_grading_snapshot` a
  JOIN latest_item_info i ON a.lightspeed_item_number = i.item_id
  WHERE i.upc IS NOT NULL
    AND TRIM(i.upc) != ''
),

-- Bucket 3: Top 200 profitable SKUs by 30d GMROI (highest → lowest)
bucket_3 AS (
  SELECT system_sku, 'top_200_gmroi_30d_high' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY gmroi_30d DESC NULLS LAST) AS rnk
    FROM abc_base
    WHERE gmroi_30d > 0
      AND sku_cost_on_hand > 0
  )
  WHERE rnk <= 200
),

-- Bucket 4: Bottom 200 profitable SKUs by 30d GMROI (lowest positive → higher)
bucket_4 AS (
  SELECT system_sku, 'bottom_200_gmroi_30d_profitable' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY gmroi_30d ASC NULLS LAST) AS rnk
    FROM abc_base
    WHERE gmroi_30d > 0
      AND sku_cost_on_hand > 0
  )
  WHERE rnk <= 200
),

-- Bucket 7: Top 200 by 30d sellthrough (highest → lowest)
bucket_7 AS (
  SELECT system_sku, 'top_200_sellthrough_30d_high' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY sellthrough_30d DESC NULLS LAST) AS rnk
    FROM abc_base
    WHERE sellthrough_30d IS NOT NULL
  )
  WHERE rnk <= 200
),

-- Bucket 8: Bottom 200 by 30d sellthrough (lowest → highest, slow-but-not-dead only)
bucket_8 AS (
  SELECT system_sku, 'bottom_200_sellthrough_30d_low' AS bucket
  FROM (
    SELECT system_sku,
           ROW_NUMBER() OVER (ORDER BY sellthrough_30d ASC NULLS LAST) AS rnk
    FROM abc_base
    WHERE sellthrough_30d IS NOT NULL
      AND sku_last_30d_sales_units > 0  -- exclude items with zero 30d sales
  )
  WHERE rnk <= 200
),

-- ============================================================
-- UNION ALL 8 BUCKETS → DEDUPLICATE BY system_sku
-- ============================================================

all_buckets AS (
  SELECT system_sku, bucket FROM bucket_1
  UNION ALL
  SELECT system_sku, bucket FROM bucket_2
  UNION ALL
  SELECT system_sku, bucket FROM bucket_3
  UNION ALL
  SELECT system_sku, bucket FROM bucket_4
  UNION ALL
  SELECT system_sku, bucket FROM bucket_5
  UNION ALL
  SELECT system_sku, bucket FROM bucket_6
  UNION ALL
  SELECT system_sku, bucket FROM bucket_7
  UNION ALL
  SELECT system_sku, bucket FROM bucket_8
),

-- One row per SKU; aggregate the bucket labels for reference
deduped AS (
  SELECT
    system_sku,
    STRING_AGG(DISTINCT bucket ORDER BY bucket) AS qualifying_buckets
  FROM all_buckets
  GROUP BY system_sku
)

-- ============================================================
-- FINAL SELECT  (schema-compatible with prior version)
-- ============================================================
SELECT
  i.item_id,
  b.brand_name,
  i.description              AS product_name,
  i.upc,
  i.system_sku,
  i.custom_sku,

  -- Category hierarchy
  fc.cat_array[SAFE_OFFSET(0)] AS category_main,
  fc.cat_array[SAFE_OFFSET(1)] AS subcategory_1,
  fc.cat_array[SAFE_OFFSET(2)] AS subcategory_2,

  -- Financial baseline
  i.current_cost,
  p.current_default_price,

  -- Weekly revenue (replaces the old 3-month total_revenue)
  COALESCE(w.weekly_revenue, 0) AS total_revenue,
  COALESCE(w.weekly_units,   0) AS weekly_units,

  -- Prospective margin: (Price − Cost) / Price
  ROUND(
    SAFE_DIVIDE(
      (p.current_default_price - i.current_cost),
       p.current_default_price
    ) * 100,
  1) AS prospective_margin_pct,

  -- Which buckets this SKU qualified through
  d.qualifying_buckets

FROM deduped d
JOIN latest_item_info i    ON d.system_sku = i.system_sku
LEFT JOIN latest_brands b  ON i.manufacturer_id = b.manufacturer_id
LEFT JOIN current_pricing p ON i.item_id = p.item_id
LEFT JOIN flat_categories fc ON i.category_id = fc.category_id
LEFT JOIN weekly_sales w    ON d.system_sku = w.system_sku

-- Guarantee exactly one row per system_sku (matrix variants can share a system_sku)
QUALIFY ROW_NUMBER() OVER (PARTITION BY d.system_sku ORDER BY i.item_id ASC) = 1

ORDER BY i.system_sku;
